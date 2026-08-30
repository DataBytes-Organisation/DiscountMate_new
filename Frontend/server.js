const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, "dist");

const MIME_TYPES = {
   ".css": "text/css; charset=utf-8",
   ".gif": "image/gif",
   ".html": "text/html; charset=utf-8",
   ".ico": "image/x-icon",
   ".jpeg": "image/jpeg",
   ".jpg": "image/jpeg",
   ".js": "application/javascript; charset=utf-8",
   ".json": "application/json; charset=utf-8",
   ".map": "application/json; charset=utf-8",
   ".png": "image/png",
   ".svg": "image/svg+xml; charset=utf-8",
   ".txt": "text/plain; charset=utf-8",
   ".webp": "image/webp",
};

function resolveRequestPath(requestPath) {
   const safePath = requestPath === "/" ? "/index.html" : requestPath;
   const candidatePath = path.resolve(path.join(DIST_DIR, `.${safePath}`));

   if (!candidatePath.startsWith(path.resolve(DIST_DIR))) {
      return null;
   }

   return candidatePath;
}

function sendFile(res, filePath) {
   fs.readFile(filePath, (error, fileContent) => {
      if (error) {
         res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
         res.end("Unable to load asset.");
         return;
      }

      const extension = path.extname(filePath).toLowerCase();
      const contentType =
         MIME_TYPES[extension] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(fileContent);
   });
}

function sendIndex(res) {
   sendFile(res, path.join(DIST_DIR, "index.html"));
}

const server = http.createServer((req, res) => {
   const requestUrl = new URL(req.url, `http://${req.headers.host}`);
   const requestPath = decodeURIComponent(requestUrl.pathname);
   const resolvedPath = resolveRequestPath(requestPath);

   if (!resolvedPath) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request.");
      return;
   }

   fs.stat(resolvedPath, (error, stats) => {
      if (!error && stats.isFile()) {
         sendFile(res, resolvedPath);
         return;
      }

      if (path.extname(requestPath)) {
         res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
         res.end("Not found.");
         return;
      }

      sendIndex(res);
   });
});

server.listen(PORT, "0.0.0.0", () => {
   console.log(`Frontend server listening on port ${PORT}`);
});
