/* Cache public install assets only. Authenticated HTML, records, API calls, and OAuth are never cached. */
const CACHE='renova-shell-v1';
const PUBLIC_ASSETS=['/offline.html','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png','/icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('renova-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(async()=>await caches.match('/offline.html')||new Response('Renova offline. Sambungkan internet lalu coba lagi.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})));
    return;
  }
  if(PUBLIC_ASSETS.includes(url.pathname)&&!url.search){
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
  }
});
