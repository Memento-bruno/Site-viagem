/* =====================================================================
   Service worker do Roteiro Europa 2026
   Objetivo: o roteiro abrir e funcionar inteiro sem internet — nos vales
   dos Grisões e das Dolomitas o sinal cai, e roaming na Suíça é caro.
   ===================================================================== */

const VERSAO = '2026-v3';
const CACHE  = `roteiro-${VERSAO}`;

/* Arquivos próprios: sempre em cache, atualizados em segundo plano. */
const FA = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/';
const CASCA = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  // Sem estas, offline todo ícone vira quadrado com X: o CSS carrega do cache
  // mas a fonte que ele referencia nunca foi baixada.
  FA + 'fa-solid-900.woff2',
  FA + 'fa-regular-400.woff2',
  FA + 'fa-brands-400.woff2'
];

/* Hosts externos que valem cachear (CDNs e as fotos de licença livre). */
const EXTERNOS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'upload.wikimedia.org',
  'live.staticflickr.com'
];
const cacheavel = url => EXTERNOS.some(h => url.hostname === h || url.hostname.endsWith('.' + h));

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll falha inteiro se um item falhar; guardamos um a um para ser tolerante.
    // Cross-origin (as fontes) precisa de no-cors, senão a resposta é rejeitada.
    await Promise.all(CASCA.map(u =>
      buscarEGuardar(new Request(u), c).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('roteiro-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Busca uma URL e guarda no cache. Cross-origin sem CORS vira resposta
   opaca — ela não pode ser lida por JS, mas é servível ao navegador. */
async function buscarEGuardar(req, cache) {
  const url = new URL(req.url);
  const mesmaOrigem = url.origin === self.location.origin;
  const resp = await fetch(mesmaOrigem ? req : new Request(req.url, { mode: 'no-cors', credentials: 'omit' }));
  if (resp && (resp.ok || resp.type === 'opaque')) await cache.put(req, resp.clone());
  return resp;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const mesmaOrigem = url.origin === self.location.origin;
  if (!mesmaOrigem && !cacheavel(url)) return;   // deixa passar o que não nos interessa

  /* Navegação: REDE PRIMEIRO, cache como reserva.
     Um roteiro que muda precisa mostrar a versão nova assim que ela existe.
     Com cache primeiro, quem já tinha aberto o site ficava preso na versão
     antiga — o preço de 3 segundos de espera é menor que o de ler um número
     desatualizado. Offline, a reserva entra na hora. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const rede = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 3500))
        ]);
        if (rede && rede.ok) { cache.put('./index.html', rede.clone()); return rede; }
      } catch {}
      return (await cache.match('./index.html'))
          || new Response('Offline e sem cópia local.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  /* Demais recursos: cache primeiro, rede como reserva. */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req);
    if (guardado) {
      if (mesmaOrigem) e.waitUntil(buscarEGuardar(req, cache).catch(() => {}));
      return guardado;
    }
    try {
      return await buscarEGuardar(req, cache);
    } catch {
      return Response.error();
    }
  })());
});

/* Pré-carga sob demanda: a página manda a lista de fotos e CDNs, e o
   worker baixa tudo relatando o progresso de volta. */
self.addEventListener('message', e => {
  const dados = e.data || {};
  if (dados.tipo !== 'PRECARREGAR') return;

  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const urls  = [...new Set(dados.urls || [])];
    let feitos = 0, falhas = 0;

    const responder = msg => e.source && e.source.postMessage(msg);
    responder({ tipo: 'PROGRESSO', feitos, total: urls.length, falhas });

    const LOTE = 6;   // paralelismo moderado: não afoga a rede do hotel
    for (let i = 0; i < urls.length; i += LOTE) {
      await Promise.all(urls.slice(i, i + LOTE).map(async u => {
        try {
          if (await cache.match(u)) { feitos++; return; }
          await buscarEGuardar(new Request(u), cache);
          feitos++;
        } catch { falhas++; }
      }));
      responder({ tipo: 'PROGRESSO', feitos, total: urls.length, falhas });
    }
    responder({ tipo: 'CONCLUIDO', feitos, total: urls.length, falhas });
  })());
});
