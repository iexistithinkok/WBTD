const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const ASSETS_DIR = path.join(ROOT, 'assets');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);

function safeJoin(base, targetPath) {
  const normalizedTarget = path.normalize(path.join(base, targetPath));
  if (!normalizedTarget.startsWith(base)) {
    return null;
  }
  return normalizedTarget;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': MIME_TYPES['.json'] });
  res.end(JSON.stringify(payload));
}

async function listTracks() {
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  const entries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((filename) => ({
      title: filename
        .replace(path.extname(filename), '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      filename,
      url: `/assets/${encodeURIComponent(filename)}`
    }));
}

async function serveFile(res, baseDir, reqPath) {
  const requested = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = safeJoin(baseDir, requested);

  if (!filePath) {
    sendJson(res, 400, { error: 'Invalid path' });
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'File not found' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/tracks') {
    try {
      const tracks = await listTracks();
      sendJson(res, 200, { tracks });
    } catch (error) {
      sendJson(res, 500, { error: 'Failed to load track list', detail: error.message });
    }
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    await serveFile(res, ASSETS_DIR, decodeURIComponent(url.pathname.replace('/assets/', '/')));
    return;
  }

  await serveFile(res, PUBLIC_DIR, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Music player running at http://localhost:${PORT}`);
});
