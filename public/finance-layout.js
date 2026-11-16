/* Presentation for the personal finance workspace. Data workflows live in finance-features.js. */
function financeMonthLabel(month) {
  if (!month) return 'Semua periode';
  return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00'));
}
function financeTypeLabel(type) {
  return {Income:'Pemasukan',Expense:'Pengeluaran',Transfer:'Transfer'}[type] || type;
}
function financeEmpty(title,description,action='') {
  return `<div class="designed-empty"><span class="empty-symbol">${icon('wallet')}</span><b>${title}</b><p>${description}</p>${action}</div>`;
}
function financeScreen() {
  const recordIds = new Set(state.transactions.map(t=>t.id));
  selectedTransactions = new Set([...selectedTransactions].filter(id=>recordIds.has(id)));
  const f=financeFilters(),month=f.month||now.slice(0,7);
  const entries=state.transactions.filter(t=>t.date.startsWith(month));
  const income=entries.filter(t=>t.type==='Income').reduce((n,t)=>n+Number(t.amount),0);
  const expense=entries.filter(t=>t.type==='Expense').reduce((n,t)=>n+Number(t.amount),0);
  const total=state.accounts.reduce((n,a)=>n+accountBalance(a),0);
  const monthLabel=financeMonthLabel(month);
  const metric=(label,value,symbol,kind,caption)=>`<article class="finance-stat ${kind}"><div class="stat-top"><span>${label}</span><span class="stat-symbol" aria-hidden="true">${symbol}</span></div><strong>${money(value)}</strong><small>${caption}</small></article>`;
  const accounts=state.accounts.map((a,i)=>`
    <article class="account-card">
      <div class="account-card-top"><span class="account-symbol account-color-${i%3}">${icon('wallet')}</span><div class="account-name"><b>${esc(a.name)}</b><small>${esc(a.type||'Rekening')}</small></div>
        <details class="record-menu"><summary aria-label="Kelola rekening ${esc(a.name)}">•••</summary><div><button onclick="openAccount('${a.id}')">Edit rekening</button><button class="danger-button" onclick="deleteAccount('${a.id}')">Hapus rekening</button></div></details>
      </div>
      <strong class="account-balance">${money(accountBalance(a))}</strong><small class="account-opening">Saldo awal ${money(a.initial)}</small>
      <div class="account-quick-actions"><button onclick="openTransaction('','${a.id}','Income')"><span aria-hidden="true">↙</span> Pemasukan</button><button onclick="openTransaction('','${a.id}','Expense')"><span aria-hidden="true">↗</span> Pengeluaran</button></div>
    </article>`).join('');
  return heading('Finance','Pahami arus uangmu. Rencanakan langkah berikutnya.',`<div class="finance-actions"><button class="secondary-button" onclick="openCSVImport()">${icon('folder')} Import CSV</button><button class="secondary-button" onclick="openTransfer()">⇄ Transfer</button><button class="primary-button" onclick="openTransaction()">＋ Transaksi baru</button></div>`)+`
    <div class="finance-workspace">
      <section class="finance-overview" aria-label="Ringkasan keuangan">
        <article class="balance-hero"><div class="balance-hero-top"><span>Total saldo rekening</span><span class="balance-live"><i></i> ${state.accounts.length} rekening</span></div><strong>${money(total)}</strong><p>Semua rekening, satu gambaran yang jelas.</p><div class="balance-hero-bottom"><span>${icon('wallet')} ${esc(state.profile.currency||'IDR')}</span><button onclick="openAccount()">Tambah rekening <span aria-hidden="true">↗</span></button></div></article>
        <div class="finance-stats">${metric('Pemasukan',income,'↙','stat-income',monthLabel)}${metric('Pengeluaran',expense,'↗','stat-expense',monthLabel)}${metric('Arus kas bersih',income-expense,'⇄','stat-net','Pemasukan dikurangi pengeluaran')}</div>
      </section>
      <section class="panel accounts-panel"><div class="panel-title"><div><h2>Rekeningmu</h2><p class="section-description">Bank, tunai, dan e-wallet yang kamu catat.</p></div><button class="text-button" onclick="openAccount()">＋ Tambah rekening</button></div><div class="account-card-grid">${accounts||financeEmpty('Mulai dari satu rekening','Tambahkan bank, tunai, atau e-wallet untuk mencatat uangmu.','<button class="secondary-button" onclick="openAccount()">Tambah rekening pertama</button>')}</div></section>
      <section class="panel transactions-panel"><div class="panel-title"><div><h2>Riwayat transaksi</h2><p class="section-description">Lihat ke mana uangmu datang dan pergi.</p></div><button class="secondary-button" onclick="exportFinanceCSV()">↓ Export CSV</button></div>
        <form id="financeFilters" class="finance-filter-grid" onsubmit="event.preventDefault();updateFinanceFilters()">
          <label>Bulan<input type="month" name="month" value="${esc(f.month)}" onchange="updateFinanceFilters()"></label>
          <label>Rekening<select name="account" onchange="updateFinanceFilters()"><option value="">Semua rekening</option>${state.accounts.map(a=>`<option value="${a.id}" ${f.account===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
          <label>Jenis<select name="type" onchange="updateFinanceFilters()"><option value="">Semua jenis</option>${['Income','Expense','Transfer'].map(t=>`<option value="${t}" ${f.type===t?'selected':''}>${financeTypeLabel(t)}</option>`).join('')}</select></label>
          <label class="finance-search-label">Cari transaksi<span class="finance-search-input">${icon('search')}<input name="query" value="${esc(f.query)}" placeholder="Kategori atau deskripsi…" oninput="updateFinanceFilters()"></span></label>
        </form><div id="financeResults">${financeResults()}</div>
      </section>
      <div class="finance-insights"><section class="panel"><div class="panel-title"><div><h2>Anggaran bulanan</h2><p class="section-description">${esc(monthLabel)} · Tetap dalam rencana.</p></div><button class="text-button" onclick="openBudget()">＋ Budget</button></div>${budgetSummary(month)}</section><section class="panel"><div class="panel-title"><div><h2>Pengeluaran per kategori</h2><p class="section-description">${esc(monthLabel)}</p></div><span class="section-symbol">${icon('chart')}</span></div>${categorySummary(month)}</section></div>
      <section class="panel finance-data-panel"><div><h2>Data tetap dalam kendalimu</h2><p class="section-description">Simpan backup dan kelola catatan kapan saja.</p></div><div class="finance-actions"><button class="secondary-button" onclick="exportData()">Backup JSON</button><button class="secondary-button" onclick="chooseRestore()">Restore</button><details class="record-menu data-menu"><summary>Kelola data <span aria-hidden="true">⌄</span></summary><div><button onclick="downloadCSVTemplate()">Download template CSV</button><button class="danger-button" onclick="openClearRecords()">Hapus semua transaksi…</button><button class="danger-button" onclick="openClearRecords('finance')">Reset seluruh finance…</button></div></details></div></section>
      <p class="finance-footnote">Saldo mencakup semua tanggal. Ringkasan bulanan mengikuti filter bulan. Transfer antar rekening tidak dihitung sebagai pemasukan atau pengeluaran.</p>
    </div>`;
}
function financeTransactionList() {
  const rows=filteredTransactions(),pages=Math.max(1,Math.ceil(rows.length/30));financePage=Math.min(financePage,pages);
  const shown=rows.slice((financePage-1)*30,financePage*30);
  const income=rows.filter(t=>t.type==='Income').reduce((n,t)=>n+Number(t.amount),0);
  const expense=rows.filter(t=>t.type==='Expense').reduce((n,t)=>n+Number(t.amount),0);
  const name=id=>state.accounts.find(a=>a.id===id)?.name||'Belum ditentukan';
  const list=shown.map(t=>{
    const kind=t.type.toLowerCase(),typeLabel=financeTypeLabel(t.type);
    const account=t.type==='Transfer'?name(t.fromAccountId)+' → '+name(t.toAccountId):name(t.accountId);
    const date=new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(t.date+'T12:00:00'));
    return `<div class="transaction-record ${selectedTransactions.has(t.id)?'is-selected':''}">
      <input type="checkbox" aria-label="Pilih ${esc(t.description||typeLabel)}" ${selectedTransactions.has(t.id)?'checked':''} onchange="selectTransaction('${t.id}',this.checked)">
      <span class="transaction-symbol transaction-${kind}" aria-hidden="true">${t.type==='Income'?'↙':t.type==='Expense'?'↗':'⇄'}</span>
      <div class="transaction-description"><b>${esc(t.description||t.category||typeLabel)}</b><small><time datetime="${t.date}">${date}</time><span> · ${esc(account)}</span></small></div>
      <span class="transaction-category">${esc(t.category||typeLabel)}</span>
      <strong class="amount ${t.type==='Income'?'income':t.type==='Expense'?'expense':'muted'}">${t.type==='Income'?'+':t.type==='Expense'?'−':''}${money(t.amount)}</strong>
      <details class="record-menu"><summary aria-label="Kelola transaksi ${esc(t.description||typeLabel)}">•••</summary><div><button onclick="openTransaction('${t.id}')">Edit transaksi</button><button class="danger-button" onclick="deleteTransaction('${t.id}')">Hapus transaksi</button></div></details>
    </div>`;
  }).join('');
  return `<div class="transaction-summary"><span><b>${rows.length}</b> transaksi ditemukan</span><span class="filtered-cashflow"><span>Pemasukan <b class="income">${money(income)}</b></span><span>Pengeluaran <b class="expense">${money(expense)}</b></span></span></div>
    <div class="selection-toolbar"><button class="text-button" onclick="selectFinancePage()">Pilih halaman ini</button>${selectedTransactions.size?`<span class="selection-count">${selectedTransactions.size} dipilih</span><button class="text-button danger-button" onclick="deleteSelectedTransactions()">Hapus pilihan</button>`:'<span class="muted">Pilih transaksi untuk mengelola sekaligus</span>'}</div>
    <div class="transaction-list">${list||financeEmpty('Belum ada transaksi di sini','Coba ubah filter atau catat transaksi pertamamu.','<button class="secondary-button" onclick="openTransaction()">＋ Catat transaksi</button>')}</div>
    <div class="transaction-pagination"><span>${rows.length?`${(financePage-1)*30+1}–${Math.min(financePage*30,rows.length)} dari ${rows.length}`:'0 transaksi'}</span><div><button class="secondary-button" ${financePage<=1?'disabled':''} onclick="financePage--;renderFinanceResults()">← Sebelumnya</button><span>${financePage} / ${pages}</span><button class="secondary-button" ${financePage>=pages?'disabled':''} onclick="financePage++;renderFinanceResults()">Berikutnya →</button></div></div>`;
}
