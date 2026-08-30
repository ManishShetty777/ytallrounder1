// Vercel Serverless Function - YouTube Download Proxy
// Streams the actual media file through the server so downloads work on the site
const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const videoID = (req.query.id || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  const type = req.query.type || 'video'; // audio, video, videoonly
  const itag = req.query.itag ? parseInt(req.query.itag) : null;

  if (!videoID || videoID.length !== 11) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  const url = `https://www.youtube.com/watch?v=${videoID}`;

  try {
    const info = await ytdl.getInfo(url);
    const title = (info.videoDetails.title || 'video')
      .replace(/[<>:"/\\|?*]/g, '')
      .trim()
      .substring(0, 80) || 'video';

    let format;

    if (itag) {
      // Use specific format by itag
      format = info.formats.find(f => f.itag === itag);
      if (!format) throw new Error('Format not found for itag ' + itag);
    } else {
      // Auto-select best format by type
      let filter, qualityOpt;
      if (type === 'audio') {
        filter = 'audioonly';
        qualityOpt = 'highestaudio';
      } else if (type === 'videoonly') {
        filter = 'videoonly';
        qualityOpt = 'highestvideo';
      } else {
        filter = 'audioandvideo';
        qualityOpt = 'highest';
      }
      format = ytdl.chooseFormat(info.formats, { filter, quality: qualityOpt });
    }

    const ext = type === 'audio'
      ? (format.container === 'webm' ? 'webm' : 'm4a')
      : (format.container || 'mp4');

    const filename = `${title}.${ext}`;

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', format.mimeType || (type === 'audio' ? 'audio/mpeg' : 'video/mp4'));
    if (format.contentLength) {
      res.setHeader('Content-Length', format.contentLength);
    }

    const stream = ytdl(url, { format });
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream failed' });
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: err.message || 'Download failed',
        hint: 'YouTube may be blocking this server. Try again later.'
      });
    }
  }
};
