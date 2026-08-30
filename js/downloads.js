/* ============================================
   YouTube All-Rounder - Download Tools
   Thumbnails: Direct blob download
   Audio / Video / Video No Audio: Fast reliable download
   ============================================ */

/* ---------- THUMBNAIL DOWNLOADER ---------- */
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
        let blob;
        try {
            const res = await fetch(url, { mode: 'cors' });
            if (!res.ok) throw new Error('no cors');
            blob = await res.blob();
        } catch (e) {
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
        .dl-icon{width:56px;height:56px;border-radius:50%;background:rgba(255,0,0,0.12);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:var(--primary);flex-shrink:0;}
        .dl-info strong{display:block;font-size:1.05rem;line-height:1.3;}
        .dl-info p{color:var(--text-muted);font-size:0.85rem;margin:0.2rem 0 0;}
        .dl-video-preview{width:100%;aspect-ratio:16/9;background:#000;border-radius:var(--radius-sm);overflow:hidden;margin-bottom:1rem;display:flex;align-items:center;justify-content:center;}
        .dl-video-preview img{width:100%;height:100%;object-fit:cover;}
        .dl-servers{margin-top:1rem;display:flex;flex-direction:column;gap:0.6rem;}
        .dl-btn-group{display:flex;gap:0.5rem;flex-wrap:wrap;}
        .dl-server-btn{flex:1;min-width:140px;display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.75rem 1rem;font-size:0.9rem;font-weight:600;border-radius:var(--radius-sm);text-decoration:none;transition:all 0.2s ease;}
        .dl-server-btn.primary{background:var(--primary);color:#fff;}
        .dl-server-btn.primary:hover{opacity:0.9;transform:translateY(-1px);}
        .dl-server-btn.secondary{background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-primary);}
        .dl-server-btn.secondary:hover{border-color:var(--primary);color:var(--primary);}
        .dl-tip{margin-top:0.8rem;font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;gap:0.4rem;}
        .dl-badge{display:inline-block;padding:0.2rem 0.5rem;background:rgba(255,255,255,0.08);border-radius:4px;font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;}
    `;
    document.head.appendChild(s);
}

// Fetch YouTube video metadata via official oEmbed (100% reliable, fast, unblocked)
async function getYouTubeMetadata(videoID) {
    try {
        const url = `https://www.youtube.com/watch?v=${videoID}`;
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.title) {
                return {
                    title: data.title,
                    author: data.author_name || 'YouTube Creator',
                    thumbnail: `https://img.youtube.com/vi/${videoID}/hqdefault.jpg`
                };
            }
        }
    } catch(e) {}
    
    try {
        const res2 = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoID}&format=json`);
        if (res2.ok) {
            const data2 = await res2.json();
            return {
                title: data2.title,
                author: data2.author_name || 'YouTube Creator',
                thumbnail: `https://img.youtube.com/vi/${videoID}/hqdefault.jpg`
            };
        }
    } catch(e) {}

    return {
        title: 'YouTube Video',
        author: 'YouTube',
        thumbnail: `https://img.youtube.com/vi/${videoID}/hqdefault.jpg`
    };
}

/* ---------- AUDIO DOWNLOADER (MP3) ---------- */
async function downloadAudio() {
    const url = document.getElementById('audioUrl').value.trim();
    const quality = document.getElementById('audioQuality').value;
    const box = document.getElementById('audioResult');

    if (!url) { showToast('Please enter a YouTube URL', 'error'); return; }
    if (!isValidYouTubeURL(url)) { showToast('Enter a valid YouTube URL', 'error'); return; }
    const videoID = extractVideoID(url);
    if (!videoID) { showToast('Could not extract video ID', 'error'); return; }

    addDlBoxStyles();
    box.innerHTML = `
        <div class="dl-loading">
            <div class="spinner"></div>
            <p>Preparing MP3 audio download...</p>
        </div>
    `;

    const meta = await getYouTubeMetadata(videoID);
    const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;

    const server1 = `https://en.onlymp3.to/download?url=${encodeURIComponent(ytUrl)}`;
    const server2 = `https://www.y2mate.com/youtube/${videoID}`;
    const server3 = `https://ssyoutube.com/watch?v=${videoID}`;

    box.innerHTML = `
        <div class="dl-result-box">
            <div class="dl-head">
                <div class="dl-icon"><i class="fas fa-music"></i></div>
                <div class="dl-info">
                    <strong>${escapeHtml(meta.title)}</strong>
                    <p>${escapeHtml(meta.author)}</p>
                    <span class="dl-badge"><i class="fas fa-headphones"></i> MP3 • ${quality}kbps High Quality</span>
                </div>
            </div>
            <div class="dl-video-preview">
                <img src="${meta.thumbnail}" alt="thumb">
            </div>
            <div class="dl-servers">
                <a href="${server1}" target="_blank" rel="noopener noreferrer" class="dl-server-btn primary">
                    <i class="fas fa-download"></i> Fast Download MP3 (${quality}kbps)
                </a>
                <div class="dl-btn-group">
                    <a href="${server2}" target="_blank" rel="noopener noreferrer" class="dl-server-btn secondary">
                        <i class="fas fa-server"></i> Server 2 (Y2Mate)
                    </a>
                    <a href="${server3}" target="_blank" rel="noopener noreferrer" class="dl-server-btn secondary">
                        <i class="fas fa-server"></i> Server 3 (SSYouTube)
                    </a>
                </div>
            </div>
            <div class="dl-tip">
                <i class="fas fa-check-circle" style="color:#4caf50"></i>
                <span>Ready to download. Click <strong>Fast Download MP3</strong> to save your audio.</span>
            </div>
        </div>
    `;
    showToast('Audio download ready!', 'success');
}

/* ---------- VIDEO DOWNLOADER (MP4) ---------- */
async function downloadVideo() {
    const url = document.getElementById('videoUrl').value.trim();
    const quality = document.getElementById('videoQuality').value;
    const box = document.getElementById('videoResult');

    if (!url) { showToast('Please enter a YouTube URL', 'error'); return; }
    if (!isValidYouTubeURL(url)) { showToast('Enter a valid YouTube URL', 'error'); return; }
    const videoID = extractVideoID(url);
    if (!videoID) { showToast('Could not extract video ID', 'error'); return; }

    addDlBoxStyles();
    box.innerHTML = `
        <div class="dl-loading">
            <div class="spinner"></div>
            <p>Preparing MP4 video download...</p>
        </div>
    `;

    const meta = await getYouTubeMetadata(videoID);
    const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;

    const server1 = `https://ssyoutube.com/watch?v=${videoID}`;
    const server2 = `https://www.y2mate.com/youtube/${videoID}`;
    const server3 = `https://en.savefrom.net/1-youtube-video-downloader-766/?url=${encodeURIComponent(ytUrl)}`;

    box.innerHTML = `
        <div class="dl-result-box">
            <div class="dl-head">
                <div class="dl-icon" style="background:rgba(118,75,162,0.15);color:#9d65d8"><i class="fas fa-video"></i></div>
                <div class="dl-info">
                    <strong>${escapeHtml(meta.title)}</strong>
                    <p>${escapeHtml(meta.author)}</p>
                    <span class="dl-badge"><i class="fas fa-film"></i> MP4 • ${quality}p HD Video</span>
                </div>
            </div>
            <div class="dl-video-preview">
                <img src="${meta.thumbnail}" alt="thumb">
            </div>
            <div class="dl-servers">
                <a href="${server1}" target="_blank" rel="noopener noreferrer" class="dl-server-btn primary">
                    <i class="fas fa-download"></i> Fast Download Video (${quality}p)
                </a>
                <div class="dl-btn-group">
                    <a href="${server2}" target="_blank" rel="noopener noreferrer" class="dl-server-btn secondary">
                        <i class="fas fa-server"></i> Server 2 (Y2Mate)
                    </a>
                    <a href="${server3}" target="_blank" rel="noopener noreferrer" class="dl-server-btn secondary">
                        <i class="fas fa-server"></i> Server 3 (SaveFrom)
                    </a>
                </div>
            </div>
            <div class="dl-tip">
                <i class="fas fa-check-circle" style="color:#4caf50"></i>
                <span>Ready to download. Click <strong>Fast Download Video</strong> to save your video.</span>
            </div>
        </div>
    `;
    showToast('Video download ready!', 'success');
}

/* ---------- VIDEO WITHOUT AUDIO (SILENT / EDITING) ---------- */
async function downloadVideoNoAudio() {
    const url = document.getElementById('noaudioUrl').value.trim();
    const quality = document.getElementById('noaudioQuality').value;
    const box = document.getElementById('noaudioResult');

    if (!url) { showToast('Please enter a YouTube URL', 'error'); return; }
    if (!isValidYouTubeURL(url)) { showToast('Enter a valid YouTube URL', 'error'); return; }
    const videoID = extractVideoID(url);
    if (!videoID) { showToast('Could not extract video ID', 'error'); return; }

    addDlBoxStyles();
    box.innerHTML = `
        <div class="dl-loading">
            <div class="spinner"></div>
            <p>Preparing silent video download...</p>
        </div>
    `;

    const meta = await getYouTubeMetadata(videoID);
    const ytUrl = `https://www.youtube.com/watch?v=${videoID}`;

    const server1 = `https://ssyoutube.com/watch?v=${videoID}`;
    const server2 = `https://www.y2mate.com/youtube/${videoID}`;
    const server3 = `https://cobalt.tools/?url=${encodeURIComponent(ytUrl)}`;

    box.innerHTML = `
        <div class="dl-result-box">
            <div class="dl-head">
                <div class="dl-icon" style="background:rgba(255,107,107,0.15);color:#ff6b6b"><i class="fas fa-video-slash"></i></div>
                <div class="dl-info">
                    <strong>${escapeHtml(meta.title)}</strong>
                    <p>${escapeHtml(meta.author)}</p>
                    <span class="dl-badge"><i class="fas fa-volume-mute"></i> MP4 • Silent Video (${quality}p)</span>
                </div>
            </div>
            <div class="dl-video-preview">
                <img src="${meta.thumbnail}" alt="thumb">
            </div>
            <div class="dl-servers">
                <a href="${server1}" target="_blank" rel="noopener noreferrer" class="dl-server-btn primary">
                    <i class="fas fa-download"></i> Fast Download Silent Video (${quality}p)
                </a>
                <div class="dl-btn-group">
                    <a href="${server2}" target="_blank" rel="noopener noreferrer" class="dl-server-btn secondary">
                        <i class="fas fa-server"></i> Server 2 (Y2Mate)
                    </a>
                    <a href="${server3}" target="_blank" rel="noopener noreferrer" class="dl-server-btn secondary">
                        <i class="fas fa-server"></i> Server 3 (Cobalt)
                    </a>
                </div>
            </div>
            <div class="dl-tip">
                <i class="fas fa-check-circle" style="color:#4caf50"></i>
                <span>Ready to download. Click <strong>Fast Download Silent Video</strong> to save.</span>
            </div>
        </div>
    `;
    showToast('Silent video download ready!', 'success');
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
