/* Deterministic, read-only answers. No model, network calls, or record mutations. */
(function(root){
  'use strict';
  const normalize=value=>String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
  const shift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
  const has=(text,pattern)=>pattern.test(text);
  const money=(value,currency)=>{try{return new Intl.NumberFormat('id-ID',{style:'currency',currency:currency||'IDR',minimumFractionDigits:0,maximumFractionDigits:2}).format(value);}catch{return String(value);}};
  const months=[['januari','january'],['februari','february'],['maret','march'],['april'],['mei','may'],['juni','june'],['juli','july'],['agustus','august'],['september'],['oktober','october'],['november'],['desember','december']];
  function monthRange(today,offset=0){const d=new Date(today+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+offset);const start=d.toISOString().slice(0,10);d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0);return{start,end:d.toISOString().slice(0,10),label:start.slice(0,7),explicit:false};}
  function period(question,today,defaultPeriod='month'){
    const q=normalize(question);
    const localDates=[...String(question).matchAll(/\b(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})\b/g)].map(m=>`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
    const dates=localDates.length?localDates:q.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[];
    if(dates.length){
      if(dates.some(d=>!validDate(d))||dates.length>2||dates[1]&&dates[1]<dates[0])return{error:'Tanggalnya belum valid. Pakai YYYY-MM-DD, atau contoh “bulan lalu”.'};
      if(dates[1]&&(new Date(dates[1])-new Date(dates[0]))/86400000>365)return{error:'Pilih periode maksimal satu tahun untuk satu pertanyaan.'};
      return{start:dates[0],end:dates[1]||dates[0],label:dates.join(' – '),explicit:true};
    }
    if(/\b(?:19|20)\d{2}-\d{2}\b/.test(q)){
      const value=q.match(/\b((?:19|20)\d{2}-\d{2})\b/)[1];
      if(!validDate(value+'-01'))return{error:'Bulan tidak valid. Pakai YYYY-MM.'};
      return{...monthRange(value+'-01'),explicit:true};
    }
    for(let i=0;i<months.length;i++)if(months[i].some(name=>new RegExp('\\b'+name+'\\b').test(q))){
      const year=q.match(/\b(?:19|20)\d{2}\b/)?.[0]||today.slice(0,4);
      const names=months[i].join('|'),day=q.match(new RegExp('\\b(\\d{1,2}) (?:'+names+')\\b'))?.[1]||q.match(new RegExp('\\b(?:'+names+') (\\d{1,2})\\b'))?.[1];
      if(day){const date=`${year}-${String(i+1).padStart(2,'0')}-${day.padStart(2,'0')}`;return validDate(date)?{start:date,end:date,label:date,explicit:true}:{error:'Tanggalnya tidak valid untuk bulan itu.'};}
      return{...monthRange(`${year}-${String(i+1).padStart(2,'0')}-01`),explicit:true};
    }
    if(has(q,/\b(hari ini|today)\b/)&&has(q,/\b(besok|tomorrow)\b/))return{start:today,end:shift(today,1),label:`${today} – ${shift(today,1)}`,explicit:true};
    const single=has(q,/\b(bulan|minggu|month|week)\b/)?null:has(q,/\b(besok|tomorrow)\b/)?1:has(q,/\b(kemarin|yesterday)\b/)?-1:has(q,/\b(hari ini|today|sekarang)\b/)?0:null;
    if(single!==null){const date=shift(today,single);return{start:date,end:date,label:date,explicit:true};}
    if(has(q,/\b(7 hari terakhir|last 7 days)\b/))return{start:shift(today,-6),end:today,label:'7 hari terakhir',explicit:true};
    if(has(q,/\b(minggu|week)\b/)){
      const weekday=new Date(today+'T12:00:00Z').getUTCDay(),offset=has(q,/\b(depan|next)\b/)?7:has(q,/\b(lalu|last|kemarin)\b/)?-7:0;
      const start=shift(today,-((weekday+6)%7)+offset);return{start,end:shift(start,6),label:`${start} – ${shift(start,6)}`,explicit:true};
    }
    if(has(q,/\b(tahun ini|this year)\b/))return{start:today.slice(0,4)+'-01-01',end:today.slice(0,4)+'-12-31',label:today.slice(0,4),explicit:true};
    if(has(q,/\b(bulan lalu|bulan kemarin|last month)\b/))return{...monthRange(today,-1),explicit:true};
    if(has(q,/\b(bulan depan|next month)\b/))return{...monthRange(today,1),explicit:true};
    if(has(q,/\b(bulan ini|this month)\b/))return{...monthRange(today),explicit:true};
    if(defaultPeriod==='day')return{start:today,end:today,label:today,explicit:false};
    if(defaultPeriod==='upcoming')return{start:today,end:shift(today,6),label:'7 hari ke depan',explicit:false};
    return monthRange(today);
  }
  function matchName(q,names){
    return names.filter(Boolean).sort((a,b)=>normalize(b).length-normalize(a).length).find(name=>{
      const value=normalize(name);return value&&(' '+q+' ').includes(' '+value+' ');
    });
  }
  function answer(state,question,context={}){
    const q=normalize(String(question).slice(0,500)),today=context.today;
    if(!validDate(today))throw new Error('Assistant requires a valid workspace date.');
    const currency=state.profile?.currency||'IDR',fmt=value=>money(value,currency);
    const accounts=state.accounts||[],tasks=state.tasks||[],budgets=state.budgets||[];
    const transactions=(state.transactions||[]).filter(t=>['Income','Expense','Transfer'].includes(t.type)&&validDate(t.date)&&Number.isFinite(Number(t.amount))&&Number(t.amount)>0);
    const links=route=>[{label:({finance:'Buka Finance',tasks:'Buka Tasks',calendar:'Buka Calendar',investments:'Buka Investments'})[route],route}];
    const respond=(intent,title,text,items=[],route='',suggestions=[])=>({intent,title,text,items:items.slice(0,8),total:items.length,links:route?links(route):[],suggestions});
    const taskCue=has(q,/\b(task|tasks|tugas|deadline|prioritas|dikerjakan|kerjain|todo|to do|overdue|terlambat)\b/);
    const scheduleCue=has(q,/\b(jadwal|agenda|kalender|calendar|schedule|event|events|meeting|rapat)\b/);
    const controlCue=has(q,/\b(kontrol|dikontrol|control|hemat|boros|dikurangi|kurangi|evaluasi|saran|perhatian|perlu diperbaiki)\b/);
    const budgetCue=has(q,/\b(anggaran|budget|budgets|batas|limit)\b/);
    const spendingCue=has(q,/\b(pengeluaran|expense|expenses|spending|spent|belanja|keluar|habis)\b/);
    const incomeCue=has(q,/\b(pemasukan|income|gaji|pendapatan|masuk)\b/);
    const balanceCue=has(q,/\b(saldo|balance|rekening|akun|account|accounts)\b/);
    const overviewCue=has(q,/\b(ringkasan|summary|overview|keuangan|finance|cashflow|arus kas)\b/);
    if(!taskCue&&!scheduleCue&&!incomeCue&&!spendingCue&&!balanceCue&&has(q,/\b(investasi|saham|crypto|kripto|pajak|pinjaman|utang|asuransi)\b/))return respond('help','Topik ini belum didukung','Aku bisa membaca transaksi, anggaran, tugas, dan jadwal. Aku belum memberi analisis investasi, utang, atau pajak.',[],'',['Ringkasan keuangan','Anggaran bulan ini']);
    const explicitDomain=taskCue||scheduleCue||controlCue||budgetCue||spendingCue||incomeCue||balanceCue||overviewCue;
    const followup=!explicitDomain&&has(q,/\b(bulan|minggu|hari|besok|kemarin|today|tomorrow|month|week|20\d{2})\b/)?context.lastIntent:'';
    const transferCue=has(q,/\btransfer\b/)&&has(q,/\b(berapa|total|riwayat|history|transaksi)\b/);
    const intent=taskCue?'tasks':scheduleCue?'schedule':controlCue?'control':budgetCue?'budget':spendingCue&&incomeCue?'overview':spendingCue?'spending':incomeCue?'income':balanceCue?'balance':transferCue?'transfers':overviewCue||has(q,/\b(transaksi|transactions)\b/)?'overview':followup;
    if(has(q,/\b(hapus|delete|reset|buat|tambah|create|ubah|edit|bayar|transfer|kirim)\b/)&&!has(q,/\b(berapa|total|riwayat|history|pengeluaran|pemasukan)\b/))return respond('help','Aku hanya membaca catatan','Perubahan data dilakukan lewat form di aplikasinya. Kamu bisa tanya saldo, pengeluaran, tugas, atau jadwal.');
    if(!intent)return respond('help','Mau cek apa?','Aku memahami pertanyaan tentang catatan uang, anggaran, tugas, dan jadwal. Coba salah satu pertanyaan ini.',[],'',['Pengeluaran bulan ini','Apa yang perlu dikontrol?','Tugas hari ini','Jadwal besok']);
    const range=period(question,today,intent==='schedule'?'day':intent==='tasks'?'upcoming':'month');
    if(range.error)return respond('help','Cek periode',range.error);
    const inRange=date=>validDate(date)&&date>=range.start&&date<=range.end;
    if(intent==='tasks'){
      const completed=has(q,/\b(selesai|completed|done)\b/),overdue=has(q,/\b(overdue|terlambat|telat|lewat)\b/),unscheduled=has(q,/\b(tanpa deadline|tanpa tanggal|unscheduled)\b/),high=has(q,/\b(high|tinggi|urgent|mendesak)\b/);
      const all=has(q,/\b(semua|all)\b/),priority=has(q,/\b(prioritas|dikerjakan|kerjain)\b/);
      const namedTask=matchName(q,tasks.map(t=>t.title));
      let found=tasks.filter(t=>completed?t.status==='Completed'&&(!range.explicit||inRange(t.completed)):!['Completed','Archived'].includes(t.status));
      if(namedTask)found=found.filter(t=>t.title===namedTask);
      if(!completed)found=found.filter(t=>unscheduled?!t.due:overdue?validDate(t.due)&&t.due<today:(all||namedTask)&&!range.explicit?true:priority&&!range.explicit?(!t.due||t.due<=today):range.explicit?inRange(t.due):(!t.due||inRange(t.due)||t.due<today));
      if(high)found=found.filter(t=>t.priority==='High');
      const ranks={High:0,Medium:1,Low:2};
      found=found.slice().sort((a,b)=>Number(!!(b.due&&b.due<today))-Number(!!(a.due&&a.due<today))||(ranks[a.priority]??1)-(ranks[b.priority]??1)||String(a.due||'9999').localeCompare(String(b.due||'9999')));
      const items=found.map(t=>({label:t.title||'Tanpa judul',detail:[completed?'Selesai '+(t.completed||''):t.due?(t.due<today?'Terlambat · ':'')+t.due:'Tanpa deadline',t.priority||'Medium',t.project||''].filter(Boolean).join(' · '),kind:'tasks',id:t.id,route:'tasks'}));
      const label=completed?'Tugas selesai':overdue?'Tugas terlambat':priority?'Prioritas berikutnya':'Tugasmu';
      return respond(intent,label,found.length?`${found.length} tugas${range.explicit?' · '+range.label:completed?' · '+range.label:''}.${found.length>8?' Menampilkan 8 teratas.':''}`:completed?'Belum ada tugas selesai pada periode ini.':'Tidak ada tugas yang sesuai. Tugas tanpa tanggal bisa dicek terpisah.',items,'tasks',['Tugas terlambat','Tugas tanpa deadline','Tugas besok']);
    }
    if(intent==='schedule'){
      const events=(context.events||state.events||[]).filter(e=>inRange(e.date)).slice().sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
      const seen=new Set(),found=events.filter(e=>{const key=[e.source||'local',e.id,e.date,e.time].join('|');if(seen.has(key))return false;seen.add(key);return true;});
      const note=context.googleConnected?' Google Calendar hanya mencakup event yang sudah dimuat; buka Calendar untuk sinkronisasi.':'';
      return respond(intent,'Jadwal · '+range.label,(found.length?`${found.length} agenda tercatat.${found.length>8?' Menampilkan 8 pertama.':''}`:'Belum ada agenda yang tercatat pada periode ini.')+note,found.map(e=>({label:e.title||'Tanpa judul',detail:[e.date,e.time||'Seharian',e.location||'',e.source==='google'?'Google Calendar':''].filter(Boolean).join(' · '),date:e.date,route:'calendar'})),'calendar',['Jadwal hari ini','Jadwal besok','Jadwal minggu ini']);
    }
    const account=matchName(q,accounts.map(a=>a.name));
    if(!account&&/\b(?:rekening|akun|account)\s+(?!semua\b|saya\b|ku\b|apa\b|bulan\b|hari\b|minggu\b)([a-z0-9][a-z0-9 -]*)/.test(q))return respond(intent,'Rekening belum dikenali','Gunakan nama rekening yang sudah tercatat.',accounts.map(a=>({label:a.name,route:'finance'})),'finance');
    if(intent==='balance'&&!account){
      const unknown=q.replace(/\b(saldo|balance|berapa|total|uang|saya|ku|rekening|akun|account|accounts|semua|hari|ini|bulan|lalu|depan|sekarang|apa|today|month|last|this|now)\b/g,'').replace(/[0-9-]/g,'').trim();
      if(unknown&&!months.some(names=>names.some(name=>unknown.includes(name))))return respond(intent,'Rekening belum dikenali','Pilih nama rekening yang sudah tercatat, atau tanya “total saldo”.',accounts.map(a=>({label:a.name,route:'finance'})),'finance');
    }
    const accountIds=new Set(accounts.filter(a=>a.name===account).map(a=>a.id));
    const aliases=[[/\b(makan|makanan|food|groceries)\b/,/food|grocer|makan/i],[/\b(transport|bensin|ongkos)\b/,/transport|bensin|ongkos/i],[/\b(gaji|salary)\b/,/gaji|salary/i]];
    let category=matchName(q,transactions.map(t=>t.category));
    if(!category)for(const [pattern,categoryPattern]of aliases)if(pattern.test(q)){
      const matches=[...new Set(transactions.map(t=>t.category).filter(c=>c&&categoryPattern.test(c)))];
      if(matches.length===1)category=matches[0];
      else if(['spending','income','budget','control'].includes(intent))return respond(intent,'Pilih kategori',matches.length?'Ada beberapa kategori yang cocok. Sebutkan nama kategori yang kamu maksud.':'Belum ada kategori yang cocok dengan istilah itu. Gunakan nama kategori di Finance.',matches.map(label=>({label,route:'finance'})),'finance');
    }
    if(!category&&/\bkategori\s+(?!terbesar\b|apa\b|yang\b|ini\b)([a-z]+)/.test(q))return respond(intent,'Kategori belum dikenali','Sebutkan nama kategori yang ada di catatan Finance.',[],'finance');
    const selected=transactions.filter(t=>inRange(t.date)&&(!account||[t.accountId,t.fromAccountId,t.toAccountId].some(id=>accountIds.has(id)))&&(!category||t.category===category));
    const income=selected.filter(t=>t.type==='Income').reduce((n,t)=>n+Number(t.amount),0),expense=selected.filter(t=>t.type==='Expense').reduce((n,t)=>n+Number(t.amount),0);
    const scope=[range.label,account,category].filter(Boolean).join(' · ');
    if(intent==='transfers'){
      const rows=selected.filter(t=>t.type==='Transfer');
      return respond(intent,'Transfer · '+scope,`${rows.length} transfer, total perpindahan ${fmt(rows.reduce((n,t)=>n+Number(t.amount),0))}. Transfer tidak dihitung sebagai pemasukan atau pengeluaran.`,rows.map(t=>({label:t.description||'Transfer',detail:t.date,value:fmt(t.amount),route:'finance'})),'finance');
    }
    if(intent==='balance'){
      const rows=accounts.filter(a=>!account||a.name===account).map(a=>({label:a.name,amount:Number(a.initial||0)+transactions.reduce((n,t)=>t.type==='Transfer'?n+(t.toAccountId===a.id?Number(t.amount):0)-(t.fromAccountId===a.id?Number(t.amount):0):t.accountId===a.id?n+(t.type==='Income'?1:-1)*Number(t.amount):n,0)}));
      if(!rows.length)return respond(intent,'Saldo rekening','Belum ada rekening yang dicatat.',[],'finance');
      return respond(intent,'Saldo rekening',`${fmt(rows.reduce((n,a)=>n+a.amount,0))} · seluruh tanggal, termasuk saldo awal.${range.explicit?' Aku belum menghitung saldo historis; angka ini mencakup semua catatan.':''}`,rows.map(a=>({label:a.label,value:fmt(a.amount),route:'finance'})),'finance',['Pengeluaran bulan ini','Anggaran bulan ini']);
    }
    const totals=new Map();selected.filter(t=>t.type==='Expense').forEach(t=>{const c=t.category||'Tanpa kategori';totals.set(c,(totals.get(c)||0)+Number(t.amount));});
    const categories=[...totals.entries()].sort((a,b)=>b[1]-a[1]);
    if(intent==='spending'||intent==='income'){
      const type=intent==='income'?'Income':'Expense',rows=selected.filter(t=>t.type===type),total=type==='Income'?income:expense;
      const items=intent==='spending'?categories.map(([label,amount])=>({label,value:fmt(amount),detail:total?Math.round(amount/total*100)+'% dari pengeluaran':'',route:'finance'})):rows.slice().sort((a,b)=>b.amount-a.amount).map(t=>({label:t.description||t.category||'Pemasukan',detail:t.date,value:fmt(t.amount),route:'finance'}));
      return respond(intent,(intent==='spending'?'Pengeluaran':'Pemasukan')+' · '+scope,`${fmt(total)} dari ${rows.length} transaksi. Transfer tidak dihitung.${!rows.length?' Belum ada catatan yang sesuai.':''}`,items,'finance',['Apa yang perlu dikontrol?','Pengeluaran bulan lalu','Ringkasan keuangan']);
    }
    if(intent==='budget'||intent==='control'){
      const month=range.start.slice(0,7);
      if(range.start.slice(0,7)!==range.end.slice(0,7))return respond(intent,'Pilih satu bulan','Anggaran dicatat per bulan. Coba “anggaran November 2026”.',[],'finance',['Anggaran bulan ini','Anggaran bulan lalu']);
      const monthly=transactions.filter(t=>t.date.startsWith(month)&&t.type==='Expense');
      const applicable=budgets.filter(b=>b.month===month&&(!category||normalize(b.category)===normalize(category))&&Number(b.amount)>0);
      const budgetRows=applicable.map(b=>{const spent=monthly.filter(t=>normalize(t.category)===normalize(b.category)).reduce((n,t)=>n+Number(t.amount),0);return{label:b.category,detail:`Terpakai ${fmt(spent)} / ${fmt(Number(b.amount))}`,value:spent>Number(b.amount)?'Lewat '+fmt(spent-Number(b.amount)):'Sisa '+fmt(Number(b.amount)-spent),over:spent>Number(b.amount),spent,limit:Number(b.amount),route:'finance'};});
      if(intent==='budget')return respond(intent,'Anggaran · '+month,applicable.length?`${applicable.length} kategori. Anggaran selalu menghitung seluruh rekening dan seluruh bulan.`:'Belum ada anggaran pada bulan ini. Tambahkan batas per kategori di Finance.',budgetRows,'finance',['Apa yang perlu dikontrol?','Pengeluaran bulan ini']);
      const items=budgetRows.filter(b=>b.over).sort((a,b)=>(b.spent-b.limit)-(a.spent-a.limit)).map(b=>({...b,detail:'Tinjau pengeluaran kategori ini. '+b.detail}));
      const monthlyIncome=transactions.filter(t=>t.date.startsWith(month)&&t.type==='Income').reduce((n,t)=>n+Number(t.amount),0),monthlyExpense=monthly.reduce((n,t)=>n+Number(t.amount),0);
      if(monthlyExpense>monthlyIncome)items.push({label:'Arus kas tercatat negatif',detail:'Pengeluaran melebihi pemasukan yang dicatat bulan ini. Pastikan catatan pemasukan sudah lengkap.',value:fmt(monthlyExpense-monthlyIncome),route:'finance'});
      const monthCategories=new Map();monthly.forEach(t=>monthCategories.set(t.category||'Tanpa kategori',(monthCategories.get(t.category||'Tanpa kategori')||0)+Number(t.amount)));
      const largest=[...monthCategories.entries()].sort((a,b)=>b[1]-a[1])[0];
      if(largest)items.push({label:'Kategori terbesar: '+largest[0],value:fmt(largest[1]),detail:'Tinjau transaksi di kategori ini; jumlah besar belum tentu boros.',route:'finance'});
      if(!applicable.length)items.push({label:'Belum ada batas anggaran',detail:'Tetapkan batas sesuai kebutuhanmu agar pengeluaran bisa dibandingkan dengan rencana.',route:'finance'});
      return respond(intent,'Yang bisa kamu cek · '+month,monthly.length?'Evaluasi catatan dan anggaran bulan ini.':'Belum ada pengeluaran pada bulan ini. Lengkapi catatan sebelum mengevaluasi.',items,'finance',['Anggaran bulan ini','Pengeluaran bulan ini','Tugas terlambat']);
    }
    return respond('overview','Ringkasan · '+scope,`${selected.length} transaksi tercatat; transfer tidak masuk arus kas.`,[{label:'Pemasukan',value:fmt(income)},{label:'Pengeluaran',value:fmt(expense)},{label:'Arus kas',value:fmt(income-expense)}],'finance',['Apa yang perlu dikontrol?','Pengeluaran bulan ini','Jadwal besok']);
  }
  const api={answer,period,normalize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RenovaAssistant=api;
})(typeof window==='undefined'?globalThis:window);
