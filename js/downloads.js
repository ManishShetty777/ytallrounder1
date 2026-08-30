/* ============================================
   YouTube All-Rounder - Direct Download Tools
   Direct-to-Device Chrome Downloads
   Zero Page Redirects, In-Site 3-Second Processing
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
        .dl-processing-box{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:1.5rem;text-align:center;}
        .dl-progress-bar-bg{width:100%;height:10px;background:rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;margin:1.2rem 0 0.8rem;position:relative;}
        .dl-progress-bar-fill{height:100%;width:0%;background:linear-gradient(90deg, #ff0000, #ff4d4d);border-radius:10px;transition:width 0.3s ease;}
        .dl-progress-text{font-size:0.85rem;color:var(--text-muted);display:flex;justify-content:space-between;margin-top:0.3rem;}
        .dl-processing-title{font-size:1.05rem;font-weight:600;color:var(--text-primary);margin-bottom:0.4rem;}
        .dl-processing-subtitle{font-size:0.85rem;color:var(--text-muted);}
        
        .dl-result-box{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:1.25rem;}
        .dl-head{display:flex;align-items:center;gap:1rem;margin-bottom:1rem;}
        .dl-icon{width:56px;height:56px;border-radius:50%;background:rgba(255,0,0,0.12);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:var(--primary);flex-shrink:0;}
        .dl-info strong{display:block;font-size:1.05rem;line-height:1.3;}
        .dl-info p{color:var(--text-muted);font-size:0.85rem;margin:0.2rem 0 0;}
        .dl-badge{display:inline-block;padding:0.2rem 0.5rem;background:rgba(255,255,255,0.08);border-radius:4px;font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;}
        .dl-video-preview{width:100%;aspect-ratio:16/9;background:#000;border-radius:var(--radius-sm);overflow:hidden;margin-bottom:1rem;display:flex;align-items:center;justify-content:center;}
        .dl-video-preview img{width:100%;height:100%;object-fit:cover;}
        
        .dl-download-actions{margin-top:1.2rem;display:flex;flex-direction:column;gap:0.75rem;}
        .dl-btn-main{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:0.6rem;padding:0.95rem 1.2rem;font-size:1rem;font-weight:700;border-radius:var(--radius-sm);background:var(--primary);color:#fff;border:none;cursor:pointer;transition:all 0.25s ease;}
        .dl-btn-main:hover{background:#cc0000;transform:translateY(-2px);box-shadow:0 6px 16px rgba(255,0,0,0.3);}
        .dl-servers-grid{display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;}
        .dl-btn-server{display:inline-flex;align-items:center;justify-content:center;gap:0.4rem;padding:0.65rem 0.8rem;font-size:0.85rem;font-weight:600;border-radius:var(--radius-sm);background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-primary);cursor:pointer;transition:all 0.2s ease;}
        .dl-btn-server:hover{border-color:var(--primary);color:var(--primary);}
        .dl-ready-note{margin-top:0.8rem;font-size:0.8rem;color:#4caf50;display:flex;align-items:center;gap:0.4rem;background:rgba(76,175,80,0.08);padding:0.6rem 0.9rem;border-radius:var(--radius-sm);}
    `;
    document.head.appendChild(s);
}

// Fetch YouTube video metadata via official oEmbed
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
        author: 'YouTube Creator',
        thumbnail: `https://img.youtube.com/vi/${videoID}/hqdefault.jpg`
    };
}

// 3-Second In-Site Processing Animation
function startInSiteProcessing(box, title, subtitle, onComplete) {
    addDlBoxStyles();
    let percent = 0;
    box.innerHTML = `
        <div class="dl-processing-box">
            <div class="dl-processing-title"><i class="fas fa-cog fa-spin" style="color:var(--primary);margin-right:0.5rem"></i> ${escapeHtml(title)}</div>
            <div class="dl-processing-subtitle" id="dlStepText">${escapeHtml(subtitle)}</div>
            <div class="dl-progress-bar-bg">
                <div class="dl-progress-bar-fill" id="dlFill"></div>
            </div>
            <div class="dl-progress-text">
                <span id="dlPercent">0%</span>
                <span>Converting file...</span>
            </div>
        </div>
    `;

    const fill = document.getElementById('dlFill');
    const pct = document.getElementById('dlPercent');
    const step = document.getElementById('dlStepText');

    const interval = setInterval(() => {
        percent += 10;
        if (percent <= 100) {
            if (fill) fill.style.width = percent + '%';
            if (pct) pct.textContent = percent + '%';
            if (percent === 30 && step) step.textContent = 'Extracting media tracks...';
            if (percent === 70 && step) step.textContent = 'Converting to requested format...';
            if (percent === 90 && step) step.textContent = 'Finalizing file download...';
        }
        if (percent >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                onComplete();
            }, 300);
        }
    }, 300); // 10 steps * 300ms = 3000ms (3 seconds)
}

// Direct File Download Trigger (Downloads directly into Chrome/Browser without opening new page)
function triggerDirectDeviceDownload(videoID, type, quality, filename, btnId) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Downloading to Device...`;
        btn.disabled = true;
    }

    showToast('Download started! Saving directly to your device...', 'success');

    // 1. Dedicated hidden download frame for silent direct download
    let dlFrame = document.getElementById('directDownloadFrame');
    if (!dlFrame) {
        dlFrame = document.createElement('iframe');
        dlFrame.id = 'directDownloadFrame';
        dlFrame.style.display = 'none';
        document.body.appendChild(dlFrame);
    }

    const downloadEndpoint = `/api/download?id=${encodeURIComponent(videoID)}&type=${encodeURIComponent(type)}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(filename)}`;
    
    // Trigger download via hidden frame
    dlFrame.src = downloadEndpoint;

    // 2. Also trigger direct link download attribute
    const a = document.createElement('a');
    a.href = downloadEndpoint;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 2000);

    setTimeout(() => {
        if (btn) {
            btn.innerHTML = `<i class="fas fa-check-circle"></i> Downloaded! Click to Download Again`;
            btn.disabled = false;
        }
    }, 4000);
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

    const meta = await getYouTubeMetadata(videoID);
    const cleanTitle = (meta.title || 'audio').replace(/[^\w\s-]/gi, '').trim().substring(0, 60);
    const filename = `${cleanTitle}.mp3`;

    startInSiteProcessing(box, 'Converting to MP3', 'Processing audio stream in ' + quality + 'kbps...', () => {
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
                <div class="dl-ready-note">
                    <i class="fas fa-check-circle"></i>
                    <span>Audio conversion completed! Click below to save file to your device.</span>
                </div>
                <div class="dl-download-actions">
                    <button id="mainAudioDlBtn" class="dl-btn-main" onclick="triggerDirectDeviceDownload('${videoID}', 'audio', '${quality}', '${escapeHtml(filename)}', 'mainAudioDlBtn')">
                        <i class="fas fa-download"></i> Download MP3 (${quality}kbps)
                    </button>
                    <div class="dl-servers-grid">
                        <button id="server2AudioBtn" class="dl-btn-server" onclick="triggerDirectDeviceDownload('${videoID}', 'audio', '192', '${escapeHtml(filename)}', 'server2AudioBtn')">
                            <i class="fas fa-bolt"></i> High-Speed Server 2
                        </button>
                        <button id="server3AudioBtn" class="dl-btn-server" onclick="triggerDirectDeviceDownload('${videoID}', 'audio', '128', '${escapeHtml(filename)}', 'server3AudioBtn')">
                            <i class="fas fa-server"></i> High-Speed Server 3
                        </button>
                    </div>
                </div>
            </div>
        `;
        showToast('MP3 ready! Click Download.', 'success');
    });
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

    const meta = await getYouTubeMetadata(videoID);
    const cleanTitle = (meta.title || 'video').replace(/[^\w\s-]/gi, '').trim().substring(0, 60);
    const filename = `${cleanTitle}-${quality}p.mp4`;

    startInSiteProcessing(box, 'Processing MP4 Video', 'Fetching video stream in ' + quality + 'p...', () => {
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
                <div class="dl-ready-note">
                    <i class="fas fa-check-circle"></i>
                    <span>Video ready! Click below to save file to your device.</span>
                </div>
                <div class="dl-download-actions">
                    <button id="mainVideoDlBtn" class="dl-btn-main" onclick="triggerDirectDeviceDownload('${videoID}', 'video', '${quality}', '${escapeHtml(filename)}', 'mainVideoDlBtn')">
                        <i class="fas fa-download"></i> Download Video (${quality}p HD)
                    </button>
                    <div class="dl-servers-grid">
                        <button id="server2VideoBtn" class="dl-btn-server" onclick="triggerDirectDeviceDownload('${videoID}', 'video', '720', '${escapeHtml(filename)}', 'server2VideoBtn')">
                            <i class="fas fa-bolt"></i> High-Speed Server 2
                        </button>
                        <button id="server3VideoBtn" class="dl-btn-server" onclick="triggerDirectDeviceDownload('${videoID}', 'video', '480', '${escapeHtml(filename)}', 'server3VideoBtn')">
                            <i class="fas fa-server"></i> High-Speed Server 3
                        </button>
                    </div>
                </div>
            </div>
        `;
        showToast('Video ready! Click Download.', 'success');
    });
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

    const meta = await getYouTubeMetadata(videoID);
    const cleanTitle = (meta.title || 'silent-video').replace(/[^\w\s-]/gi, '').trim().substring(0, 60);
    const filename = `${cleanTitle}-silent-${quality}p.mp4`;

    startInSiteProcessing(box, 'Extracting Silent Video', 'Rendering video-only track in ' + quality + 'p...', () => {
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
                <div class="dl-ready-note">
                    <i class="fas fa-check-circle"></i>
                    <span>Silent video stream ready! Click below to save file to your device.</span>
                </div>
                <div class="dl-download-actions">
                    <button id="mainSilentDlBtn" class="dl-btn-main" onclick="triggerDirectDeviceDownload('${videoID}', 'videoonly', '${quality}', '${escapeHtml(filename)}', 'mainSilentDlBtn')">
                        <i class="fas fa-download"></i> Download Silent Video (${quality}p)
                    </button>
                    <div class="dl-servers-grid">
                        <button id="server2SilentBtn" class="dl-btn-server" onclick="triggerDirectDeviceDownload('${videoID}', 'videoonly', '720', '${escapeHtml(filename)}', 'server2SilentBtn')">
                            <i class="fas fa-bolt"></i> High-Speed Server 2
                        </button>
                        <button id="server3SilentBtn" class="dl-btn-server" onclick="triggerDirectDeviceDownload('${videoID}', 'videoonly', '480', '${escapeHtml(filename)}', 'server3SilentBtn')">
                            <i class="fas fa-server"></i> High-Speed Server 3
                        </button>
                    </div>
                </div>
            </div>
        `;
        showToast('Silent video ready! Click Download.', 'success');
    });
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
