"use strict";

/*
  BIG4ARTS MUSIC VAULT
  If the music repository ever changes, update only this configuration block.
*/
const CONFIG = {
  owner: "iexistithinkok",
  repository: "WBTD",
  branch: "main",
  assetsPath: "assets",
  cacheMinutes: 10,
};

const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".aac"];
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const elements = {
  audio: document.querySelector("#audio"),
  jukebox: document.querySelector("#jukebox"),
  trackTitle: document.querySelector("#track-title"),
  trackMeta: document.querySelector("#track-meta"),
  playButton: document.querySelector("#play-btn"),
  previousButton: document.querySelector("#prev-btn"),
  nextButton: document.querySelector("#next-btn"),
  seek: document.querySelector("#seek"),
  currentTime: document.querySelector("#current-time"),
  duration: document.querySelector("#duration"),
  visualizer: document.querySelector("#visualizer"),
  playlist: document.querySelector("#playlist"),
  refreshButton: document.querySelector("#refresh-btn"),
  libraryStatus: document.querySelector("#library-status"),
  trackCount: document.querySelector("#track-count"),
};

const state = {
  tracks: [],
  currentIndex: -1,
  visualizerTimer: null,
};

function isAudioFile(filename) {
  const lowerName = filename.toLowerCase();
  return AUDIO_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function cleanTitle(filename) {
  let decodedName = filename;

  try {
    decodedName = decodeURIComponent(filename);
  } catch {
    // Keep the original filename if it is not URI encoded.
  }

  return decodedName
    .replace(/\.(mp3|m4a|wav|ogg|aac)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+MP3$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = String(wholeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function apiHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function rawTrackUrl(path) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repository}/${CONFIG.branch}/${encodedPath}`;
}

function normalizeTracks(files) {
  return files
    .filter((file) => file.type === "file" && isAudioFile(file.name))
    .map((file) => ({
      filename: file.name,
      title: cleanTitle(file.name),
      url: file.download_url || rawTrackUrl(file.path),
    }))
    .sort((a, b) => collator.compare(a.title, b.title));
}

async function fetchFromContentsApi() {
  const path = CONFIG.assetsPath.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repository}/contents/${path}?ref=${encodeURIComponent(CONFIG.branch)}`;
  const response = await fetch(url, { headers: apiHeaders() });

  if (!response.ok) {
    throw new Error(`Contents request failed (${response.status})`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Unexpected contents response");
  return normalizeTracks(payload);
}

async function fetchFromTreeApi() {
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repository}/git/trees/${encodeURIComponent(CONFIG.branch)}?recursive=1`;
  const response = await fetch(url, { headers: apiHeaders() });

  if (!response.ok) {
    throw new Error(`Tree request failed (${response.status})`);
  }

  const payload = await response.json();
  const prefix = `${CONFIG.assetsPath.replace(/\/$/, "")}/`;
  const files = (payload.tree || [])
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix))
    .map((entry) => ({
      type: "file",
      path: entry.path,
      name: entry.path.slice(prefix.length),
      download_url: rawTrackUrl(entry.path),
    }))
    .filter((entry) => !entry.name.includes("/"));

  return normalizeTracks(files);
}

function readTrackCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem("big4arts-track-cache"));
    const maxAge = CONFIG.cacheMinutes * 60 * 1000;
    if (!cached || Date.now() - cached.savedAt > maxAge || !Array.isArray(cached.tracks)) {
      return null;
    }
    return cached.tracks;
  } catch {
    return null;
  }
}

function writeTrackCache(tracks) {
  try {
    sessionStorage.setItem(
      "big4arts-track-cache",
      JSON.stringify({ savedAt: Date.now(), tracks }),
    );
  } catch {
    // The player still works if private browsing blocks session storage.
  }
}

async function discoverTracks(forceRefresh = false) {
  if (!forceRefresh) {
    const cachedTracks = readTrackCache();
    if (cachedTracks?.length) return cachedTracks;
  }

  try {
    const tracks = await fetchFromContentsApi();
    if (tracks.length) {
      writeTrackCache(tracks);
      return tracks;
    }
  } catch (contentsError) {
    console.warn(contentsError.message);
  }

  const tracks = await fetchFromTreeApi();
  if (tracks.length) writeTrackCache(tracks);
  return tracks;
}

function setLibraryStatus(message, isError = false) {
  elements.libraryStatus.textContent = message;
  elements.libraryStatus.classList.toggle("error", isError);
}

function renderPlaylist() {
  const fragment = document.createDocumentFragment();

  state.tracks.forEach((track, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = track.title;
    button.title = track.title;
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `Play ${track.title}`);
    item.append(button);
    fragment.append(item);
  });

  elements.playlist.replaceChildren(fragment);
}

function updateActiveTrack() {
  const items = elements.playlist.querySelectorAll("li");
  items.forEach((item, index) => {
    const isActive = index === state.currentIndex;
    item.classList.toggle("active", isActive);
    const button = item.querySelector("button");
    if (isActive) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
}

function updateMediaSession(track) {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: "Cameron & Hutch",
      album: "Big4Arts Music Vault",
    });
  } catch {
    // Media-session metadata is an enhancement, not a playback requirement.
  }
}

async function selectTrack(index, shouldPlay = true) {
  if (!state.tracks.length) return;

  const normalizedIndex = (index + state.tracks.length) % state.tracks.length;
  const track = state.tracks[normalizedIndex];
  state.currentIndex = normalizedIndex;

  elements.trackTitle.textContent = track.title;
  elements.trackMeta.textContent = track.filename;
  elements.currentTime.textContent = "0:00";
  elements.duration.textContent = "0:00";
  elements.seek.value = "0";
  elements.audio.src = track.url;
  elements.audio.load();
  updateActiveTrack();
  updateMediaSession(track);

  try {
    localStorage.setItem("big4arts-last-track", track.filename);
  } catch {
    // Remembering the last track is optional.
  }

  if (!shouldPlay) return;

  try {
    await elements.audio.play();
  } catch (error) {
    console.warn("Playback needs a direct user action.", error);
    setLibraryStatus("Press the glowing play button to begin.");
  }
}

function restoredTrackIndex() {
  try {
    const lastFilename = localStorage.getItem("big4arts-last-track");
    const index = state.tracks.findIndex((track) => track.filename === lastFilename);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

async function loadLibrary(forceRefresh = false) {
  elements.refreshButton.disabled = true;
  setLibraryStatus(forceRefresh ? "Refreshing the complete song list…" : "Loading the complete song list…");
  elements.trackCount.textContent = "Connecting to the vault";

  try {
    const tracks = await discoverTracks(forceRefresh);
    if (!tracks.length) throw new Error("No audio files were found in the assets folder.");

    state.tracks = tracks;
    renderPlaylist();
    await selectTrack(restoredTrackIndex(), false);
    setLibraryStatus("");
    elements.trackCount.textContent = `${tracks.length} songs ready to play`;
  } catch (error) {
    console.error(error);
    state.tracks = [];
    elements.playlist.replaceChildren();
    elements.trackTitle.textContent = "The Music Vault is resting";
    elements.trackMeta.textContent = "Please try Refresh in a moment";
    setLibraryStatus("The song list could not be loaded. Please press Refresh.", true);
    elements.trackCount.textContent = "Music connection unavailable";
  } finally {
    elements.refreshButton.disabled = false;
  }
}

function togglePlayback() {
  if (!state.tracks.length) {
    loadLibrary(true);
    return;
  }

  if (elements.audio.paused) {
    elements.audio.play().catch((error) => {
      console.error(error);
      setLibraryStatus("This browser could not start the song. Please choose it again.", true);
    });
  } else {
    elements.audio.pause();
  }
}

function updatePlayingState(isPlaying) {
  elements.jukebox.classList.toggle("is-playing", isPlaying);
  elements.playButton.setAttribute("aria-pressed", String(isPlaying));
  elements.playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");

  if (isPlaying) startVisualizer();
  else stopVisualizer();
}

function createVisualizer() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 24; index += 1) {
    const bar = document.createElement("span");
    bar.style.height = `${12 + ((index * 13) % 32)}%`;
    fragment.append(bar);
  }
  elements.visualizer.replaceChildren(fragment);
}

function animateVisualizer() {
  elements.visualizer.querySelectorAll("span").forEach((bar, index) => {
    const wave = Math.sin(Date.now() / 240 + index * 0.72) * 19;
    const variation = Math.random() * 34;
    bar.style.height = `${Math.max(8, Math.min(94, 38 + wave + variation))}%`;
  });
}

function startVisualizer() {
  if (state.visualizerTimer) return;
  animateVisualizer();
  state.visualizerTimer = window.setInterval(animateVisualizer, 170);
}

function stopVisualizer() {
  window.clearInterval(state.visualizerTimer);
  state.visualizerTimer = null;
  elements.visualizer.querySelectorAll("span").forEach((bar, index) => {
    bar.style.height = `${12 + ((index * 13) % 32)}%`;
  });
}

elements.playButton.addEventListener("click", togglePlayback);
elements.previousButton.addEventListener("click", () => selectTrack(state.currentIndex - 1));
elements.nextButton.addEventListener("click", () => selectTrack(state.currentIndex + 1));
elements.refreshButton.addEventListener("click", () => loadLibrary(true));

elements.playlist.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  selectTrack(Number(button.dataset.index));
});

elements.seek.addEventListener("input", () => {
  if (!Number.isFinite(elements.audio.duration)) return;
  elements.audio.currentTime = (Number(elements.seek.value) / 100) * elements.audio.duration;
});

elements.audio.addEventListener("loadedmetadata", () => {
  elements.duration.textContent = formatTime(elements.audio.duration);
});

elements.audio.addEventListener("timeupdate", () => {
  const progress = Number.isFinite(elements.audio.duration)
    ? (elements.audio.currentTime / elements.audio.duration) * 100
    : 0;
  elements.seek.value = String(progress || 0);
  elements.currentTime.textContent = formatTime(elements.audio.currentTime);
  elements.duration.textContent = formatTime(elements.audio.duration);
});

elements.audio.addEventListener("play", () => {
  updatePlayingState(true);
  setLibraryStatus("");
});

elements.audio.addEventListener("pause", () => updatePlayingState(false));
elements.audio.addEventListener("ended", () => selectTrack(state.currentIndex + 1));
elements.audio.addEventListener("error", () => {
  updatePlayingState(false);
  setLibraryStatus("This song could not be played. Please choose another selection.", true);
});

if ("mediaSession" in navigator) {
  const mediaActions = {
    play: () => elements.audio.play(),
    pause: () => elements.audio.pause(),
    previoustrack: () => selectTrack(state.currentIndex - 1),
    nexttrack: () => selectTrack(state.currentIndex + 1),
  };

  Object.entries(mediaActions).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Some browsers expose Media Session but support only a subset of actions.
    }
  });
}

createVisualizer();
loadLibrary();
