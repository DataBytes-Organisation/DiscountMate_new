'use strict';

const { spawn } = require('child_process');
const http      = require('http');
const path      = require('path');
const fs        = require('fs');

const SERVICE_DIR = path.resolve(__dirname, '../../ml-service/reverse_image_search');
const ML_SERVICE_DIR = path.resolve(SERVICE_DIR, '..');
const RIS_HOST    = '127.0.0.1';
const RIS_PORT    = 8001;
const POLL_MS     = 2000;

let _proc = null;

function firstExisting(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate));
}

function resolvePython() {
  if (process.env.RIS_PYTHON && process.env.RIS_PYTHON.trim()) {
    return process.env.RIS_PYTHON.trim();
  }

  const candidates = process.platform === 'win32'
    ? [
        path.join(ML_SERVICE_DIR, 'venv', 'Scripts', 'python.exe'),
        process.env.CONDA_PREFIX && path.join(process.env.CONDA_PREFIX, 'python.exe'),
      ]
    : [
        path.join(ML_SERVICE_DIR, 'venv', 'bin', 'python'),
        process.env.CONDA_PREFIX && path.join(process.env.CONDA_PREFIX, 'bin', 'python'),
      ];

  const detectedPython = firstExisting(candidates);
  if (detectedPython) return detectedPython;

  console.warn('[ReverseImageSearch] No venv or conda python found; falling back to system python3. Install deps at Backend/ml-service/ or set RIS_PYTHON in Backend/.env.');
  return 'python3';
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: RIS_HOST, port: RIS_PORT, path: '/health', method: 'GET', timeout: 3000 },
      (res) => { res.resume(); resolve(res.statusCode === 200); }
    );
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function startReverseImageSearch() {
  const python    = resolvePython();
  const metaPath = path.join(SERVICE_DIR, '..', 'ml_models', 'reverse_image_search_metadata.json');

  if (!fs.existsSync(metaPath))
    return Promise.reject(new Error(`[ReverseImageSearch] Missing: ${metaPath}`));

  console.log(`[ReverseImageSearch] Starting sidecar — python: ${python}`);

  _proc = spawn(
    python,
    ['-m', 'uvicorn', 'api:app', '--host', RIS_HOST, '--port', String(RIS_PORT)],
    { cwd: SERVICE_DIR, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  _proc.stdout.on('data', (d) => process.stdout.write(`[ReverseImageSearch] ${d}`));
  _proc.stderr.on('data', (d) => process.stderr.write(`[ReverseImageSearch] ${d}`));

  return new Promise((resolve, reject) => {
    let exited   = false;
    let exitCode = null;

    _proc.on('exit', (code) => {
      exited   = true;
      exitCode = code;
    });

    const timeoutMs = parseInt(process.env.RIS_STARTUP_TIMEOUT_MS || '300000', 10);
    const deadline  = Date.now() + timeoutMs;

    function poll() {
      if (exited) {
        return reject(new Error(
          `[ReverseImageSearch] Process exited before becoming healthy (code ${exitCode}). ` +
          'Ensure uvicorn and Python deps are installed in Backend/ml-service.'
        ));
      }
      if (Date.now() >= deadline) {
        stopReverseImageSearch();
        return reject(new Error(
          `[ReverseImageSearch] Did not become healthy within ${timeoutMs / 1000} s.`
        ));
      }
      checkHealth().then((ok) => {
        if (ok) {
          console.log('[ReverseImageSearch] Sidecar is healthy and ready.');
          _proc.on('exit', (code) => {
            console.error(`[ReverseImageSearch] Sidecar exited unexpectedly (code ${code}). Restart the server to recover.`);
            _proc = null;
          });
          resolve();
        } else {
          setTimeout(poll, POLL_MS);
        }
      });
    }

    setTimeout(poll, POLL_MS);
  });
}

function stopReverseImageSearch() {
  if (_proc && !_proc.killed) {
    console.log('[ReverseImageSearch] Sending SIGTERM to sidecar.');
    _proc.kill('SIGTERM');
    _proc = null;
  }
}

module.exports = { startReverseImageSearch, stopReverseImageSearch };
