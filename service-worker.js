
const CACHE='club-cache-v1';
const ASSETS=['./','./index.html','./app.js','./styles.css','./manifest.webmanifest','./assets/logo.png',
'./data/rooms.json','./data/calendar.json','./data/tariffs.json','./data/policies.json','./data/members.csv','./data/promotions.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(url.origin===location.origin){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));}});
