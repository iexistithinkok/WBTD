# WBTD Media Vault (GitHub Pages + Cloudflare Ready)

This site is a static **audio + video** player with a custom WBTD logo and Cameron/Hutch branding.

## What's new

- Custom SVG logo (`assets/wbtd-logo.svg`) with **Cameron + Hutch** in the branding.
- Mixed media playlist supports audio **and** music videos.
- Newest media appears first.

## Supported media formats

### Audio
- `.mp3`
- `.wav`
- `.ogg`
- `.m4a`
- `.flac`

### Video
- `.mp4`
- `.webm`
- `.mov`
- `.m4v`

## How media is discovered

1. **GitHub Pages auto-discovery (recommended):**
   - The app calls GitHub API and reads files from your repo's `assets/` folder.
   - Playlist includes both audio and video files.

2. **Fallback index file (`assets/index.json`):**
   - For local/static hosting, list files in `assets/index.json`.
   - You can use objects with `filename` and `addedAt` for newest-first ordering.

Example:

```json
{
  "tracks": [
    { "filename": "My New Video.mp4", "addedAt": 1710800000000 },
    { "filename": "My Song.mp3", "addedAt": 1710700000000 }
  ]
}
```

## Will deploy overwrite existing assets?

No. Deploying does not overwrite existing media unless you replace/delete those files in git commits. Keep your current file names and they stay intact.

## Cloudflare transfer notes

You can move this from GitHub Pages to Cloudflare Pages safely:

1. Connect this GitHub repo in Cloudflare Pages.
2. Build command: **(none)**
3. Output directory: **/** (root)
4. Keep media files inside `assets/`.

Because this is a static app, Cloudflare will serve your existing media files directly from the same paths.

## Local preview

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.
