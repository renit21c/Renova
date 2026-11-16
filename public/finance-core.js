/* Shared, dependency-free validation for the browser and regression tests. */
(function (root) {
  'use strict';
  const collections = ['tasks', 'events', 'accounts', 'transactions', 'goals', 'journal', 'projects', 'investments', 'budgets'];
  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  }
  function amount(value, format = 'plain') {
    let text = String(value ?? '').trim().replace(/^(Rp|IDR|USD)\s*/i, '').replace(/\s/g, '');
    if (format === 'id') {
      if (!/^-?(\d+|\d{1,3}(\.\d{3})+)(,\d{1,2})?$/.test(text)) throw new Error('Format angka Indonesia tidak valid: ' + value);
      text = text.replace(/\./g, '').replace(',', '.');
    } else if (format === 'en') {
      if (!/^-?(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/.test(text)) throw new Error('Format angka English tidak valid: ' + value);
      text = text.replace(/,/g, '');
    }
    if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error('Jumlah tidak valid: ' + value);
    const number = Number(text);
    if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER / 100) throw new Error('Jumlah terlalu besar.');
    return number;
  }
  function parseCSV(text, separator) {
    text = text.replace(/^\uFEFF/, '');
    if (!separator) {
      let quotes = false, commas = 0, semicolons = 0;
      for (const c of text) { if (c === '"') quotes = !quotes; else if (!quotes) { if (c === '\n' || c === '\r') break; if (c === ',') commas++; if (c === ';') semicolons++; } }
      separator = semicolons > commas ? ';' : ',';
    }
    const rows = []; let row = [], cell = '', quoted = false, closed = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') { quoted = false; closed = true; }
        else cell += c;
      } else if (c === '"' && !cell && !closed) quoted = true;
      else if (c === separator) { row.push(cell); cell = ''; closed = false; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); if (row.some(x => x.trim())) rows.push(row);
        row = []; cell = ''; closed = false;
      } else if (closed && c.trim()) throw new Error('CSV tidak valid setelah tanda kutip.');
      else cell += c;
    }
    if (quoted) throw new Error('Tanda kutip CSV belum ditutup.');
    row.push(cell); if (row.some(x => x.trim())) rows.push(row);
    if (rows.length < 2) throw new Error('CSV harus berisi header dan minimal satu baris data.');
    if (rows.some(r => r.length !== rows[0].length)) throw new Error('Jumlah kolom CSV tidak konsisten.');
    return { headers: rows[0].map(x => x.trim()), rows: rows.slice(1) };
  }
  function csvCell(value) {
    let text = String(value ?? '');
    // Prevent formulas when this export is opened in spreadsheet software.
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function fingerprint(t) {
    return JSON.stringify([t.date, t.type, Number(t.amount), t.accountId || '', t.fromAccountId || '', t.toAccountId || '', t.category || '', t.description || '']);
  }
  function nextDue(date, repeat) {
    if (!validDate(date)) throw new Error('Recurring tasks need a valid due date.');
    const d = new Date(date + 'T12:00:00Z');
    if (repeat === 'monthly') {
      const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, last));
    } else d.setUTCDate(d.getUTCDate() + (repeat === 'weekly' ? 7 : 1));
    return d.toISOString().slice(0, 10);
  }
  function zonedParts(value, zone) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(new Date(value));
    const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,seconds:p.second};
  }
  function zonedISO(date, time, zone) {
    if (!validDate(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) throw new Error('Invalid date/time.');
    const target = Date.parse(`${date}T${time.length === 5 ? time + ':00' : time}Z`);
    if (!Number.isFinite(target)) throw new Error('Invalid date/time.');
    let guess = target;
    for (let i=0;i<4;i++) {
      const p=zonedParts(guess,zone), observed=Date.parse(`${p.date}T${p.time}:${p.seconds}Z`);
      const delta=target-observed; if (!delta) return new Date(guess).toISOString(); guess+=delta;
    }
    throw new Error('This time does not exist in the selected timezone.');
  }
  function validateWorkspace(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !input.profile || typeof input.profile !== 'object' || Array.isArray(input.profile)) throw new Error('Format backup Renova tidak valid.');
    const output = JSON.parse(JSON.stringify(input));
    for (const key of collections) {
      if (output[key] === undefined) output[key] = [];
      if (!Array.isArray(output[key])) throw new Error(key + ' harus berupa daftar.');
      const ids = new Set();
      for (const item of output[key]) {
        if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(item.id) || ids.has(item.id)) throw new Error('ID tidak valid atau duplikat: ' + key);
        ids.add(item.id);
      }
    }
    for (const a of output.accounts) if (!Number.isFinite(Number(a.initial || 0))) throw new Error('Saldo awal tidak valid.');
    for (const b of output.budgets) if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month || '') || typeof b.category !== 'string' || !b.category.trim() || !Number.isFinite(Number(b.amount)) || Number(b.amount) <= 0) throw new Error('Anggaran backup tidak valid.');
    for (const key of ['tasks','events','journal','projects','goals']) {
      for (const item of output[key]) {
        for (const field of ['date','due','targetDate']) if (item[field] && !validDate(item[field])) throw new Error('Tanggal backup tidak valid: ' + key);
        for (const field of ['title','body','name','description']) if (item[field] !== undefined && typeof item[field] !== 'string') throw new Error('Teks backup tidak valid: ' + key);
      }
    }
    for (const t of output.transactions) {
      if (!validDate(t.date) || !['Income', 'Expense', 'Transfer'].includes(t.type) || !Number.isFinite(Number(t.amount)) || Number(t.amount) <= 0) throw new Error('Transaksi backup tidak valid.');
      const has = id => output.accounts.some(a => a.id === id);
      if (t.type === 'Transfer' && (!has(t.fromAccountId) || !has(t.toAccountId) || t.fromAccountId === t.toAccountId)) throw new Error('Rekening transfer backup tidak valid.');
      if (t.type !== 'Transfer' && t.accountId && !has(t.accountId)) throw new Error('Rekening transaksi backup tidak ditemukan.');
    }
    if (output.profile.timezone) new Intl.DateTimeFormat('en', { timeZone: output.profile.timezone });
    if (output.profile.currency) new Intl.NumberFormat('en', { style:'currency', currency:output.profile.currency });
    return output;
  }
  const api = { validDate, amount, parseCSV, csvCell, fingerprint, nextDue, zonedParts, zonedISO, validateWorkspace, collections };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RenovaCore = api;
})(typeof window === 'undefined' ? globalThis : window);
