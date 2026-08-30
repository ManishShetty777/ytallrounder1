// Vercel Serverless Function - Resolve Media Stream URL Endpoint
// Resolves the direct media URL and returns JSON { downloadUrl, filename, mimeType }
// Avoids function timeouts by letting the client browser download directly from the resolved CDN

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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const videoID = (req.query.id || req.query.v || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  const type = req.query.type || 'audio'; // audio | video | videoonly
  const quality = req.query.quality || (type === 'audio' ? '192' : '1080');
  const rawTitle = req.query.title || 'YouTube_Download';

  if (!videoID || videoID.length !== 11) {
    return res.status(400).json({
      success: false,
      error: 'Invalid YouTube Video ID. Must be 11 characters.',
      code: 400
    });
  }

  const cleanTitle = rawTitle.replace(/[^\w\s.-]/gi, '').trim().replace(/\s+/g, '_').substring(0, 80) || `media_${videoID}`;
  const ext = type === 'audio' ? 'mp3' : 'mp4';
  const mimeType = type === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const filename = cleanTitle.toLowerCase().endsWith(`.${ext}`) ? cleanTitle : `${cleanTitle}.${ext}`;

  const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;
  console.log(`[API /download] Resolving direct download URL for ${videoID} (${type}, ${quality})`);

  let lastError = null;

  // ----------------------------------------------------
  // TIER 1: Authenticated @distube/ytdl-core Format URL Resolution
  // ----------------------------------------------------
  try {
    const cookieEnv = process.env.YOUTUBE_COOKIE || process.env.COOKIE || '';
    const parsedCookies = parseCookies(cookieEnv);
    let agent = undefined;

    if (parsedCookies) {
      try {
        agent = ytdl.createAgent(parsedCookies);
        console.log(`[API /download] Tier 1: Agent initialized with ${parsedCookies.length} session cookies`);
      } catch (agentErr) {
        console.warn('[API /download] Tier 1 agent error:', agentErr.message);
      }
    } else {
      console.warn('[API /download] YOUTUBE_COOKIE is unset in environment variables; running anonymous Tier 1 request');
    }

    const filter = type === 'audio' ? 'audioonly' : type === 'videoonly' ? 'videoonly' : 'audioandvideo';
    const qualityOpt = type === 'audio' ? 'highestaudio' : 'highest';

    const info = await ytdl.getInfo(ytUrl, {
      agent,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      }
    });

    const format = ytdl.chooseFormat(info.formats, { filter, quality: qualityOpt });
    if (format && format.url) {
      console.log(`[API /download] Tier 1 SUCCESS: Resolved direct URL for itag ${format.itag}`);
      return res.status(200).json({
        success: true,
        downloadUrl: format.url,
        filename,
        mimeType,
        format: {
          itag: format.itag,
          quality: format.qualityLabel || format.audioBitrate + 'kbps',
          contentLength: format.contentLength || null
        },
        provider: 'ytdl-core' + (parsedCookies ? '-authenticated' : '')
      });
    }
  } catch (t1Err) {
    lastError = t1Err;
    console.warn('[API /download] Tier 1 (ytdl-core) failed:', t1Err.message);
  }

  // ----------------------------------------------------
  // TIER 2: YouTube.js Dynamic ESM Import (TV Context URL Resolution)
  // ----------------------------------------------------
  try {
    const { Innertube, UniversalCache, ClientType } = await import('youtubei.js');
    const yt = await Innertube.create({
      cache: new UniversalCache(false),
      client_type: ClientType.TV,
      generate_session_locally: true,
      retrieve_player: true
    });

    const info = await yt.getInfo(videoID);
    const streamingData = info?.streaming_data;
    if (streamingData) {
      const formats = [
        ...(Array.isArray(streamingData.formats) ? streamingData.formats : []),
        ...(Array.isArray(streamingData.adaptive_formats) ? streamingData.adaptive_formats : [])
      ];

      const targetFormat = type === 'audio'
        ? formats.find(f => f?.has_audio && !f?.has_video) || formats.find(f => f?.has_audio)
        : formats.find(f => f?.has_video && f?.has_audio) || formats.find(f => f?.has_video);

      if (targetFormat) {
        let streamUrl = targetFormat.url;
        if (!streamUrl && typeof targetFormat.decipher === 'function') {
          try {
            streamUrl = await targetFormat.decipher(yt.session.player);
          } catch (dErr) {}
        }

        if (streamUrl && typeof streamUrl === 'string') {
          console.log(`[API /download] Tier 2 SUCCESS: Resolved Innertube URL for itag ${targetFormat.itag}`);
          return res.status(200).json({
            success: true,
            downloadUrl: streamUrl,
            filename,
            mimeType,
            format: {
              itag: targetFormat.itag,
              quality: targetFormat.quality_label || targetFormat.quality || 'Audio'
            },
            provider: 'youtubei.js-tv'
          });
        }
      }
    }
  } catch (t2Err) {
    lastError = t2Err;
    console.warn('[API /download] Tier 2 (youtubei.js) failed:', t2Err.message);
  }

  // ----------------------------------------------------
  // TIER 3: Hosted Cobalt API Endpoint (Env-Var Only)
  // ----------------------------------------------------
  const cobaltBase = process.env.COBALT_API_URL || null;
  if (cobaltBase) {
    try {
      const cobaltHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      };
      if (process.env.COBALT_API_KEY) {
        cobaltHeaders['Authorization'] = `Api-Key ${process.env.COBALT_API_KEY}`;
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
        let mediaUrl = null;
        if (cobaltData?.url) mediaUrl = cobaltData.url;
        else if (cobaltData?.tunnel) mediaUrl = Array.isArray(cobaltData.tunnel) ? cobaltData.tunnel[0] : cobaltData.tunnel;
        else if (cobaltData?.output?.url) mediaUrl = cobaltData.output.url;
        else if (typeof cobaltData?.output === 'string') mediaUrl = cobaltData.output;
        else if (cobaltData?.picker && Array.isArray(cobaltData.picker) && cobaltData.picker[0]?.url) mediaUrl = cobaltData.picker[0].url;

        if (mediaUrl) {
          console.log('[API /download] Tier 3 SUCCESS: Resolved Cobalt media URL');
          return res.status(200).json({
            success: true,
            downloadUrl: mediaUrl,
            filename,
            mimeType,
            format: {
              quality: quality + (type === 'audio' ? 'kbps' : 'p')
            },
            provider: 'cobalt-api'
          });
        }
      }
    } catch (t3Err) {
      lastError = t3Err;
      console.warn('[API /download] Tier 3 (Cobalt) failed:', t3Err.message);
    }
  }

  // ----------------------------------------------------
  // Diagnostic Error Response
  // ----------------------------------------------------
  const errMsg = lastError?.message || 'Download URL resolution failed';
  let statusCode = 503;
  let userFriendlyError = 'Extraction service temporarily unavailable. Please retry in a few moments.';

  if (errMsg.includes('429') || errMsg.includes('Sign in to confirm you\'re not a bot') || errMsg.includes('bot')) {
    statusCode = 429;
    userFriendlyError = 'YouTube bot protection temporarily blocked this datacenter request. Set YOUTUBE_COOKIE in Vercel environment variables to enable 100% continuous extraction.';
  } else if (errMsg.includes('404') || errMsg.includes('Video unavailable')) {
    statusCode = 404;
    userFriendlyError = 'This video is unavailable or has been deleted from YouTube.';
  } else if (errMsg.includes('403') || errMsg.includes('private video')) {
    statusCode = 403;
    userFriendlyError = 'This video is private, age-restricted, or region-restricted.';
  }

  return res.status(statusCode).json({
    success: false,
    error: userFriendlyError,
    code: statusCode,
    details: errMsg.substring(0, 180),
    videoID
  });
};
