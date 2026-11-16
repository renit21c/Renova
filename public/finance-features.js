let financePage = 1, selectedTransactions = new Set();
function financeFilters() {
  return featurePrefs.finance || { month:now.slice(0,7), account:'', type:'', query:'' };
}
function filteredTransactions() {
  const f = financeFilters();
  return state.transactions.filter(t => (!f.month || t.date.startsWith(f.month)) && (!f.type || t.type === f.type) && (!f.account || [t.accountId,t.fromAccountId,t.toAccountId].includes(f.account)) && (!f.query || [t.description,t.category].join(' ').toLowerCase().includes(f.query.toLowerCase()))).sort((a,b)=>b.date.localeCompare(a.date));
}
function updateFinanceFilters() {
  const previousMonth = financeFilters().month;
  featurePrefs.finance = Object.fromEntries(new FormData(document.getElementById('financeFilters')));
  financePage=1; selectedTransactions.clear(); rememberView();
  if (previousMonth !== featurePrefs.finance.month) render(); else renderFinanceResults();
}
function featureFinance() { return financeScreen(); }
function financeResults() { return financeTransactionList(); }
function renderFinanceResults() { document.getElementById('financeResults').innerHTML=financeResults(); }
function selectTransaction(id,checked) { checked?selectedTransactions.add(id):selectedTransactions.delete(id); renderFinanceResults(); }
function selectFinancePage() { filteredTransactions().slice((financePage-1)*30,financePage*30).forEach(t=>selectedTransactions.add(t.id)); renderFinanceResults(); }
function deleteSelectedTransactions() {
  if (!selectedTransactions.size || !confirm(`Delete ${selectedTransactions.size} selected transactions?`)) return;
  checkpoint('delete selected transactions'); state.transactions=state.transactions.filter(t=>!selectedTransactions.has(t.id)); selectedTransactions.clear(); save(); render();
}
function categorySummary(month) {
  const totals={}; state.transactions.filter(t=>t.type==='Expense'&&t.date.startsWith(month)).forEach(t=>{const c=t.category||'Uncategorized';totals[c]=(totals[c]||0)+Number(t.amount);});
  const entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]), total=entries.reduce((n,[,v])=>n+v,0);
  const categories=entries.map(([c,v])=>`<div class="budget-row"><div class="panel-title"><span>${esc(c)}</span><b>${money(v)}</b></div><div class="progress"><span style="width:${v/total*100}%"></span></div></div>`).join('') || '<p class="empty">Belum ada pengeluaran bulan ini.</p>';
  return categories + '<h3>Spending trend · last six months</h3>' + spendingTrend();
}
function budgetSummary(month) {
  return state.budgets.filter(b=>b.month===month).map(b=>{
    const spent=state.transactions.filter(t=>t.type==='Expense'&&t.date.startsWith(month)&&t.category===b.category).reduce((n,t)=>n+Number(t.amount),0);
    return `<div class="budget-row"><div class="panel-title"><b>${esc(b.category)}</b><button class="text-button" onclick="openBudget('${b.id}')">Edit</button><button class="text-button danger-button" onclick="removeRecord('budgets','${b.id}')">Delete</button></div><small class="${spent>b.amount?'expense':'muted'}">${money(spent)} / ${money(b.amount)} · ${spent>b.amount?'Over budget '+money(spent-b.amount):'Remaining '+money(b.amount-spent)}</small><div class="progress"><span style="width:${Math.min(100,spent/b.amount*100)}%"></span></div></div>`;
  }).join('') || '<p class="empty">Buat batas pengeluaran per kategori untuk bulan ini.</p>';
}
function openBudget(id='') {
  const b=state.budgets.find(x=>x.id===id)||{};
  modal(`<h2>Anggaran bulanan</h2><form onsubmit="saveBudget(event,'${id}')"><div class="field"><label>Bulan<input type="month" name="month" required value="${b.month||financeFilters().month||now.slice(0,7)}"></label></div><div class="field"><label>Kategori<input name="category" list="budgetCategories" required value="${esc(b.category||'')}"><datalist id="budgetCategories">${financeCategories.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label></div><div class="field"><label>Batas pengeluaran<input name="amount" type="number" step="0.01" min="0.01" required value="${b.amount||''}"></label></div><div class="modal-actions"><button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">Save budget</button></div></form>`);
}
function saveBudget(event,id) {
  event.preventDefault(); const b=Object.fromEntries(new FormData(event.target)); b.amount=Number(b.amount); b.category=b.category.trim();
  if (!b.category||!Number.isFinite(b.amount)||b.amount<=0) return toast('Budget tidak valid.');
  if (state.budgets.some(x=>x.id!==id&&x.month===b.month&&x.category.toLowerCase()===b.category.toLowerCase())) return toast('Budget kategori dan bulan ini sudah ada.');
  const old=state.budgets.find(x=>x.id===id); if(old) Object.assign(old,b); else state.budgets.push({...b,id:crypto.randomUUID()});
  save(); closeModal(); render();
}
function exportFinanceCSV() {
  const name=id=>state.accounts.find(a=>a.id===id)?.name||'';
  const rows=[['date','type','amount','account','to_account','category','description'],...filteredTransactions().map(t=>[t.date,t.type,t.amount,name(t.type==='Transfer'?t.fromAccountId:t.accountId),name(t.toAccountId),t.category,t.description])];
  downloadText('renova-transactions.csv','\uFEFF'+rows.map(row=>row.map(RenovaCore.csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8'); toast('Export mengikuti filter aktif.');
}
function downloadCSVTemplate() { downloadText('renova-template.csv','date,type,amount,account,to_account,category,description\r\n'+now+',Expense,25000,Cash,,Food & groceries,Lunch\r\n','text/csv'); }
function openCSVImport() {
  csvImport=null; csvPreview=null;
  modal(`<h2>Import transaksi CSV</h2><p class="muted">CSV koma atau titik koma, termasuk teks dengan kutip dan baris baru. Maksimal 5 MB / 10.000 transaksi. Pilih format angka secara eksplisit.</p><button class="text-button" onclick="downloadCSVTemplate()">Download template</button><div class="field"><label>CSV file<input type="file" accept=".csv,text/csv" onchange="readFinanceCSV(this)"></label></div><div id="csvMapping"></div>`);
}
async function readFinanceCSV(input) {
  try {
    const file=input.files[0]; if(!file) return;
    if(file.size>5*1024*1024) throw new Error('CSV maksimal 5 MB.');
    csvImport=RenovaCore.parseCSV(await file.text()); if(csvImport.rows.length>10000) throw new Error('Maksimal 10.000 transaksi per impor.');
    const aliases={date:['date','tanggal'],type:['type','jenis','tipe'],amount:['amount','jumlah','nominal'],debit:['debit','debet','pengeluaran'],credit:['credit','kredit','pemasukan'],account:['account','rekening','akun'],to_account:['to_account','rekening tujuan'],category:['category','kategori'],description:['description','deskripsi','keterangan']};
    document.getElementById('csvMapping').innerHTML=`<form id="csvMap" onsubmit="event.preventDefault();previewFinanceCSV()"><div class="form-grid">${Object.entries(aliases).map(([key,names])=>`<div class="field"><label>${key}<select name="${key}"><option value="">${['date','amount'].includes(key)?'Choose required column':'Optional'}</option>${csvImport.headers.map((h,i)=>`<option value="${i}" ${names.includes(h.toLowerCase())?'selected':''}>${esc(h)}</option>`).join('')}</select></label></div>`).join('')}<div class="field"><label>Format angka<select name="numberFormat"><option value="plain">25000.50 (tanpa pemisah ribuan)</option><option value="id">25.000,50 (Indonesia)</option><option value="en">25,000.50 (English)</option></select></label></div><div class="field"><label>Rekening default<input name="defaultAccount" value="${esc(state.accounts[0]?.name||'Cash')}"></label></div><div class="field"><label>Jenis default<select name="defaultType"><option>Expense</option><option>Income</option></select></label></div><div class="field"><label>Tanggal<select name="dateFormat"><option value="iso">YYYY-MM-DD</option><option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option></select></label></div></div><button class="secondary-button">Preview import</button></form><div id="csvPreview"></div>`;
  } catch(error) { csvImport=null; document.getElementById('csvMapping').textContent=error.message; }
}
function previewFinanceCSV() {
  csvPreview=null;
  const map=Object.fromEntries(new FormData(document.getElementById('csvMap'))), errors=[], newAccounts=[], rows=[], duplicates=[];
  const accountMap=new Map(state.accounts.map(a=>[a.name.toLowerCase(),a.id]));
  const accountId=name=>{name=name.trim();if(!name)throw new Error('Rekening wajib diisi.'); const key=name.toLowerCase(); if(!accountMap.has(key)){const a={id:crypto.randomUUID(),name,type:'Imported',initial:0};accountMap.set(key,a.id);newAccounts.push(a);} return accountMap.get(key);};
  const seen=new Set(state.transactions.map(RenovaCore.fingerprint));
  if(map.date===''||(map.amount===''&&map.debit===''&&map.credit==='')) return toast('Pilih tanggal dan kolom amount atau debit/credit.');
  for(let i=0;i<csvImport.rows.length;i++) {
    try {
      const row=csvImport.rows[i],get=key=>map[key]!==''?String(row[Number(map[key])]||'').trim():'';
      let date=get('date'); if(map.dateFormat!=='iso'){const p=date.split(/[\/-]/);if(p.length!==3)throw new Error('Format tanggal tidak sesuai.');date=`${p[2]}-${(map.dateFormat==='dmy'?p[1]:p[0]).padStart(2,'0')}-${(map.dateFormat==='dmy'?p[0]:p[1]).padStart(2,'0')}`;}
      if(!RenovaCore.validDate(date))throw new Error('Tanggal tidak valid.');
      const raw=get('type').toLowerCase(), types={income:'Income',pemasukan:'Income',credit:'Income',expense:'Expense',pengeluaran:'Expense',debit:'Expense',transfer:'Transfer'};
      let type=raw?types[raw]:map.defaultType;if(!type)throw new Error('Jenis harus Income, Expense, atau Transfer.');
      let value;
      if(map.amount!=='') value=RenovaCore.amount(get('amount'),map.numberFormat);
      else {
        const debit=get('debit')?RenovaCore.amount(get('debit'),map.numberFormat):0;
        const credit=get('credit')?RenovaCore.amount(get('credit'),map.numberFormat):0;
        if(debit<0||credit<0||(debit>0&&credit>0))throw new Error('Isi salah satu debit/credit dengan jumlah positif.');
        value=debit||credit;const inferred=debit?'Expense':'Income';
        if(raw&&type!==inferred)throw new Error('Jenis tidak sesuai kolom debit/credit.');
        type=inferred;
      }
      if(value<=0)throw new Error('Jumlah harus lebih dari nol. Gunakan jenis transaksi untuk arah uang.');
      const from=accountId(get('account')||map.defaultAccount),t={id:crypto.randomUUID(),date,type,amount:value,category:get('category'),description:get('description')};
      if(type==='Transfer'){t.fromAccountId=from;t.toAccountId=accountId(get('to_account'));if(t.fromAccountId===t.toAccountId)throw new Error('Rekening transfer harus berbeda.');}
      else t.accountId=from;
      const key=RenovaCore.fingerprint(t); if(seen.has(key))duplicates.push(i+2);else{seen.add(key);rows.push(t);}
    }catch(error){errors.push(`Baris ${i+2}: ${error.message}`);}
  }
  const used=new Set(rows.flatMap(t=>[t.accountId,t.fromAccountId,t.toAccountId]).filter(Boolean));
  csvPreview={rows,accounts:newAccounts.filter(a=>used.has(a.id)),map:JSON.stringify(map),errors:errors.length};
  document.getElementById('csvPreview').innerHTML=`<h3>Preview</h3><p>${rows.length} transaksi baru · ${duplicates.length} duplikat dilewati · ${errors.length} baris gagal.</p><p>Rekening baru (saldo awal 0): ${esc(csvPreview.accounts.map(a=>a.name).join(', ')||'Tidak ada')}. Edit saldo awal setelah impor jika dibutuhkan.</p>${errors.length?`<div class="auth-error">${errors.slice(0,30).map(esc).join('<br>')}</div>`:''}<div class="csv-preview">${rows.slice(0,10).map(t=>`<div class="list-row"><span>${t.date} · ${t.type}</span><b>${money(t.amount)}</b><span>${esc(t.description)}</span></div>`).join('')}</div><p class="muted">Duplikat ditentukan dari tanggal, jenis, jumlah, rekening, kategori, dan deskripsi. Periksa transaksi identik yang memang disengaja.</p><button class="primary-button" ${!rows.length||errors.length?'disabled':''} onclick="commitFinanceCSV()">Import ${rows.length} transactions</button>`;
}
function commitFinanceCSV() {
  if(!csvPreview||csvPreview.errors||JSON.stringify(Object.fromEntries(new FormData(document.getElementById('csvMap'))))!==csvPreview.map) return toast('Preview ulang dan perbaiki baris yang gagal sebelum impor.');
  if(!confirm(`Import ${csvPreview.rows.length} transaksi dan buat ${csvPreview.accounts.length} rekening?`))return;
  checkpoint('CSV import');state.accounts.push(...csvPreview.accounts);state.transactions.push(...csvPreview.rows);save();closeModal();csvPreview=null;csvImport=null;render();toast('CSV imported');
}
