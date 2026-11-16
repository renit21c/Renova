const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const code=stripTypeScriptTypes(fs.readFileSync('utils/workspace-sync.ts','utf8')).replace('export function workspaceSync','function workspaceSync');
function harness({row=null,pending=null,version=null,failRead=false,failWrite=false,conflictWrite=false}={}){
  const values=new Map(), listeners=new Map(), timers=new Map(), statuses=[];let conflicts=0,updates=0,reads=0,sequence=0;
  const key='renova-v1:user';values.set(key,JSON.stringify(pending||{profile:{},tasks:[]}));if(pending)values.set(key+':pending',JSON.stringify(pending));if(version)values.set(key+':version',version);
  const client={from(){let operation='read',payload,conditions=[];const q={select(){return q;},eq(k,v){conditions.push([k,v]);return q;},maybeSingle(){return q;},update(p){operation='update';payload=p;return q;},insert(p){operation='insert';payload=p;return q;},then(resolve,reject){return Promise.resolve().then(()=>{
    if(operation==='read'){reads++;return failRead?{data:null,error:new Error('offline')}:{data:row,error:null};}
    updates++;if(failWrite)return{data:null,error:new Error('offline')};
    if(conflictWrite||(operation==='update'&&conditions.some(([k,v])=>k==='updated_at'&&v!==row?.updated_at)))return{data:[],error:null};
    if(operation==='insert'&&row)return{data:null,error:{code:'23505'}};
    row={state:payload.state,updated_at:payload.updated_at};return{data:[{updated_at:row.updated_at}],error:null};
  }).then(resolve,reject);}};return q;}};
  const ctx=vm.createContext({console,Date,JSON,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},setTimeout(fn){const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),window:{dispatchEvent(){},addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type),location:{reload(){}}}});
  vm.runInContext(code,ctx);
  const sync=ctx.workspaceSync(client,'user',{status:s=>statuses.push(s),conflict:v=>{if(v)conflicts++;},error(){}});
  return{sync,values,key,statuses,get row(){return row},get updates(){return updates},get conflicts(){return conflicts},async tick(){const callbacks=[...timers.values()];timers.clear();for(const f of callbacks)f();for(let i=0;i<20;i++)await Promise.resolve();},event(name){listeners.get(name)?.({});},setFailWrite(value){failWrite=value;}};
}
test('Pending local edits survive reopening and replay to cloud',async()=>{
  const pending={profile:{},tasks:[{id:'a'}]},h=harness({row:{state:{profile:{},tasks:[]},updated_at:'2026-01-01T00:00:00Z'},pending,version:'2026-01-01T00:00:00Z'});
  await h.sync.load();await h.tick();assert.equal(h.row.state.tasks[0].id,'a');assert.equal(h.values.get(h.key+':pending'),undefined);assert.equal(h.conflicts,0);h.sync.dispose();
});
test('Newer cloud data cannot silently overwrite unsynced local work',async()=>{
  const h=harness({row:{state:{profile:{},tasks:[{id:'remote'}]},updated_at:'2026-02-01T00:00:00Z'},pending:{profile:{},tasks:[{id:'local'}]},version:'2026-01-01T00:00:00Z'});
  await h.sync.load();await h.tick();assert.equal(h.conflicts,1);assert.equal(h.updates,0);assert.equal(JSON.parse(h.values.get(h.key)).tasks[0].id,'local');h.sync.dispose();
});
test('Failed cloud writes retain outbox and retry successfully',async()=>{
  const h=harness({pending:{profile:{},tasks:[{id:'a'}]},failWrite:true});await h.sync.load();await h.tick();assert.ok(h.values.get(h.key+':pending'));assert.equal(h.updates,1);
  h.setFailWrite(false);await h.tick();assert.equal(h.row.state.tasks[0].id,'a');assert.equal(h.values.get(h.key+':pending'),undefined);h.sync.dispose();
});
test('Concurrent updates use compare-and-set rather than blind upsert',async()=>{
  const h=harness({row:{state:{profile:{}},updated_at:'2026-01-01T00:00:00Z'},pending:{profile:{},tasks:[{id:'local'}]},version:'2026-01-01T00:00:00Z',conflictWrite:true});await h.sync.load();await h.tick();assert.equal(h.conflicts,1);assert.ok(h.values.get(h.key+':pending'));h.sync.dispose();
});
test('Offline startup opens cached workspace and keeps changes pending',async()=>{
  const h=harness({pending:{profile:{},tasks:[{id:'local'}]},failRead:true,failWrite:true});assert.equal(await h.sync.load(),true);assert.ok(h.statuses.some(x=>x.includes('offline')));assert.ok(h.values.get(h.key+':pending'));h.sync.dispose();
});
test('Choosing local explicitly archives the replaced cloud copy',async()=>{
  const remote={profile:{},tasks:[{id:'remote'}]},h=harness({row:{state:remote,updated_at:'2026-02-01T00:00:00Z'},pending:{profile:{},tasks:[{id:'local'}]},version:'2026-01-01T00:00:00Z'});await h.sync.load();await h.sync.resolve('local');await h.tick();assert.equal(h.row.state.tasks[0].id,'local');assert.deepEqual(JSON.parse(h.values.get(h.key+':recovery')),remote);h.sync.dispose();
});
