// Vercel Serverless Function - Direct Binary Download Streamer
// Pipes media stream directly to user's browser as attachment

const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const videoID = (req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  const type = req.query.type || 'audio'; // audio, video, videoonly
  const quality = req.query.quality || (type === 'audio' ? '192' : '1080');
  const rawTitle = req.query.title || 'youtube-media';

  if (!videoID || videoID.length !== 11) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  const cleanTitle = rawTitle.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 80) || 'media';
  const ext = type === 'audio' ? 'mp3' : 'mp4';
  const filename = cleanTitle.endsWith(`.${ext}`) ? cleanTitle : `${cleanTitle}.${ext}`;

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Type', type === 'audio' ? 'audio/mpeg' : 'video/mp4');

  const url = `https://www.youtube.com/watch?v=${videoID}`;

  try {
    const filter = type === 'audio' ? 'audioonly' : type === 'videoonly' ? 'videoonly' : 'audioandvideo';
    const qualityOpt = type === 'audio' ? 'highestaudio' : 'highest';

    const stream = ytdl(url, {
      filter,
      quality: qualityOpt,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    });

    stream.on('error', (err) => {
      console.error('YTDL stream error:', err.message);
      if (!res.headersSent) {
        // Fallback: Send a structured response or redirect to stream endpoint
        return res.status(502).json({ error: 'Stream failed', message: err.message });
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error('Handler error:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Download failed: ' + err.message });
    }
  }
};
