/* ============================================
   YouTube All-Rounder - Content Generators
   Template-based + Optional Gemini API
   ============================================ */

/* ============================================
   Description Generator
   ============================================ */
async function generateDescription() {
    const title = document.getElementById('descTitle').value.trim();
    const topic = document.getElementById('descTopic').value.trim();
    const tone = document.getElementById('descTone').value;
    const includeLinks = document.getElementById('descIncludeLinks').checked;
    const includeTimestamps = document.getElementById('descIncludeTimestamps').checked;
    const includeCTA = document.getElementById('descIncludeCTA').checked;

    if (!title) { showToast('Please enter a video title', 'error'); return; }

    const resultContainer = document.getElementById('descResult');
    const outputField = document.getElementById('descOutput');
    resultContainer.classList.add('active');
    outputField.value = 'Generating...';

    // Try Gemini API if key exists
    if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
        const prompt = `Generate a YouTube video description for:
Title: ${title}
Topic: ${topic || title}
Tone: ${tone}
${includeTimestamps ? 'Include timestamps.' : ''}
${includeCTA ? 'Include call to action.' : ''}
${includeLinks ? 'Include social media links.' : ''}
Include hashtags at the end. Make it SEO optimized.`;

        const aiResult = await callGemini(prompt);
        if (aiResult) {
            outputField.value = aiResult;
            showToast('AI description generated!', 'success');
            return;
        }
    }

    // Template fallback
    outputField.value = generateDescriptionTemplate(title, topic, tone, includeLinks, includeTimestamps, includeCTA);
    showToast('Description generated!', 'success');
}

function generateDescriptionTemplate(title, topic, tone, includeLinks, includeTimestamps, includeCTA) {
    const openings = {
        professional: `Welcome to this comprehensive guide on ${topic || title}.`,
        casual: `Hey everyone! Welcome back to the channel!`,
        funny: `What's up, amazing people! You asked for it, here it is!`,
        informative: `In this video, we explore everything about ${topic || title}.`,
        promotional: `Looking for the best ${topic || title}? You're in the right place!`
    };

    let desc = openings[tone] + '\n\n';
    desc += `In this video about "${topic || title}", we cover:\n`;
    desc += `• What is ${topic || title}\n`;
    desc += `• How to get started\n`;
    desc += `• Tips and tricks\n`;
    desc += `• Common mistakes to avoid\n\n`;

    if (includeTimestamps) {
        desc += '📌 TIMESTAMPS:\n';
        desc += '0:00 - Introduction\n';
        desc += '0:30 - Overview\n';
        desc += '2:00 - Main Content\n';
        desc += '5:00 - Tips & Tricks\n';
        desc += '8:00 - Conclusion\n\n';
    }

    if (includeCTA) {
        desc += '👍 LIKE this video if you found it helpful!\n';
        desc += '💬 COMMENT your thoughts below!\n';
        desc += '🔔 SUBSCRIBE for more content!\n\n';
    }

    if (includeLinks) {
        desc += '🔗 CONNECT WITH US:\n';
        desc += '━━━━━━━━━━━━━━━━━━━\n';
        desc += '🌐 Website: https://yourwebsite.com\n';
        desc += '🐦 Twitter: @yourhandle\n';
        desc += '📸 Instagram: @yourhandle\n';
        desc += '━━━━━━━━━━━━━━━━━━━\n\n';
    }

    desc += `🔍 RELATED SEARCHES:\n`;
    desc += `${topic || title}, ${topic || title} tutorial, ${topic || title} guide, how to ${topic || title}\n\n`;
    desc += '━━━━━━━━━━━━━━━━━━━\n';
    desc += '#youtube #youtuber #tutorial #howto #tips #guide #education #viral #trending #subscribe';

    return desc;
}

/* ============================================
   Hashtag Generator
   ============================================ */
async function generateHashtags() {
    const topic = document.getElementById('hashTopic').value.trim();
    const platform = document.getElementById('hashPlatform').value;
    const count = parseInt(document.getElementById('hashCount').value);
    const type = document.querySelector('input[name="hashType"]:checked').value;

    if (!topic) { showToast('Please enter a topic', 'error'); return; }

    const resultContainer = document.getElementById('hashResult');
    const outputContainer = document.getElementById('hashOutput');
    resultContainer.classList.add('active');

    // Try Gemini API
    if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
        const prompt = `Generate ${count} ${type} hashtags for ${platform} about "${topic}". Return only hashtags separated by spaces.`;
        const aiResult = await callGemini(prompt);
        if (aiResult) {
            const hashtags = aiResult.split(/\s+/).filter(h => h.startsWith('#')).slice(0, count);
            outputContainer.innerHTML = '';
            hashtags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'hashtag-tag';
                span.textContent = tag;
                span.onclick = () => copyToClipboard(tag);
                outputContainer.appendChild(span);
            });
            showToast(`AI generated ${hashtags.length} hashtags!`, 'success');
            return;
        }
    }

    // Template fallback
    const hashtags = generateHashtagsByTopic(topic, platform, count, type);
    outputContainer.innerHTML = '';
    hashtags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'hashtag-tag';
        span.textContent = tag;
        span.onclick = () => copyToClipboard(tag);
        outputContainer.appendChild(span);
    });
    showToast(`Generated ${hashtags.length} hashtags!`, 'success');
}

function generateHashtagsByTopic(topic, platform, count, type) {
    const words = topic.toLowerCase().split(/\s+/);
    const mainWord = words[0];

    const trending = {
        youtube: ['#youtube', '#youtuber', '#youtubers', '#youtubechannel', '#viral', '#trending', '#subscribe', '#like', '#contentcreator', '#video', '#tutorial', '#howto', '#tips', '#education', '#entertainment', '#gaming', '#tech', '#lifestyle', '#music', '#funny'],
        instagram: ['#instagram', '#instagood', '#photooftheday', '#instadaily', '#beautiful', '#happy', '#follow', '#like4like', '#f4f', '#explore', '#trending', '#viral', '#reels', '#photography', '#art', '#love', '#style', '#nature', '#travel', '#food'],
        tiktok: ['#tiktok', '#fyp', '#foryou', '#foryoupage', '#viral', '#trending', '#tiktokviral', '#funny', '#comedy', '#dance', '#music', '#duet', '#challenge', '#lifehack', '#tips', '#tutorial', '#howto', '#diy', '#creative', '#famous'],
        twitter: ['#twitter', '#tweet', '#trending', '#news', '#live', '#update', '#motivation', '#quote', '#discussion', '#thread', '#community', '#follow', '#retweet', '#viral', '#tech', '#gaming', '#sports', '#music', '#film', '#podcast']
    };

    const categoryTags = {
        general: ['#tutorial', '#guide', '#tips', '#howto', '#education'],
        trending: ['#viral', '#trending', '#fyp', '#explore', '#famous'],
        niche: ['#expert', '#pro', '#advanced', '#masterclass', '#deepdive'],
        mixed: ['#youtube', '#video', '#content', '#creator', '#community']
    };

    let hashtags = words.map(w => `#${w}`);
    hashtags = [...hashtags, ...(trending[platform] || trending.youtube)];
    hashtags = [...hashtags, ...(categoryTags[type] || categoryTags.general)];
    hashtags.push(`#${mainWord}2024`, `#${mainWord}tips`, `#${mainWord}tutorial`);

    return [...new Set(hashtags.map(h => h.toLowerCase()))].slice(0, count);
}

/* ============================================
   Tags Generator
   ============================================ */
async function generateTags() {
    const title = document.getElementById('tagTitle').value.trim();
    const category = document.getElementById('tagCategory').value;
    const count = parseInt(document.getElementById('tagCount').value);

    if (!title) { showToast('Please enter a video title', 'error'); return; }

    const resultContainer = document.getElementById('tagResult');
    const outputContainer = document.getElementById('tagOutput');
    resultContainer.classList.add('active');

    // Try Gemini API
    if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
        const prompt = `Generate ${count} YouTube video tags for a ${category} video titled: "${title}". Return only tags separated by commas.`;
        const aiResult = await callGemini(prompt);
        if (aiResult) {
            const tags = aiResult.split(',').map(t => t.trim()).filter(t => t).slice(0, count);
            outputContainer.innerHTML = '';
            tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag-item';
                span.textContent = tag;
                span.onclick = () => copyToClipboard(tag);
                outputContainer.appendChild(span);
            });
            showToast(`AI generated ${tags.length} tags!`, 'success');
            return;
        }
    }

    // Template fallback
    const tags = generateTagsByTitle(title, category, count);
    outputContainer.innerHTML = '';
    tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag-item';
        span.textContent = tag;
        span.onclick = () => copyToClipboard(tag);
        outputContainer.appendChild(span);
    });
    showToast(`Generated ${tags.length} tags!`, 'success');
}

function generateTagsByTitle(title, category, count) {
    const words = title.toLowerCase().split(/\s+/);
    const mainWords = words.filter(w => w.length > 3);

    let tags = [title.toLowerCase()];
    if (mainWords.length > 0) tags.push(mainWords.join(' '));
    words.forEach(word => { if (word.length > 3) tags.push(word); });

    tags = [...tags, 'how to', 'tutorial', 'guide', 'tips', 'tricks', 'review', 'best', 'top', 'explained', 'beginner', '2024', 'new', 'latest'];

    const categoryTags = {
        general: ['video', 'tutorial', 'guide', 'tips', 'education'],
        gaming: ['gaming', 'gameplay', 'gamer', 'lets play', 'walkthrough'],
        tech: ['technology', 'tech', 'gadget', 'review', 'unboxing'],
        education: ['learn', 'study', 'class', 'lesson', 'course'],
        entertainment: ['funny', 'comedy', 'entertainment', 'viral', 'fun'],
        music: ['song', 'music video', 'live performance', 'cover', 'remix'],
        sports: ['sports', 'highlights', 'match', 'training', 'skills'],
        cooking: ['recipe', 'cook', 'cooking', 'food', 'chef'],
        travel: ['travel', 'vlog', 'trip', 'adventure', 'destination'],
        fitness: ['workout', 'exercise', 'training', 'gym', 'health'],
        beauty: ['makeup', 'skincare', 'beauty', 'tutorial', 'products'],
        finance: ['money', 'invest', 'finance', 'stock', 'crypto']
    };

    tags = [...tags, ...(categoryTags[category] || categoryTags.general)];
    mainWords.forEach(word => {
        tags.push(`${word} tutorial`, `best ${word}`, `${word} tips`, `how to ${word}`);
    });

    return [...new Set(tags)].slice(0, count);
}

/* ============================================
   Title Optimizer
   ============================================ */
async function optimizeTitle() {
    const title = document.getElementById('optTitle').value.trim();
    const keyword = document.getElementById('optKeyword').value.trim();
    const goal = document.getElementById('optGoal').value;

    if (!title) { showToast('Please enter a title', 'error'); return; }

    const resultContainer = document.getElementById('optResult');
    const outputContainer = document.getElementById('optOutput');
    resultContainer.classList.add('active');

    // Try Gemini API
    if (typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY) {
        const prompt = `Optimize this YouTube title for ${goal}. Title: "${title}", Keyword: "${keyword || 'none'}". Give 5 optimized variations with scores.`;
        const aiResult = await callGemini(prompt);
        if (aiResult) {
            outputContainer.innerHTML = '';
            const lines = aiResult.split('\n').filter(l => l.trim());
            lines.forEach(line => {
                const div = document.createElement('div');
                div.className = 'title-option';
                div.onclick = () => copyToClipboard(line.replace(/^\d+\.\s*/, ''));
                div.innerHTML = `<div class="title-option-text">${line}</div>`;
                outputContainer.appendChild(div);
            });
            showToast('AI-optimized titles ready!', 'success');
            return;
        }
    }

    // Template fallback
    const titles = generateOptimizedTitles(title, keyword, goal);
    outputContainer.innerHTML = '';
    titles.forEach(item => {
        const div = document.createElement('div');
        div.className = 'title-option';
        div.onclick = () => copyToClipboard(item.title);
        div.innerHTML = `
            <div class="title-option-text">${item.title}</div>
            <div class="title-option-score">Score: <strong>${item.score}%</strong> | ${item.reason}</div>
        `;
        outputContainer.appendChild(div);
    });
    showToast('Titles optimized!', 'success');
}

function generateOptimizedTitles(title, keyword, goal) {
    const titles = [];
    const kw = keyword || title;

    if (goal === 'clicks') {
        titles.push({ title: `INCREDIBLE ${title} You NEED To See!`, score: 92, reason: 'High CTR with power word' });
        titles.push({ title: `I Tried ${title} For 30 Days - Results`, score: 88, reason: 'Personal story creates curiosity' });
        titles.push({ title: `The TRUTH About ${title}`, score: 90, reason: 'Promises exclusive info' });
        titles.push({ title: `${title} (AMAZING Results!)`, score: 87, reason: 'Excitement builder' });
        titles.push({ title: `Why ${title} Changes Everything`, score: 85, reason: 'Bold claim' });
    } else if (goal === 'seo') {
        titles.push({ title: `How To ${kw} - Complete 2024 Guide`, score: 95, reason: 'Keyword-rich with year' });
        titles.push({ title: `${kw} Tutorial: Step-by-Step Guide`, score: 93, reason: 'Clear structure' });
        titles.push({ title: `Learn ${kw} in 10 Minutes`, score: 88, reason: 'Specific time' });
        titles.push({ title: `${kw} Explained: Everything You Need`, score: 90, reason: 'Comprehensive' });
        titles.push({ title: `${kw} for Beginners: Complete Tutorial`, score: 91, reason: 'Targets beginners' });
    } else {
        titles.push({ title: `${title} Just Changed EVERYTHING!`, score: 94, reason: 'Urgency + drama' });
        titles.push({ title: `Why ${title} Is Going VIRAL`, score: 91, reason: 'Trending leverage' });
        titles.push({ title: `The ${title} Secret Breaking The Internet`, score: 89, reason: 'Curiosity gap' });
        titles.push({ title: `${title} Will Blow Your Mind`, score: 87, reason: 'Strong emotion' });
        titles.push({ title: `Everyone Is Talking About ${title}`, score: 86, reason: 'Social proof' });
    }

    return titles.slice(0, 5);
}

/* ============================================
   Gemini API Call (shared with app.js)
   ============================================ */
async function callGemini(prompt) {
    if (typeof GEMINI_API_KEY === 'undefined' || !GEMINI_API_KEY) return null;

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
