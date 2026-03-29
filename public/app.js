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

async function loadTracks() {
  const response = await fetch('/api/tracks');
  const data = await response.json();
  tracks = data.tracks || [];

  playlistElement.innerHTML = '';
  if (!tracks.length) {
    titleElement.textContent = 'No tracks found';
    metaElement.textContent = 'Add MP3 files to /assets and click refresh.';
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
