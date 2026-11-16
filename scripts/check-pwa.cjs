const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname=127.0.0.1','--port=3081'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let settled=false;
const timeout=setTimeout(()=>finish(new Error('Local PWA server did not become ready.')),20000);
function finish(error){if(settled)return;settled=true;clearTimeout(timeout);server.kill();if(error){console.error(error.message);process.exitCode=1;}}
server.on('error',finish);
server.on('exit',code=>{if(!settled)finish(new Error('Server exited: '+code));});
server.stderr.on('data',data=>{if(String(data).includes('EADDRINUSE'))finish(new Error('Preview port 3081 is occupied.'));});
server.stdout.on('data',async data=>{
  if(!String(data).includes('Ready'))return;
  try{
    const responses=await Promise.all(['/manifest.webmanifest','/sw.js','/offline.html','/icons/icon-192.png'].map(path=>fetch('http://127.0.0.1:3081'+path,{signal:AbortSignal.timeout(10000)})));
    for(const response of responses)assert.equal(response.status,200,response.url);
    const manifest=await responses[0].json();assert.equal(manifest.display,'standalone');assert.equal(manifest.icons.length,3);
    assert.equal(responses[1].headers.get('service-worker-allowed'),'/');assert.ok(responses[1].headers.get('cache-control').includes('no-store'));
    console.log('PWA HTTP checks passed: manifest, service worker headers, offline page, PNG icon.');finish();
  }catch(error){finish(error);}
});
