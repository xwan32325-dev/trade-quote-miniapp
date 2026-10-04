'use strict';

/*
 * 外贸算价助手 · H5 分发服务
 * - 把 dist/build/h5 静态页面发在 /（朋友的手机浏览器直接打开）
 * - 把 /api/* 反向代理到本机后端（默认 127.0.0.1:8787），这样页面和接口同源，
 *   公网只需要暴露这一个端口，也不用给小程序配域名白名单
 * 零依赖，只用 Node 内置模块。
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 8790;
const ROOT = path.resolve(process.env.H5_DIR || path.join(__dirname, '..', 'dist', 'build', 'h5'));
const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = Number(process.env.API_PORT) || 8787;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function proxy(req, res) {
  const upstream = http.request(
    {
      host: API_HOST,
      port: API_PORT,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `${API_HOST}:${API_PORT}` },
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res); // 直接透传，SSE 流式也不会被缓冲
    },
  );

  upstream.on('error', (err) => {
    if (!res.headersSent) sendJson(res, 502, { ok: false, message: '后端不可用：' + err.message });
    else res.end();
  });

  req.pipe(upstream);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const resolved = path.resolve(ROOT, '.' + urlPath);

  // 防目录穿越
  if (!resolved.startsWith(ROOT)) {
    sendJson(res, 403, { ok: false, message: 'forbidden' });
    return;
  }

  fs.stat(resolved, (err, stat) => {
    const filePath = !err && stat.isFile() ? resolved : path.join(ROOT, 'index.html'); // SPA 回退

    fs.readFile(filePath, (readErr, buf) => {
      if (readErr) {
        sendJson(res, 404, { ok: false, message: 'not found', root: ROOT });
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      res.end(buf);
    });
  });
}

// 只放行试用版真正需要的接口，其余一律 404（避免把后端其它接口也暴露到公网）
const ALLOWED_APIS = [
  { method: 'GET', path: '/api/fx' },
  { method: 'POST', path: '/api/run-once' },
  { method: 'POST', path: '/api/parse-image' },
];

function isAllowedApi(method, url) {
  const p = (url || '').split('?')[0];
  return ALLOWED_APIS.some((a) => a.method === method && a.path === p);
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  if (url.startsWith('/api/')) {
    if (!isAllowedApi(req.method, url)) {
      sendJson(res, 404, { ok: false, message: 'not found' });
      return;
    }

    proxy(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[h5] 试用版已启动: http://localhost:${PORT}`);
  console.log(`[h5] 静态目录: ${ROOT}  (存在: ${fs.existsSync(path.join(ROOT, 'index.html'))})`);
  console.log(`[h5] 接口代理: /api/* -> http://${API_HOST}:${API_PORT}`);
});
