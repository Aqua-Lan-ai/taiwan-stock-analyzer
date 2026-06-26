export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const rawTicker = url.searchParams.get('ticker') || '';
  if (!rawTicker) {
    return json({ error: 'ticker required' }, 400);
  }

  const ticker = rawTicker.replace(/\//g, '-');

  // Try without cookie first; if blocked, get session from Yahoo homepage
  let chartRes = await fetchChart(ticker, '');
  if (!chartRes.ok || chartRes.status === 429) {
    const cookie = await getYFCookie();
    chartRes = await fetchChart(ticker, cookie);
  }

  const body = await chartRes.text();
  if (!body.startsWith('{')) {
    return json({ error: `Yahoo Finance error: ${body.slice(0, 80)}` }, 500);
  }

  const chart = JSON.parse(body);
  const result = { chart: chart?.chart?.result?.[0] ?? null, pe: null };
  return json({ html: JSON.stringify(result) });
}

async function fetchChart(ticker, cookie) {
  return fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?events=dividends&range=10y&interval=1mo`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com/',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    }
  );
}

async function getYFCookie() {
  try {
    const res = await fetch('https://finance.yahoo.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    // Edge Runtime combines multiple Set-Cookie into one header
    const setCookie = res.headers.get('set-cookie') || '';
    return setCookie.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  } catch {
    return '';
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
