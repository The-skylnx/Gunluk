/**
 * Cloudflare Worker — YÖK Atlas CORS Proxy
 * Kurulum: Cloudflare Dashboard -> Workers & Pages -> Create Worker -> bu kodu yapıştırıp Deploy et.
 * Oluşan *.workers.dev adresini Günlük uygulamasındaki "Canlı YÖK Atlas Proxy Ayarı" kutusuna yapıştır.
 */
export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const targetPath = url.searchParams.get('path') || '/api/tercih-kilavuz/search';
    const targetUrl = `https://yokatlas.yok.gov.tr${targetPath.startsWith('/') ? targetPath : '/' + targetPath}`;

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
    return new Response(body, {
      status: resp.status,
      headers: {
        ...corsHeaders,
        'Content-Type': resp.headers.get('Content-Type') || 'application/json; charset=utf-8'
      }
    });
  }
};
