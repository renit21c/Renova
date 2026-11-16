const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function worker({online=true}={}) {
  const listeners=new Map(),stored=new Map(),requests=[],puts=[];
  const cache={addAll:async paths=>{paths.forEach(p=>stored.set(p,new Response('public '+p)));},match:async request=>stored.get(typeof request==='string'?request:new URL(request.url).pathname),put:async(...args)=>puts.push(args)};
  const context=vm.createContext({URL,Response,caches:{open:async()=>cache,match:cache.match,keys:async()=>['renova-shell-v0','other-app-cache'],delete:async key=>{requests.push(key);return true;}},fetch:async request=>{if(!online)throw new Error('offline');return new Response('network '+request.url);},self:{location:{origin:'https://renova.test'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>listeners.set(name,fn)}});
  vm.runInContext(fs.readFileSync('public/sw.js','utf8'),context);
  return {listeners,stored,puts,requests,async install(){let pending;listeners.get('install')({waitUntil:p=>pending=p});await pending;},async fetch(path,{method='GET',mode='cors'}={}){let result;listeners.get('fetch')({request:{url:'https://renova.test'+path,method,mode},respondWith:p=>result=p});return result?await result:null;}};
}
test('PWA icons have the required real PNG dimensions',()=>{
  for(const [name,size] of [['icon-192',192],['icon-512',512],['icon-maskable-512',512],['apple-touch-icon',180]]) {
    const png=fs.readFileSync(`public/icons/${name}.png`);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
});
test('Service worker precaches every public asset and serves the offline fallback on failed navigation',async()=>{
  const sw=worker({online:false});await sw.install();
  for(const file of sw.stored.keys())assert.ok(fs.existsSync('public'+file),file);
  const response=await sw.fetch('/',{mode:'navigate'});assert.equal(await response.text(),'public /offline.html');
});
test('Private navigation stays on the network and never enters Cache Storage',async()=>{
  const sw=worker();await sw.install();
  const response=await sw.fetch('/?gcal_ticket=private',{mode:'navigate'});assert.ok((await response.text()).includes('gcal_ticket=private'));assert.equal(sw.puts.length,0);assert.equal(sw.stored.has('/'),false);
  assert.equal(await sw.fetch('/api/account'),null);assert.equal(await sw.fetch('/records',{method:'POST'}),null);
});
test('Offline cache contains no application scripts or personal JSON records',async()=>{
  const sw=worker({online:false});await sw.install();
  assert.equal(await sw.fetch('/app.js'),null);assert.equal(await sw.fetch('/renova_workspace'),null);assert.equal(await sw.fetch('/icons/icon-192.png?token=private'),null);
});
test('Activating a worker removes only obsolete Renova caches',async()=>{
  const sw=worker();let pending;sw.listeners.get('activate')({waitUntil:p=>pending=p});await pending;assert.deepEqual(sw.requests,['renova-shell-v0']);
});
