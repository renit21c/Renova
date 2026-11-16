const {test}=require('node:test'),assert=require('node:assert/strict');
const assistant=require('../public/assistant-core.js');
const today='2026-11-16';
function fixture(){return{profile:{currency:'IDR'},accounts:[{id:'a',name:'Cash',initial:1000},{id:'b',name:'Bank',initial:500}],transactions:[{id:'income',date:today,type:'Income',amount:2000,accountId:'a',category:'Salary'},{id:'food',date:today,type:'Expense',amount:300,accountId:'a',category:'Food & groceries',description:'Lunch'},{id:'transport',date:'2026-11-15',type:'Expense',amount:150,accountId:'b',category:'Transport'},{id:'transfer',date:today,type:'Transfer',amount:200,fromAccountId:'a',toAccountId:'b'},{id:'old',date:'2026-10-20',type:'Expense',amount:900,accountId:'a',category:'Shopping'}],budgets:[{id:'budget-food',month:'2026-11',category:'Food & groceries',amount:200},{id:'budget-transport',month:'2026-11',category:'Transport',amount:200}],tasks:[{id:'late',title:'Finish report',due:'2026-11-15',priority:'High',status:'In progress'},{id:'today',title:'Review budget',due:today,priority:'Medium',status:'To do'},{id:'tomorrow',title:'Send proposal',due:'2026-11-17',priority:'High',status:'To do'},{id:'done',title:'Done task',status:'Completed',completed:today},{id:'archived',title:'Hidden task',due:'2026-11-01',status:'Archived'},{id:'unscheduled',title:'Read book',status:'Inbox'}],events:[{id:'meeting',title:'Daily meeting',date:today,time:'09:00'},{id:'visit',title:'Client visit',date:'2026-11-17',time:'13:00'}]};}
const ask=(text,context={})=>assistant.answer(fixture(),text,{today,...context});
test('Spending totals exclude transfers and other months',()=>{
  const reply=ask('Pengeluaran bulan ini');assert.equal(reply.intent,'spending');assert.match(reply.text,/450/);assert.equal(reply.items.length,2);assert.equal(reply.items[0].label,'Food & groceries');
});
test('Balance includes opening balances and handles both transfer legs exactly once',()=>{
  const reply=ask('total saldo');assert.match(reply.text,/2[.\s]150/);assert.equal(reply.items.length,2);
  const account=ask('saldo Bank');assert.match(account.text,/550/);assert.equal(account.items.length,1);
});
test('Unknown account and category do not silently return unrelated totals',()=>{
  assert.match(ask('saldo rekening BCA').title,/belum dikenali/);
  assert.match(ask('pengeluaran kategori Hiburan').title,/belum dikenali/);
});
test('Category aliases and account filters use recorded categories',()=>{
  const reply=ask('pengeluaran makanan bulan ini');assert.match(reply.text,/300/);assert.equal(reply.items.length,1);
  const bank=ask('pengeluaran rekening Bank bulan ini');assert.match(bank.text,/150/);assert.equal(bank.items[0].label,'Transport');
});
test('Budget reports overspending and remaining limits without treating transfers as expenses',()=>{
  const reply=ask('anggaran bulan ini');assert.equal(reply.intent,'budget');assert.match(reply.items[0].value,/Lewat.*100/);assert.match(reply.items[1].value,/Sisa.*50/);
});
test('Control suggestions reflect actual overspending and do not label large categories as wasteful',()=>{
  const reply=ask('Apa yang perlu dikontrol?');assert.equal(reply.intent,'control');assert.equal(reply.items[0].label,'Food & groceries');assert.ok(reply.items.some(x=>/belum tentu boros/.test(x.detail)));assert.ok(!reply.items.some(x=>/negatif/.test(x.label)));
});
test('Missing income is described as incomplete records, not a definitive financial diagnosis',()=>{
  const state=fixture();state.transactions=state.transactions.filter(t=>t.type!=='Income');
  const reply=assistant.answer(state,'apa yang perlu dikontrol',{today});assert.ok(reply.items.some(x=>/pemasukan sudah lengkap/.test(x.detail)));
});
test('Task periods exclude archived/completed tasks and preserve tomorrow dates',()=>{
  assert.deepEqual(ask('tugas hari ini').items.map(x=>x.id),['today']);
  assert.deepEqual(ask('tugas besok').items.map(x=>x.id),['tomorrow']);
  assert.deepEqual(ask('tugas terlambat').items.map(x=>x.id),['late']);
  assert.deepEqual(ask('tugas tanpa deadline').items.map(x=>x.id),['unscheduled']);
});
test('Completed tasks are counted using completion dates',()=>{
  assert.deepEqual(ask('tugas selesai hari ini').items.map(x=>x.id),['done']);
});
test('Priority questions rank overdue tasks first',()=>{
  const reply=ask('apa prioritas yang perlu dikerjakan');assert.equal(reply.items[0].id,'late');assert.ok(!reply.items.some(x=>x.id==='archived'||x.id==='done'));
});
test('Calendar answers use explicit periods and warn about limited Google coverage',()=>{
  assert.equal(ask('jadwal besok').items[0].label,'Client visit');
  const reply=ask('jadwal hari ini',{googleConnected:true});assert.match(reply.text,/sudah dimuat/);assert.equal(reply.items.length,1);
});
test('Event deduplication keeps distinct recurring occurrences',()=>{
  const events=[{id:'weekly',title:'Meeting',date:today},{id:'weekly',title:'Meeting',date:today},{id:'weekly',title:'Meeting',date:'2026-11-17'}];
  assert.equal(ask('jadwal minggu ini',{events}).items.length,2);
});
test('Date parser handles previous month across a year boundary, full weeks, and named months',()=>{
  assert.equal(assistant.period('bulan lalu','2026-01-10').start,'2025-12-01');
  assert.deepEqual(assistant.period('minggu ini',today),{start:today,end:'2026-11-22',label:'2026-11-16 – 2026-11-22',explicit:true});
  assert.equal(assistant.period('Februari 2028',today).end,'2028-02-29');
  assert.equal(assistant.period('bulan kemarin',today).start,'2026-10-01');
  assert.equal(assistant.period('minggu kemarin',today).start,'2026-11-09');
  assert.equal(assistant.period('jadwal 20 November',today).start,'2026-11-20');
  assert.equal(assistant.period('jadwal 17/11/2026',today).start,'2026-11-17');
});
test('Invalid and excessively long ranges request clarification',()=>{
  assert.ok(assistant.period('2026-02-30',today).error);assert.ok(assistant.period('2026-12-01 sampai 2026-11-01',today).error);assert.ok(assistant.period('2020-01-01 sampai 2026-11-01',today).error);
});
test('Date-only followups retain the last topic',()=>{
  const reply=ask('dan bulan lalu?',{lastIntent:'spending'});assert.equal(reply.intent,'spending');assert.match(reply.text,/900/);
});
test('Unsupported questions and write commands return help without pretending to execute',()=>{
  assert.equal(ask('hapus semua transaksi').intent,'help');assert.equal(ask('bagaimana cuaca?').intent,'help');assert.equal(ask('buat tugas baru').intent,'help');
});
test('Transfers can be queried independently from income and spending',()=>{
  const reply=ask('berapa total transfer bulan ini');assert.equal(reply.intent,'transfers');assert.match(reply.text,/200/);assert.equal(reply.items.length,1);
});
test('Mixed income and expense questions return both totals',()=>{
  const reply=ask('pemasukan dan pengeluaran bulan ini');assert.equal(reply.intent,'overview');assert.equal(reply.items.length,3);
});
test('Historical balance requests clearly identify the all-time balance limitation',()=>{
  assert.match(ask('saldo bulan lalu').text,/belum menghitung saldo historis/);
});
test('All answers are read-only, even for frozen state and lists',()=>{
  const state=fixture(),before=JSON.stringify(state);
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}};freeze(state);
  for(const q of ['pengeluaran bulan ini','saldo','jadwal hari ini','tugas','apa yang perlu dikontrol','anggaran bulan ini'])assistant.answer(state,q,{today});
  assert.equal(JSON.stringify(state),before);
});
