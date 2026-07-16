const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Đọc .env thủ công
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) process.env[k] = v.join('=');
  });
} catch(e) {}

const PORT = 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API route: POST /api/ai
  if (req.method === 'POST' && req.url === '/api/ai') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let prompt;
      try { prompt = JSON.parse(body).prompt; } catch(e) {}
      if (!prompt) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Missing prompt'}));
        return;
      }
      if (!GEMINI_KEY) {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'GEMINI_API_KEY not configured'}));
        return;
      }

      const payload = JSON.stringify({contents:[{parts:[{text:prompt}]}]});
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(payload)}
      };

      console.log(`[${new Date().toLocaleTimeString()}] 🤖 Gọi Gemini API...`);
      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
          try {
            const json = JSON.parse(data);
            const text = (json.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') || '')
              .replace(/```json|```/g,'').trim();
            console.log(`[${new Date().toLocaleTimeString()}] ✅ Gemini trả về: ${text.slice(0,80)}...`);
            res.writeHead(200, {'Content-Type':'application/json'});
            res.end(JSON.stringify({text}));
          } catch(e) {
            console.log(`[${new Date().toLocaleTimeString()}] ❌ Gemini lỗi parse: ${data.slice(0,100)}`);
            res.writeHead(500, {'Content-Type':'application/json'});
            res.end(JSON.stringify({error:'Parse error', raw: data.slice(0,200)}));
          }
        });
      });
      apiReq.on('error', e => {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error: e.message}));
      });
      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  // Static files
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // fallback to index.html
      fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream'});
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ Server chạy tại http://localhost:${PORT}`);
  console.log(`   GEMINI_API_KEY: ${GEMINI_KEY ? '✓ có ('+GEMINI_KEY.slice(0,8)+'...)' : '✗ chưa có — dùng AI simulation'}`);
  console.log(`\n   Nhấn Ctrl+C để dừng\n`);
});
