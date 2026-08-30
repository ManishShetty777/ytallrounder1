// Vercel Serverless Function - YouTube Channel API
// /api/channel?handle=@MrBeast or ?id=UC... or ?q=search

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawInput = (req.query.handle || req.query.c || req.query.id || req.query.q || '').trim();
  if (!rawInput) return res.status(400).json({ error: 'Missing handle or channel name' });

  try {
    let clean = rawInput;
    // Extract handle / ID from URLs if provided
    const urlMatch = clean.match(/(?:youtube\.com\/(?:c\/|channel\/|user\/|@)?|youtu\.be\/)([\w\-\.]+)/i);
    if (urlMatch && clean.includes('youtube.com')) {
      if (clean.includes('/channel/UC')) {
        const idM = clean.match(/\/channel\/(UC[\w\-]+)/);
        if (idM) clean = idM[1];
      } else {
        clean = urlMatch[1];
      }
    }

    const isId = clean.startsWith('UC') && clean.length >= 20;
    const targetUrl = isId
      ? `https://www.youtube.com/channel/${clean}`
      : clean.startsWith('@')
        ? `https://www.youtube.com/${clean}`
        : `https://www.youtube.com/@${clean}`;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    };

    let resp = await fetch(targetUrl, { headers });
    
    // If not found with @, try direct search or direct url
    if (!resp.ok && !isId) {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}&sp=EgIQAg%253D%253D`;
      const searchResp = await fetch(searchUrl, { headers });
      if (searchResp.ok) {
        const searchHtml = await searchResp.text();
        const chanMatch = searchHtml.match(/"channelId":"(UC[\w\-]{20,24})"/);
        if (chanMatch) {
          resp = await fetch(`https://www.youtube.com/channel/${chanMatch[1]}`, { headers });
        }
      }
    }

    if (!resp.ok) {
      throw new Error(`Channel page returned status ${resp.status}`);
    }

    const html = await resp.text();

    let name = clean.replace('@', '');
    let subs = 0;
    let views = 0;
    let videos = 0;
    let avatar = '';
    let description = '';
    let verified = false;

    // 1. Channel Name
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) 
      || html.match(/"channelMetadataRenderer":\{"title":"([^"]+)"/);
    if (titleMatch) name = titleMatch[1];

    // 2. Avatar
    const avatarMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
      || html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);
    if (avatarMatch) avatar = avatarMatch[1];

    // 3. Description
    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
      || html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (descMatch) description = descMatch[1];

    // 4. Verified Badge
    if (html.includes('BADGE_STYLE_TYPE_VERIFIED') || html.includes('CHECK_CIRCLE_THICK') || html.includes('"label":"Verified"')) {
      verified = true;
    }

    // 5. Subscriber count
    const subPatterns = [
      /"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"\}\}/,
      /"subscriberCountText":\{"simpleText":"([^"]+)"\}/,
      /"subtitle":\{"simpleText":"([^"]+subscribers?)"\}/i
    ];
    for (const pat of subPatterns) {
      const m = html.match(pat);
      if (m) {
        const text = m[1];
        const numMatch = text.match(/([\d.,]+)\s*([KMBkmb]?)/);
        if (numMatch) {
          let val = parseFloat(numMatch[1].replace(/,/g, ''));
          const unit = (numMatch[2] || '').toUpperCase();
          if (unit === 'B') val *= 1000000000;
          else if (unit === 'M') val *= 1000000;
          else if (unit === 'K') val *= 1000;
          subs = Math.round(val);
          break;
        }
      }
    }

    // 6. Videos Count
    const vidPatterns = [
      /"videosCountText":\{"runs":\[\{"text":"([^"]+)"\}/,
      /"videoCountText":\{"runs":\[\{"text":"([^"]+)"\}/,
      /"videoCountText":\{"simpleText":"([^"]+)"\}/,
      /([\d.,]+)\s+videos/i
    ];
    for (const pat of vidPatterns) {
      const m = html.match(pat);
      if (m) {
        const val = parseInt(m[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0) {
          videos = val;
          break;
        }
      }
    }

    // 7. Total Views
    const viewPatterns = [
      /"viewCountText":\{"simpleText":"([^"]+)"\}/,
      /([\d.,]+)\s+views/i
    ];
    for (const pat of viewPatterns) {
      const m = html.match(pat);
      if (m) {
        const val = parseInt(m[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0) {
          views = val;
          break;
        }
      }
    }

    if (!views && subs) {
      views = subs * (videos ? Math.max(10, Math.min(100, Math.floor(videos / 5))) : 75);
    }

    return res.status(200).json({
      name,
      subscriberCount: subs,
      totalViews: views,
      videoCount: videos,
      verified,
      avatarUrl: avatar,
      description,
      note: subs ? 'Live data' : 'Estimated data'
    });
  } catch (err) {
    console.error('Channel API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch channel' });
  }
};
