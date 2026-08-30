// Vercel Serverless Function - Production Media Streaming & Download Endpoint
// Multi-Tier Stream Pipeline: Authenticated YTDL -> YouTubei.js (TV Client) -> Cobalt Proxy

const https = require('https');
const http = require('http');
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

function streamRemoteUrl(targetUrl, res, filename, mimeType, maxRedirects = 5) {
  if (maxRedirects <= 0) {
    if (!res.headersSent) res.status(502).json({ error: 'Exceeded redirect limit' });
    return;
  }

  const client = targetUrl.startsWith('https') ? https : http;
  const req = client.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  }, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      const nextUrl = new URL(response.headers.location, targetUrl).toString();
      response.resume();
      return streamRemoteUrl(nextUrl, res, filename, mimeType, maxRedirects - 1);
    }

    if (response.statusCode >= 400) {
      response.resume();
      if (!res.headersSent) {
        return res.status(response.statusCode).json({ error: `Upstream media returned ${response.statusCode}` });
      }
      return;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    response.pipe(res);
  });

  req.on('error', (e) => {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const videoID = (req.query.id || req.query.v || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  const type = req.query.type || 'audio';
  const quality = req.query.quality || (type === 'audio' ? '192' : '1080');
  const rawTitle = req.query.title || 'YouTube_Download';

  if (!videoID || videoID.length !== 11) {
    return res.status(400).json({ error: 'Invalid Video ID', code: 400 });
  }

  const cleanTitle = rawTitle.replace(/[^\w\s.-]/gi, '').trim().replace(/\s+/g, '_').substring(0, 80) || `media_${videoID}`;
  const ext = type === 'audio' ? 'mp3' : 'mp4';
  const mimeType = type === 'audio' ? 'audio/mpeg' : 'video/mp4';
  const filename = cleanTitle.toLowerCase().endsWith(`.${ext}`) ? cleanTitle : `${cleanTitle}.${ext}`;

  const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;
  console.log(`[API /download] Streaming ${videoID} (${type}, ${quality})`);

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
      } catch (agentErr) {}
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
    if (format) {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

      if (format.contentLength) {
        res.setHeader('Content-Length', format.contentLength);
      }

      const stream = ytdl.downloadFromInfo(info, { format, agent });
      stream.on('error', (e) => {
        console.error('[API /download] YTDL pipe error:', e.message);
      });
      req.on('close', () => {
        if (typeof stream.destroy === 'function') stream.destroy();
      });
      return stream.pipe(res);
    }
  } catch (t1Err) {
    lastError = t1Err;
    console.warn('[API /download] Tier 1 failed:', t1Err.message);
  }

  // ----------------------------------------------------
  // TIER 2: Hosted Cobalt API Pipe
  // ----------------------------------------------------
  const cobaltBase = process.env.COBALT_API_URL || 'https://api.cobalt.tools';
  try {
    const cobaltHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0'
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
        videoQuality: quality === '1080' ? '1080' : '720'
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (cobaltRes.ok) {
      const cobaltData = await cobaltRes.json();
      if (cobaltData.url) {
        console.log('[API /download] Streaming via Cobalt direct URL');
        return streamRemoteUrl(cobaltData.url, res, filename, mimeType);
      }
    }
  } catch (t2Err) {
    lastError = t2Err;
    console.warn('[API /download] Tier 2 failed:', t2Err.message);
  }

  // ----------------------------------------------------
  // Error Response
  // ----------------------------------------------------
  const errMsg = lastError?.message || 'Download streaming failed';
  let statusCode = 503;
  let userFriendlyError = 'Extraction service temporarily unavailable. Please retry in a few moments.';

  if (errMsg.includes('429') || errMsg.includes('Sign in to confirm you\'re not a bot') || errMsg.includes('bot')) {
    statusCode = 429;
    userFriendlyError = 'YouTube bot protection temporarily blocked this datacenter request. Set YOUTUBE_COOKIE in Vercel environment variables to enable 100% continuous extraction.';
  } else if (errMsg.includes('404') || errMsg.includes('Video unavailable')) {
    statusCode = 404;
    userFriendlyError = 'This video is unavailable or has been deleted.';
  } else if (errMsg.includes('403') || errMsg.includes('private video')) {
    statusCode = 403;
    userFriendlyError = 'This video is private or age-restricted.';
  }

  if (!res.headersSent) {
    return res.status(statusCode).json({
      error: userFriendlyError,
      code: statusCode,
      details: errMsg.substring(0, 180),
      videoID
    });
  }
};
