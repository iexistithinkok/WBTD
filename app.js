const audio = document.getElementById('audio');
const video = document.getElementById('video');
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
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];

let tracks = [];
let currentIndex = -1;
let visualizationTimer;
let activePlayer = audio;

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

function mediaTypeFor(filename) {
  const lower = filename.toLowerCase();
  if (VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'video';
  if (AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'audio';
  return null;
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

function switchPlayer(mediaType) {
  const nextPlayer = mediaType === 'video' ? video : audio;
  if (activePlayer !== nextPlayer) {
    activePlayer.pause();
    activePlayer.removeAttribute('src');
    activePlayer.load();
  }

  activePlayer = nextPlayer;
  if (mediaType === 'video') {
    video.classList.remove('hidden');
  } else {
    video.classList.add('hidden');
  }
}

function setTrack(index) {
  if (!tracks.length) return;
  currentIndex = (index + tracks.length) % tracks.length;
  const track = tracks[currentIndex];

  switchPlayer(track.mediaType);

  activePlayer.src = track.url;
  titleElement.textContent = track.title;
  metaElement.textContent = `${track.filename} · ${track.mediaType.toUpperCase()}`;
  seek.value = '0';
  currentTimeElement.textContent = '0:00';
  durationElement.textContent = '0:00';

  [...playlistElement.children].forEach((li, liIndex) => {
    li.classList.toggle('active', liIndex === currentIndex);
  });
}

async function fetchLastCommitDate(owner, repo, filename) {
  const path = encodeURIComponent(`assets/${filename}`);
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?path=${path}&per_page=1`);
  if (!response.ok) return 0;

  const commits = await response.json();
  const date = commits?.[0]?.commit?.committer?.date;
  return date ? Date.parse(date) : 0;
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
  const mediaFiles = files.filter((file) => file.type === 'file' && mediaTypeFor(file.name));

  return Promise.all(
    mediaFiles.map(async (file) => ({
      title: prettifyTitle(file.name),
      filename: file.name,
      url: file.download_url,
      mediaType: mediaTypeFor(file.name),
      addedAt: await fetchLastCommitDate(owner, repo, file.name)
    }))
  );
}

async function loadFromAssetsIndex() {
  const response = await fetch('assets/index.json', { cache: 'no-store' });
  if (!response.ok) return [];

  const data = await response.json();
  const files = Array.isArray(data) ? data : data.tracks;
  if (!Array.isArray(files)) return [];

  return files
    .map((entry) => {
      if (typeof entry === 'string') {
        return {
          filename: entry,
          addedAt: 0
        };
      }

      if (entry && typeof entry.filename === 'string') {
        return {
          filename: entry.filename,
          addedAt: Number(entry.addedAt) || 0
        };
      }

      return null;
    })
    .filter((entry) => entry && mediaTypeFor(entry.filename))
    .map((entry) => ({
      title: prettifyTitle(entry.filename),
      filename: entry.filename,
      url: `assets/${encodeURIComponent(entry.filename)}`,
      mediaType: mediaTypeFor(entry.filename),
      addedAt: entry.addedAt
    }));
}

function renderPlaylist() {
  playlistElement.innerHTML = '';

  if (!tracks.length) {
    titleElement.textContent = 'No media found';
    metaElement.textContent = 'Add audio/video files to /assets (or update assets/index.json).';
    return;
  }

  tracks.forEach((track, index) => {
    const item = document.createElement('li');

    const titleSpan = document.createElement('span');
    titleSpan.textContent = track.title;

    const typeSpan = document.createElement('span');
    typeSpan.className = 'type-pill';
    typeSpan.textContent = track.mediaType;

    item.appendChild(titleSpan);
    item.appendChild(typeSpan);

    item.title = track.filename;
    item.addEventListener('click', async () => {
      setTrack(index);
      await activePlayer.play();
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
  tracks.sort((a, b) => b.addedAt - a.addedAt || a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));
  renderPlaylist();
}

playButton.addEventListener('click', async () => {
  if (!tracks.length) return;

  if (activePlayer.paused) {
    if (currentIndex < 0) setTrack(0);
    await activePlayer.play();
    playButton.textContent = '⏸';
    runVisualizer(true);
  } else {
    activePlayer.pause();
    playButton.textContent = '▶';
    runVisualizer(false);
  }
});

prevButton.addEventListener('click', async () => {
  if (!tracks.length) return;
  setTrack(currentIndex - 1);
  await activePlayer.play();
  playButton.textContent = '⏸';
  runVisualizer(true);
});

nextButton.addEventListener('click', async () => {
  if (!tracks.length) return;
  setTrack(currentIndex + 1);
  await activePlayer.play();
  playButton.textContent = '⏸';
  runVisualizer(true);
});

refreshButton.addEventListener('click', loadTracks);

function attachPlayerEvents(player) {
  player.addEventListener('loadedmetadata', () => {
    durationElement.textContent = formatTime(player.duration);
  });

  player.addEventListener('timeupdate', () => {
    if (player.duration) {
      seek.value = String((player.currentTime / player.duration) * 100);
    }
    currentTimeElement.textContent = formatTime(player.currentTime);
  });

  player.addEventListener('ended', async () => {
    if (!tracks.length) return;
    setTrack(currentIndex + 1);
    await activePlayer.play();
  });

  player.addEventListener('pause', () => {
    if (!player.ended && player === activePlayer) {
      playButton.textContent = '▶';
      runVisualizer(false);
    }
  });

  player.addEventListener('play', () => {
    if (player === activePlayer) {
      playButton.textContent = '⏸';
      runVisualizer(true);
    }
  });
}

seek.addEventListener('input', () => {
  if (!activePlayer.duration) return;
  const percentage = Number(seek.value) / 100;
  activePlayer.currentTime = activePlayer.duration * percentage;
});

attachPlayerEvents(audio);
attachPlayerEvents(video);
renderVisualizer();
loadTracks();
