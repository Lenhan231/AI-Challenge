import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

// Load .env
try {
  const env = fs.readFileSync(".env", "utf8");
  env
    .split("\n")
    .forEach((line) => {
      const [k, ...v] = line.trim().split("=");
      if (k && v.length) process.env[k] = v.join("=");
    });
} catch (e) {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// API route handlers
const apiHandlers = {};

// Dynamically load API modules
async function loadApiHandlers() {
  const apiDir = path.join(__dirname, "api");
  const loadDir = async (dir, prefix = "") => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "_lib") {
        await loadDir(fullPath, `${prefix}${entry.name}/`);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const routePath = `${prefix}${entry.name.replace(".js", "")}`;
        try {
          const module = await import(`file://${fullPath}`);
          apiHandlers[routePath] = module.default;
          console.log(`  ✓ Loaded API: /api/${routePath}`);
        } catch (err) {
          console.error(`  ✗ Failed to load /api/${routePath}:`, err.message);
        }
      }
    }
  };

  await loadDir(apiDir);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API routes
  if (req.url.startsWith("/api/")) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const routePath = url.pathname.replace("/api/", "");

        const handler = apiHandlers[routePath];
        if (!handler) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "API route not found" }));
          return;
        }

        // Parse body if POST
        let bodyData = {};
        if (req.method === "POST" && body) {
          try {
            bodyData = JSON.parse(body);
          } catch (e) {}
        }

        // Create request object
        const mockReq = {
          method: req.method,
          url: req.url,
          query: Object.fromEntries(url.searchParams),
          body: bodyData,
        };

        // Create response object
        let statusCode = 200;
        let responseHeaders = {};
        let responseBody = "";

        const mockRes = {
          status: (code) => {
            statusCode = code;
            return mockRes;
          },
          setHeader: (key, value) => {
            responseHeaders[key] = value;
          },
          writeHead: (code, headers = {}) => {
            statusCode = code;
            Object.assign(responseHeaders, headers);
          },
          json: (data) => {
            responseHeaders["Content-Type"] = "application/json";
            responseBody = JSON.stringify(data);
            res.writeHead(statusCode, responseHeaders);
            res.end(responseBody);
          },
          end: (data) => {
            res.writeHead(statusCode, responseHeaders);
            res.end(data || responseBody);
          },
        };

        await handler(mockReq, mockRes);
      } catch (err) {
        console.error("API error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static files
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
  if (urlPath === "/host") urlPath = "/host.html";

  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback to index.html for SPA routing (but not for /host)
      const fallbackFile = urlPath === "/host.html" ? "host.html" : "index.html";
      fs.readFile(path.join(__dirname, fallbackFile), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(data2);
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
    });
    res.end(data);
  });
});

// Start server
loadApiHandlers().then(() => {
  server.listen(PORT, () => {
    console.log(`\n✅ Dev server running at http://localhost:${PORT}`);
    console.log(`   Player view: http://localhost:${PORT}`);
    console.log(`   Host panel: http://localhost:${PORT}/host`);
    console.log(`\n   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "✓" : "✗ not set"}`);
    console.log(
      `   UPSTASH Redis: ${process.env.UPSTASH_REDIS_REST_URL ? "✓" : "✗ not set"}\n`
    );
    console.log(`   Press Ctrl+C to stop\n`);
  });
});
