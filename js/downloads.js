/* ============================================
   YouTube All-Rounder - Download Tools (FIXED)
   Thumbnail: direct blob download
   Audio/Video: Piped API + Vercel backend fallback
   ============================================ */

/* ---------- THUMBNAIL (FIXED: real blob download) ---------- */
function downloadThumbnail() {
    const url = document.getElementById('thumbUrl').value.trim();
    const quality = document.getElementById('thumbQuality').value;
    const resultContainer = document.getElementById('thumbResult');

    if (!url) { showToast('Please enter a YouTube URL', 'error'); return; }
    if (!isValidYouTubeURL(url)) { showToast('Enter a valid YouTube URL', 'error'); return; }

    const videoID = extractVideoID(url);
    if (!videoID) { showToast('Could not extract video ID', 'error'); return; }

    const qualities = {
        'maxresdefault': { url: `https://img.youtube.com/vi/${videoID}/maxresdefault.jpg`, label: 'Max HD 1280x720' },
        'sddefault': { url: `https://img.youtube.com/vi/${videoID}/sddefault.jpg`, label: 'SD 640x480' },
        'hqdefault': { url: `https://img.youtube.com/vi/${videoID}/hqdefault.jpg`, label: 'HQ 480x360' },
        'mqdefault': { url: `https://img.youtube.com/vi/${videoID}/mqdefault.jpg`, label: 'MQ 320x180' }
    };
    const selected = qualities[quality] || qualities['maxresdefault'];

    resultContainer.innerHTML = `
        <div class="thumb-result-box">
            <div class="thumb-preview">
                <img id="thumbPreviewImg" src="${selected.url}" alt="Thumbnail"
                     crossorigin="anonymous" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${videoID}/hqdefault.jpg'">
            </div>
            <div class="thumb-info"><span class="thumb-quality">${selected.label}</span><span id="thumbStatus"></span></div>
            <div class="thumb-actions">
                <button class="btn btn-primary" onclick="downloadThumbBlob('${selected.url}','yt-thumb-${videoID}-${quality}.jpg')">
                    <i class="fas fa-download"></i> Download HD
                </button>
                <button class="btn btn-secondary" onclick="window.open('${selected.url}','_blank')">
                    <i class="fas fa-external-link-alt"></i> Open
                </button>
                <button class="btn btn-secondary" onclick="copyToClipboard('${selected.url}')">
                    <i class="fas fa-copy"></i> Copy URL
                </button>
            </div>
            <div id="thumbExtraQualities" class="thumb-extra"></div>
        </div>
    `;
    // show all qualities as small buttons
    const extra = document.getElementById('thumbExtraQualities');
    extra.innerHTML = Object.keys(qualities).map(k => `
        <a href="${qualities[k].url}" target="_blank" class="thumb-q-btn">${qualities[k].label}</a>
    `).join('');
    addThumbStyles();
    showToast('Thumbnail ready - click Download', 'success');
}

async function downloadThumbBlob(url, filename) {
    const status = document.getElementById('thumbStatus');
    if (status) status.textContent = 'Downloading...';
    try {
        // Try direct fetch with CORS mode
        let blob;
        try {
            const res = await fetch(url, { mode: 'cors' });
            if (!res.ok) throw new Error('no cors');
            blob = await res.blob();
        } catch (e) {
            // Fallback via corsproxy
            const proxy = 'https://corsproxy.io/?' + encodeURIComponent(url);
            const res2 = await fetch(proxy);
            if (!res2.ok) throw new Error('proxy failed');
            blob = await res2.blob();
        }
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        showToast('Thumbnail downloaded!', 'success');
        if (status) status.textContent = 'Downloaded';
    } catch (err) {
        console.error(err);
        // Final fallback: open in new tab - user can right-click save
        window.open(url, '_blank');
        showToast('Opened in new tab - right click to save', 'info');
        if (status) status.textContent = 'Opened';
    }
}

function addThumbStyles() {
    if (document.getElementById('thumbStyles')) return;
    const s = document.createElement('style');
    s.id = 'thumbStyles';
    s.textContent = `
        .thumb-result-box{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);overflow:hidden;}
        .thumb-preview{width:100%;max-height:380px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;}
        .thumb-preview img{width:100%;height:auto;display:block;}
        .thumb-info{padding:0.75rem 1rem;background:var(--bg-card);display:flex;justify-content:space-between;align-items:center;font-size:0.9rem;}
        .thumb-quality{color:var(--primary);font-weight:600;}
        .thumb-actions{display:flex;gap:0.75rem;padding:1rem;justify-content:center;flex-wrap:wrap;}
        .thumb-extra{display:flex;gap:0.5rem;padding:0 1rem 1rem;flex-wrap:wrap;justify-content:center;}
        .thumb-q-btn{padding:0.4rem 0.8rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--text-secondary);}
        .thumb-q-btn:hover{border-color:var(--primary);color:var(--primary);}
    `;
    document.head.appendChild(s);
}

/* ---------- SHARED: Piped instances ---------- */
const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.syncpundit.io',
    'https://api.piped.private.coffee',
    'https://pipedapi.codespace.cz'
];

async function fetchWithTimeout(url, ms=3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch(e) { clearTimeout(id); throw e; }
}

const INVIDIOUS_INSTANCES = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://iv.ggtyler.dev',
    'https://inv.nadeko.net',
    'https://invidious.flokinet.to'
];

async function getPipedStreams(videoID) {
    let lastErr = null;
    for (const base of PIPED_INSTANCES) {
        try {
            const res = await fetchWithTimeout(`${base}/streams/${videoID}`, 7000);
            if (!res.ok) throw new Error('status '+res.status);
            const data = await res.json();
            if (data && (data.audioStreams || data.videoStreams)) return data;
            throw new Error('no streams');
        } catch (e) { lastErr = e; continue; }
    }
    throw lastErr || new Error('All Piped instances failed');
}

async function getInvidiousStreams(videoID) {
    let lastErr = null;
    for (const base of INVIDIOUS_INSTANCES) {
        try {
            const res = await fetchWithTimeout(`${base}/api/v1/videos/${videoID}`, 8000);
            if (!res.ok) throw new Error('status '+res.status);
            const data = await res.json();
            // Convert Invidious format to Piped-like
            if (data && (data.formatStreams || data.adaptiveFormats)) {
                const audioStreams = (data.adaptiveFormats || []).filter(f => f.type && f.type.startsWith('audio/')).map(f => ({
                    url: f.url,
                    mimeType: f.type,
                    quality: f.qualityLabel || f.bitrate || 'audio',
                    bitrate: parseInt(f.bitrate) || 0,
                    codec: f.encoding || '',
                    contentLength: f.clen || 0
                }));
                const videoStreams = [...(data.formatStreams || []), ...(data.adaptiveFormats || []).filter(f => f.type && f.type.startsWith('video/'))].map(f => ({
                    url: f.url,
                    mimeType: f.type,
                    quality: f.qualityLabel || f.quality || f.resolution || 'video',
                    height: parseInt((f.qualityLabel||'').replace('p','')) || 0,
                    fps: f.fps || 30,
                    codec: f.encoding || '',
                    contentLength: f.clen || 0,
                    videoOnly: !(data.formatStreams || []).includes(f)
                }));
                return {
                    title: data.title,
                    uploader: data.author,
                    thumbnailUrl: data.videoThumbnails?.[0]?.url,
                    audioStreams,
                    videoStreams
                };
            }
            throw new Error('no invid streams');
        } catch (e) { lastErr = e; continue; }
    }
    throw lastErr || new Error('All Invidious instances failed');
}

const COBALT_INSTANCES = [
    'https://co.wuk.sh',
    'https://cobalt.canine.tools',
    'https://api.cobalt.tools'
];

async function getCobaltStreams(videoID) {
    let lastErr = null;
    for (const base of COBALT_INSTANCES) {
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(base + '/', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoID}`, videoQuality: "720", audioFormat: "mp3", downloadMode: "auto" }),
                signal: controller.signal
            });
            clearTimeout(tid);
            if (!res.ok) throw new Error('cobalt status '+res.status);
            const data = await res.json();
            if (data.url) {
                return {
                    title: 'Video',
                    uploader: '',
                    audioStreams: [{ url: data.url, mimeType: 'audio/mp3', quality: 'mp3', bitrate: 128000, codec: 'mp3', contentLength: 0 }],
                    videoStreams: [{ url: data.url, mimeType: 'video/mp4', quality: '720p', height: 720, fps: 30, codec: 'h264', contentLength: 0, videoOnly: false }]
                };
            }
            throw new Error(data.error || 'no cobalt url');
        } catch (e) {
            try {
                const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(base + '/');
                const res2 = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoID}`, videoQuality: "720", downloadMode: "auto" })
                });
                if (res2.ok) {
                    const data2 = await res2.json();
                    if (data2.url) return { title: 'Video', uploader: '', audioStreams: [{ url: data2.url, mimeType: 'audio/mp3', quality: 'mp3', bitrate: 128000, codec: 'mp3', contentLength: 0 }], videoStreams: [{ url: data2.url, mimeType: 'video/mp4', quality: '720p', height: 720, fps: 30, codec: 'h264', contentLength: 0, videoOnly: false }] };
                }
            } catch {}
            lastErr = e; continue;
        }
    }
    throw lastErr || new Error('All Cobalt failed');
}

async function getVercelStreams(videoID) {
    try {
        const res = await fetchWithTimeout(`/api/stream?id=${videoID}`, 8000);
        if (!res.ok) throw new Error('vercel backend not available ('+res.status+')');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.audioStreams || data.videoStreams) return data;
        throw new Error('no vercel streams');
    } catch (e) { throw e; }
}

async function getStreamsWithFallback(videoID) {
    // 1. Try Vercel backend first (works after deploy, most reliable)
    try { return await getVercelStreams(videoID); } catch (e) { console.warn('Vercel failed', e.message); }
    try { return await getPipedStreams(videoID); } catch (e) { console.warn('Piped failed', e.message); }
    try { return await getInvidiousStreams(videoID); } catch (e) { console.warn('Invidious failed', e.message); }
    try { return await getCobaltStreams(videoID); } catch (e) { console.warn('Cobalt failed', e.message); }
    // Final fallback: return redirect links that always work (not ideal but works)
    throw new Error(`All APIs blocked by YouTube. Use redirect fallback below.`);
}

function formatBytes(b) {
    if (!b) return '';
    if (b > 1024*1024*1024) return (b/1024/1024/1024).toFixed(2)+' GB';
    if (b > 1024*1024) return (b/1024/1024).toFixed(1)+' MB';
    if (b > 1024) return (b/1024).toFixed(0)+' KB';
    return b+' B';
}

function addDlBoxStyles() {
    if (document.getElementById('dlBoxStyles')) return;
    const s = document.createElement('style');
    s.id = 'dlBoxStyles';
    s.textContent = `
        .dl-loading{text-align:center;padding:2rem;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);}
        .dl-loading p{color:var(--text-muted);margin-top:1rem;}
        .spinner{width:38px;height:38px;border:3px solid var(--border-color);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .dl-result-box{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:1.25rem;}
        .dl-head{display:flex;align-items:center;gap:1rem;margin-bottom:1rem;}
        .dl-icon{width:56px;height:56px;border-radius:50%;background:rgba(76,175,80,0.12);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#4caf50;flex-shrink:0;}
        .dl-info strong{display:block;font-size:1.05rem;}
        .dl-info p{color:var(--text-muted);font-size:0.9rem;margin:0.2rem 0 0;}
        .dl-video-preview{width:100%;aspect-ratio:16/9;background:#000;border-radius:var(--radius-sm);overflow:hidden;margin-bottom:1rem;display:flex;align-items:center;justify-content:center;}
        .dl-video-preview img{width:100%;height:100%;object-fit:cover;}
        .stream-list{display:flex;flex-direction:column;gap:0.6rem;max-height:340px;overflow-y:auto;padding-right:4px;}
        .stream-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:0.75rem 1rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);}
        .stream-meta{font-size:0.9rem;}
        .stream-meta small{color:var(--text-muted);font-size:0.8rem;}
        .stream-actions{display:flex;gap:0.5rem;}
        .btn-sm{padding:0.5rem 0.9rem;font-size:0.85rem;}
        .dl-error{background:rgba(244,67,54,0.06);border:1px solid rgba(244,67,54,0.2);border-radius:var(--radius-md);padding:1.25rem;text-align:center;}
        .dl-error i{color:#f44336;font-size:1.8rem;margin-bottom:0.5rem;}
    `;
    document.head.appendChild(s);
}
function addLoadingStyles(){ addDlBoxStyles(); }

/* ---------- AUDIO DOWNLOADER (FAST FALLBACK) ---------- */
async function downloadAudio() {
    const url = document.getElementById('audioUrl').value.trim();
    const qualitySel = document.getElementById('audioQuality').value;
    const box = document.getElementById('audioResult');
    if (!url) { showToast('Enter YouTube URL', 'error'); return; }
    if (!isValidYouTubeURL(url)) { showToast('Invalid YouTube URL', 'error'); return; }
    const videoID = extractVideoID(url);
    if (!videoID) { showToast('Could not extract video ID', 'error'); return; }

    // Show loading + fallback immediately
    box.innerHTML = `
        <div class="dl-loading"><div class="spinner"></div><p>Trying direct API...</p>
        <small style="color:var(--text-muted)">If spinner >3s, use fallback below</small></div>
        <div id="audioFallback" style="display:none;margin-top:1rem">
            <div class="dl-error">
                <i class="fas fa-info-circle" style="color:#ff9800"></i>
                <p><strong>Direct API blocked by YouTube</strong> (datacenter IP)</p>
                <p style="font-size:0.85rem;color:var(--text-muted);margin:0.5rem 0">Use partner sites - they work 100%:</p>
                <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin:0.8rem 0">
                    <a href="https://loader.to/api/button/?url=https://www.youtube.com/watch?v=${videoID}&f=mp3" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download MP3 via Loader.to</a>
                    <a href="https://10downloader.com/download?v=https://www.youtube.com/watch?v=${videoID}&audio=1" target="_blank" class="btn btn-secondary btn-sm">10Downloader</a>
                    <a href="https://www.y2mate.com/youtube/${videoID}" target="_blank" class="btn btn-secondary btn-sm">Y2Mate</a>
                </div>
            </div>
        </div>`;
    addDlBoxStyles();

    // Show fallback after 3 seconds if API still loading
    const fallbackTimer = setTimeout(() => {
        const fb = document.getElementById('audioFallback');
        if (fb) fb.style.display = 'block';
    }, 3000);

    try {
        const data = await getStreamsWithFallback(videoID);
        clearTimeout(fallbackTimer);
        const audios = (data.audioStreams || []).sort((a,b) => (b.bitrate||0)-(a.bitrate||0));
        if (!audios.length) throw new Error('No audio streams found');

        let html = `
            <div class="dl-result-box">
                <div class="dl-head">
                    <div class="dl-icon"><i class="fas fa-music"></i></div>
                    <div class="dl-info"><strong>${escapeHtml(data.title || 'Audio')}</strong><p>${escapeHtml(data.uploader || '')} • ${audios.length} options</p></div>
                </div>
                <div class="dl-video-preview"><img src="https://img.youtube.com/vi/${videoID}/hqdefault.jpg" alt="thumb"></div>
                <div class="stream-list">
        `;
        audios.slice(0,6).forEach(a => {
            const br = a.bitrate ? Math.round(a.bitrate/1000)+' kbps' : (a.quality || 'audio');
            const ext = (a.mimeType||'').includes('webm') ? 'webm' : a.mimeType?.includes('mp4') ? 'm4a' : 'mp3';
            const dlLink = '/api/download?id=' + videoID + '&type=audio' + (a.itag ? '&itag=' + a.itag : '');
            html += `
                <div class="stream-row">
                    <div class="stream-meta"><strong>${br}</strong> • ${ext.toUpperCase()} <small>${a.codec || ''} ${formatBytes(a.contentLength)}</small></div>
                    <div class="stream-actions">
                        <a href="${dlLink}" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download</a>
                        <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${a.url}')"><i class="fas fa-copy"></i></button>
                    </div>
                </div>`;
        });
        html += `</div></div>`;
        box.innerHTML = html;
        showToast('Audio streams loaded!', 'success');
    } catch (err) {
        clearTimeout(fallbackTimer);
        console.error('audio error', err);
        box.innerHTML = `
            <div class="dl-error">
                <i class="fas fa-music" style="color:#ff9800;font-size:1.8rem"></i>
                <p><strong>Try downloading directly:</strong></p>
                <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin:0.8rem 0">
                    <a href="/api/download?id=${videoID}&type=audio" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download Audio (MP3)</a>
                </div>
                <p style="font-size:0.85rem;color:var(--text-muted);margin:0.5rem 0">Or use partner sites:</p>
                <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin:0.8rem 0">
                    <a href="https://loader.to/api/button/?url=https://www.youtube.com/watch?v=${videoID}&f=mp3" target="_blank" class="btn btn-secondary btn-sm">Loader.to</a>
                    <a href="https://10downloader.com/download?v=https://www.youtube.com/watch?v=${videoID}&audio=1" target="_blank" class="btn btn-secondary btn-sm">10Downloader</a>
                    <a href="https://www.y2mate.com/youtube/${videoID}" target="_blank" class="btn btn-secondary btn-sm">Y2Mate</a>
                </div>
                <button class="btn btn-primary btn-sm" onclick="downloadAudio()"><i class="fas fa-redo"></i> Retry</button>
            </div>`;
        showToast('Try the direct download button', 'info');
    }
}

/* ---------- VIDEO DOWNLOADER (FAST FALLBACK) ---------- */
async function downloadVideo() {
    const url = document.getElementById('videoUrl').value.trim();
    const wantQuality = document.getElementById('videoQuality').value;
    const box = document.getElementById('videoResult');
    if (!url) { showToast('Enter YouTube URL', 'error'); return; }
    if (!isValidYouTubeURL(url)) { showToast('Invalid URL', 'error'); return; }
    const videoID = extractVideoID(url);
    if (!videoID) { showToast('Bad video ID', 'error'); return; }

    box.innerHTML = `
        <div class="dl-loading"><div class="spinner"></div><p>Trying direct API...</p>
        <small style="color:var(--text-muted)">If spinner >3s, use fallback below</small></div>
        <div id="videoFallback" style="display:none;margin-top:1rem">
            <div class="dl-error">
                <i class="fas fa-info-circle" style="color:#ff9800"></i>
                <p><strong>Direct API blocked by YouTube</strong> (datacenter IP)</p>
                <p style="font-size:0.85rem;color:var(--text-muted);margin:0.5rem 0">Use partner sites - they work 100%:</p>
                <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin:0.8rem 0">
                    <a href="https://loader.to/api/button/?url=https://www.youtube.com/watch?v=${videoID}&f=mp4" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download MP4 via Loader.to</a>
                    <a href="https://10downloader.com/download?v=https://www.youtube.com/watch?v=${videoID}" target="_blank" class="btn btn-secondary btn-sm">10Downloader</a>
                    <a href="https://www.y2mate.com/youtube/${videoID}" target="_blank" class="btn btn-secondary btn-sm">Y2Mate</a>
                </div>
            </div>
        </div>`;
    addDlBoxStyles();

    const fallbackTimer = setTimeout(() => {
        const fb = document.getElementById('videoFallback');
        if (fb) fb.style.display = 'block';
    }, 3000);

    try {
        const data = await getStreamsWithFallback(videoID);
        clearTimeout(fallbackTimer);
        let videos = (data.videoStreams || []).filter(v => v.videoOnly === false);
        if (!videos.length) videos = data.videoStreams || [];
        videos.sort((a,b) => (parseInt(b.quality)||0) - (parseInt(a.quality)||0));
        if (!videos.length) throw new Error('No video streams');

        let html = `
            <div class="dl-result-box">
                <div class="dl-head">
                    <div class="dl-icon" style="background:rgba(118,75,162,0.12);color:#764ba2"><i class="fas fa-video"></i></div>
                    <div class="dl-info"><strong>${escapeHtml(data.title || 'Video')}</strong><p>${escapeHtml(data.uploader || '')} • ${videos.length} options</p></div>
                </div>
                <div class="dl-video-preview"><img src="https://img.youtube.com/vi/${videoID}/hqdefault.jpg" alt="thumb"></div>
                <div class="stream-list">
        `;
        videos.slice(0,6).forEach(v => {
            const label = v.quality || (v.height ? v.height+'p' : 'video');
            const ext = v.mimeType?.includes('webm') ? 'webm' : 'mp4';
            const fps = v.fps ? ` ${v.fps}fps` : '';
            const dlLink = '/api/download?id=' + videoID + '&type=video' + (v.itag ? '&itag=' + v.itag : '');
            html += `
                <div class="stream-row">
                    <div class="stream-meta"><strong>${label}${fps}</strong> • ${ext} <small>${v.codec || ''} ${formatBytes(v.contentLength)}</small></div>
                    <div class="stream-actions">
                        <a href="${dlLink}" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download</a>
                        <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${v.url}')"><i class="fas fa-copy"></i></button>
                    </div>
                </div>`;
        });
        html += `</div></div>`;
        box.innerHTML = html;
        showToast('Video streams loaded!', 'success');
    } catch (err) {
        clearTimeout(fallbackTimer);
        console.error(err);
        box.innerHTML = `
            <div class="dl-error">
                <i class="fas fa-video" style="color:#ff9800;font-size:1.8rem"></i>
                <p><strong>Try downloading directly:</strong></p>
                <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin:0.8rem 0">
                    <a href="/api/download?id=${videoID}&type=video" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download Video (MP4)</a>
                </div>
                <p style="font-size:0.85rem;color:var(--text-muted);margin:0.5rem 0">Or use partner sites:</p>
                <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin:0.8rem 0">
                    <a href="https://loader.to/api/button/?url=https://www.youtube.com/watch?v=${videoID}&f=mp4" target="_blank" class="btn btn-secondary btn-sm">Loader.to</a>
                    <a href="https://10downloader.com/download?v=https://www.youtube.com/watch?v=${videoID}" target="_blank" class="btn btn-secondary btn-sm">10Downloader</a>
                    <a href="https://www.y2mate.com/youtube/${videoID}" target="_blank" class="btn btn-secondary btn-sm">Y2Mate</a>
                </div>
                <button class="btn btn-primary btn-sm" onclick="downloadVideo()"><i class="fas fa-redo"></i> Retry</button>
            </div>`;
        showToast('Try the direct download button', 'info');
    }
}

/* ---------- VIDEO WITHOUT AUDIO (FAST FALLBACK) ---------- */
async function downloadVideoNoAudio() {
    const url = document.getElementById('noaudioUrl').value.trim();
    const wantQuality = document.getElementById('noaudioQuality').value;
    const box = document.getElementById('noaudioResult');
    if (!url) { showToast('Enter YouTube URL', 'error'); return; }
    if (!isValidYouTubeURL(url)) { showToast('Invalid URL', 'error'); return; }
    const videoID = extractVideoID(url);
    if (!videoID) { showToast('Bad ID', 'error'); return; }

    box.innerHTML = `
        <div class="dl-loading"><div class="spinner"></div><p>Trying direct API...</p>
        <small style="color:var(--text-muted)">If spinner >3s, use fallback below</small></div>
        <div id="noaudioFallback" style="display:none;margin-top:1rem">
            <div class="dl-error">
                <i class="fas fa-info-circle" style="color:#ff9800"></i>
                <p><strong>Direct API blocked by YouTube</strong> (datacenter IP)</p>
                <p style="font-size:0.85rem;color:var(--text-muted);margin:0.5rem 0">Use partner sites - they work 100%:</p>
                <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin:0.8rem 0">
                    <a href="https://loader.to/api/button/?url=https://www.youtube.com/watch?v=${videoID}&f=mp4" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download MP4 via Loader.to</a>
                    <a href="https://10downloader.com/download?v=https://www.youtube.com/watch?v=${videoID}" target="_blank" class="btn btn-secondary btn-sm">10Downloader</a>
                </div>
            </div>
        </div>`;
    addDlBoxStyles();

    const fallbackTimer = setTimeout(() => {
        const fb = document.getElementById('noaudioFallback');
        if (fb) fb.style.display = 'block';
    }, 3000);

    try {
        const data = await getStreamsWithFallback(videoID);
        clearTimeout(fallbackTimer);
        let vids = (data.videoStreams || []).filter(v => v.videoOnly === true);
        if (!vids.length) vids = (data.videoStreams || []).slice(0,4);
        vids.sort((a,b) => (parseInt(b.quality)||0) - (parseInt(a.quality)||0));
        if (!vids.length) throw new Error('No streams');

        let html = `
            <div class="dl-result-box">
                <div class="dl-head">
                    <div class="dl-icon" style="background:rgba(255,107,107,0.12);color:#ff6b6b"><i class="fas fa-video-slash"></i></div>
                    <div class="dl-info"><strong>${escapeHtml(data.title || 'Video (no audio)')}</strong><p>Silent video - for editing</p></div>
                </div>
                <div class="dl-video-preview"><img src="https://img.youtube.com/vi/${videoID}/hqdefault.jpg" alt="thumb"></div>
                <div class="stream-list">
        `;
        vids.slice(0,6).forEach(v => {
            const label = v.quality || (v.height ? v.height+'p' : 'video');
            const tag = v.videoOnly ? 'no audio' : 'with audio';
            const ext = v.mimeType?.includes('webm') ? 'webm' : 'mp4';
            const dlLink = '/api/download?id=' + videoID + '&type=videoonly' + (v.itag ? '&itag=' + v.itag : '');
            html += `
                <div class="stream-row">
                    <div class="stream-meta"><strong>${label}</strong> • ${ext} <small>${v.videoOnly ? 'no audio' : 'with audio'} ${formatBytes(v.contentLength)}</small></div>
                    <div class="stream-actions">
                        <a href="${dlLink}" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download</a>
                        <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${v.url}')"><i class="fas fa-copy"></i></button>
                    </div>
                </div>`;
        });
        html += `</div></div>`;
        box.innerHTML = html;
        showToast('Silent video streams loaded!', 'success');
    } catch (err) {
        box.innerHTML = `
            <div class="dl-error">
                <i class="fas fa-video-slash" style="color:#ff9800;font-size:1.8rem"></i>
                <p><strong>Try downloading directly:</strong></p>
                <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin:0.8rem 0">
                    <a href="/api/download?id=${videoID}&type=videoonly" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download Video (No Audio)</a>
                </div>
                <p style="font-size:0.85rem;color:var(--text-muted);margin:0.5rem 0">Or use partner sites:</p>
                <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin:0.8rem 0">
                    <a href="https://loader.to/api/button/?url=https://www.youtube.com/watch?v=${videoID}&f=mp4" target="_blank" class="btn btn-secondary btn-sm">Loader.to</a>
                    <a href="https://10downloader.com/download?v=https://www.youtube.com/watch?v=${videoID}" target="_blank" class="btn btn-secondary btn-sm">10Downloader</a>
                </div>
                <button class="btn btn-primary btn-sm" onclick="downloadVideoNoAudio()"><i class="fas fa-redo"></i> Retry</button>
            </div>`;
        showToast('Using fallback', 'info');
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
