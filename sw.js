/* Service Worker for 英国7日权威指南 (GitHub Pages)
 * 策略：
 *  - 导航请求：network-first，失败回退缓存 index.html（离线可读文字/时间轴/清单/美食情报）。
 *  - 同站静态资源 + Leaflet CSS/JS（CDN）：cache-first + 后台更新（SWR）。
 *  - 地图瓦片（Google/Esri）：network-only，绝不缓存（离线降级为文字+POI地址，Leaflet 灰底仍显示标记/路线）。
 *  - 安装时尽力预缓存核心文件 + Leaflet（no-cors，离线兜底）。
 */
const SW_VER = 'uk7-v17';
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
// 预录发音音频（离线核心：旅行中问路/点餐必用）。逐个 put（非 addAll），单个缺失不影响其余。
const AUDIO = [
  './audio/ashmolean-museum.mp3',
  './audio/baker-street.mp3',
  './audio/big-ben.mp3',
  './audio/bodleian.mp3',
  './audio/borough-market.mp3',
  './audio/bottega-veneta.mp3',
  './audio/bridge-of-sighs.mp3',
  './audio/british-museum.mp3',
  './audio/bus-stop-t.mp3',
  './audio/caravan.mp3',
  './audio/cf-afternoon-tea.mp3',
  './audio/cf-dintai.mp3',
  './audio/cf-english-breakfast.mp3',
  './audio/cf-fishchips.mp3',
  './audio/cf-haidilao.mp3',
  './audio/cf-hotpot.mp3',
  './audio/cf-lanzhou.mp3',
  './audio/christ-church.mp3',
  './audio/city-sleeper.mp3',
  './audio/coal-drops-yard.mp3',
  './audio/court-cafe.mp3',
  './audio/covered-market.mp3',
  './audio/d1-blooms-cafe.mp3',
  './audio/d1-plough.mp3',
  './audio/d2-jugged-hare.mp3',
  './audio/d2-kazan.mp3',
  './audio/d2-wetherspoon-victoria.mp3',
  './audio/d3-caravan.mp3',
  './audio/d3-coal-office.mp3',
  './audio/d3-german-gym.mp3',
  './audio/d4-ashmolean-roof.mp3',
  './audio/d4-bens-cookies.mp3',
  './audio/d4-grand-cafe.mp3',
  './audio/d4-honest-burgers.mp3',
  './audio/d4-pieminister.mp3',
  './audio/d4-sartorelli.mp3',
  './audio/d4-sasi-thai.mp3',
  './audio/d4-turl-st.mp3',
  './audio/d5-108-brasserie.mp3',
  './audio/d5-court-cafe.mp3',
  './audio/d5-museum-tavern.mp3',
  './audio/d5-store-st-espresso.mp3',
  './audio/d5-the-lamb.mp3',
  './audio/d5-the-marylebone.mp3',
  './audio/d6-borough.mp3',
  './audio/d6-dishoom.mp3',
  './audio/d6-flat-iron.mp3',
  './audio/d6-hawksmoor.mp3',
  './audio/d7-harrods-food.mp3',
  './audio/d7-lighterman.mp3',
  './audio/daunt-books.mp3',
  './audio/dishoom.mp3',
  './audio/german-gymnasium.mp3',
  './audio/gloucester-green.mp3',
  './audio/harrods.mp3',
  './audio/johnstons-of-elgin.mp3',
  './audio/kazan.mp3',
  './audio/kings-cross.mp3',
  './audio/liberty.mp3',
  './audio/london-eye.mp3',
  './audio/marks-and-spencer-pantheon.mp3',
  './audio/marylebone-high-street.mp3',
  './audio/neals-yard.mp3',
  './audio/oxford-circus.mp3',
  './audio/platform-9-three-quarters.mp3',
  './audio/pret-a-manger.mp3',
  './audio/radcliffe-camera.mp3',
  './audio/regents-park.mp3',
  './audio/royal-national-hotel.mp3',
  './audio/russell-square.mp3',
  './audio/selfridges.mp3',
  './audio/sherlock-holmes.mp3',
  './audio/st-pancras-international.mp3',
  './audio/the-jugged-hare.mp3',
  './audio/the-lighterman.mp3',
  './audio/the-plough.mp3',
  './audio/tottenham-court-road.mp3',
  './audio/tower-bridge.mp3',
  './audio/university-church-st-mary.mp3',
  './audio/victoria-station.mp3',
  './audio/vivienne-westwood.mp3',
  './audio/wetherspoons-the-victoria.mp3'
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
    // 音频逐个 put：单个 404/失败不影响其余（addAll 是原子的，一个失败全部回滚）
    await Promise.all(AUDIO.map(u =>
      fetch(u).then(r => { if (r && r.ok) return core.put(u, r); }).catch(() => {})
    ));
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
