// Vercel Serverless Function - YouTube Stream API
// Deploy to Vercel: automatically becomes /api/stream?id=VIDEOID
// Requires: npm install ytdl-core

const ytdl = require('ytdl-core');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const videoID = (req.query.id || req.query.v || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 11);
  if (!videoID || videoID.length !== 11) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  const url = `https://www.youtube.com/watch?v=${videoID}`;
  try {
    if (!ytdl.validateURL(url)) throw new Error('Invalid URL');
    const info = await ytdl.getInfo(url);

    const formats = info.formats.map(f => ({
      itag: f.itag,
      url: f.url,
      mimeType: f.mimeType,
      quality: f.qualityLabel || f.quality || '',
      qualityLabel: f.qualityLabel,
      bitrate: f.bitrate,
      audioBitrate: f.audioBitrate,
      height: f.height,
      fps: f.fps,
      hasAudio: !!f.hasAudio,
      hasVideo: !!f.hasVideo,
      contentLength: f.contentLength,
      container: f.container,
      codecs: f.codecs
    }));

    // Separate
    const audioStreams = formats.filter(f => f.hasAudio && !f.hasVideo).sort((a,b)=>(b.audioBitrate||0)-(a.audioBitrate||0));
    const videoStreams = formats.filter(f => f.hasVideo).sort((a,b)=>( (b.height||0) - (a.height||0) ));

    return res.status(200).json({
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      lengthSeconds: info.videoDetails.lengthSeconds,
      viewCount: info.videoDetails.viewCount,
      thumbnails: info.videoDetails.thumbnails,
      audioStreams: audioStreams.slice(0,8),
      videoStreams: videoStreams.slice(0,12)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to fetch streams', url });
  }
};
