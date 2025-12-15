# 🕐 WebTime - Private Browsing Time Tracker

A privacy-focused browser extension that tracks your browsing time with **all data stored locally** on your device. No servers, no cloud, no data collection.

## ✨ Features

- **100% Private** - All data stored locally using `chrome.storage.local`
- **Time Tracking** - Automatically tracks time spent on each website
- **Visit Counting** - Records number of visits to each site
- **Daily/Weekly/All-Time Stats** - View your browsing patterns over different time periods
- **Export Data** - Download your data as JSON for backup or analysis
- **Clean UI** - Modern, dark-themed interface
- **Idle Detection** - Pauses tracking when you're away from the computer

## 🔒 Privacy

This extension is designed with privacy as the top priority:

- **No external servers** - Zero network requests for data storage
- **No analytics** - No tracking or telemetry
- **No accounts** - No sign-up or login required
- **Local only** - All data stays on your device
- **Open source** - Fully auditable code

## 📦 Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `webtime-extension` folder
6. The extension icon will appear in your toolbar

### Convert SVG Icons to PNG (Optional)

The extension includes SVG icons. For production use, convert them to PNG:

```bash
# Using ImageMagick or any image converter
convert icons/icon16.svg icons/icon16.png
convert icons/icon48.svg icons/icon48.png
convert icons/icon128.svg icons/icon128.png
```

Or use an online converter like [CloudConvert](https://cloudconvert.com/svg-to-png).

## 🚀 Usage

1. Click the WebTime icon in your browser toolbar
2. View your browsing statistics:
   - **Today** - Current day's activity
   - **This Week** - Last 7 days
   - **All Time** - Complete history
3. Use the buttons at the bottom to:
   - **Export Data** - Download as JSON
   - **Clear Data** - Delete all tracked data

## 📁 Project Structure

```
webtime-extension/
├── manifest.json      # Extension configuration
├── background.js      # Service worker for time tracking
├── popup.html         # Main popup interface
├── popup.css          # Popup styles
├── popup.js           # Popup functionality
├── icons/             # Extension icons
│   ├── icon16.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md
```

## 🛠️ Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions Used**:
  - `tabs` - To track active tab changes
  - `storage` - For local data persistence
  - `idle` - To detect user inactivity

## 📊 Data Format

Your exported data follows this structure:

```json
{
  "exportDate": "2025-12-15T...",
  "data": {
    "sites": {
      "example.com": {
        "totalTime": 123456,
        "visits": 42,
        "favicon": "https://...",
        "firstVisit": 1702648800000
      }
    },
    "dailyStats": {
      "2025-12-15": {
        "example.com": {
          "time": 12345,
          "visits": 5
        }
      }
    }
  }
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

MIT License - See [LICENSE](LICENSE) for details
browser extension to track usage
