BIG4ARTS JUKEBOX — INSTALLATION
================================

This package replaces the look of the Cameron & Hutch Music Vault while keeping
the automatic GitHub music-library scanner.

FILES IN THIS PACKAGE
---------------------
index.html
styles.css
app.js
ui-assets/jukebox-frame.png

HOW TO INSTALL IT ON YOUR EXISTING GITHUB PAGES SITE
----------------------------------------------------
1. Open the GitHub repository that currently publishes music.big4arts.com.
2. Upload index.html, styles.css, and app.js to the repository's main folder.
3. When GitHub asks, approve replacing the older files with these new files.
4. Upload the complete ui-assets folder beside those three files.
5. Leave your existing assets folder and every MP3 inside it exactly where they are.
6. Commit the changes to the main branch.
7. Allow GitHub Pages a few minutes to publish, then reload music.big4arts.com.

IMPORTANT
---------
The player is currently configured for this music source:
  GitHub owner: iexistithinkok
  Repository: WBTD
  Branch: main
  Music folder: assets

If that is still the correct repository, no settings need to be changed.

WHAT THE NEW PLAYER DOES
------------------------
- Automatically discovers every supported audio file in the assets folder.
- Uses a second GitHub scanning method if the first one is temporarily unavailable.
- Keeps a short session cache to reduce GitHub request limits.
- Remembers the listener's last selected song.
- Supports play, pause, previous, next, seeking, and automatic next-song playback.
- Adds phone media controls where supported.
- Adapts the jukebox and song selector for desktop, tablet, and phone screens.

No domain or DNS changes are required.
