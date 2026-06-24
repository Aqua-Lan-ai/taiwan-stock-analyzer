import https from 'https';
import zlib from 'zlib';

const GOODINFO_BASE = 'https://goodinfo.tw/tw';
const agent = new https.Agent({ rejectUnauthorized: false });

const htmlCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

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

function buildClientKey(pageBody) {
  const tz = 480;
  const excelNow = Date.now() / 86400000 - tz / 1440 + 25569;
  const m = pageBody && pageBody.match(/arr\[0\] = '([^']+)'.*?arr\[1\] = '([^']+)'.*?arr\[2\] = '([^']+)'/s);
  const v0 = m ? m[1] : '4.9';
  const v1 = m ? m[2] : '37097.4196938132';
  const v2 = m ? m[3] : '47097.4196938131';
  return `${v0}|${v1}|${v2}|${tz}|${excelNow.toFixed(10)}|0|0|0`;
}

async function fetchGoodinfo(path, clientId) {
  const url = `${GOODINFO_BASE}${path}`;
  const first = await httpsGet(url, { Referer: `${GOODINFO_BASE}/index.asp` });
  const reinitMatch = first.body.match(/window\.location\.replace\('([^']+)'\)/);
  if (!reinitMatch) return first.body;
  const reinitPath = reinitMatch[1];
  const reinitUrl = reinitPath.startsWith('http') ? reinitPath : `${GOODINFO_BASE}/${reinitPath}`;
  const clientKey = buildClientKey(first.body);
  const cookie = `CLIENT%5FID=${clientId}; CLIENT_KEY=${encodeURIComponent(clientKey)}`;
  const second = await httpsGet(reinitUrl, { Referer: url, Cookie: cookie });
  return second.body;
}

let cachedClientId = null;
let cacheTime = 0;

// Yahoo Finance crumb auth
let yfCrumb = null;
let yfCookie = null;
let yfCrumbTime = 0;

async function getYFCrumb() {
  if (yfCrumb && yfCookie && Date.now() - yfCrumbTime < 60 * 60 * 1000) return { crumb: yfCrumb, cookie: yfCookie };
  const fcRes = await httpsGet('https://fc.yahoo.com', { Accept: '*/*' });
  const setCookie = fcRes.headers['set-cookie'];
  let cookie = '';
  if (setCookie) {
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    cookie = cookies.map((c) => c.split(';')[0]).join('; ');
  }
  const crumbRes = await httpsGet('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    Accept: 'application/json',
    Cookie: cookie,
    Referer: 'https://finance.yahoo.com/',
  });
  yfCrumb = crumbRes.body.trim();
  yfCookie = cookie;
  yfCrumbTime = Date.now();
  return { crumb: yfCrumb, cookie: yfCookie };
}

async function getClientId() {
  if (cachedClientId && Date.now() - cacheTime < 60 * 60 * 1000) return cachedClientId;
  const res = await httpsGet(`${GOODINFO_BASE}/index.asp`);
  const setCookie = res.headers['set-cookie'];
  if (setCookie) {
    for (const c of Array.isArray(setCookie) ? setCookie : [setCookie]) {
      const m = c.match(/CLIENT(?:%5F|_)ID=([^;]+)/i);
      if (m) { cachedClientId = m[1]; cacheTime = Date.now(); return cachedClientId; }
    }
  }
  cachedClientId = `${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}_127.0.0.1`;
  cacheTime = Date.now();
  return cachedClientId;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { stockId, type, force } = req.query;

  // Yahoo Finance: price + dividend history for US stocks
  if (type === 'us_stock') {
    const { ticker } = req.query;
    if (!ticker) return res.status(400).json({ error: 'ticker required' });
    const cacheKey = `us_stock/${ticker}`;
    const cached = htmlCache.get(cacheKey);
    const US_TTL = 30 * 60 * 1000; // 30 min
    if (cached && force !== '1' && Date.now() - cached.time < US_TTL) {
      return res.json({ html: cached.html, cached: true });
    }
    try {
      const chartHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/',
      };
      // Fetch chart (always needed) and PE summary (best-effort)
      const chartRes = await httpsGet(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?events=dividends&range=10y&interval=1mo`,
        chartHeaders
      );
      const chart = JSON.parse(chartRes.body);

      let summaryResult = null;
      try {
        const { crumb, cookie } = await getYFCrumb();
        const summaryRes = await httpsGet(
          `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,assetProfile&crumb=${encodeURIComponent(crumb)}`,
          { ...chartHeaders, Cookie: cookie }
        );
        const summary = JSON.parse(summaryRes.body);
        summaryResult = summary?.quoteSummary?.result?.[0] ?? null;
      } catch (_) { /* PE unavailable, continue without it */ }

      const result = {
        chart: chart?.chart?.result?.[0] ?? null,
        summary: summaryResult,
      };
      const html = JSON.stringify(result);
      htmlCache.set(cacheKey, { html, time: Date.now() });
      return res.json({ html });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // TWSE real-time price: no goodinfo needed
  if (type === 'twse_price') {
    if (!stockId) return res.status(400).json({ error: 'stockId required' });
    const cacheKey = `twse_price/${stockId}`;
    const cached = htmlCache.get(cacheKey);
    const PRICE_TTL = 5 * 60 * 1000; // 5 min
    if (cached && force !== '1' && Date.now() - cached.time < PRICE_TTL) {
      return res.json({ html: cached.html, cached: true });
    }
    try {
      let info = null;
      for (const ex of ['tse', 'otc']) {
        const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${ex}_${stockId}.tw&json=1&delay=0`;
        const result = await httpsGet(url, { Referer: 'https://mis.twse.com.tw/', Accept: 'application/json' });
        const json = JSON.parse(result.body);
        const row = json.msgArray?.find(r => r.c === stockId);
        if (row) { info = row; break; }
      }
      const html = JSON.stringify(info ?? {});
      htmlCache.set(cacheKey, { html, time: Date.now() });
      return res.json({ html });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // TWSE ex-dividend table: year-based query, no goodinfo REINIT needed
  if (type === 'twse_ex') {
    const { year } = req.query;
    if (!year) return res.status(400).json({ error: 'year required' });
    const cacheKey = `twse_ex/${year}`;
    const cached = htmlCache.get(cacheKey);
    if (cached && force !== '1' && Date.now() - cached.time < CACHE_TTL_MS) {
      return res.json({ html: cached.html, cached: true });
    }
    try {
      const url = `https://www.twse.com.tw/rwd/zh/stock/TWT49U?response=json&strDate=${year}0101&endDate=${year}1231`;
      const result = await httpsGet(url, { Referer: 'https://www.twse.com.tw/', Accept: 'application/json' });
      htmlCache.set(cacheKey, { html: result.body, time: Date.now() });
      return res.json({ html: result.body });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (!stockId) return res.status(400).json({ error: 'stockId required' });

  const paths = {
    basic:       `/StockDetail.asp?STOCK_ID=${stockId}`,
    dividend:    `/StockDividendPolicy.asp?STOCK_ID=${stockId}`,
    cashflow:    `/StockFinDetail.asp?STOCK_ID=${stockId}&RPT_CAT=CF_YEAR`,
    performance: `/StockBzPerformance.asp?STOCK_ID=${stockId}`,
    schedule:    `/StockDividendSchedule.asp?STOCK_ID=${stockId}`,
  };

  const path = paths[type];
  if (!path) return res.status(400).json({ error: 'invalid type' });

  const cacheKey = `${stockId}/${type}`;
  const cached = htmlCache.get(cacheKey);
  if (cached && force !== '1' && Date.now() - cached.time < CACHE_TTL_MS) {
    return res.json({ html: cached.html, stockId, type, cached: true });
  }

  try {
    const clientId = await getClientId();
    const html = await fetchGoodinfo(path, clientId);
    if (html.includes('異常連線') || html.includes('鎖定用戶')) {
      cachedClientId = null;
      return res.status(429).json({ error: 'goodinfo rate limit — please wait 15min' });
    }
    htmlCache.set(cacheKey, { html, time: Date.now() });
    res.json({ html, stockId, type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
