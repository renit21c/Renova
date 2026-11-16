import type { SupabaseClient } from '@supabase/supabase-js';

type State = Record<string, unknown>;
type Row = { state: State; updated_at: string };
type Callbacks = { status: (text: string) => void; conflict: (value: boolean) => void; error: (text: string) => void };

/** Durable outbox with optimistic concurrency. A conflicting device never overwrites silently. */
export function workspaceSync(client: SupabaseClient, userId: string, callbacks: Callbacks) {
  const store = `renova-v1:${userId}`;
  const pendingKey = `${store}:pending`, versionKey = `${store}:version`;
  let version: string | null = localStorage.getItem(versionKey);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true, running = false, conflicted = false, attempt = 0;
  let remote: Row | null = null;
  const table = () => client.from('renova_workspace');
  const valid = (value: unknown): value is State => !!value && typeof value === 'object' && !Array.isArray(value);
  const conflict = (row: Row | null) => {
    remote = row; conflicted = true; callbacks.conflict(true);
    callbacks.status('Ada perubahan dari perangkat lain. Pilih versi untuk dilanjutkan.');
  };
  const queue = (delay = 400) => {
    if (!active || conflicted) return;
    clearTimeout(timer); timer = setTimeout(() => void flush(), delay);
  };
  async function readRemote() {
    const { data, error } = await table().select('state,updated_at').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data && !valid(data.state)) throw new Error('Format workspace cloud tidak valid.');
    return data as Row | null;
  }
  async function flush() {
    if (!active || running || conflicted) return;
    const raw = localStorage.getItem(pendingKey); if (!raw) return;
    running = true;
    try {
      const snapshot: unknown = JSON.parse(raw);
      if (!valid(snapshot)) throw new Error('Data antrean lokal tidak valid. Export backup untuk pemulihan.');
      callbacks.status('Menyimpan ke cloud…');
      const updatedAt = new Date(Math.max(Date.now(), version ? Date.parse(version) + 1 : 0)).toISOString();
      const result = version
        ? await table().update({ state: snapshot, updated_at: updatedAt }).eq('id', userId).eq('updated_at', version).select('updated_at')
        : await table().insert({ id: userId, state: snapshot, updated_at: updatedAt }).select('updated_at');
      if (result.error) {
        if (result.error.code === '23505') { conflict(await readRemote()); return; }
        throw result.error;
      }
      if (!result.data?.length) { conflict(await readRemote()); return; }
      version = result.data[0].updated_at;
      localStorage.setItem(versionKey, version!);
      // Edits made while this request was in flight stay queued.
      if (localStorage.getItem(pendingKey) === raw) localStorage.removeItem(pendingKey);
      attempt = 0;
      if (active) callbacks.status(localStorage.getItem(pendingKey) ? 'Perubahan berikutnya menunggu sinkronisasi…' : 'Tersimpan di cloud');
    } catch (error) {
      if (active) callbacks.status(`Tersimpan lokal; cloud akan dicoba lagi. ${error instanceof Error ? error.message : 'Koneksi gagal.'}`);
      attempt++;
    } finally {
      running = false;
      if (active && !conflicted && localStorage.getItem(pendingKey)) queue(Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)));
    }
  }
  const onSave = () => { callbacks.status('Tersimpan lokal; menunggu cloud…'); queue(); };
  const onOnline = () => {
    if (localStorage.getItem(pendingKey)) { queue(0); return; }
    void readRemote().then(row => {
      if (!active) return;
      if (row && row.updated_at !== version) conflict(row);
      else callbacks.status('Tersimpan di cloud');
    }).catch(() => { if (active) callbacks.status('Data lokal tersedia; koneksi cloud belum pulih.'); });
  };
  const onStorageError = () => callbacks.status('Penyimpanan lokal penuh/gagal. Export backup sekarang.');
  const onStorage = (event: StorageEvent) => {
    if (event.key === versionKey && event.newValue !== version) {
      conflicted = true; callbacks.conflict(true); callbacks.status('Workspace berubah di tab lain. Pilih versi sebelum menyimpan.');
    }
  };
  async function load() {
    let local = localStorage.getItem(store);
    // Migrate old personal installs once, without exposing another account's records.
    if (!local) {
      const owner = localStorage.getItem('renova-local-owner-v1');
      if (!owner || owner === userId) {
        local = localStorage.getItem('renova-v1') || localStorage.getItem('life-os-v1');
        if (local) { localStorage.setItem(store, local); localStorage.setItem(pendingKey, local); localStorage.setItem('renova-local-owner-v1', userId); }
      }
    }
    if (local && !valid(JSON.parse(local))) throw new Error('Data lokal tidak valid.');
    try {
      const row = await readRemote(); if (!active) return false;
      const pending = localStorage.getItem(pendingKey);
      if (pending) {
        if (row && version !== row.updated_at) conflict(row);
        else { version = row?.updated_at || null; queue(0); }
      } else if (row) {
        localStorage.setItem(store, JSON.stringify(row.state));
        version = row.updated_at; localStorage.setItem(versionKey, version);
        callbacks.status('Tersimpan di cloud');
      } else {
        version = null; localStorage.removeItem(versionKey);
        if (local) { localStorage.setItem(pendingKey, local); queue(0); }
        callbacks.status('Workspace siap');
      }
    } catch (error) {
      if (!local) throw error;
      callbacks.status('Mode offline: data lokal tersedia. Sinkronisasi akan dicoba lagi.'); queue(2000);
    }
    if (!active) return false;
    window.addEventListener('renova:save', onSave);
    window.addEventListener('renova:storage-error', onStorageError);
    window.addEventListener('online', onOnline);
    window.addEventListener('storage', onStorage);
    return true;
  }
  async function resolve(choice: 'local' | 'cloud') {
    try {
      remote = await readRemote();
      // Preserve whichever version the user is replacing in a downloadable recovery slot.
      const detail: { state?: State } = {};
      window.dispatchEvent(new CustomEvent('renova:request-snapshot', { detail }));
      const current = detail.state ? JSON.stringify(detail.state) : localStorage.getItem(store);
      localStorage.setItem(`${store}:recovery`, choice === 'cloud' ? current || '{}' : JSON.stringify(remote?.state || {}));
      version = remote?.updated_at || null;
      if (version) localStorage.setItem(versionKey, version); else localStorage.removeItem(versionKey);
      if (choice === 'cloud') {
        if (!remote) throw new Error('Versi cloud belum tersedia. Pilih simpan versi lokal.');
        localStorage.setItem(store, JSON.stringify(remote.state)); localStorage.removeItem(pendingKey);
        window.location.reload(); return;
      }
      if (current) localStorage.setItem(pendingKey, current);
      if (current) localStorage.setItem(store, current);
      conflicted = false; callbacks.conflict(false); queue(0);
    } catch (error) { callbacks.status(error instanceof Error ? error.message : 'Resolusi gagal. Coba lagi.'); }
  }
  return {
    load, resolve, retry: () => queue(0),
    dispose() { active = false; clearTimeout(timer); window.removeEventListener('renova:save',onSave); window.removeEventListener('renova:storage-error',onStorageError); window.removeEventListener('online',onOnline); window.removeEventListener('storage',onStorage); },
  };
}
