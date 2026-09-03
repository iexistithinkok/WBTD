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

// GitHub repository containing the audio files.
const GITHUB_OWNER = 'iexistithinkok';
const GITHUB_REPO = 'WBTD';
const GITHUB_AUDIO_FOLDER = 'assets';

let tracks = [];
let currentIndex = -1;
let visualizationTimer;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';

  const minutes = Math.floor(seconds / 60);
  const secondsRemaining = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${secondsRemaining}`;
}

function prettifyTitle(filename) {
  return filename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAudioFile(filename) {
  const lowerFilename = filename.toLowerCase();

  return AUDIO_EXTENSIONS.some((extension) =>
    lowerFilename.endsWith(extension)
  );
}

function renderVisualizer() {
  visualizer.innerHTML = '';

  for (let index = 0; index < 30; index += 1) {
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
  audio.load();

  titleElement.textContent = track.title;
  metaElement.textContent = track.filename;

  [...playlistElement.children].forEach((listItem, listItemIndex) => {
    listItem.classList.toggle(
      'active',
      listItemIndex === currentIndex
    );
  });
}

async function loadFromGitHubApi() {
  const apiUrl =
    `https://api.github.com/repos/${GITHUB_OWNER}/` +
    `${GITHUB_REPO}/contents/${GITHUB_AUDIO_FOLDER}`;

  try {
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub returned status ${response.status}`);
    }

    const files = await response.json();

    if (!Array.isArray(files)) {
      throw new Error('GitHub did not return a file list.');
    }

    return files
      .filter(
        (file) =>
          file.type === 'file' &&
          isAudioFile(file.name) &&
          file.download_url
      )
      .map((file) => ({
        title: prettifyTitle(file.name),
        filename: file.name,
        url: file.download_url
      }));
  } catch (error) {
    console.warn('Could not load tracks from GitHub:', error);
    return [];
  }
}

async function loadFromAssetsIndex() {
  try {
    const response = await fetch('assets/index.json', {
      cache: 'no-store'
    });

    if (!response.ok) return [];

    const data = await response.json();
    const filenames = Array.isArray(data) ? data : data.tracks;

    if (!Array.isArray(filenames)) return [];

    return filenames
      .filter(
        (filename) =>
          typeof filename === 'string' &&
          isAudioFile(filename)
      )
      .map((filename) => ({
        title: prettifyTitle(filename),
        filename,
        url: `assets/${encodeURIComponent(filename)}`
      }));
  } catch (error) {
    console.warn('Could not load assets/index.json:', error);
    return [];
  }
}

function renderPlaylist() {
  playlistElement.innerHTML = '';

  if (!tracks.length) {
    titleElement.textContent = 'No tracks found';
    metaElement.textContent =
      'Unable to load the music library. Please try Refresh tracks.';

    return;
  }

  tracks.forEach((track, index) => {
    const item = document.createElement('li');

    item.textContent = track.title;
    item.title = track.filename;

    item.addEventListener('click', async () => {
      setTrack(index);

      try {
        await audio.play();
      } catch (error) {
        console.error('Unable to play this track:', error);
        metaElement.textContent =
          `Unable to play: ${track.filename}`;
      }
    });

    playlistElement.appendChild(item);
  });

  setTrack(0);
}

async function loadTracks() {
  titleElement.textContent = 'Loading music library…';
  metaElement.textContent = 'Scanning the GitHub assets folder.';

  let loadedTracks = await loadFromGitHubApi();

  // Use index.json only if the GitHub API is temporarily unavailable.
  if (!loadedTracks.length) {
    loadedTracks = await loadFromAssetsIndex();
  }

  tracks = loadedTracks.sort((firstTrack, secondTrack) =>
    firstTrack.filename.localeCompare(
      secondTrack.filename,
      undefined,
      {
        numeric: true,
        sensitivity: 'base'
      }
    )
  );

  renderPlaylist();
}

playButton.addEventListener('click', async () => {
  if (!tracks.length) return;

  if (audio.paused) {
    if (currentIndex < 0) {
      setTrack(0);
    }

    try {
      await audio.play();
    } catch (error) {
      console.error('Unable to play this track:', error);

      metaElement.textContent =
        'This audio file could not be played.';
    }
  } else {
    audio.pause();
  }
});

prevButton.addEventListener('click', async () => {
  if (!tracks.length) return;

  setTrack(currentIndex - 1);

  try {
    await audio.play();
  } catch (error) {
    console.error('Unable to play the previous track:', error);
  }
});

nextButton.addEventListener('click', async () => {
  if (!tracks.length) return;

  setTrack(currentIndex + 1);

  try {
    await audio.play();
  } catch (error) {
    console.error('Unable to play the next track:', error);
  }
});

refreshButton.addEventListener('click', () => {
  loadTracks();
});

audio.addEventListener('loadedmetadata', () => {
  durationElement.textContent = formatTime(audio.duration);
});

audio.addEventListener('timeupdate', () => {
  if (audio.duration) {
    seek.value = String(
      (audio.currentTime / audio.duration) * 100
    );
  }

  currentTimeElement.textContent =
    formatTime(audio.currentTime);
});

seek.addEventListener('input', () => {
  if (!audio.duration) return;

  const percentage = Number(seek.value) / 100;
  audio.currentTime = audio.duration * percentage;
});

audio.addEventListener('ended', async () => {
  if (!tracks.length) return;

  setTrack(currentIndex + 1);

  try {
    await audio.play();
  } catch (error) {
    console.error('Unable to advance to the next track:', error);
  }
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

audio.addEventListener('error', () => {
  playButton.textContent = '▶';
  runVisualizer(false);

  if (currentIndex >= 0 && tracks[currentIndex]) {
    metaElement.textContent =
      `Unable to load: ${tracks[currentIndex].filename}`;
  }
});

renderVisualizer();
loadTracks();
