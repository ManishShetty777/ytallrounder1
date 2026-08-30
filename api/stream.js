// Vercel Serverless Function - Production Media Stream & Extraction Prober
// Multi-Tier Fallback Chain: Authenticated YTDL -> YouTubei.js (TV/Embedded) -> Hosted Cobalt API

const ytdl = require('@distube/ytdl-core');

function parseCookies(cookieInput) {
  if (!cookieInput) return null;
  const str = cookieInput.trim();
  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {}
  }
  const cookies = [];
  const parts = str.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      cookies.push({
        name: trimmed.substring(0, eqIdx).trim(),
        value: trimmed.substring(eqIdx + 1).trim(),
        domain: '.youtube.com',
        path: '/'
      });
    }
  }
  return cookies.length > 0 ? cookies : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const videoID = (req.query.id || req.query.v || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  const type = req.query.type || 'audio'; // audio | video | videoonly
  const quality = req.query.quality || (type === 'audio' ? '192' : '1080');

  if (!videoID || videoID.length !== 11) {
    return res.status(400).json({
      success: false,
      code: 400,
      reason: 'INVALID_VIDEO_ID',
      error: 'Invalid YouTube Video ID. Must be an 11-character identifier.'
    });
  }

  const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;
  console.log(`[API /stream] Probing video ${videoID} (type: ${type}, quality: ${quality})`);

  let lastError = null;

  // ----------------------------------------------------
  // TIER 1: Authenticated @distube/ytdl-core (Session Cookies)
  // ----------------------------------------------------
  try {
    const cookieEnv = process.env.YOUTUBE_COOKIE || process.env.COOKIE || '';
    const parsedCookies = parseCookies(cookieEnv);
    let agent = undefined;

    if (parsedCookies) {
      try {
        agent = ytdl.createAgent(parsedCookies);
        console.log(`[API /stream] Tier 1: Initialized agent with ${parsedCookies.length} session cookies`);
      } catch (agentErr) {
        console.warn('[API /stream] Tier 1 agent creation error:', agentErr.message);
      }
    }

    const info = await ytdl.getInfo(ytUrl, {
      agent,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      }
    });

    const filter = type === 'audio' ? 'audioonly' : type === 'videoonly' ? 'videoonly' : 'audioandvideo';
    const qualityOpt = type === 'audio' ? 'highestaudio' : 'highest';
    const format = ytdl.chooseFormat(info.formats, { filter, quality: qualityOpt });

    if (format) {
      console.log(`[API /stream] Tier 1 SUCCESS: Extracted format (itag: ${format.itag})`);
      return res.status(200).json({
        success: true,
        title: info.videoDetails?.title || 'YouTube Video',
        author: info.videoDetails?.author?.name || 'YouTube Creator',
        duration: info.videoDetails?.lengthSeconds || 0,
        format: {
          itag: format.itag,
          mimeType: format.mimeType,
          quality: format.qualityLabel || format.audioBitrate + 'kbps'
        },
        provider: 'ytdl-core' + (parsedCookies ? '-authenticated' : '')
      });
    }
  } catch (t1Err) {
    lastError = t1Err;
    console.warn('[API /stream] Tier 1 (ytdl-core) failed:', t1Err.message);
  }

  // ----------------------------------------------------
  // TIER 2: YouTube.js (InnerTube TV / Embedded Client Context)
  // ----------------------------------------------------
  try {
    const { Innertube, UniversalCache, ClientType } = require('youtubei.js');
    const yt = await Innertube.create({
      cache: new UniversalCache(false),
      client_type: ClientType.TV_EMBEDDED,
      retrieve_player: true
    });

    const info = await yt.getInfo(videoID);
    const formats = info.streaming_data?.adaptive_formats || [];
    const targetFormat = type === 'audio'
      ? formats.find(f => f.has_audio && !f.has_video)
      : formats.find(f => f.has_video);

    if (targetFormat) {
      console.log(`[API /stream] Tier 2 SUCCESS: YouTubei.js found format (itag: ${targetFormat.itag})`);
      return res.status(200).json({
        success: true,
        title: info.basic_info?.title || 'YouTube Video',
        author: info.basic_info?.author || 'YouTube Creator',
        duration: info.basic_info?.duration || 0,
        format: {
          itag: targetFormat.itag,
          mimeType: targetFormat.mime_type,
          quality: targetFormat.quality_label || 'Audio'
        },
        provider: 'youtubei.js-tv'
      });
    }
  } catch (t2Err) {
    lastError = t2Err;
    console.warn('[API /stream] Tier 2 (youtubei.js) failed:', t2Err.message);
  }

  // ----------------------------------------------------
  // TIER 3: Hosted Cobalt API Endpoint
  // ----------------------------------------------------
  const cobaltBase = process.env.COBALT_API_URL || 'https://api.cobalt.tools';
  try {
    const cobaltHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (process.env.COBALT_API_KEY) {
      cobaltHeaders['Authorization'] = `Bearer ${process.env.COBALT_API_KEY}`;
    }

    const cobaltRes = await fetch(cobaltBase, {
      method: 'POST',
      headers: cobaltHeaders,
      body: JSON.stringify({
        url: ytUrl,
        downloadMode: type === 'audio' ? 'audio' : 'auto',
        audioFormat: 'mp3',
        videoQuality: quality === '1080' ? '1080' : quality === '720' ? '720' : 'auto'
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (cobaltRes.ok) {
      const cobaltData = await cobaltRes.json();
      if (cobaltData.url || cobaltData.status === 'redirect' || cobaltData.status === 'tunnel') {
        console.log('[API /stream] Tier 3 SUCCESS: Cobalt resolved media URL');
        return res.status(200).json({
          success: true,
          title: cobaltData.filename || 'YouTube Download',
          author: 'YouTube Creator',
          format: {
            quality: quality + (type === 'audio' ? 'kbps' : 'p')
          },
          provider: 'cobalt-api'
        });
      }
    }
  } catch (t3Err) {
    lastError = t3Err;
    console.warn('[API /stream] Tier 3 (Cobalt) failed:', t3Err.message);
  }

  // ----------------------------------------------------
  // DIAGNOSTIC ERROR HANDLER
  // ----------------------------------------------------
  const errMsg = lastError?.message || 'Extraction pipeline failed';
  let statusCode = 503;
  let reason = 'EXTRACTOR_BLOCKED';
  let userFriendlyError = 'Extraction service temporarily unavailable. Please retry in a few moments.';

  if (errMsg.includes('429') || errMsg.includes('Sign in to confirm you\'re not a bot') || errMsg.includes('bot')) {
    statusCode = 429;
    reason = 'YOUTUBE_BOT_DETECTION';
    userFriendlyError = 'YouTube bot protection temporarily blocked this datacenter request. Set YOUTUBE_COOKIE in your Vercel Project Settings to enable 100% continuous extraction.';
  } else if (errMsg.includes('404') || errMsg.includes('Video unavailable') || errMsg.includes('not found')) {
    statusCode = 404;
    reason = 'VIDEO_NOT_FOUND';
    userFriendlyError = 'This YouTube video was not found or has been removed.';
  } else if (errMsg.includes('403') || errMsg.includes('private video')) {
    statusCode = 403;
    reason = 'FORBIDDEN_OR_AGE_RESTRICTED';
    userFriendlyError = 'This video is private, age-restricted, or region-restricted by YouTube.';
  } else if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
    statusCode = 408;
    reason = 'TIMEOUT';
    userFriendlyError = 'The extraction request timed out. Please retry.';
  }

  return res.status(statusCode).json({
    success: false,
    code: statusCode,
    reason,
    error: userFriendlyError,
    details: errMsg.substring(0, 180),
    videoID
  });
};
