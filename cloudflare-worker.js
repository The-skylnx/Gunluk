/**
 * Cloudflare Worker — YÖK Atlas CORS Proxy (Sertleştirilmiş)
 * Yalnızca https://the-skylnx.github.io ve yerel geliştirme (localhost / 127.0.0.1) kaynaklarına izin verir.
 */
function getAllowedOrigin(origin) {
  if (!origin) return null;
  if (origin === 'https://the-skylnx.github.io') return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return null;
}

function jsonResponse(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

export default {
  async fetch(request) {
    const reqOrigin = request.headers.get('Origin') || '';
    const allowedOrigin = getAllowedOrigin(reqOrigin);
    const corsHeaders = {
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (allowedOrigin) {
      corsHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
    }

    if (request.method === 'OPTIONS') {
      if (!allowedOrigin) {
        return jsonResponse({ error: 'İzin verilmeyen kaynak (Origin).' }, 403, corsHeaders);
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (reqOrigin && !allowedOrigin) {
      return jsonResponse({ error: 'İzin verilmeyen kaynak (Origin).' }, 403, corsHeaders);
    }

    const url = new URL(request.url);
    const rawPath = url.searchParams.get('path') || '';
    if (!rawPath || !rawPath.startsWith('/api/') || rawPath.includes('..') || rawPath.includes('://') || /\s/.test(rawPath)) {
      return jsonResponse({ error: 'Geçersiz path parametresi. Yalnızca /api/ ile başlayan yollara izin verilir.' }, 400, corsHeaders);
    }

    const targetUrl = `https://yokatlas.yok.gov.tr${rawPath}`;
    try {
      const init = {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://yokatlas.yok.gov.tr',
          'Referer': 'https://yokatlas.yok.gov.tr/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      };

      if (request.method === 'POST') {
        init.body = await request.text();
      }

      const resp = await fetch(targetUrl, init);
      const body = await resp.text();

      if (!resp.ok) {
        return jsonResponse({
          error: 'Hedef sunucu hata döndürdü.',
          upstreamStatus: resp.status
        }, resp.status >= 500 ? 502 : resp.status, corsHeaders);
      }

      return new Response(body, {
        status: resp.status,
        headers: {
          ...corsHeaders,
          'Content-Type': resp.headers.get('Content-Type') || 'application/json; charset=utf-8'
        }
      });
    } catch (err) {
      return jsonResponse({
        error: 'Hedef sunucuya bağlanılamadı.',
        detail: err && err.message ? err.message : 'Bilinmeyen ağ hatası'
      }, 502, corsHeaders);
    }
  }
};
