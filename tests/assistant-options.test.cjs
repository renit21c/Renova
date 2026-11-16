const {test}=require('node:test'),assert=require('node:assert/strict');
const menu=require('../public/assistant-options.js'),assistant=require('../public/assistant-core.js');
const state={profile:{currency:'IDR'},accounts:[],transactions:[],tasks:[],events:[],budgets:[]};
test('Every selectable question produces a supported answer for its topic',()=>{
  for(const topic of menu.topics)for(const question of topic.questions)for(const period of ['current','previous']){
    const choice=menu.prompt(topic.id,question.id,period);assert.ok(choice,question.id);
    const reply=assistant.answer(state,choice.query,{today:'2026-11-16',preset:true});
    assert.notEqual(reply.intent,'help',choice.query);
    if(topic.id==='tasks')assert.equal(reply.intent,'tasks');
    if(topic.id==='schedule')assert.equal(reply.intent,'schedule');
  }
});
test('Month choices change finance periods while total balances remain all-time',()=>{
  const previous=menu.prompt('finance','spending','previous');
  assert.match(assistant.answer(state,previous.query,{today:'2026-11-16',preset:true}).title,/2026-10/);
  assert.equal(menu.prompt('finance','balance','previous').query,menu.prompt('finance','balance','current').query);
});
test('Unlisted questions and invalid periods are rejected',()=>{
  assert.equal(menu.prompt('finance','hapus semua transaksi'),null);
  assert.equal(menu.prompt('unknown','today'),null);
  assert.equal(menu.prompt('finance','spending','arbitrary'),null);
});
test('Preset wording cannot accidentally filter by a matching account, category, or task title',()=>{
  const data={...state,accounts:[{id:'a',name:'Total',initial:100},{id:'b',name:'Cash',initial:200}],transactions:[{date:'2026-11-16',amount:20,type:'Expense',category:'Pengeluaran',accountId:'a'},{date:'2026-11-16',amount:30,type:'Expense',category:'Food',accountId:'b'}],tasks:[{id:'a',title:'Tugas hari ini',status:'To do',due:'2026-11-16'},{id:'b',title:'Other task',status:'To do',due:'2026-11-16'}]};
  const ask=(topic,id)=>assistant.answer(data,menu.prompt(topic,id).query,{today:'2026-11-16',preset:true});
  assert.equal(ask('finance','balance').items.length,2);assert.equal(ask('finance','spending').items.length,2);assert.equal(ask('tasks','today').items.length,2);
});
