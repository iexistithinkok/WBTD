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
  audioContext: null,
  analyser: null,
  sourceNode: null,
  frequencyData: null,
  waveformData: null,
  animationFrame: null,
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
    ensureAudioAnalyzer();
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

function ensureAudioAnalyzer() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return false;

  if (!state.audioContext) {
    try {
      state.audioContext = new AudioContextClass();
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 512;
      state.analyser.minDecibels = -92;
      state.analyser.maxDecibels = -12;
      state.analyser.smoothingTimeConstant = 0.78;
      state.sourceNode = state.audioContext.createMediaElementSource(elements.audio);
      state.sourceNode.connect(state.analyser);
      state.analyser.connect(state.audioContext.destination);
      state.frequencyData = new Uint8Array(state.analyser.frequencyBinCount);
      state.waveformData = new Uint8Array(state.analyser.fftSize);
    } catch (error) {
      console.warn("Audio-reactive visualization is unavailable.", error);
      state.audioContext = null;
      state.analyser = null;
      return false;
    }
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume().catch((error) => console.warn("Audio display could not resume.", error));
  }

  return true;
}

function canvasSurface() {
  const canvas = elements.visualizer;
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(bounds.width * ratio));
  const pixelHeight = Math.max(1, Math.round(bounds.height * ratio));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  return { context, width: bounds.width, height: bounds.height };
}

function drawSpectrum(context, width, height, frequencyData) {
  const barCount = 38;
  const startX = width * 0.1;
  const spectrumWidth = width * 0.8;
  const gap = Math.max(1.2, width * 0.005);
  const barWidth = Math.max(2, (spectrumWidth - gap * (barCount - 1)) / barCount);
  const baseline = height * 0.9;
  const maximumHeight = height * 0.42;

  context.save();
  context.globalCompositeOperation = "screen";

  for (let index = 0; index < barCount; index += 1) {
    const dataIndex = Math.min(
      frequencyData.length - 1,
      Math.floor(2 + Math.pow(index / barCount, 1.45) * frequencyData.length * 0.62),
    );
    const strength = frequencyData[dataIndex] / 255;
    const barHeight = Math.max(3, Math.pow(strength, 1.35) * maximumHeight);
    const x = startX + index * (barWidth + gap);
    const hue = 188 + (index / (barCount - 1)) * 126;
    const color = `hsla(${hue}, 100%, 62%, 0.96)`;

    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = Math.max(4, width * 0.012);
    context.fillRect(x, baseline - barHeight, barWidth, barHeight);

    context.globalAlpha = 0.19;
    context.fillRect(x, baseline + 3, barWidth, barHeight * 0.2);
    context.globalAlpha = 1;
  }

  context.restore();
}

function drawWaveform(context, width, height, waveformData) {
  const centerY = height * 0.51;
  const amplitude = height * 0.16;
  const horizontalGradient = context.createLinearGradient(0, 0, width, 0);
  horizontalGradient.addColorStop(0, "rgba(38, 231, 255, 0)");
  horizontalGradient.addColorStop(0.12, "#26e7ff");
  horizontalGradient.addColorStop(0.5, "#ff4ad8");
  horizontalGradient.addColorStop(0.88, "#26e7ff");
  horizontalGradient.addColorStop(1, "rgba(38, 231, 255, 0)");

  context.save();
  context.strokeStyle = "rgba(38, 231, 255, 0.2)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(width * 0.06, centerY);
  context.lineTo(width * 0.94, centerY);
  context.stroke();

  const drawLine = (lineWidth, alpha, blur) => {
    context.beginPath();
    for (let index = 0; index < waveformData.length; index += 1) {
      const x = (index / (waveformData.length - 1)) * width;
      const normalized = waveformData[index] / 128 - 1;
      const y = centerY + normalized * amplitude;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.globalAlpha = alpha;
    context.strokeStyle = horizontalGradient;
    context.lineWidth = lineWidth;
    context.shadowColor = "#ff3fd4";
    context.shadowBlur = blur;
    context.stroke();
  };

  drawLine(Math.max(5, width * 0.015), 0.24, 22);
  drawLine(Math.max(1.6, width * 0.0045), 1, 9);
  context.restore();
}

function drawIdleVisualizer() {
  const { context, width, height } = canvasSurface();
  const idleWave = new Uint8Array(256);
  const idleSpectrum = new Uint8Array(128);

  for (let index = 0; index < idleWave.length; index += 1) {
    idleWave[index] = 128 + Math.sin(index * 0.18) * 2;
  }
  for (let index = 0; index < idleSpectrum.length; index += 1) {
    idleSpectrum[index] = 22 + Math.sin(index * 0.53) * 11;
  }

  drawSpectrum(context, width, height, idleSpectrum);
  drawWaveform(context, width, height, idleWave);
}

function drawLiveVisualizer() {
  if (!state.analyser || elements.audio.paused) {
    state.animationFrame = null;
    drawIdleVisualizer();
    return;
  }

  state.analyser.getByteFrequencyData(state.frequencyData);
  state.analyser.getByteTimeDomainData(state.waveformData);
  const { context, width, height } = canvasSurface();
  drawSpectrum(context, width, height, state.frequencyData);
  drawWaveform(context, width, height, state.waveformData);
  state.animationFrame = window.requestAnimationFrame(drawLiveVisualizer);
}

function startVisualizer() {
  ensureAudioAnalyzer();
  if (state.animationFrame) return;
  state.animationFrame = window.requestAnimationFrame(drawLiveVisualizer);
}

function stopVisualizer() {
  if (state.animationFrame) window.cancelAnimationFrame(state.animationFrame);
  state.animationFrame = null;
  drawIdleVisualizer();
}

elements.playButton.addEventListener("click", togglePlayback);
elements.previousButton.addEventListener("click", () => {
  ensureAudioAnalyzer();
  selectTrack(state.currentIndex - 1);
});
elements.nextButton.addEventListener("click", () => {
  ensureAudioAnalyzer();
  selectTrack(state.currentIndex + 1);
});
elements.refreshButton.addEventListener("click", () => loadLibrary(true));

elements.playlist.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  ensureAudioAnalyzer();
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
    play: () => {
      ensureAudioAnalyzer();
      elements.audio.play();
    },
    pause: () => elements.audio.pause(),
    previoustrack: () => {
      ensureAudioAnalyzer();
      selectTrack(state.currentIndex - 1);
    },
    nexttrack: () => {
      ensureAudioAnalyzer();
      selectTrack(state.currentIndex + 1);
    },
  };

  Object.entries(mediaActions).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Some browsers expose Media Session but support only a subset of actions.
    }
  });
}

window.addEventListener("resize", () => {
  if (elements.audio.paused) window.requestAnimationFrame(drawIdleVisualizer);
});

window.requestAnimationFrame(drawIdleVisualizer);
loadLibrary();
