// Vercel Serverless Function - Resolve Media Download URL Endpoint
// Extraction Priority:
// Tier 1: youtubei.js (ANDROID / TV_EMBEDDED Client without cookies)
// Tier 2: @distube/ytdl-core (Authenticated with YOUTUBE_COOKIE)
// Tier 3: Hosted Cobalt API (if COBALT_API_URL is configured)

const ytdl = require('@distube/ytdl-core');

let cachedInnertube = null;

async function getInnertube(clientType) {
  const { Innertube, UniversalCache, ClientType } = await import('youtubei.js');
  const targetClient = clientType || ClientType.ANDROID;
  
  if (cachedInnertube && cachedInnertube.session?.client_type === targetClient) {
    return cachedInnertube;
  }

  cachedInnertube = await Innertube.create({
    cache: new UniversalCache(false),
    client_type: targetClient,
    generate_session_locally: true,
    retrieve_player: true
  });
  return cachedInnertube;
}

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
      error: 'Invalid YouTube Video ID. Must be an 11-character identifier.',
      code: 400
    });
  }

  const cleanTitle = rawTitle.replace(/[^\w\s.-]/gi, '').trim().replace(/\s+/g, '_').substring(0, 80) || `media_${videoID}`;
  const ext = type === 'audio' ? 'mp3' : 'mp4';
  const mimeType = type === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const filename = cleanTitle.toLowerCase().endsWith(`.${ext}`) ? cleanTitle : `${cleanTitle}.${ext}`;

  const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;
  console.log(`[API /download] Resolving download URL for ${videoID} (${type}, ${quality})`);

  const tierErrors = [];

  // ----------------------------------------------------
  // TIER 1 (PRIMARY): youtubei.js (ANDROID / TV_EMBEDDED context without cookies)
  // ----------------------------------------------------
  try {
    const { ClientType } = await import('youtubei.js');
    const clientCandidates = [ClientType.ANDROID, ClientType.TV_EMBEDDED];

    for (const clientType of clientCandidates) {
      try {
        console.log(`[API /download] Tier 1: Trying youtubei.js with ${clientType} context...`);
        const yt = await getInnertube(clientType);
        const info = await yt.getBasicInfo(videoID);

        if (!info) throw new Error('Empty response from Innertube');

        const streamingData = info.streaming_data;
        if (!streamingData) {
          const status = info.playability_status?.status || 'UNKNOWN';
          const reason = info.playability_status?.reason || 'No streaming data';
          throw new Error(`Streaming data unavailable (${status}: ${reason})`);
        }

        const formats = [
          ...(Array.isArray(streamingData.formats) ? streamingData.formats : []),
          ...(Array.isArray(streamingData.adaptive_formats) ? streamingData.adaptive_formats : [])
        ];

        if (formats.length === 0) throw new Error('Formats array is empty');

        const targetFormat = type === 'audio'
          ? formats.find(f => f?.has_audio && !f?.has_video) || formats.find(f => f?.has_audio)
          : formats.find(f => f?.has_video && f?.has_audio) || formats.find(f => f?.has_video);

        if (targetFormat) {
          let resolvedUrl = targetFormat.url;
          if (!resolvedUrl && typeof targetFormat.decipher === 'function') {
            try {
              resolvedUrl = await targetFormat.decipher(yt.session.player);
            } catch (dErr) {
              console.warn(`[API /download] Tier 1 decipher warning: ${dErr.message}`);
            }
          }

          if (resolvedUrl && typeof resolvedUrl === 'string') {
            console.log(`[API /download] Tier 1 SUCCESS (${clientType}): itag ${targetFormat.itag}`);
            return res.status(200).json({
              success: true,
              downloadUrl: resolvedUrl,
              filename,
              mimeType,
              format: {
                itag: targetFormat.itag,
                quality: targetFormat.quality_label || targetFormat.quality || 'Audio'
              },
              provider: `youtubei.js-${clientType.toLowerCase()}`
            });
          }
        }
      } catch (clientErr) {
        console.warn(`[API /download] Tier 1 (${clientType}) attempt failed: ${clientErr.message}`);
      }
    }
    throw new Error('youtubei.js failed to resolve a playable direct URL on both ANDROID and TV_EMBEDDED clients.');
  } catch (t1Err) {
    console.error('[API /download] Tier 1 RAW ERROR:', t1Err.message);
    tierErrors.push({ tier: 'youtubei.js', message: t1Err.message });
  }

  // ----------------------------------------------------
  // TIER 2 (BACKUP): @distube/ytdl-core (Authenticated with YOUTUBE_COOKIE)
  // ----------------------------------------------------
  try {
    console.log('[API /download] Tier 2: Trying @distube/ytdl-core fallback...');
    const cookieEnv = process.env.YOUTUBE_COOKIE || process.env.COOKIE || '';
    const parsedCookies = parseCookies(cookieEnv);
    let agent = undefined;

    if (parsedCookies) {
      try {
        agent = ytdl.createAgent(parsedCookies);
        console.log(`[API /download] Tier 2: Agent initialized with ${parsedCookies.length} session cookies`);
      } catch (agentErr) {
        console.warn('[API /download] Tier 2 agent error:', agentErr.message);
      }
    } else {
      console.warn('[API /download] Tier 2: YOUTUBE_COOKIE is unset; running unauthenticated ytdl-core');
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

    if (!info || !Array.isArray(info.formats)) {
      throw new Error('YTDL did not return a valid formats array');
    }

    const format = ytdl.chooseFormat(info.formats, { filter, quality: qualityOpt });
    if (format && format.url) {
      console.log(`[API /download] Tier 2 SUCCESS: itag ${format.itag}`);
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
    throw new Error('ytdl-core could not find a playable format matching request');
  } catch (t2Err) {
    console.error('[API /download] Tier 2 RAW ERROR:', t2Err.message);
    tierErrors.push({ tier: 'ytdl-core', message: t2Err.message });
  }

  // ----------------------------------------------------
  // TIER 3 (HOSTED FALLBACK): Cobalt API (Env-Var Only)
  // ----------------------------------------------------
  const cobaltBase = process.env.COBALT_API_URL || null;
  if (!cobaltBase) {
    console.warn('[API /download] Tier 3: COBALT_API_URL is unset; skipping hosted Cobalt tier');
    tierErrors.push({ tier: 'cobalt-api', message: 'COBALT_API_URL is unset in environment' });
  } else {
    try {
      console.log(`[API /download] Tier 3: Calling custom Cobalt instance at ${cobaltBase}...`);
      const cobaltHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
      throw new Error(`Cobalt returned HTTP ${cobaltRes.status}`);
    } catch (t3Err) {
      console.error('[API /download] Tier 3 RAW ERROR:', t3Err.message);
      tierErrors.push({ tier: 'cobalt-api', message: t3Err.message });
    }
  }

  // ----------------------------------------------------
  // Structured Diagnostic Response
  // ----------------------------------------------------
  const allTierDetails = tierErrors.map(e => `[${e.tier}]: ${e.message}`).join(' | ');
  console.error('[API /download] ALL TIERS FAILED:', allTierDetails);

  return res.status(503).json({
    success: false,
    code: 503,
    reason: 'EXTRACTION_PIPELINE_FAILED',
    error: 'Extraction failed across all available providers.',
    details: allTierDetails,
    tierErrors,
    videoID
  });
};
