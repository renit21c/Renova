/* Personal workspace workflows. Loaded before app.js; initialized after its state. */
let modalDirty = false, modalSaving = false, modalReturnFocus = null, submittingModal = null;
let undoHistory = [], featurePrefs = {}, csvImport = null, csvPreview = null;
const cloneData = value => JSON.parse(JSON.stringify(value));
function workspaceDate() {
  try { return RenovaCore.zonedParts(new Date(),state.profile.timezone || 'Asia/Jakarta').date; }
  catch { return iso(new Date()); }
}
function rememberView() {
  for (const id of ['taskSearch','taskFilter','taskProjectFilter','taskPriorityFilter','taskStatusFilter']) {
    const input = document.getElementById(id); if (input) featurePrefs[id] = input.value;
  }
  featurePrefs.calendarOffset = calendarOffset;
  localStorage.setItem(`${STORE}:views`, JSON.stringify(featurePrefs));
}
function afterWorkspaceRender() {
  syncThemeChrome();
  if (route === 'tasks') {
    for (const [id, value] of Object.entries(featurePrefs)) {
      const input = document.getElementById(id); if (input) input.value = value;
    }
    filterTasks();
    const listPanel = document.querySelector('#taskList')?.closest('section');
    const timelinePanel = document.querySelector('#taskTimeline')?.closest('section');
    if (listPanel && timelinePanel) {
      const toggle = document.createElement('div'); toggle.className = 'view-toggle';
      toggle.innerHTML = `<button class="secondary-button" onclick="setTaskView('list')" aria-pressed="${featurePrefs.taskView !== 'timeline'}">List</button><button class="secondary-button" onclick="setTaskView('timeline')" aria-pressed="${featurePrefs.taskView === 'timeline'}">Timeline</button>`;
      document.querySelector('.page-heading').append(toggle);
      // Keep filters available in both views; only hide the list contents.
      document.getElementById('taskList').hidden = featurePrefs.taskView === 'timeline';
      timelinePanel.hidden = featurePrefs.taskView !== 'timeline';
    }
  }
  if (route === 'settings') {
    const section = document.createElement('section'); section.className = 'panel';
    section.innerHTML = `<h2>Backup & restore</h2><p class="muted">Restore mengganti seluruh workspace. Backup sebelum restore akan disimpan di browser.</p><div class="finance-actions"><button class="secondary-button" onclick="chooseRestore()">Restore JSON backup</button><button class="secondary-button" onclick="downloadRecovery()">Download recovery backup</button><button class="text-button danger-button" onclick="openClearRecords('workspace')">Delete all workspace records</button></div>`;
    document.getElementById('page').append(section);
    const installSection=document.createElement('section');installSection.className='panel install-panel';
    installSection.innerHTML=`<span class="install-symbol">${icon('home')}</span><div><h2>Renova, lebih dekat</h2><p class="muted">Tambahkan ke layar utama untuk membuka Renova seperti aplikasi.</p></div><button class="secondary-button" onclick="window.dispatchEvent(new CustomEvent('renova:install'))">Install Renova</button>`;
    document.getElementById('page').append(installSection);
  }
  document.querySelectorAll('.currency-input > span').forEach(el => el.textContent = state.profile.currency || 'IDR');
  if (undoHistory.length) {
    const button = document.createElement('button'); button.className = 'secondary-button undo-button';
    button.textContent = 'Undo: ' + undoHistory[undoHistory.length - 1].label; button.onclick = undoLastChange;
    document.querySelector('.page-heading')?.append(button);
  }
}
function setTaskView(view) { featurePrefs.taskView = view; rememberView(); render(); }
function checkpoint(label) {
  undoHistory.push({ label, state: cloneData(state) });
  if (undoHistory.length > 10) undoHistory.shift();
}
function undoLastChange() {
  const last = undoHistory.pop(); if (!last) return;
  if (!last.after) return;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  // Reverse this operation only. Later journal edits or transactions remain intact.
  for (const key of RenovaCore.collections) {
    const before=new Map((last.state[key]||[]).map(x=>[x.id,x]));
    const after=new Map((last.after[key]||[]).map(x=>[x.id,x]));
    const current=new Map((state[key]||[]).map(x=>[x.id,x]));
    for (const id of new Set([...before.keys(),...after.keys()])) {
      const b=before.get(id),a=after.get(id),c=current.get(id);
      if (same(b,a)) continue;
      if (!b && same(c,a)) current.delete(id);
      else if (b && !a && !c) {
        const restored=cloneData(b);
        if(key==='tasks'&&last.label.includes('Google')) delete restored.calendarEventId;
        current.set(id,restored);
      } else if (b && a && same(c,a)) current.set(id,cloneData(b));
    }
    state[key]=[...current.values()];
  }
  for (const key of ['profile','focus','theme']) if(same(state[key],last.after[key])) state[key]=cloneData(last.state[key]);
  save(); render(); toast('Perubahan dibatalkan');
}
function featureSave() {
  try {
    const checkpoint=undoHistory[undoHistory.length-1];
    if(checkpoint&&!checkpoint.after)checkpoint.after=cloneData(state);
    localStorage.setItem(STORE, JSON.stringify(state));
    localStorage.setItem(`${STORE}:pending`, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('renova:save', { detail: cloneData(state) }));
    if (submittingModal && submittingModal === document.querySelector('#modalRoot form')) {
      modalSaving = true; modalDirty = false;
    }
    return true;
  } catch (error) {
    window.dispatchEvent(new CustomEvent('renova:storage-error'));
    toast('Penyimpanan lokal gagal. Export backup sebelum menutup halaman.');
    throw error;
  }
}
function featureModal(content) {
  if (modalDirty && !pendingTaskProject && !confirm('Discard unsaved changes? Journal drafts are kept on this device.')) return false;
  modalReturnFocus = document.activeElement; modalDirty = false; modalSaving = false;
  document.querySelector('#modalRoot').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal" role="dialog" aria-modal="true" aria-label="Workspace form" tabindex="-1">${content}</div></div>`;
  document.querySelector('#modalRoot form')?.addEventListener('input', () => { modalDirty = true; modalSaving = false; });
  document.querySelector('#modalRoot form')?.addEventListener('change', () => { modalDirty = true; modalSaving = false; });
  document.querySelector('#modalRoot form')?.addEventListener('submit', e => {
    submittingModal = e.currentTarget;
    queueMicrotask(() => { submittingModal = null; });
  },true);
  queueMicrotask(() => document.querySelector('#modalRoot input, #modalRoot button, #modalRoot .modal')?.focus());
  return true;
}
function featureCloseModal(force = false) {
  if (!force && modalDirty && !modalSaving && !confirm('Discard unsaved changes? Journal drafts are kept on this device.')) return false;
  pendingTaskProject = null; modalDirty = false; modalSaving = false;
  document.querySelector('#modalRoot').innerHTML = ''; modalReturnFocus?.focus(); return true;
}
function featureHome() {
  const active = state.tasks.filter(t => !['Completed','Archived'].includes(t.status));
  const events = calendarEvents().filter(e => e.date >= now).sort((a,b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const schedule = (title, items) => `<section class="panel"><div class="panel-title"><h2>${title}</h2><a href="#calendar">Open calendar</a></div>${items.map(e => `<div class="schedule-item"><span class="time">${esc(e.time || 'All day')}</span><div class="event-info"><b>${esc(e.title)}</b><small>${esc(e.date)} · ${esc(e.location || e.source || 'Local calendar')}</small></div></div>`).join('') || '<div class="empty">No events.</div>'}</section>`;
  const block = (title, items) => `<section class="panel"><div class="panel-title"><h2>${title}</h2><button class="text-button" onclick="openTask()">Add task</button></div>${taskRows(items)}</section>`;
  return heading(`${greeting()}${state.profile.nickname ? ', ' + esc(state.profile.nickname) : ''}.`, `${dateLabel(now)} · ${esc(state.focus || 'Choose one meaningful thing to move forward today.')}`) + `<div class="dashboard-grid"><div class="section-stack">${schedule('Today’s schedule', events.filter(e => e.date === now))}${block('Overdue', active.filter(t => t.due && t.due < now))}${block('Today’s tasks', active.filter(t => t.due === now))}</div><div class="section-stack">${schedule('Upcoming events', events.filter(e => e.date > now).slice(0,5))}${block('Unscheduled tasks', active.filter(t => !t.due).slice(0,5))}<section class="panel"><h2>Personal focus</h2><p>${esc(state.focus || 'Set a focus for this week')}</p><button class="secondary-button" onclick="openFocus()">Edit focus</button><p>${state.tasks.filter(t => t.status === 'Completed' && t.completed === now).length} completed today</p><a href="#finance">Finance · ${money(balance())}</a></section></div></div>`;
}
function featureSearchNow() {
  const q = document.getElementById('globalSearch').value.trim().toLowerCase();
  const kinds = [['tasks','Task','title'],['events','Event','title'],['goals','Goal','title'],['journal','Journal','title'],['projects','Project','name'],['investments','Investment','name'],['transactions','Transaction','description']];
  const matches = kinds.flatMap(([key,label,field]) => state[key].filter(x => [x[field],x.body,x.description,x.category].join(' ').toLowerCase().includes(q)).map(x => ({ key,label,id:x.id,title:x[field] || x.body || x.category || label })));
  document.getElementById('searchResults').innerHTML = q ? matches.slice(0,60).map(x => `<button class="search-result list-row" onclick="openSearchRecord('${x.key}','${x.id}')"><span class="status">${x.label}</span><b>${esc(x.title)}</b></button>`).join('') || '<div class="empty">No matches.</div>' : '<div class="empty">Start typing to search.</div>';
}
function openSearchRecord(key,id) {
  if (!closeModal()) return;
  const routes = { tasks:'tasks',events:'calendar',goals:'goals',journal:'journal',projects:'projects',investments:'investments',transactions:'finance' };
  setRoute(routes[key]);
  ({ tasks:openTask,events:(_id)=>openEvent(now,_id),goals:openGoal,journal:openJournal,projects:openProject,investments:openInvestment,transactions:openTransaction })[key](id);
}
function featureJournal() {
  return heading('Journal','Private entries, synced to your workspace. Drafts stay on this device.','<button class="primary-button" onclick="openJournal()">＋ New entry</button>') + `<section class="panel">${state.journal.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(j => `<article class="goal-card"><div class="panel-title"><h2>${esc(j.title || 'Untitled entry')}</h2><span>${esc(j.date)}</span></div><p class="journal-body">${esc(j.body)}</p><button class="text-button" onclick="openJournal('${j.id}')">Edit</button><button class="text-button danger-button" onclick="removeRecord('journal','${j.id}')">Delete</button></article>`).join('') || '<div class="empty">Write your first entry.</div>'}</section>`;
}
function featureOpenJournal(id = '') {
  const draftKey = `${STORE}:journal-draft:${id || 'new'}`;
  let draft; try { draft = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch {}
  const j = draft || state.journal.find(x => x.id === id) || {};
  if (!modal(`<h2>${id ? 'Edit' : 'New'} journal entry</h2><p class="muted">Draft saved automatically on this device.</p><form onsubmit="featureSaveJournal(event,'${id}')"><div class="field"><label>Title<input name="title" value="${esc(j.title || '')}"></label></div><div class="field"><label>Your thoughts<textarea name="body" required>${esc(j.body || '')}</textarea></label></div><div class="modal-actions"><button type="button" class="secondary-button" onclick="closeModal()">Close</button><button class="primary-button">Save entry</button></div></form>`)) return;
  document.querySelector('#modalRoot form').addEventListener('input', e => {
    try { localStorage.setItem(draftKey, JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))); }
    catch { toast('Draft could not be saved. Export or copy your writing.'); }
  });
}
function featureSaveJournal(event,id) {
  event.preventDefault(); const existing = state.journal.find(x => x.id === id);
  const entry = { ...existing, ...Object.fromEntries(new FormData(event.target)), id:id || crypto.randomUUID(), date:existing?.date || now };
  if (existing) Object.assign(existing,entry); else state.journal.push(entry);
  save(); localStorage.removeItem(`${STORE}:journal-draft:${id || 'new'}`); closeModal(); render(); toast('Journal saved');
}
function removeRecord(key,id) {
  if (!confirm('Delete this record? You can undo this change.')) return;
  checkpoint('delete ' + key); state[key] = state[key].filter(x => x.id !== id); save(); closeModal(true); render();
}
function featureDeleteTransaction(id) { removeRecord('transactions',id); }
function featureDeleteAccount(id) {
  if (state.transactions.some(t => [t.accountId,t.fromAccountId,t.toAccountId].includes(id))) {
    toast('Rekening masih dipakai transaksi. Hapus/pindahkan transaksi terlebih dahulu, atau gunakan reset finance.'); return;
  }
  removeRecord('accounts',id);
}
function downloadText(name,text,type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], {type})); const a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function chooseRestore() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    try {
      if (!input.files[0]) return;
      if (input.files[0].size > 20 * 1024 * 1024) throw new Error('Backup maksimal 20 MB.');
      const restored = RenovaCore.validateWorkspace(JSON.parse(await input.files[0].text()));
      const counts = RenovaCore.collections.map(k => `${k}: ${restored[k].length}`).join(', ');
      if (!confirm(`Restore mengganti seluruh workspace saat ini. ${counts}. Lanjutkan?`)) return;
      localStorage.setItem(`${STORE}:recovery`,JSON.stringify(state)); checkpoint('restore backup');
      state = {...seed,...restored,profile:{...seed.profile,...restored.profile}}; save(); render(); toast('Backup restored');
    } catch (error) { toast(error.message); }
  }; input.click();
}
function downloadRecovery() {
  const recovery = localStorage.getItem(`${STORE}:recovery`);
  if (!recovery) return toast('Belum ada recovery backup.');
  downloadText('renova-recovery.json',recovery,'application/json');
}
function openClearRecords(scope = 'transactions') {
  modal(`<h2>Delete records</h2><p>Backup otomatis dibuat sebelum penghapusan. Google Calendar tidak dihapus.</p><form onsubmit="clearRecords(event)"><div class="field"><label>Records<select name="scope"><option value="transactions" ${scope === 'transactions' ? 'selected' : ''}>All transactions (keep accounts and opening balances)</option><option value="finance" ${scope === 'finance' ? 'selected' : ''}>All finance: transactions, accounts, budgets, investments and savings goals</option><option value="workspace" ${scope === 'workspace' ? 'selected' : ''}>All workspace records (keep profile and appearance)</option></select></label></div><div class="field"><label>Type DELETE to confirm<input name="confirmation" required pattern="DELETE" autocomplete="off"></label></div><div class="modal-actions"><button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">Delete records</button></div></form>`);
}
function clearRecords(event) {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); if (values.confirmation !== 'DELETE') return;
  try { localStorage.setItem(`${STORE}:recovery`,JSON.stringify(state)); }
  catch { return toast('Recovery backup gagal disimpan. Export backup sebelum menghapus data.'); }
  checkpoint('delete records');
  const keys = values.scope === 'workspace' ? RenovaCore.collections : values.scope === 'finance' ? ['transactions','accounts','budgets','investments','goals'] : ['transactions'];
  for (const key of keys) state[key] = [];
  if (values.scope === 'workspace') {
    state.focus = '';
    for (let i=localStorage.length-1;i>=0;i--) { const key=localStorage.key(i); if (key.startsWith(`${STORE}:journal-draft:`)) localStorage.removeItem(key); }
  }
  save(); closeModal(); render(); toast('Records deleted. Undo or download recovery backup in Settings.');
}
function initWorkspaceFeatures() {
  initSoftUi();
  try { featurePrefs = JSON.parse(localStorage.getItem(`${STORE}:views`) || '{}'); } catch { featurePrefs = {}; }
  calendarOffset = Number(featurePrefs.calendarOffset) || 0;
  state.budgets ||= []; now = workspaceDate(); today = new Date(now + 'T12:00:00');
  document.addEventListener('input', e => { if (e.target.closest('.task-filters')) rememberView(); });
  document.addEventListener('change', e => { if (e.target.closest('.task-filters')) rememberView(); });
  window.addEventListener('beforeunload', e => { if (modalDirty) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('renova:request-snapshot', e => { e.detail.state = cloneData(state); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return; const dialog = document.querySelector('#modalRoot .modal'); if (!dialog) return;
    const els = [...dialog.querySelectorAll('button,input,select,textarea,a[href]')].filter(x => !x.disabled && x.getClientRects().length);
    const first=els[0],last=els[els.length-1]; if (!first) return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  setInterval(() => { const date=workspaceDate(); if (date !== now) { now=date; today=new Date(now+'T12:00:00'); if (!document.querySelector('#modalRoot form')) render(); } },30000);
}
function createNextTaskOccurrence(task) {
  if (task.status !== 'Completed' || !['daily','weekly','monthly'].includes(task.repeat) || !task.due || task.nextOccurrenceId) return;
  const next = {...cloneData(task),id:crypto.randomUUID(),due:RenovaCore.nextDue(task.due,task.repeat),status:'To do',completed:''};
  delete next.calendarEventId; delete next.nextOccurrenceId;
  task.nextOccurrenceId=next.id;
  state.tasks.push(next);
}
