/* Presentation for the personal finance workspace. Data workflows live in finance-features.js. */
function financeMonthLabel(month) {
  if (!month) return 'Semua periode';
  return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00'));
}
function financeTypeLabel(type) {
  return {Income:'Pemasukan',Expense:'Pengeluaran',Transfer:'Transfer'}[type] || type;
}
function financeEmpty(title,description,action='') {
  return `<div class="designed-empty"><span class="empty-symbol">${icon('wallet')}</span><b>${title}</b>${description?`<p>${description}</p>`:''}${action}</div>`;
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
  const metric=(label,value,symbol,kind,caption)=>`<article class="finance-stat ${kind}"><div class="stat-top"><span>${label}</span><span class="stat-symbol" aria-hidden="true">${icon(kind==='stat-income'?'arrow-in':kind==='stat-expense'?'arrow-out':'transfer')}</span></div><strong>${money(value)}</strong></article>`;
  const accounts=state.accounts.map((a,i)=>`
    <article class="account-card">
      <div class="account-card-top"><span class="account-symbol account-color-${i%3}">${icon('wallet')}</span><div class="account-name"><b>${esc(a.name)}</b><small>${esc(a.type||'Rekening')}</small></div>
        <details class="record-menu"><summary aria-label="Kelola rekening ${esc(a.name)}">${icon('more')}</summary><div><button onclick="openAccount('${a.id}')">${icon('edit')} Edit</button><button class="danger-button" onclick="deleteAccount('${a.id}')">${icon('trash')} Hapus</button></div></details>
      </div>
      <strong class="account-balance">${money(accountBalance(a))}</strong>
      <div class="account-quick-actions"><button onclick="openTransaction('','${a.id}','Income')">${icon('arrow-in')} Pemasukan</button><button onclick="openTransaction('','${a.id}','Expense')">${icon('arrow-out')} Pengeluaran</button></div>
    </article>`).join('');
  return heading('Finance','',`<div class="finance-actions"><button class="secondary-button compact-action" onclick="openCSVImport()" aria-label="Import CSV" title="Import CSV">${icon('upload')}<span>Import</span></button><button class="secondary-button compact-action" onclick="openTransfer()" aria-label="Transfer antar rekening" title="Transfer">${icon('transfer')}<span>Transfer</span></button><button class="primary-button" onclick="openTransaction()">${icon('plus')} Transaksi</button></div>`)+`
    <div class="finance-workspace">
      <section class="finance-overview" aria-label="Ringkasan keuangan">
        <article class="balance-hero"><div class="balance-hero-top"><span>Total saldo</span><span class="balance-live">${icon('wallet')}</span></div><strong>${money(total)}</strong><div class="balance-hero-bottom"><span>${icon('calendar')} ${esc(monthLabel)}</span><span>${state.accounts.length} rekening</span></div></article>
        <div class="finance-stats">${metric('Pemasukan',income,'↙','stat-income',monthLabel)}${metric('Pengeluaran',expense,'↗','stat-expense',monthLabel)}${metric('Arus kas',income-expense,'⇄','stat-net','Pemasukan dikurangi pengeluaran')}</div>
      </section>
      <section class="panel accounts-panel"><div class="panel-title"><div><h2>Rekening</h2></div><button class="icon-button action-icon" onclick="openAccount()" aria-label="Tambah rekening" title="Tambah rekening">${icon('plus')}</button></div><div class="account-card-grid">${accounts||financeEmpty('Belum ada rekening','','<button class="secondary-button" onclick="openAccount()">Tambah rekening</button>')}</div></section>
      <section class="panel transactions-panel"><div class="panel-title"><div><h2>Transaksi</h2></div><button class="icon-button action-icon" onclick="exportFinanceCSV()" aria-label="Export transaksi CSV" title="Export CSV">${icon('download')}</button></div>
        <form id="financeFilters" class="finance-filter-grid" onsubmit="event.preventDefault();updateFinanceFilters()">
          <label>Bulan<input type="month" name="month" value="${esc(f.month)}" onchange="updateFinanceFilters()"></label>
          <details id="financeMoreFilters" class="finance-filter-details" open><summary>${icon('filter')} Filter <span id="financeFilterCount" class="filter-count">${Number(Boolean(f.account))+Number(Boolean(f.type))||''}</span></summary><div class="finance-extra-fields">
            <label>Rekening<select name="account" onchange="updateFinanceFilters()"><option value="">Semua rekening</option>${state.accounts.map(a=>`<option value="${a.id}" ${f.account===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
            <label>Jenis<select name="type" onchange="updateFinanceFilters()"><option value="">Semua jenis</option>${['Income','Expense','Transfer'].map(t=>`<option value="${t}" ${f.type===t?'selected':''}>${financeTypeLabel(t)}</option>`).join('')}</select></label>
          </div></details>
          <label class="finance-search-label">Cari<span class="finance-search-input">${icon('search')}<input name="query" value="${esc(f.query)}" placeholder="Cari transaksi…" oninput="updateFinanceFilters()"></span></label>
        </form><div id="financeResults">${financeResults()}</div>
      </section>
      <div class="finance-insights"><section class="panel"><div class="panel-title"><div><h2>Anggaran</h2><p class="section-description">${esc(monthLabel)}</p></div><button class="icon-button action-icon" onclick="openBudget()" aria-label="Tambah anggaran" title="Tambah anggaran">${icon('plus')}</button></div>${budgetSummary(month)}</section><section class="panel"><div class="panel-title"><div><h2>Kategori</h2><p class="section-description">${esc(monthLabel)}</p></div><span class="section-symbol">${icon('chart')}</span></div>${categorySummary(month)}</section></div>
      <section class="panel finance-data-panel"><div><h2>Backup & data</h2></div><div class="finance-actions"><button class="secondary-button" onclick="exportData()">${icon('download')} Backup</button><button class="secondary-button" onclick="chooseRestore()">${icon('upload')} Restore</button><details class="record-menu data-menu"><summary aria-label="Kelola data" title="Kelola data">${icon('more')}</summary><div><button onclick="downloadCSVTemplate()">Download template CSV</button><button class="danger-button" onclick="openClearRecords()">Hapus semua transaksi…</button><button class="danger-button" onclick="openClearRecords('finance')">Reset seluruh finance…</button></div></details></div></section>
      <details class="finance-help"><summary>${icon('info')} Tentang saldo</summary><p>Saldo mencakup semua tanggal. Arus kas mengikuti bulan yang dipilih. Transfer tidak dihitung sebagai pemasukan atau pengeluaran.</p></details>
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
      <label class="transaction-select"><input type="checkbox" aria-label="Pilih ${esc(t.description||typeLabel)}" ${selectedTransactions.has(t.id)?'checked':''} onchange="selectTransaction('${t.id}',this.checked)"></label>
      <span class="transaction-symbol transaction-${kind}" aria-hidden="true">${icon(t.type==='Income'?'arrow-in':t.type==='Expense'?'arrow-out':'transfer')}</span>
      <div class="transaction-description"><b>${esc(t.description||t.category||typeLabel)}</b><small><time datetime="${t.date}">${date}</time><span> · ${esc(account)}</span></small></div>
      <span class="transaction-category">${esc(t.category||typeLabel)}</span>
      <strong class="amount ${t.type==='Income'?'income':t.type==='Expense'?'expense':'muted'}">${t.type==='Income'?'+':t.type==='Expense'?'−':''}${money(t.amount)}</strong>
      <details class="record-menu"><summary aria-label="Kelola transaksi ${esc(t.description||typeLabel)}">${icon('more')}</summary><div><button onclick="openTransaction('${t.id}')">${icon('edit')} Edit</button><button class="danger-button" onclick="deleteTransaction('${t.id}')">${icon('trash')} Hapus</button></div></details>
    </div>`;
  }).join('');
  return `<div class="transaction-summary"><span><b>${rows.length}</b> transaksi</span><span class="filtered-cashflow"><span>Pemasukan <b class="income">${money(income)}</b></span><span>Pengeluaran <b class="expense">${money(expense)}</b></span></span></div>
    <div class="selection-toolbar"><button class="text-button select-page-action" onclick="selectFinancePage()">${icon('check')} Pilih</button>${selectedTransactions.size?`<span class="selection-count">${selectedTransactions.size} dipilih</span><button class="text-button danger-button" onclick="deleteSelectedTransactions()">Hapus pilihan</button>`:''}</div>
    <div class="transaction-list">${list||financeEmpty('Belum ada transaksi','Ubah filter atau tambah transaksi.',`<button class="secondary-button" onclick="openTransaction()">${icon('plus')} Transaksi</button>`)}</div>
    <div class="transaction-pagination"><span>${rows.length?`${(financePage-1)*30+1}–${Math.min(financePage*30,rows.length)} dari ${rows.length}`:'0 transaksi'}</span><div><button class="secondary-button page-arrow" aria-label="Halaman sebelumnya" ${financePage<=1?'disabled':''} onclick="financePage--;renderFinanceResults()">${icon('chevron-left')}</button><span>${financePage} / ${pages}</span><button class="secondary-button page-arrow" aria-label="Halaman berikutnya" ${financePage>=pages?'disabled':''} onclick="financePage++;renderFinanceResults()">${icon('chevron-right')}</button></div></div>`;
}
