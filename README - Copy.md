# YouTube All-Rounder - Free YouTube Tools

A professional, feature-rich website offering free YouTube tools including thumbnail downloader, audio extractor, video downloader, and content generators.

## Features

### Download Tools
- **Thumbnail Downloader** - Download YouTube thumbnails in HD, SD, and max resolution
- **Audio Downloader** - Extract and download audio as MP3 (up to 320kbps)
- **Video Downloader** - Download YouTube videos in MP4 format (up to 4K)
- **Video Without Audio** - Download silent video tracks

### Content Generators
- **Description Generator** - Generate SEO-optimized video descriptions
- **Hashtag Generator** - Create trending hashtags for YouTube, Instagram, TikTok
- **Tags Generator** - Generate relevant tags for your videos
- **Title Optimizer** - Optimize titles for clicks, SEO, or viral potential

### SEO Tools
- **Keyword Research** - Find related keywords for your content
- **Channel Analyzer** - Analyze YouTube channel performance
- **Trending Topics** - Discover what's trending on YouTube

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Animations**: GSAP, Animate.css
- **API**: cobalt.tools for downloads
- **Icons**: Font Awesome 6
- **Fonts**: Poppins, Inter

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

### Other Platforms
- Netlify
- GitHub Pages
- Any static hosting

## Customization

### Update Domain
1. Open `index.html`
2. Find `your-domain.vercel.app`
3. Replace with your actual domain

### Add Buy Me a Coffee
1. Get your link from buymeacoffee.com
2. Replace `YOURUSERNAME` in index.html
3. Add your QR code image

### Add Google AdSense
1. Sign up at adsense.google.com
2. Create ad units
3. Replace placeholders in index.html

## File Structure

```
youtube-all-rounder/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # Styles with animations
├── js/
│   ├── app.js          # Core app logic
│   ├── downloads.js    # Download tools
│   └── generators.js   # Content generators
├── vercel.json         # Vercel configuration
├── DEPLOYMENT.md       # Deployment guide
└── README.md           # This file
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License - Feel free to use and modify.

## Credits

- cobalt.tools for download API
- Font Awesome for icons
- Google Fonts for typography
