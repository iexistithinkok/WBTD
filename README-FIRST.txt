BIG4ARTS JUKEBOX V5 — CURVED TITLE MARQUEE INSTALLATION
================================

This revision keeps the full Big4Arts jukebox player, cleans up the words inside
the glass, and makes the neon react to the music. NOW PLAYING and the song title
now share two balanced curves, and the duplicate raw MP3 filename has been
removed from the display.

FILES IN THIS PACKAGE
---------------------
index.html
styles.css
app.js
jukebox-frame-clean-v4.png

HOW TO INSTALL IT ON YOUR EXISTING GITHUB PAGES SITE
----------------------------------------------------
1. Open the GitHub repository that currently publishes music.big4arts.com.
2. Upload index.html, styles.css, and app.js to the repository's main folder.
3. When GitHub asks, approve replacing the older files with these new files.
4. Upload jukebox-frame-clean-v4.png beside those three files in the same main folder.
   This new filename prevents browsers from reusing the earlier artwork.
5. Leave your existing assets folder and every MP3 inside it exactly where they are.
6. Commit the changes to the main branch.
7. Allow GitHub Pages a few minutes to publish, then reload music.big4arts.com.

The image file itself has not changed in Version 5. If
jukebox-frame-clean-v4.png is already in the repository, the three files that
must be replaced are index.html, styles.css, and app.js.

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
- Draws a real waveform and frequency spectrum from the song that is playing.
- Drives the jukebox halo, chrome, title glow, and play light from the song's bass.
- Settles into a slow neon breathing glow whenever the music is paused.
- Curves every song title inside the glass and automatically fits longer names.
- Curves NOW PLAYING above the song title as one centered neon marquee.
- Removes the duplicate raw MP3 filename so the title has room to breathe.
- Adds a prominent link back to big4arts.com and strengthens Big4Arts branding.
- Adds phone media controls where supported.
- Adapts the jukebox and song selector for desktop, tablet, and phone screens.

No domain or DNS changes are required.

The older jukebox-frame files may remain in the repository. Version 5 does not
reference them, so they cannot appear in the player.
