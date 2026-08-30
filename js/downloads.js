/* ============================================
   YouTube All-Rounder - Production Download System
   Strict State Machine:
   Processing... -> Successfully extracted -> Ready to download -> Downloading... -> Complete
   OR Processing... -> Extraction failed (real reason)
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
            if (!res.ok) throw new Error('CORS request failed');
            blob = await res.blob();
        } catch (e) {
            const proxy = 'https://corsproxy.io/?' + encodeURIComponent(url);
            const res2 = await fetch(proxy);
            if (!res2.ok) throw new Error('Proxy fallback failed');
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
        showToast('Thumbnail downloaded successfully!', 'success');
        if (status) status.textContent = 'Downloaded';
    } catch (err) {
        console.error('Thumbnail download error:', err);
        window.open(url, '_blank');
        showToast('Opened thumbnail in new tab to save manually', 'info');
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
        .dl-btn-main:disabled{opacity:0.7;cursor:not-allowed;transform:none;}
        .dl-btn-retry{background:#d32f2f !important;}
        .dl-btn-retry:hover{background:#b71c1c !important;}
        .dl-error-box{background:rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.3);border-radius:var(--radius-sm);padding:0.9rem 1.1rem;color:#ff8a80;font-size:0.85rem;margin-top:0.8rem;display:flex;flex-direction:column;gap:0.4rem;text-align:left;}
        .dl-error-title{font-weight:700;display:flex;align-items:center;gap:0.5rem;color:#ff5252;}
        .dl-error-details{font-size:0.8rem;color:#ffcdd2;word-break:break-all;font-family:monospace;background:rgba(0,0,0,0.2);padding:0.4rem 0.6rem;border-radius:4px;}
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

// Core Extraction & Validation Engine
async function probeAndExtractStream(videoID, type, quality, meta, box, retryCallback) {
    addDlBoxStyles();

    // 1. UI State: Processing / Extracting...
    box.innerHTML = `
        <div class="dl-processing-box">
            <div class="dl-processing-title"><i class="fas fa-cog fa-spin" style="color:var(--primary);margin-right:0.5rem"></i> Extracting Media Stream...</div>
            <div class="dl-processing-subtitle">Connecting to backend extraction service for ${type === 'audio' ? 'MP3 Audio' : 'MP4 Video'}...</div>
            <div class="dl-progress-bar-bg">
                <div class="dl-progress-bar-fill" style="width: 45%;"></div>
            </div>
            <div class="dl-progress-text">
                <span>Processing...</span>
                <span>Probing formats</span>
            </div>
        </div>
    `;

    try {
        const probeRes = await fetch(`/api/stream?id=${encodeURIComponent(videoID)}&type=${encodeURIComponent(type)}&quality=${encodeURIComponent(quality)}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        const probeData = await probeRes.json();

        // If extraction failed from backend
        if (!probeRes.ok || !probeData.success) {
            const errorReason = probeData.error || `Extraction failed with HTTP ${probeRes.status}`;
            const errorDetails = probeData.details || `Error code: ${probeData.code || probeRes.status} (${probeData.reason || 'UNKNOWN_ERROR'})`;

            // UI State: Extraction Failed -> show REAL reason
            box.innerHTML = `
                <div class="dl-result-box">
                    <div class="dl-head">
                        <div class="dl-icon" style="background:rgba(244,67,54,0.15);color:#f44336"><i class="fas fa-exclamation-triangle"></i></div>
                        <div class="dl-info">
                            <strong>${escapeHtml(meta.title)}</strong>
                            <p>${escapeHtml(meta.author)}</p>
                            <span class="dl-badge" style="color:#ff8a80;"><i class="fas fa-times-circle"></i> Extraction Failed</span>
                        </div>
                    </div>
                    <div class="dl-video-preview">
                        <img src="${meta.thumbnail}" alt="thumb">
                    </div>
                    <div class="dl-error-box">
                        <div class="dl-error-title"><i class="fas fa-times"></i> Extraction Error</div>
                        <div>${escapeHtml(errorReason)}</div>
                        <div class="dl-error-details">${escapeHtml(errorDetails)}</div>
                    </div>
                    <div class="dl-download-actions">
                        <button class="dl-btn-main dl-btn-retry" onclick="(${retryCallback.toString()})()">
                            <i class="fas fa-redo"></i> Retry Extraction
                        </button>
                    </div>
                </div>
            `;
            showToast('Extraction failed: ' + errorReason, 'error');
            return;
        }

        // 2. UI State: Successfully extracted -> Ready to download
        const cleanTitle = (meta.title || 'media').replace(/[^\w\s-]/gi, '').trim().substring(0, 60);
        const ext = type === 'audio' ? 'mp3' : 'mp4';
        const filename = `${cleanTitle}.${ext}`;

        box.innerHTML = `
            <div class="dl-result-box">
                <div class="dl-head">
                    <div class="dl-icon"><i class="fas ${type === 'audio' ? 'fa-music' : type === 'videoonly' ? 'fa-video-slash' : 'fa-video'}"></i></div>
                    <div class="dl-info">
                        <strong>${escapeHtml(meta.title)}</strong>
                        <p>${escapeHtml(meta.author)}</p>
                        <span class="dl-badge"><i class="fas fa-check-circle" style="color:#4caf50"></i> Verified • ${ext.toUpperCase()} ${quality}${type === 'audio' ? 'kbps' : 'p'}</span>
                    </div>
                </div>
                <div class="dl-video-preview">
                    <img src="${meta.thumbnail}" alt="thumb">
                </div>
                <div class="dl-ready-note">
                    <i class="fas fa-check-circle"></i>
                    <span>Successfully extracted! Ready to download directly to your device.</span>
                </div>
                <div id="${type}ErrorBox" class="dl-error-box" style="display:none;"></div>
                <div class="dl-download-actions">
                    <button id="main${type}DlBtn" class="dl-btn-main" onclick="executeProductionDownload('${videoID}', '${type}', '${quality}', '${escapeHtml(filename)}', 'main${type}DlBtn', '${type}ErrorBox')">
                        <i class="fas fa-download"></i> Download ${ext.toUpperCase()} (Ready)
                    </button>
                </div>
            </div>
        `;
        showToast('Successfully extracted! Ready to download.', 'success');
    } catch (networkErr) {
        console.error('[Probe Network Error]:', networkErr);
        box.innerHTML = `
            <div class="dl-result-box">
                <div class="dl-head">
                    <div class="dl-icon" style="background:rgba(244,67,54,0.15);color:#f44336"><i class="fas fa-wifi"></i></div>
                    <div class="dl-info">
                        <strong>${escapeHtml(meta.title)}</strong>
                        <p>${escapeHtml(meta.author)}</p>
                        <span class="dl-badge" style="color:#ff8a80;"><i class="fas fa-times-circle"></i> Network Error</span>
                    </div>
                </div>
                <div class="dl-error-box">
                    <div class="dl-error-title"><i class="fas fa-times"></i> Connection Error</div>
                    <div>Unable to connect to extraction endpoint. Check your internet connection or server status.</div>
                    <div class="dl-error-details">${escapeHtml(networkErr.message)}</div>
                </div>
                <div class="dl-download-actions">
                    <button class="dl-btn-main dl-btn-retry" onclick="(${retryCallback.toString()})()">
                        <i class="fas fa-redo"></i> Retry Connection
                    </button>
                </div>
            </div>
        `;
        showToast('Network error during extraction', 'error');
    }
}

// Production Download Execution
async function executeProductionDownload(videoID, type, quality, filename, btnId, errorBoxId) {
    const btn = document.getElementById(btnId);
    const errBox = errorBoxId ? document.getElementById(errorBoxId) : null;

    if (errBox) errBox.style.display = 'none';

    // UI State: Starting download...
    if (btn) {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Starting download...`;
        btn.disabled = true;
        btn.classList.remove('dl-btn-retry');
    }

    showToast('Starting download... Streaming file from server.', 'info');

    const downloadEndpoint = `/api/download?id=${encodeURIComponent(videoID)}&type=${encodeURIComponent(type)}&quality=${encodeURIComponent(quality)}&title=${encodeURIComponent(filename)}`;

    try {
        const response = await fetch(downloadEndpoint, {
            method: 'GET',
            headers: { 'Accept': '*/*' }
        });

        if (!response.ok) {
            let errorMsg = `Server error (${response.status})`;
            try {
                const errData = await response.json();
                if (errData.error) errorMsg = errData.error;
            } catch(e) {}
            throw new Error(errorMsg);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const text = await response.text();
            try {
                const json = JSON.parse(text);
                throw new Error(json.error || 'Server returned invalid format.');
            } catch(e) {
                throw new Error('Server returned JSON error response.');
            }
        }

        // UI State: Downloading (X%)...
        const contentLengthHeader = response.headers.get('content-length');
        const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
        let receivedBytes = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedBytes += value.length;

            if (totalBytes > 0 && btn) {
                const pct = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
                btn.innerHTML = `<i class="fas fa-download fa-bounce"></i> Downloading (${pct}%)...`;
            } else if (btn) {
                const mb = (receivedBytes / (1024 * 1024)).toFixed(1);
                btn.innerHTML = `<i class="fas fa-download fa-bounce"></i> Downloading (${mb}MB)...`;
            }
        }

        const blob = new Blob(chunks, { type: type === 'audio' ? 'audio/mpeg' : 'video/mp4' });
        if (blob.size === 0) {
            throw new Error('Received empty download stream.');
        }

        // UI State: Complete
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);

        showToast('Download complete! File saved to your device.', 'success');

        if (btn) {
            btn.innerHTML = `<i class="fas fa-check-circle"></i> Download Complete (Click to download again)`;
            btn.disabled = false;
        }
    } catch (err) {
        console.error('[Download Stream Error]:', err);
        showToast('Download failed: ' + err.message, 'error');

        if (btn) {
            btn.innerHTML = `<i class="fas fa-redo"></i> Download Failed - Retry`;
            btn.disabled = false;
            btn.classList.add('dl-btn-retry');
        }

        if (errBox) {
            errBox.style.display = 'flex';
            errBox.innerHTML = `
                <div class="dl-error-title"><i class="fas fa-times"></i> Stream Error</div>
                <div>${escapeHtml(err.message)}</div>
            `;
        }
    }
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
    await probeAndExtractStream(videoID, 'audio', quality, meta, box, downloadAudio);
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
    await probeAndExtractStream(videoID, 'video', quality, meta, box, downloadVideo);
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
    await probeAndExtractStream(videoID, 'videoonly', quality, meta, box, downloadVideoNoAudio);
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
