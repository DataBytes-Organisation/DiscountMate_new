'use strict';

const { spawn } = require('child_process');
const http      = require('http');
const path      = require('path');
const fs        = require('fs');

const SERVICE_DIR = path.resolve(__dirname, '../../ml-service/reverse_image_search');
const RIS_HOST    = '127.0.0.1';
const RIS_PORT    = 8001;
const POLL_MS     = 2000;

let _proc = null;

function resolvePython() {
  const venvBin = process.platform === 'win32'
    ? path.join(SERVICE_DIR, 'venv', 'Scripts', 'python.exe')
    : path.join(SERVICE_DIR, 'venv', 'bin', 'python');
  if (fs.existsSync(venvBin)) return venvBin;
  if (process.env.RIS_PYTHON)  return process.env.RIS_PYTHON;
  return 'python3';
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: RIS_HOST, port: RIS_PORT, path: '/health', method: 'GET', timeout: 3000 },
      (res) => resolve(res.statusCode === 200)
    );
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function startReverseImageSearch() {
  const python    = resolvePython();
  const indexPath = path.join(SERVICE_DIR, '..', 'ml_models', 'reverse_image_search.faiss');
  const metaPath  = path.join(SERVICE_DIR, '..', 'ml_models', 'reverse_image_search_metadata.json');

  if (!fs.existsSync(indexPath))
    return Promise.reject(new Error(`[ReverseImageSearch] Missing: ${indexPath}`));
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

    const timeoutMs = parseInt(process.env.RIS_STARTUP_TIMEOUT_MS || '120000', 10);
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
