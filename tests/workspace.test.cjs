const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const core=require('../public/finance-core.js');
const storage=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size}};};
function workspace(){
  const elements=new Map();const element=()=>({innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},append(){},focus(){},getClientRects(){return[1]},closest(){return null}});
  const document={activeElement:null,querySelector:selector=>{if(selector.includes('#modalRoot form'))return null;if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},querySelectorAll:()=>[],getElementById:id=>document.querySelector('#'+id),addEventListener(){},createElement:element,body:element()};
  const ctx=vm.createContext({console,Intl,Date,Map,Set,URL,URLSearchParams,JSON,crypto:require('node:crypto').webcrypto,localStorage:storage(),document,location:{hash:'',search:''},history:{replaceState(){}},setTimeout:()=>1,clearTimeout(){},setInterval(){},queueMicrotask(){},confirm:()=>true,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},FormData:class{constructor(form){return Object.entries(form.values||{})[Symbol.iterator]();}}});
  ctx.window=ctx;ctx.sessionStorage=storage();ctx.addEventListener=()=>{};ctx.dispatchEvent=()=>{};
  for(const name of ['finance-core','workspace-features','finance-features','app'])vm.runInContext(fs.readFileSync(`public/${name}.js`,'utf8').replace('initWorkspaceFeatures();render();completeGoogleOAuth();',''),ctx);
  vm.runInContext('state.budgets=[];now="2026-11-16";render=()=>{};',ctx);
  return {ctx,run:code=>vm.runInContext(code,ctx),elements};
}
test('CSV supports BOM, semicolons, quoted separators, escaped quotes, and multiline descriptions',()=>{
  const result=core.parseCSV('\uFEFFdate;description;amount\r\n2026-11-16;"Lunch; \"\"special\"\"\nmeal";25.000,50\r\n');
  assert.equal(result.rows[0][1],'Lunch; "special"\nmeal');assert.equal(core.amount(result.rows[0][2],'id'),25000.5);
  assert.throws(()=>core.parseCSV('a,b\n"unfinished,2'));assert.throws(()=>core.parseCSV('a,b\n1,2,3'));
});
test('Money parsing preserves decimal values and negative opening balances; rejects malformed input',()=>{
  assert.equal(core.amount('-200.50'),-200.5);assert.equal(core.amount('25,000.50','en'),25000.5);
  for(const s of ['1e8','abc','1.234,56','Infinity','2.345'])assert.throws(()=>core.amount(s));
  assert.equal(core.csvCell('=SUM(A1)'),"\"'=SUM(A1)\"");
});
test('Dates and recurring monthly tasks handle month boundaries',()=>{
  assert.equal(core.validDate('2026-02-30'),false);assert.equal(core.validDate('2028-02-29'),true);
  assert.equal(core.nextDue('2026-01-31','monthly'),'2026-02-28');assert.equal(core.nextDue('2026-12-30','weekly'),'2027-01-06');
});
test('Backup validates records before changing existing data',()=>{
  assert.throws(()=>core.validateWorkspace({profile:{},transactions:[{id:'x',amount:-5,date:'2026-11-16',type:'Expense'}]}));
  assert.throws(()=>core.validateWorkspace({profile:{},tasks:[{id:"x');alert(1)//"}]}));
  assert.throws(()=>core.validateWorkspace({profile:{},tasks:[{id:'a'},{id:'a'}]}));
  assert.deepEqual(core.validateWorkspace({profile:{timezone:'Asia/Jakarta'}}).accounts,[]);
});
test('Account transfers preserve total money; expenses and income affect only the linked account',()=>{
  const {run}=workspace();
  run(`state.accounts=[{id:'a',initial:1000},{id:'b',initial:500}];state.transactions=[{id:'t',type:'Transfer',amount:200,fromAccountId:'a',toAccountId:'b'},{id:'e',type:'Expense',amount:50,accountId:'a'},{id:'i',type:'Income',amount:100,accountId:'b'}]`);
  assert.equal(run('accountBalance(state.accounts[0])'),750);assert.equal(run('accountBalance(state.accounts[1])'),800);assert.equal(run('balance()'),1550);
});
test('Recurring completion creates one successor and never duplicates on reopen',async()=>{
  const {run}=workspace();run(`state.tasks=[{id:'a',title:'Weekly review',due:'2026-11-16',repeat:'weekly',status:'Completed'}];createNextTaskOccurrence(state.tasks[0]);createNextTaskOccurrence(state.tasks[0]);`);
  assert.equal(run('state.tasks.length'),2);assert.equal(run('state.tasks[1].due'),'2026-11-23');assert.equal(run('state.tasks[1].status'),'To do');
});
test('Dashboard separates today from upcoming and archived tasks',()=>{
  const {run}=workspace();run(`state.events=[{id:'a',title:'Today meeting',date:now},{id:'b',title:'Future meeting',date:'2026-11-20'}];state.tasks=[{id:'late',title:'Overdue task',status:'To do',due:'2026-11-15'},{id:'archived',title:'Hidden archived',status:'Archived',due:now}];`);
  const html=run('featureHome()');assert.ok(html.includes('Overdue task'));assert.ok(!html.includes('Hidden archived'));
  assert.ok(html.indexOf('Today meeting')<html.indexOf('Upcoming events'));assert.ok(html.indexOf('Future meeting')>html.indexOf('Upcoming events'));
});
test('Task list keeps descriptions, safe links, and escapes user content',()=>{
  const {run}=workspace();const html=run(`taskRows([{id:'a',title:'<script>',description:'Task details',link:'https://example.com',status:'To do'}])`);
  assert.ok(html.includes('Task details'));assert.ok(html.includes('https://example.com/'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!run(`taskRows([{id:'a',link:'javascript:alert(1)'}])`).includes('href="javascript:'));
});
test('CSV mapping validates, previews, skips duplicates, and does not mutate records before commit',()=>{
  const {run}=workspace();run(`state.accounts=[{id:'a',name:'Cash',initial:0}];state.transactions=[];csvImport=RenovaCore.parseCSV('date,type,amount,account,description\\n2026-11-16,Expense,25000,Cash,Lunch\\n2026-11-16,Expense,25000,Cash,Lunch');document.getElementById('csvMap').values={date:'0',type:'1',amount:'2',account:'3',to_account:'',category:'',description:'4',numberFormat:'plain',defaultAccount:'Cash',defaultType:'Expense',dateFormat:'iso'};previewFinanceCSV();`);
  assert.equal(run('state.transactions.length'),0);assert.equal(run('csvPreview.rows.length'),1);
  run('commitFinanceCSV()');assert.equal(run('state.transactions.length'),1);run('undoLastChange()');assert.equal(run('state.transactions.length'),0);
});
test('Finance reset preserves unrelated personal records and can be undone',()=>{
  const {run}=workspace();run(`state.accounts=[{id:'a'}];state.tasks=[{id:'t'}];state.journal=[{id:'j'}];state.transactions=[{id:'x'}];clearRecords({preventDefault(){},target:{values:{scope:'finance',confirmation:'DELETE'}}});`);
  assert.equal(run('state.accounts.length'),0);assert.equal(run('state.tasks.length'),1);assert.equal(run('state.journal.length'),1);
  assert.ok(run('localStorage.getItem(STORE+":recovery")'));run('undoLastChange()');assert.equal(run('state.accounts.length'),1);
});
test('Finance filters include transfers for both accounts and exclude other months',()=>{
  const {run}=workspace();run(`featurePrefs.finance={month:'2026-11',account:'b',type:'',query:''};state.transactions=[{id:'x',date:'2026-11-16',type:'Transfer',fromAccountId:'a',toAccountId:'b'},{id:'y',date:'2026-10-16',type:'Income',accountId:'b'}]`);
  assert.equal(run('filteredTransactions().length'),1);assert.equal(run('filteredTransactions()[0].id'),'x');
});
test('Undo deletion preserves unrelated work added afterwards',()=>{
  const {run}=workspace();run(`state.transactions=[{id:'a',amount:5}];state.journal=[];checkpoint('delete transaction');state.transactions=[];save();state.journal.push({id:'new',body:'Keep this writing'});save();undoLastChange();`);
  assert.equal(run('state.transactions[0].id'),'a');assert.equal(run('state.journal[0].body'),'Keep this writing');
});
test('Timezone conversion follows the profile, including daylight saving gaps',()=>{
  assert.equal(core.zonedISO('2026-11-16','09:00','Asia/Jakarta'),'2026-11-16T02:00:00.000Z');
  assert.equal(core.zonedParts('2026-11-16T23:30:00Z','Asia/Bangkok').date,'2026-11-17');
  assert.throws(()=>core.zonedISO('2026-03-08','02:30','America/New_York'));
  assert.throws(()=>core.amount('1,2,3','en'));assert.throws(()=>core.amount('1.2.3','id'));
});
test('Every main screen produces usable markup with an empty workspace',()=>{
  const {run}=workspace();for(const page of ['home','tasks','calendar','finance','goals','journal','settings','projects','investments','journey']) {
    const html=run(`${page}()`);assert.equal(typeof html,'string');assert.ok(html.includes('page-heading'),page);
  }
});
test('Static preview contains the navigation controls needed during bootstrap',()=>{
  const html=fs.readFileSync('index.html','utf8');
  for(const id of ['mobileSidebarCollapse','sidebarBackdrop','mobileMenu','nav','page','quickButton','searchButton','themeButton','settingsButton','modalRoot','toast'])assert.ok(html.includes(`id="${id}"`),id);
});
test('Bank debit/credit CSV columns infer expense and income without double counting',()=>{
  const {run}=workspace();run(`state.accounts=[{id:'a',name:'Bank',initial:0}];csvImport=RenovaCore.parseCSV('date,debit,credit\\n2026-11-16,25000,0\\n2026-11-17,0,100000');document.getElementById('csvMap').values={date:'0',type:'',amount:'',debit:'1',credit:'2',account:'',to_account:'',category:'',description:'',numberFormat:'plain',defaultAccount:'Bank',defaultType:'Expense',dateFormat:'iso'};previewFinanceCSV();`);
  assert.equal(run('csvPreview.errors'),0);assert.equal(run('csvPreview.rows[0].type'),'Expense');assert.equal(run('csvPreview.rows[1].type'),'Income');
});
