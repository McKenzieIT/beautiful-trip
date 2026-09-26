/* Service Worker for 英国7日权威指南 (GitHub Pages)
 * 策略：
 *  - 导航请求：network-first，失败回退缓存 index.html（离线可读文字/时间轴/清单/美食情报）。
 *  - 同站静态资源 + Leaflet CSS/JS（CDN）：cache-first + 后台更新（SWR）。
 *  - 地图瓦片（Google/Esri）：network-only，绝不缓存（离线降级为文字+POI地址，Leaflet 灰底仍显示标记/路线）。
 *  - 安装时尽力预缓存核心文件 + Leaflet（no-cors，离线兜底）。
 */
const SW_VER = 'uk7-v8';
const CORE = [
  './',
  './index.html',
  './restaurants.js',
  './pron.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];
const LEAFLET_CDNS = [
  'https://cdn.bootcdn.net/ajax/libs/leaflet/1.9.4/leaflet.css',
  'https://cdn.bootcdn.net/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdn.staticfile.net/leaflet/1.9.4/leaflet.css',
  'https://cdn.staticfile.net/leaflet/1.9.4/leaflet.js',
  'https://lib.baomitu.com/leaflet/1.9.4/leaflet.css',
  'https://lib.baomitu.com/leaflet/1.9.4/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'
];
// 地图瓦片主机 — 绝不缓存（离线不缓存瓦片）
const TILE_HOSTS = ['mt0.google.com','mt1.google.com','mt2.google.com','mt3.google.com','server.arcgisonline.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const core = await caches.open(SW_VER + '-core');
    await core.addAll(CORE).catch(() => {});
    const lf = await caches.open(SW_VER + '-lf');
    await Promise.all(LEAFLET_CDNS.map(u =>
      fetch(u, { mode: 'no-cors' }).then(r => lf.put(u, r)).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(SW_VER)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // 1) 地图瓦片：network-only，不缓存
  if (TILE_HOSTS.some(h => url.hostname === h)) return;

  // 2) 导航：network-first → 缓存 index.html
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(SW_VER + '-core');
        c.put('./index.html', net.clone()).catch(() => {});
        return net;
      } catch (_) {
        const c = await caches.open(SW_VER + '-core');
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  // 3) 同站静态 + Leaflet CDN：cache-first + 后台 SWR
  const sameOrigin = url.origin === self.location.origin;
  const isLeaflet = LEAFLET_CDNS.some(u => u.indexOf(url.origin) === 0);
  if (sameOrigin || isLeaflet) {
    e.respondWith((async () => {
      const core = await caches.open(SW_VER + '-core');
      const lf = await caches.open(SW_VER + '-lf');
      const cached = await core.match(req) || await lf.match(req);
      const net = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) {
          (isLeaflet ? lf : core).put(req, r.clone()).catch(() => {});
        }
        return r;
      }).catch(() => null);
      return cached || (await net) || Response.error();
    })());
    return;
  }
  // 4) 其余：默认浏览器处理
});
