// Vercel Serverless Function - Production Media Streaming & Download Endpoint
// Streams verified MP3 and MP4 binary attachments directly to the client browser

const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validate Query Parameters
  const videoID = (req.query.id || req.query.v || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  const type = req.query.type || 'audio'; // audio | video | videoonly
  const quality = req.query.quality || (type === 'audio' ? '192' : '1080');
  const rawTitle = req.query.title || 'YouTube_Media';

  if (!videoID || videoID.length !== 11) {
    return res.status(400).json({
      error: 'Invalid or missing YouTube Video ID. Must be an 11-character identifier.',
      code: 400,
      reason: 'INVALID_VIDEO_ID'
    });
  }

  // Sanitize Filename for Content-Disposition
  const cleanTitle = rawTitle
    .replace(/[^\w\s.-]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 80) || `media_${videoID}`;

  const ext = type === 'audio' ? 'mp3' : 'mp4';
  const mimeType = type === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const filename = cleanTitle.toLowerCase().endsWith(`.${ext}`) ? cleanTitle : `${cleanTitle}.${ext}`;

  const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;
  console.log(`[API /download] Starting stream for ${videoID} (${type}, ${quality})`);

  try {
    let agent = undefined;
    if (process.env.YOUTUBE_COOKIE) {
      try {
        const cookieData = JSON.parse(process.env.YOUTUBE_COOKIE);
        agent = ytdl.createAgent(Array.isArray(cookieData) ? cookieData : [cookieData]);
      } catch (cookieErr) {
        console.warn('[API /download] Cookie parse failed');
      }
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
    if (!format) {
      return res.status(404).json({
        error: 'No playable format available for this video.',
        code: 404,
        reason: 'FORMAT_NOT_FOUND'
      });
    }

    // Set Production Attachment Headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (format.contentLength) {
      res.setHeader('Content-Length', format.contentLength);
    }

    const stream = ytdl.downloadFromInfo(info, { format, agent });

    stream.on('error', (streamErr) => {
      console.error('[API /download] Stream error:', streamErr.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Media stream interrupted: ' + streamErr.message,
          code: 502,
          reason: 'STREAM_INTERRUPTED'
        });
      }
    });

    req.on('close', () => {
      if (typeof stream.destroy === 'function') {
        stream.destroy();
      }
    });

    stream.pipe(res);
  } catch (err) {
    const errMsg = err.message || '';
    console.error(`[API /download] Handler error for ${videoID}:`, errMsg);

    let statusCode = 503;
    let reason = 'EXTRACTOR_FAILURE';
    let userFriendlyError = 'Extraction service could not stream media.';

    if (errMsg.includes('Status code: 429') || errMsg.includes('Sign in to confirm you\'re not a bot')) {
      statusCode = 429;
      reason = 'YOUTUBE_BOT_DETECTION_OR_RATE_LIMIT';
      userFriendlyError = 'YouTube is rate-limiting serverless IP addresses (Bot Detection). A valid YOUTUBE_COOKIE is required in Vercel environment variables.';
    } else if (errMsg.includes('Status code: 403') || errMsg.includes('private video')) {
      statusCode = 403;
      reason = 'FORBIDDEN_OR_AGE_RESTRICTED';
      userFriendlyError = 'This video is private, age-restricted, or blocked from automated downloading.';
    } else if (errMsg.includes('Status code: 404') || errMsg.includes('Video unavailable')) {
      statusCode = 404;
      reason = 'VIDEO_NOT_FOUND';
      userFriendlyError = 'YouTube video not found or has been removed.';
    } else if (errMsg.includes('timeout')) {
      statusCode = 408;
      reason = 'UPSTREAM_TIMEOUT';
      userFriendlyError = 'Download stream timed out. Please try again.';
    }

    if (!res.headersSent) {
      return res.status(statusCode).json({
        error: userFriendlyError,
        code: statusCode,
        reason,
        details: errMsg.substring(0, 180),
        videoID
      });
    }
  }
};
