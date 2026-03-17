# WBTD Music Player (GitHub Pages Ready)

This player now works as a **static site** with a root `index.html`, so it can be deployed directly on GitHub Pages.

## How tracks are discovered

The app supports two loading paths:

1. **GitHub Pages auto-discovery (recommended):**
   - When hosted on `*.github.io`, the app calls the GitHub API and automatically lists audio files from your repo's `assets/` folder.
   - Uploading new tracks to `assets/` makes them show up after page refresh.

2. **Fallback index file (`assets/index.json`):**
   - For local/static hosting where directory listing is unavailable, update `assets/index.json`.
   - Add filenames to the `tracks` array.

## Supported formats

- `.mp3`
- `.wav`
- `.ogg`
- `.m4a`
- `.flac`

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. In repo settings, enable **Pages** and deploy from your branch root.
3. Put your songs in `assets/`.
4. Open your Pages URL and click **Refresh tracks** if needed.

## Local preview

Use any static server from repo root, for example:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.
