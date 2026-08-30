// Vercel Serverless Function - Production Media Stream & Extraction Prober
// Passes through authentic raw underlying error diagnostics and logs full stack traces

const ytdl = require('@distube/ytdl-core');

let cachedInnertube = null;

async function getInnertubeInstance() {
  if (cachedInnertube) return cachedInnertube;
  try {
    const { Innertube, UniversalCache, ClientType } = await import('youtubei.js');
    cachedInnertube = await Innertube.create({
      cache: new UniversalCache(false),
      client_type: ClientType.TV,
      generate_session_locally: true,
      retrieve_player: true
    });
    return cachedInnertube;
  } catch (err) {
    console.error('[API /stream] Innertube initialization error:', err);
    return null;
  }
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
  console.log(`[API /stream] Starting extraction probe for ${videoID} (type: ${type}, quality: ${quality})`);

  const tierErrors = [];

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
        console.warn('[API /stream] Tier 1 agent error:', agentErr.message);
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
    console.error('[API /stream] Tier 1 RAW ERROR:', t1Err);
    tierErrors.push({ tier: 'ytdl-core', message: t1Err.message, stack: t1Err.stack });
  }

  // ----------------------------------------------------
  // TIER 2: YouTube.js Dynamic ESM Import (TV Context & Raw Error Pass-Through)
  // ----------------------------------------------------
  try {
    const yt = await getInnertubeInstance();
    if (yt) {
      console.log('[API /stream] Tier 2: Calling Innertube.getInfo()...');
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
      } else {
        throw new Error(`YouTubei.js returned 0 matching stream formats for type: ${type}`);
      }
    }
  } catch (t2Err) {
    console.error('[API /stream] Tier 2 RAW ERROR from Innertube.getInfo():', t2Err);
    tierErrors.push({ tier: 'youtubei.js', message: t2Err.message, stack: t2Err.stack });
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
        if (cobaltData.url) mediaUrl = cobaltData.url;
        else if (cobaltData.tunnel) mediaUrl = Array.isArray(cobaltData.tunnel) ? cobaltData.tunnel[0] : cobaltData.tunnel;
        else if (cobaltData.output?.url) mediaUrl = cobaltData.output.url;
        else if (typeof cobaltData.output === 'string') mediaUrl = cobaltData.output;
        else if (cobaltData.picker && Array.isArray(cobaltData.picker) && cobaltData.picker[0]?.url) mediaUrl = cobaltData.picker[0].url;

        if (mediaUrl || cobaltData.status === 'redirect' || cobaltData.status === 'tunnel') {
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
      console.error('[API /stream] Tier 3 RAW ERROR:', t3Err);
      tierErrors.push({ tier: 'cobalt-api', message: t3Err.message });
    }
  }

  // ----------------------------------------------------
  // RAW ERROR PASS-THROUGH (No Fake 404 Overwrites)
  // ----------------------------------------------------
  const primaryError = tierErrors[0]?.message || tierErrors[1]?.message || 'Extraction failed across all tiers';
  const allTierDetails = tierErrors.map(e => `[${e.tier}]: ${e.message}`).join(' | ');

  console.error('[API /stream] ALL TIERS FAILED. Details:', allTierDetails);

  return res.status(503).json({
    success: false,
    code: 503,
    reason: 'EXTRACTION_PIPELINE_ERROR',
    error: primaryError,
    details: allTierDetails,
    tierErrors,
    videoID
  });
};
