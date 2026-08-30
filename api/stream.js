// Vercel Serverless Function - Production Media Stream & Extraction Prober
// Checks availability and resolves verifiable media streams for YouTube videos

const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
  // Production CORS & Security Headers
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
      error: 'Invalid or missing YouTube Video ID. Please provide a valid 11-character ID.',
      provider: 'validation'
    });
  }

  const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;
  console.log(`[API /stream] Probing video ID: ${videoID} | Type: ${type} | Quality: ${quality}`);

  // Tier 1: Distube YTDL Extractor with optional Cookie Agent
  try {
    let agent = undefined;
    if (process.env.YOUTUBE_COOKIE) {
      try {
        const cookieData = JSON.parse(process.env.YOUTUBE_COOKIE);
        agent = ytdl.createAgent(Array.isArray(cookieData) ? cookieData : [cookieData]);
        console.log('[API /stream] Using authenticated YOUTUBE_COOKIE agent');
      } catch (cookieErr) {
        console.warn('[API /stream] YOUTUBE_COOKIE parse error, falling back to default agent');
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

    const title = info.videoDetails?.title || 'YouTube Video';
    const author = info.videoDetails?.author?.name || 'YouTube Creator';
    const duration = info.videoDetails?.lengthSeconds || 0;

    let filter = type === 'audio' ? 'audioonly' : type === 'videoonly' ? 'videoonly' : 'audioandvideo';
    let qualityOpt = type === 'audio' ? 'highestaudio' : 'highest';

    const format = ytdl.chooseFormat(info.formats, { filter, quality: qualityOpt });
    if (!format || !format.url) {
      throw new Error('No playable format matching requested criteria was found.');
    }

    console.log(`[API /stream] Extracted successfully: "${title}" (itag: ${format.itag})`);

    return res.status(200).json({
      success: true,
      title,
      author,
      duration,
      format: {
        itag: format.itag,
        mimeType: format.mimeType,
        quality: format.qualityLabel || format.audioBitrate + 'kbps',
        contentLength: format.contentLength || null
      },
      provider: 'ytdl-core-authenticated'
    });
  } catch (err) {
    const errMsg = err.message || '';
    console.error(`[API /stream] Extraction failed for ${videoID}:`, errMsg);

    // Differentiate Error Categories
    let statusCode = 503;
    let reason = 'EXTRACTOR_FAILURE';
    let userFriendlyError = 'Extraction service could not resolve media stream.';

    if (errMsg.includes('Status code: 429') || errMsg.includes('Sign in to confirm you\'re not a bot') || errMsg.includes('Too Many Requests')) {
      statusCode = 429;
      reason = 'YOUTUBE_BOT_DETECTION_OR_RATE_LIMIT';
      userFriendlyError = 'YouTube is rate-limiting serverless IP addresses (Bot Detection). Set a valid YOUTUBE_COOKIE in Vercel environment variables to enable datacenter streaming.';
    } else if (errMsg.includes('Status code: 403') || errMsg.includes('private video') || errMsg.includes('Sign in')) {
      statusCode = 403;
      reason = 'FORBIDDEN_OR_AGE_RESTRICTED';
      userFriendlyError = 'This video is private, age-restricted, or blocked from automated extraction.';
    } else if (errMsg.includes('Status code: 404') || errMsg.includes('Video unavailable') || errMsg.includes('not found')) {
      statusCode = 404;
      reason = 'VIDEO_NOT_FOUND';
      userFriendlyError = 'YouTube video not found or has been removed.';
    } else if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT') || errMsg.includes('ESOCKETTIMEDOUT')) {
      statusCode = 408;
      reason = 'UPSTREAM_TIMEOUT';
      userFriendlyError = 'Connection to media stream timed out. Please try again.';
    }

    return res.status(statusCode).json({
      success: false,
      code: statusCode,
      reason,
      error: userFriendlyError,
      details: errMsg.substring(0, 180),
      provider: 'ytdl-core',
      videoID
    });
  }
};
