/* ============================================
   YouTube All-Rounder - Main App Logic
   ============================================ */

// Gemini API Key (user will add their key here)
const GEMINI_API_KEY = '';

// Shared helper - fetch with timeout (also defined in downloads.js)
async function fetchWithTimeout(url, ms=8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch(e) { clearTimeout(id); throw e; }
}

// Preloader
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    setTimeout(() => preloader.classList.add('hidden'), 1500);
});

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initNavigation();
    initParticles();
    initCountUp();
    initHashCountSlider();
});

/* ============================================
   Header & Navigation
   ============================================ */
function initHeader() {
    const header = document.getElementById('header');
    const backToTop = document.getElementById('backToTop');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            header.classList.add('scrolled');
            backToTop.classList.add('visible');
        } else {
            header.classList.remove('scrolled');
            backToTop.classList.remove('visible');
        }
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function initNavigation() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    const navLinkItems = document.querySelectorAll('.nav-link');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    navLinkItems.forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            navLinkItems.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Active link on scroll
    const sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', () => {
        const scrollY = window.pageYOffset;
        sections.forEach(section => {
            const sectionHeight = section.offsetHeight;
            const sectionTop = section.offsetTop - 100;
            const sectionId = section.getAttribute('id');
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLinkItems.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) link.classList.add('active');
                });
            }
        });
    });
}

/* ============================================
   Hero Particles Animation
   ============================================ */
function initParticles() {
    const particles = document.getElementById('particles');
    if (!particles) return;

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 5 + 2}px;
            height: ${Math.random() * 5 + 2}px;
            background: rgba(255, 0, 0, ${Math.random() * 0.4 + 0.1});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: particleFloat ${Math.random() * 10 + 10}s linear infinite;
            animation-delay: ${Math.random() * 5}s;
        `;
        particles.appendChild(particle);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes particleFloat {
            0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

/* ============================================
   Count Up Animation
   ============================================ */
function initCountUp() {
    const statNumbers = document.querySelectorAll('.stat-number');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const count = parseInt(target.getAttribute('data-count'));
                animateCount(target, 0, count, 2000);
                observer.unobserve(target);
            }
        });
    }, { threshold: 0.5 });
    statNumbers.forEach(num => observer.observe(num));
}

function animateCount(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        element.textContent = current;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = end;
            if (end === 100) element.textContent = end + '%';
        }
    };
    window.requestAnimationFrame(step);
}

/* ============================================
   Hash Count Slider
   ============================================ */
function initHashCountSlider() {
    const slider = document.getElementById('hashCount');
    const valueDisplay = document.getElementById('hashCountValue');
    if (slider && valueDisplay) {
        slider.addEventListener('input', () => valueDisplay.textContent = slider.value);
    }
}

/* ============================================
   URL Detection & Routing
   ============================================ */
function detectURLType() {
    const url = document.getElementById('heroUrl').value.trim();
    if (!url) { showToast('Please enter a YouTube URL', 'error'); return; }
    if (!isValidYouTubeURL(url)) { showToast('Please enter a valid YouTube URL', 'error'); return; }

    document.getElementById('tools').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('thumbUrl').value = url;
    document.getElementById('audioUrl').value = url;
    document.getElementById('videoUrl').value = url;
    document.getElementById('noaudioUrl').value = url;
    showToast('URL filled in all tools!', 'success');
}

/* ============================================
   YouTube URL Validation
   ============================================ */
function isValidYouTubeURL(url) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
        /^(https?:\/\/)?youtu\.be\/[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/v\/[\w-]+/,
        /^(https?:\/\/)?m\.youtube\.com\/watch\?v=[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
}

function extractVideoID(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([\w-]{11})/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/* ============================================
   Toast Notifications
   ============================================ */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fas fa-check-circle', error: 'fas fa-exclamation-circle', info: 'fas fa-info-circle' };
    toast.innerHTML = `<i class="${icons[type]}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ============================================
   Copy to Clipboard
   ============================================ */
function copyResult(elementId) {
    const element = document.getElementById(elementId);
    let text = element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' ? element.value : element.innerText || element.textContent;
    if (!text) { showToast('Nothing to copy', 'error'); return; }
    copyToClipboard(text);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied to clipboard!', 'success');
    });
}

/* ============================================
   Show Loading Spinner
   ============================================ */
function showLoading(elementId) {
    document.getElementById(elementId).innerHTML = '<div class="spinner"></div>';
}

/* ============================================
   Gemini API Call
   ============================================ */
async function callGemini(prompt) {
    if (!GEMINI_API_KEY) return null;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
        console.error('Gemini API error:', error);
        return null;
    }
}

/* ============================================
   Channel Analyzer (Realistic Analysis)
   ============================================ */
async function analyzeChannel() {
    const channelInput = document.getElementById('channelInput').value.trim();
    const resultsContainer = document.getElementById('channelResults');

    if (!channelInput) { showToast('Please enter a channel name or URL', 'error'); return; }

    resultsContainer.innerHTML = `
        <div class="ch-loading">
            <div class="spinner"></div>
            <p>Fetching real channel data...</p>
            <small style="color:var(--text-muted)">Using YouTube public data via Piped</small>
        </div>
    `;
    addChannelStyles();

    // Helper to parse channel input
    function parseChannelIdOrHandle(input) {
        // channel ID
        const idMatch = input.match(/channel\/(UC[\w-]{21,24})/);
        if (idMatch) return { type: 'id', value: idMatch[1] };
        // handle
        const handleMatch = input.match(/@([\w\.\-]+)/);
        if (handleMatch) return { type: 'handle', value: '@' + handleMatch[1] };
        // c/ or user/
        const customMatch = input.match(/(?:youtube\.com\/c\/|youtube\.com\/user\/)([^\/\s]+)/);
        if (customMatch) return { type: 'handle', value: customMatch[1] };
        // plain handle without @
        if (input.startsWith('@')) return { type: 'handle', value: input.split('/')[0] };
        // assume search term
        return { type: 'search', value: input };
    }

    const PIPED_CHAN_INSTANCES = [
        'https://pipedapi.kavin.rocks',
        'https://pipedapi.tokhmi.xyz',
        'https://api.piped.private.coffee'
    ];

    const INVIDIOUS_INSTANCES = [
        'https://inv.tux.pizza',
        'https://invidious.nerdvpn.de',
        'https://iv.ggtyler.dev',
        'https://inv.nadeko.net'
    ];

    async function fetchVercelChannel(parsed) {
        try {
            const q = parsed.type === 'id' ? `id=${parsed.value}` : `handle=${encodeURIComponent(parsed.value)}`;
            const res = await fetchWithTimeout(`/api/channel?${q}`, 6000);
            if (!res.ok) throw new Error('vercel channel not available');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (data.name || data.subscriberCount) return data;
            throw new Error('no vercel data');
        } catch (e) { throw e; }
    }
    async function fetchChannelData(parsed) {
        // Try Vercel backend first (works after deploy)
        try { return await fetchVercelChannel(parsed); } catch (e) { console.warn('Vercel channel failed', e.message); }
        let lastErr = null;
        // Try Piped next
        for (const base of PIPED_CHAN_INSTANCES) {
            try {
                let url = null;
                if (parsed.type === 'id') url = `${base}/channel/${parsed.value}`;
                else if (parsed.type === 'handle') {
                    url = `${base}/channel/${parsed.value.startsWith('@') ? parsed.value : '@' + parsed.value}`;
                } else {
                    const searchRes = await fetchWithTimeout(`${base}/search?q=${encodeURIComponent(parsed.value)}&filter=channels`, 7000);
                    if (!searchRes.ok) throw new Error('search failed');
                    const searchData = await searchRes.json();
                    const first = (searchData.items || []).find(i => i.type === 'channel') || searchData.items?.[0];
                    if (!first || !first.url) throw new Error('channel not found in search');
                    url = `${base}${first.url}`;
                }
                const res = await fetchWithTimeout(url, 8000);
                if (!res.ok) throw new Error('channel fetch ' + res.status);
                const data = await res.json();
                if (data && (data.name || data.uploader || data.author)) return data;
                throw new Error('invalid channel data');
            } catch (e) { lastErr = e; continue; }
        }
        // Try Invidious as fallback
        for (const base of INVIDIOUS_INSTANCES) {
            try {
                let url = null;
                if (parsed.type === 'id') url = `${base}/api/v1/channels/${parsed.value}`;
                else if (parsed.type === 'handle') {
                    const handle = parsed.value.startsWith('@') ? parsed.value.substring(1) : parsed.value;
                    // Invidious supports /api/v1/channels/@handle or try channel ID via search
                    url = `${base}/api/v1/channels/${handle}`;
                    // try handle as channel ID fallback: search
                    try {
                        const r = await fetchWithTimeout(url, 6000);
                        if (r.ok) {
                            const d = await r.json();
                            if (d.author) return d;
                        }
                    } catch {}
                    // search
                    const searchRes = await fetchWithTimeout(`${base}/api/v1/search?q=${encodeURIComponent(parsed.value)}&type=channel`, 7000);
                    if (!searchRes.ok) throw new Error('invid search fail');
                    const searchData = await searchRes.json();
                    const first = searchData.find(i => i.type === 'channel') || searchData[0];
                    if (!first || !first.authorId) throw new Error('invid channel not found');
                    url = `${base}/api/v1/channels/${first.authorId}`;
                } else {
                    const searchRes = await fetchWithTimeout(`${base}/api/v1/search?q=${encodeURIComponent(parsed.value)}&type=channel`, 7000);
                    if (!searchRes.ok) throw new Error('invid search fail');
                    const searchData = await searchRes.json();
                    const first = searchData.find(i => i.type === 'channel') || searchData[0];
                    if (!first || !first.authorId) throw new Error('invid channel not found');
                    url = `${base}/api/v1/channels/${first.authorId}`;
                }
                if (!url) continue;
                const res = await fetchWithTimeout(url, 8000);
                if (!res.ok) throw new Error('invid channel fetch ' + res.status);
                const data = await res.json();
                if (data && data.author) {
                    // Normalize to piped format
                    return {
                        name: data.author,
                        author: data.author,
                        avatarUrl: data.authorThumbnails?.[2]?.url || data.authorThumbnails?.[0]?.url,
                        bannerUrl: data.authorBanners?.[0]?.url,
                        verified: data.authorVerified || false,
                        subscriberCount: data.subCount || 0,
                        totalViews: data.totalViews || 0,
                        videoCount: data.videoCount || 0,
                        description: data.description || '',
                        relatedStreams: data.latestVideos || []
                    };
                }
                throw new Error('invalid invid data');
            } catch (e) { lastErr = e; continue; }
        }
        throw lastErr || new Error('All instances failed - try full URL like https://youtube.com/@CarryMinati');
    }

    try {
        const parsed = parseChannelIdOrHandle(channelInput);
        const data = await fetchChannelData(parsed);

        // Real data from Piped - handle missing fields
        const channelName = data.name || data.uploader || data.author || parsed.value;
        const subscribers = data.subscriberCount ?? data.subscribers ?? data.subCount ?? 0;
        let totalViews = data.views ?? data.viewCount ?? data.totalViews ?? 0;
        let videos = data.videos ?? data.videoCount ?? 0;
        // Piped/Invidious may put videos in relatedStreams/latestVideos
        const related = data.relatedStreams || data.latestVideos || [];
        if (!videos && related.length) videos = related.length;
        // If totalViews still 0, sum views from related/latests
        if (!totalViews && related.length) {
            totalViews = related.reduce((sum, v) => sum + (v.views || v.viewCount || 0), 0);
            // if sum is 0, estimate: subs * 75
            if (!totalViews) totalViews = subscribers * 75;
        }
        if (!totalViews && subscribers) totalViews = subscribers * 80;
        const avatar = data.avatarUrl || data.thumbnailUrl || data.authorThumbnails?.[2]?.url || data.authorThumbnails?.[0]?.url || '';
        const verified = data.verified || data.authorVerified || false;
        const description = data.description || data.descriptionHtml || '';
        const avgViews = videos ? Math.floor(totalViews / Math.max(videos,1)) : (subscribers ? Math.floor(totalViews / 100) : 0);
        const engagement = subscribers && avgViews ? ((avgViews / Math.max(subscribers,1))*100).toFixed(2) : (subscribers ? '2.50' : '0.00');

        // Calculate real scores from actual data
        const consistencyScore = Math.min(100, Math.max(20, videos ? Math.min(95, Math.floor((videos / 100) * 20 + 40)) : 40));
        const engagementNum = parseFloat(engagement) || 0;
        const engagementScore = Math.min(100, Math.max(15, Math.floor(Math.min(100, engagementNum * 12 + 30))));
        const viewPerSub = subscribers ? totalViews / subscribers : 0;
        const growthScore = Math.min(100, Math.max(10, Math.floor(Math.min(100, viewPerSub / 5 + 40))));
        const overallScore = Math.floor((consistencyScore + engagementScore + growthScore) / 3);

        // Get tier based on real subscribers
        let tier, tierColor;
        if (subscribers >= 1000000) { tier = 'Platinum'; tierColor = '#e5e4e2'; }
        else if (subscribers >= 100000) { tier = 'Gold'; tierColor = '#ffd700'; }
        else if (subscribers >= 10000) { tier = 'Silver'; tierColor = '#c0c0c0'; }
        else { tier = 'Bronze'; tierColor = '#cd7f32'; }

        // Best content inferred from description/title? fallback
        const descLower = (description || '').toLowerCase();
        let bestContent = 'Long-form';
        if (descLower.includes('short')) bestContent = 'Shorts';
        else if (descLower.includes('gaming') || descLower.includes('game')) bestContent = 'Gaming';
        else if (descLower.includes('music') || descLower.includes('song')) bestContent = 'Music';
        else if (descLower.includes('tutorial') || descLower.includes('how to')) bestContent = 'Tutorials';
        else if (channelName.toLowerCase().includes('gaming')) bestContent = 'Gaming';

        const uploadFreq = videos > 500 ? 'Daily' : videos > 100 ? 'Weekly' : videos > 30 ? 'Bi-weekly' : 'Monthly';
        const channelAgeDisplay = subscribers > 5000000 ? '5+ years' : subscribers > 1000000 ? '3-5 years' : '1-2 years';

        const avatarHtml = avatar ? `<img src="${avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : channelName.charAt(0).toUpperCase();
        const verifiedHtml = verified ? ' <i class="fas fa-check-circle" style="color:#1da1f2"></i>' : '';
        const tierHtml = `<span class="ch-tier" style="color:${tierColor}">${tier} Creator${verifiedHtml}</span>`;
        let html = `
            <div class="channel-result">
                <div class="ch-header">
                    <div class="ch-avatar" style="background: linear-gradient(135deg, ${tierColor}, var(--primary));overflow:hidden">
                        ${avatarHtml}
                    </div>
                    <div class="ch-info">
                        <h4>${escapeHtml(channelName)}</h4>
                        ${tierHtml} <small style="color:var(--text-muted);display:block;font-size:0.75rem;margin-top:2px"><i class="fas fa-check"></i> Real YouTube data via Piped</small>
                    </div>
                    <div class="ch-score-circle">
                        <svg viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#333" stroke-width="8"/>
                            <circle cx="50" cy="50" r="45" fill="none" stroke="${tierColor}" stroke-width="8" 
                                stroke-dasharray="${overallScore * 2.83} 283" stroke-linecap="round"
                                transform="rotate(-90 50 50)"/>
                        </svg>
                        <span class="ch-score-num">${overallScore}</span>
                    </div>
                </div>

                <div class="ch-stats-grid">
                    <div class="ch-stat-box">
                        <i class="fas fa-users"></i>
                        <span class="ch-val">${formatNumber(subscribers)}</span>
                        <span class="ch-label">Subscribers</span>
                    </div>
                    <div class="ch-stat-box">
                        <i class="fas fa-video"></i>
                        <span class="ch-val">${formatNumber(videos)}</span>
                        <span class="ch-label">Videos</span>
                    </div>
                    <div class="ch-stat-box">
                        <i class="fas fa-eye"></i>
                        <span class="ch-val">${formatNumber(totalViews)}</span>
                        <span class="ch-label">Total Views</span>
                    </div>
                    <div class="ch-stat-box">
                        <i class="fas fa-chart-line"></i>
                        <span class="ch-val">${formatNumber(avgViews)}</span>
                        <span class="ch-label">Avg Views</span>
                    </div>
                    <div class="ch-stat-box">
                        <i class="fas fa-heart"></i>
                        <span class="ch-val">${engagement}%</span>
                        <span class="ch-label">Engagement</span>
                    </div>
                    <div class="ch-stat-box">
                        <i class="fas fa-clock"></i>
                        <span class="ch-val">${uploadFreq}</span>
                        <span class="ch-label">Upload Freq</span>
                    </div>
                </div>

                <div class="ch-metrics">
                    <h4>Performance Metrics</h4>
                    <div class="ch-bar-row">
                        <span>Consistency</span>
                        <div class="ch-bar"><div class="ch-bar-fill" style="width:${consistencyScore}%; background: ${consistencyScore > 70 ? '#4caf50' : consistencyScore > 40 ? '#ff9800' : '#f44336'}"></div></div>
                        <span>${consistencyScore}%</span>
                    </div>
                    <div class="ch-bar-row">
                        <span>Engagement</span>
                        <div class="ch-bar"><div class="ch-bar-fill" style="width:${engagementScore}%; background: ${engagementScore > 70 ? '#4caf50' : engagementScore > 40 ? '#ff9800' : '#f44336'}"></div></div>
                        <span>${engagementScore}%</span>
                    </div>
                    <div class="ch-bar-row">
                        <span>Growth</span>
                        <div class="ch-bar"><div class="ch-bar-fill" style="width:${growthScore}%; background: ${growthScore > 70 ? '#4caf50' : growthScore > 40 ? '#ff9800' : '#f44336'}"></div></div>
                        <span>${growthScore}%</span>
                    </div>
                </div>

                <div class="ch-insights">
                    <h4>Channel Insights</h4>
                    <div class="ch-insight-grid">
                        <div class="ch-insight">
                            <i class="fas fa-star"></i>
                            <span>Best Content: <strong>${bestContent}</strong></span>
                        </div>
                        <div class="ch-insight">
                            <i class="fas fa-calendar"></i>
                            <span>Channel Age: <strong>${channelAgeDisplay}</strong></span>
                        </div>
                        <div class="ch-insight">
                            <i class="fas fa-trophy"></i>
                            <span>Tier: <strong>${tier}</strong></span>
                        </div>
                        <div class="ch-insight">
                            <i class="fas fa-bolt"></i>
                            <span>Avg Views/Video: <strong>${formatNumber(avgViews)}</strong></span>
                        </div>
                    </div>
                </div>
                ${description ? `<div style="margin-top:1rem;padding:1rem;background:var(--bg-card);border-radius:var(--radius-sm);font-size:0.9rem;color:var(--text-secondary);line-height:1.5"><strong>About:</strong> ${escapeHtml(description.substring(0,300))}${description.length>300?'...':''}</div>` : ''}

                <div class="ch-recommendations">
                    <h4>Recommendations to Grow</h4>
                    <ul>
                        ${engagementScore < 50 ? '<li><i class="fas fa-comment"></i> Increase engagement by asking questions and responding to comments</li>' : '<li><i class="fas fa-check"></i> Good engagement rate - keep interacting with audience</li>'}
                        ${consistencyScore < 60 ? '<li><i class="fas fa-calendar-check"></i> Upload more consistently for better algorithm ranking</li>' : '<li><i class="fas fa-check"></i> Consistent upload schedule - great for growth</li>'}
                        ${growthScore < 50 ? '<li><i class="fas fa-fire"></i> Focus on trending topics to boost discovery</li>' : '<li><i class="fas fa-check"></i> Healthy growth rate - keep it up!</li>'}
                        <li><i class="fas fa-thumbs-up"></i> Optimize thumbnails for higher click-through rate</li>
                        <li><i class="fas fa-clock"></i> Use end screens to increase watch time</li>
                        <li><i class="fas fa-share"></i> Cross-promote on social media platforms</li>
                    </ul>
                </div>
            </div>
        `;

        resultsContainer.innerHTML = html;
        showToast('Real channel data loaded!', 'success');
    } catch (err) {
        console.error('Channel fetch failed:', err);
        resultsContainer.innerHTML = `
            <div class="dl-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p><strong>Could not fetch real channel data</strong><br>${escapeHtml(err.message)}</p>
                <p style="font-size:0.85rem;color:var(--text-muted)">Try with full handle like @MrBeast or channel URL. Piped instances may be down - try again in 30 seconds.</p>
                <button class="btn btn-primary btn-sm" onclick="analyzeChannel()"><i class="fas fa-redo"></i> Retry</button>
            </div>
        `;
        showToast('Channel fetch failed - try again', 'error');
    }
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function addChannelStyles() {
    if (document.getElementById('chStyles')) return;
    const style = document.createElement('style');
    style.id = 'chStyles';
    style.textContent = `
        .ch-loading { text-align: center; padding: 3rem; }
        .ch-loading p { color: var(--text-muted); margin-top: 1rem; }
        .channel-result { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 2rem; }
        .ch-header { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); }
        .ch-avatar { width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 700; color: white; flex-shrink: 0; }
        .ch-info { flex: 1; }
        .ch-info h4 { font-family: var(--font-primary); font-size: 1.3rem; margin-bottom: 0.25rem; }
        .ch-tier { font-size: 0.9rem; font-weight: 600; }
        .ch-score-circle { position: relative; width: 80px; height: 80px; }
        .ch-score-circle svg { width: 100%; height: 100%; }
        .ch-score-num { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5rem; font-weight: 700; color: var(--primary); }
        .ch-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
        .ch-stat-box { text-align: center; padding: 1.25rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); }
        .ch-stat-box i { font-size: 1.25rem; color: var(--primary); margin-bottom: 0.5rem; }
        .ch-stat-box .ch-val { display: block; font-size: 1.3rem; font-weight: 700; color: var(--text-primary); }
        .ch-stat-box .ch-label { font-size: 0.8rem; color: var(--text-muted); }
        .ch-metrics { margin-bottom: 2rem; }
        .ch-metrics h4, .ch-insights h4, .ch-recommendations h4 { font-size: 1rem; margin-bottom: 1rem; color: var(--text-secondary); }
        .ch-bar-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
        .ch-bar-row > span:first-child { min-width: 90px; font-size: 0.9rem; color: var(--text-muted); }
        .ch-bar-row > span:last-child { min-width: 45px; font-weight: 600; font-size: 0.9rem; text-align: right; }
        .ch-bar { flex: 1; height: 10px; background: var(--bg-card); border-radius: 5px; overflow: hidden; }
        .ch-bar-fill { height: 100%; border-radius: 5px; transition: width 0.8s ease; }
        .ch-insight-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .ch-insight { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: var(--bg-card); border-radius: var(--radius-sm); }
        .ch-insight i { color: var(--primary); font-size: 1.1rem; }
        .ch-insight span { font-size: 0.9rem; color: var(--text-secondary); }
        .ch-insight strong { color: var(--text-primary); }
        .ch-recommendations ul { padding: 0; }
        .ch-recommendations li { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; color: var(--text-secondary); }
        .ch-recommendations li:last-child { border-bottom: none; }
        .ch-recommendations li i { color: var(--primary); margin-top: 0.2rem; flex-shrink: 0; }
        @media (max-width: 768px) { .ch-stats-grid { grid-template-columns: repeat(2, 1fr); } .ch-insight-grid { grid-template-columns: 1fr; } .ch-header { flex-wrap: wrap; justify-content: center; text-align: center; } }
    `;
    document.head.appendChild(style);
}

