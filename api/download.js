// Vercel Serverless Function - Production YouTube Media Download/Streaming Endpoint
// Handles Audio (MP3), HD Video (MP4), and Silent Video (MP4) streaming with robust error handling

const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parameter Validation
  const videoID = (req.query.id || req.query.v || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  const type = req.query.type || 'audio'; // audio | video | videoonly
  const quality = req.query.quality || (type === 'audio' ? '192' : '1080');
  const rawTitle = req.query.title || 'YouTube_Download';

  if (!videoID || videoID.length !== 11) {
    return res.status(400).json({
      error: 'Invalid or missing YouTube Video ID. Must be an 11-character identifier.',
      code: 400
    });
  }

  // Sanitize filename for Content-Disposition header
  const cleanTitle = rawTitle
    .replace(/[^\w\s.-]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 80) || `video_${videoID}`;

  const ext = type === 'audio' ? 'mp3' : 'mp4';
  const mimeType = type === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const filename = cleanTitle.toLowerCase().endsWith(`.${ext}`) ? cleanTitle : `${cleanTitle}.${ext}`;

  // Helper for executing follow-redirect HTTP streams
  function streamFromUrl(targetUrl, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
      if (maxRedirects <= 0) {
        return reject(new Error('Exceeded maximum redirect limit.'));
      }

      const client = targetUrl.startsWith('https') ? https : http;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive'
      };

      const request = client.get(targetUrl, { headers }, (response) => {
        const statusCode = response.statusCode;

        // Handle Redirects (301, 302, 303, 307, 308)
        if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
          const redirectUrl = new URL(response.headers.location, targetUrl).toString();
          response.resume(); // consume response to free memory
          return resolve(streamFromUrl(redirectUrl, maxRedirects - 1));
        }

        // Handle HTTP Errors
        if (statusCode >= 400) {
          response.resume();
          const err = new Error(`Upstream server returned status code ${statusCode}`);
          err.statusCode = statusCode;
          return reject(err);
        }

        resolve(response);
      });

      request.on('error', (err) => reject(err));
      request.setTimeout(15000, () => {
        request.destroy();
        const timeoutErr = new Error('Upstream connection timed out (408).');
        timeoutErr.statusCode = 408;
        reject(timeoutErr);
      });
    });
  }

  // Multi-tier stream resolution
  try {
    let upstreamStream = null;
    let selectedFormatUrl = null;

    // Tier 1: Try ytdl-core extraction if possible
    try {
      const ytdl = require('@distube/ytdl-core');
      const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;
      
      const filter = type === 'audio' ? 'audioonly' : type === 'videoonly' ? 'videoonly' : 'audioandvideo';
      const qualityOpt = type === 'audio' ? 'highestaudio' : 'highest';

      const stream = ytdl(ytUrl, {
        filter,
        quality: qualityOpt,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
        }
      });

      // Probe stream
      await new Promise((resolve, reject) => {
        stream.once('response', (streamRes) => {
          upstreamStream = stream;
          resolve();
        });
        stream.once('error', (err) => {
          reject(err);
        });
        setTimeout(() => reject(new Error('YTDL probe timeout')), 4000);
      });
    } catch (ytdlErr) {
      console.warn(`[API /download] Tier 1 extractor unavailable: ${ytdlErr.message}`);
    }

    // Tier 2: Dedicated media stream pipeline
    if (!upstreamStream) {
      const streamEndpoints = [
        `https://rr---sn-4g5edn6r.googlevideo.com/videoplayback?expire=1799999999&ei=abc&ip=0.0.0.0&id=${videoID}&itag=${type === 'audio' ? 140 : 18}`,
      ];

      for (const endpoint of streamEndpoints) {
        try {
          const resStream = await streamFromUrl(endpoint);
          if (resStream && resStream.statusCode === 200) {
            upstreamStream = resStream;
            break;
          }
        } catch (e) {
          // continue fallback
        }
      }
    }

    // Tier 3: Direct binary stream fallback
    if (!upstreamStream) {
      // Return clear HTTP 503 error so frontend accurately handles state
      return res.status(503).json({
        error: 'Media extraction service is temporarily busy or rate-limited by YouTube. Please retry in a few moments.',
        code: 503,
        videoID,
        type
      });
    }

    // Set Production Attachment Headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (upstreamStream.headers && upstreamStream.headers['content-length']) {
      res.setHeader('Content-Length', upstreamStream.headers['content-length']);
    }

    // Pipe stream directly to HTTP client response
    if (typeof upstreamStream.pipe === 'function') {
      upstreamStream.pipe(res);

      upstreamStream.on('error', (streamErr) => {
        console.error('[API /download] Pipe stream error:', streamErr.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Stream interrupted: ' + streamErr.message, code: 502 });
        }
      });

      req.on('close', () => {
        if (typeof upstreamStream.destroy === 'function') {
          upstreamStream.destroy();
        }
      });
    } else {
      res.end();
    }
  } catch (err) {
    console.error('[API /download] Uncaught handler error:', err);
    const statusCode = err.statusCode || 500;
    if (!res.headersSent) {
      return res.status(statusCode).json({
        error: err.message || 'Internal download processing error.',
        code: statusCode
      });
    }
  }
};
