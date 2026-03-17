const audio = document.getElementById('audio');
const playlistElement = document.getElementById('playlist');
const titleElement = document.getElementById('track-title');
const metaElement = document.getElementById('track-meta');
const playButton = document.getElementById('play-btn');
const prevButton = document.getElementById('prev-btn');
const nextButton = document.getElementById('next-btn');
const refreshButton = document.getElementById('refresh-btn');
const seek = document.getElementById('seek');
const currentTimeElement = document.getElementById('current-time');
const durationElement = document.getElementById('duration');
const visualizer = document.getElementById('visualizer');

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

let tracks = [];
let currentIndex = -1;
let visualizationTimer;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

function prettifyTitle(filename) {
  return filename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAudioFile(name) {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function renderVisualizer() {
  visualizer.innerHTML = '';
  for (let i = 0; i < 30; i += 1) {
    const bar = document.createElement('span');
    bar.style.height = `${18 + Math.random() * 42}px`;
    visualizer.appendChild(bar);
  }
}

function runVisualizer(active) {
  clearInterval(visualizationTimer);
  if (!active) {
    [...visualizer.children].forEach((bar) => {
      bar.style.height = '18px';
    });
    return;
  }

  visualizationTimer = setInterval(() => {
    [...visualizer.children].forEach((bar) => {
      bar.style.height = `${18 + Math.random() * 42}px`;
    });
  }, 180);
}

function setTrack(index) {
  if (!tracks.length) return;
  currentIndex = (index + tracks.length) % tracks.length;
  const track = tracks[currentIndex];
  audio.src = track.url;
  titleElement.textContent = track.title;
  metaElement.textContent = track.filename;

  [...playlistElement.children].forEach((li, liIndex) => {
    li.classList.toggle('active', liIndex === currentIndex);
  });
}

async function loadFromGitHubApi() {
  const hostname = window.location.hostname;
  if (!hostname.endsWith('github.io')) return [];

  const owner = hostname.split('.')[0];
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const repo = pathParts[0];
  if (!owner || !repo) return [];

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/assets`);
  if (!response.ok) return [];

  const files = await response.json();
  return files
    .filter((file) => file.type === 'file' && isAudioFile(file.name))
    .map((file) => ({
      title: prettifyTitle(file.name),
      filename: file.name,
      url: file.download_url
    }));
}

async function loadFromAssetsIndex() {
  const response = await fetch('assets/index.json', { cache: 'no-store' });
  if (!response.ok) return [];

  const data = await response.json();
  const files = Array.isArray(data) ? data : data.tracks;
  if (!Array.isArray(files)) return [];

  return files
    .filter((name) => typeof name === 'string' && isAudioFile(name))
    .map((name) => ({
      title: prettifyTitle(name),
      filename: name,
      url: `assets/${encodeURIComponent(name)}`
    }));
}

function renderPlaylist() {
  playlistElement.innerHTML = '';

  if (!tracks.length) {
    titleElement.textContent = 'No tracks found';
    metaElement.textContent = 'Add audio files to /assets (or update assets/index.json).';
    return;
  }

  tracks.forEach((track, index) => {
    const item = document.createElement('li');
    item.textContent = track.title;
    item.title = track.filename;
    item.addEventListener('click', async () => {
      setTrack(index);
      await audio.play();
      playButton.textContent = '⏸';
      runVisualizer(true);
    });
    playlistElement.appendChild(item);
  });

  setTrack(0);
}

async function loadTracks() {
  const githubTracks = await loadFromGitHubApi();
  tracks = githubTracks.length ? githubTracks : await loadFromAssetsIndex();
  tracks.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));
  renderPlaylist();
}

playButton.addEventListener('click', async () => {
  if (!tracks.length) return;

  if (audio.paused) {
    if (currentIndex < 0) setTrack(0);
    await audio.play();
    playButton.textContent = '⏸';
    runVisualizer(true);
  } else {
    audio.pause();
    playButton.textContent = '▶';
    runVisualizer(false);
  }
});

prevButton.addEventListener('click', async () => {
  if (!tracks.length) return;
  setTrack(currentIndex - 1);
  await audio.play();
  playButton.textContent = '⏸';
  runVisualizer(true);
});

nextButton.addEventListener('click', async () => {
  if (!tracks.length) return;
  setTrack(currentIndex + 1);
  await audio.play();
  playButton.textContent = '⏸';
  runVisualizer(true);
});

refreshButton.addEventListener('click', loadTracks);

audio.addEventListener('loadedmetadata', () => {
  durationElement.textContent = formatTime(audio.duration);
});

audio.addEventListener('timeupdate', () => {
  if (audio.duration) {
    seek.value = String((audio.currentTime / audio.duration) * 100);
  }
  currentTimeElement.textContent = formatTime(audio.currentTime);
});

seek.addEventListener('input', () => {
  if (!audio.duration) return;
  const percentage = Number(seek.value) / 100;
  audio.currentTime = audio.duration * percentage;
});

audio.addEventListener('ended', async () => {
  if (!tracks.length) return;
  setTrack(currentIndex + 1);
  await audio.play();
});

audio.addEventListener('pause', () => {
  if (!audio.ended) {
    playButton.textContent = '▶';
    runVisualizer(false);
  }
});

audio.addEventListener('play', () => {
  playButton.textContent = '⏸';
  runVisualizer(true);
});

renderVisualizer();
loadTracks();
