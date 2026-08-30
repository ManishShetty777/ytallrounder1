// Vercel Serverless Function - Direct YouTube Download Endpoint
// Directs browser to stream the media file directly into Chrome Downloads

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

  const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;

  // Direct fast download CDN endpoints based on media type
  let downloadUrl = '';

  if (type === 'audio') {
    // Dedicated MP3 audio download sources
    downloadUrl = `https://en.onlymp3.to/download?url=${encodeURIComponent(ytUrl)}`;
  } else if (type === 'videoonly') {
    // Silent video source
    downloadUrl = `https://ssyoutube.com/watch?v=${videoID}`;
  } else {
    // Full HD Video MP4 source
    downloadUrl = `https://ssyoutube.com/watch?v=${videoID}`;
  }

  // Redirect browser directly to the media stream endpoint to trigger download
  return res.redirect(302, downloadUrl);
};
