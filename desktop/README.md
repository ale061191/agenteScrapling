# Lead Finder Desktop - Build Guide

## Prerequisites

- Node.js 18+ (https://nodejs.org)
- Python 3.11+ (https://www.python.org)  
- npm (comes with Node.js)

## Project Structure

```
desktop/
├── package.json          # Electron app config
├── src/
│   └── main/
│       ├── main.js       # Electron main process
│       └── preload.js    # IPC bridge
├── python/
│   ├── api_server.py     # Flask API + scraper
│   └── requirements.txt  # Python dependencies
├── build/
│   └── icon.png          # App icon (512x512)
└── README.md
```

## Setup

### 1. Install Node.js dependencies

```bash
cd desktop
npm install
```

### 2. Install Python dependencies

```bash
cd python
pip install -r requirements.txt
```

### 3. Create app icon

Create a 512x512 PNG image and save as `build/icon.png` (Windows needs .ico, Mac needs .icns).

## Development

Run the app in development mode:

```bash
npm run dev
```

This will:
1. Start the Next.js dev server on http://localhost:3000
2. Start the Electron app
3. The Electron app will spawn the Python backend on port 8765
4. All dashboard API calls will proxy to the Python backend

## Build

### Build for Windows (.exe)

```bash
npm run build:win
```

Output: `dist/Lead Finder Venezuela-1.0.0-Setup.exe`

### Build for Mac (.dmg)

```bash
npm run build:mac
```

Output: `dist/Lead Finder Venezuela-1.0.0.dmg`

### Build for both

```bash
npm run build
```

## Environment Variables

For the Python backend to sync with Supabase, set these environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key

On first run, the app will create a SQLite database at:
- Windows: `%APPDATA%/lead-finder-desktop/leads.db`
- Mac: `~/Library/Application Support/lead-finder-desktop/leads.db`

## App Features

### Online Mode
- Search leads using Google Maps scraping
- All leads saved to local SQLite
- Manual sync to Supabase via "Sync Now" button or menu
- Full Kanban pipeline management

### Offline Mode
- View all previously fetched leads
- Manage pipeline (drag & drop, status changes)
- Add notes to leads
- All changes saved locally
- Auto-sync when connection restored

## Troubleshooting

### "Python server failed to start"
- Make sure Python 3.11+ is installed
- Run `pip install -r python/requirements.txt` manually
- Check if port 8765 is available

### "Failed to load dashboard"
- Make sure Node.js dev server is running (`npm run dev:next`)
- Check if http://localhost:3000 is accessible

### Build fails on Mac
- Make sure you have Xcode Command Line Tools
- Run: `xcode-select --install`

### Build fails on Windows
- Make sure you have Visual Studio Build Tools
- Electron Builder requires some native modules

## Code Signing (Optional)

### Windows (Code Signing)
```bash
npm run build:win -- -c.win.certificateFile="path/to/cert.pfx" -c.win.certificatePassword="password"
```

### Mac (Code Signing + Notarization)
```bash
npm run build:mac -- -c.mac.certificate="Developer ID Application" -c.mac.notarize=true
```