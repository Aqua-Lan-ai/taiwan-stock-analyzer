const express = require('express');
const cors = require('cors');
const https = require('https');
const zlib = require('zlib');

const app = express();
app.use(cors());
app.use(express.json());

const GOODINFO_BASE = 'https://goodinfo.tw/tw';

const agent = new https.Agent({ rejectUnauthorized: false });

// Simple request queue to space out goodinfo requests
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 2000;
function throttle() {
  const now = Date.now();
  const wait = Math.max(0, lastRequestTime + MIN_INTERVAL_MS - now);
  lastRequestTime = now + wait;
  return new Promise((r) => setTimeout(r, wait));
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        ...headers,
      },
    };
    https.get(url, options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        const done = (b) => resolve({ body: b.toString('utf8'), headers: res.headers });
        if (enc === 'gzip') zlib.gunzip(buf, (err, r) => done(err ? buf : r));
        else if (enc === 'deflate') zlib.inflate(buf, (err, r) => done(err ? buf : r));
        else if (enc === 'br') zlib.brotliDecompress(buf, (err, r) => done(err ? buf : r));
        else done(buf);
      });
    }).on('error', reject);
  });
}

// Parse CLIENT_KEY arr values from goodinfo's first-stage JS response
function buildClientKey(pageBody) {
  const tz = 480; // Taiwan UTC+8
  const excelNow = Date.now() / 86400000 - tz / 1440 + 25569;
  const m = pageBody && pageBody.match(/arr\[0\] = '([^']+)'.*?arr\[1\] = '([^']+)'.*?arr\[2\] = '([^']+)'/s);
  const v0 = m ? m[1] : '4.9';
  const v1 = m ? m[2] : '37097.4196938132';
  const v2 = m ? m[3] : '47097.4196938131';
  return `${v0}|${v1}|${v2}|${tz}|${excelNow.toFixed(10)}|0|0|0`;
}

// Fetch goodinfo page, following the JS-redirect REINIT pattern
async function fetchGoodinfo(path, clientId) {
  const url = `${GOODINFO_BASE}${path}`;

  // First request - gets REINIT JS redirect (no cookies needed yet)
  const first = await httpsGet(url, {
    'Referer': `${GOODINFO_BASE}/index.asp`,
  });

  // Extract REINIT redirect URL from JS
  const reinitMatch = first.body.match(/window\.location\.replace\('([^']+)'\)/);
  if (!reinitMatch) return first.body;

  const reinitPath = reinitMatch[1];
  const reinitUrl = reinitPath.startsWith('http')
    ? reinitPath
    : `${GOODINFO_BASE}/${reinitPath}`;

  // Build CLIENT_KEY from values in the first response's JS
  const clientKey = buildClientKey(first.body);
  const cookie = `CLIENT%5FID=${clientId}; CLIENT_KEY=${encodeURIComponent(clientKey)}`;

  // Second request with proper cookies
  const second = await httpsGet(reinitUrl, {
    'Referer': url,
    'Cookie': cookie,
  });

  return second.body;
}

// Cache CLIENT_ID for 1 hour (it's IP-based)
let cachedClientId = null;
let cacheTime = 0;

async function getClientId() {
  if (cachedClientId && Date.now() - cacheTime < 60 * 60 * 1000) {
    return cachedClientId;
  }
  const res = await httpsGet(`${GOODINFO_BASE}/index.asp`);
  const setCookie = res.headers['set-cookie'];
  if (setCookie) {
    for (const c of (Array.isArray(setCookie) ? setCookie : [setCookie])) {
      const m = c.match(/CLIENT(?:%5F|_)ID=([^;]+)/i);
      if (m) {
        cachedClientId = m[1];
        cacheTime = Date.now();
        return cachedClientId;
      }
    }
  }
  cachedClientId = `${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}_127.0.0.1`;
  cacheTime = Date.now();
  return cachedClientId;
}

app.get('/api/proxy', async (req, res) => {
  const { stockId, type } = req.query;
  if (!stockId) return res.status(400).json({ error: 'stockId required' });

  const paths = {
    basic:       `/StockDetail.asp?STOCK_ID=${stockId}`,
    dividend:    `/StockDividendPolicy.asp?STOCK_ID=${stockId}`,
    exdate:      `/StockDividend.asp?STOCK_ID=${stockId}`,
    cashflow:    `/StockFinDetail.asp?STOCK_ID=${stockId}&RPT_CAT=CF_YEAR`,
    performance: `/StockBzPerformance.asp?STOCK_ID=${stockId}`,
  };

  const path = paths[type];
  if (!path) return res.status(400).json({ error: 'invalid type' });

  try {
    await throttle();
    const clientId = await getClientId();
    const html = await fetchGoodinfo(path, clientId);
    if (html.includes('異常連線') || html.includes('鎖定用戶')) {
      cachedClientId = null; // force refresh on next request
      console.error('[proxy] blocked by goodinfo — wait before retrying');
      return res.status(429).json({ error: 'goodinfo rate limit — please wait 15min' });
    }
    console.log(`[proxy] ${stockId}/${type} → ${html.length} chars`);
    res.json({ html, stockId, type });
  } catch (err) {
    console.error('[proxy] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
