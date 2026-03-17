# WBTD Music Player

A visually rich music player that auto-populates tracks from the `assets/` folder.

## Usage

1. Put your music files (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`) into `assets/`.
2. Start the app:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000`.
4. Click **Refresh from assets** whenever you upload new files.

The backend reads the folder dynamically, so the playlist is generated automatically from file names.
