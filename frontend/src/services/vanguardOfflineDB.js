const DB_NAME = 'vanguard_cmms_local_first_v2';
const DB_VERSION = 1;

const STORES = {
  SNAPSHOT_OS: 'snapshot_os_atribuidas',
  OUTBOX: 'outbox_events',
  MEDIA: 'media_blobs',
  META: 'sync_metadata'
};

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB indisponivel neste ambiente.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORES.SNAPSHOT_OS)) {
        db.createObjectStore(STORES.SNAPSHOT_OS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
        const outboxStore = db.createObjectStore(STORES.OUTBOX, { keyPath: 'event_id' });
        outboxStore.createIndex('sync_status', 'sync_status', { unique: false });
        outboxStore.createIndex('occurred_at_client_utc', 'occurred_at_client_utc', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.MEDIA)) {
        db.createObjectStore(STORES.MEDIA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function runTx(storeName, mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = operation(store, tx);
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFromStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export const vanguardOfflineDB = {
  async obterDeviceId() {
    try {
      const existing = await runTx(STORES.META, 'readonly', (s) => s.get('device_id'));
      if (existing?.value) return existing.value;
      const novo = `device-${generateUUID()}`;
      await runTx(STORES.META, 'readwrite', (s) => s.put({ key: 'device_id', value: novo }));
      return novo;
    } catch {
      return 'device-fallback-browser';
    }
  },

  async salvarSnapshotOS(listaOS = []) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction([STORES.SNAPSHOT_OS, STORES.META], 'readwrite');
        const store = tx.objectStore(STORES.SNAPSHOT_OS);
        store.clear();
        for (const os of listaOS) {
          if (os && os.id != null) store.put(os);
        }
        tx.objectStore(STORES.META).put({
          key: 'last_snapshot_at',
          value: new Date().toISOString()
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[VanguardDB] Falha ao gravar snapshot IndexedDB:', err.message);
    }
  },

  async lerSnapshotOS() {
    try {
      return await getAllFromStore(STORES.SNAPSHOT_OS);
    } catch {
      return [];
    }
  },

  async enfileirarEventoOffline({ event_type, chamado_id, payload = {}, occurred_at_client_utc }) {
    const evento = {
      event_id: generateUUID(),
      event_type,
      chamado_id: Number(chamado_id),
      payload,
      occurred_at_client_utc: occurred_at_client_utc || new Date().toISOString(),
      sync_status: 'PENDING',
      created_local_at: Date.now()
    };

    await runTx(STORES.OUTBOX, 'readwrite', (s) => s.put(evento));

    // Notifica listeners de UI e registra Background Sync quando disponivel
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vanguard-outbox-changed', { detail: evento }));
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready
          .then((reg) => reg.sync.register('vanguard-outbox-sync'))
          .catch(() => {});
      }
    }
    return evento;
  },

  async listarEventosOutbox() {
    try {
      const todos = await getAllFromStore(STORES.OUTBOX);
      return todos.sort(
        (a, b) => new Date(a.occurred_at_client_utc).getTime() - new Date(b.occurred_at_client_utc).getTime()
      );
    } catch {
      return [];
    }
  },

  async listarEventosPendentes() {
    const todos = await this.listarEventosOutbox();
    return todos.filter((e) => e.sync_status === 'PENDING');
  },

  async listarConflitos() {
    const todos = await this.listarEventosOutbox();
    return todos.filter((e) => e.sync_status === 'CONFLITO_REATRIBUICAO');
  },

  async removerEventoOutbox(eventId) {
    try {
      await runTx(STORES.OUTBOX, 'readwrite', (s) => s.delete(eventId));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vanguard-outbox-changed'));
      }
    } catch (e) {
      console.warn('[VanguardDB] Erro ao remover evento:', e.message);
    }
  },

  /**
   * Reconcilia fila local IndexedDB com /api/v2/sync/events mantendo causalidade e detectando conflitos.
   */
  async sincronizarComServidor(token) {
    if (!token || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { executado: false, motivo: 'offline_ou_sem_token', aplicados: 0, conflitos: 0 };
    }

    const pendentes = await this.listarEventosPendentes();
    if (!pendentes.length) {
      return { executado: true, aplicados: 0, conflitos: 0, pendentesRestantes: 0 };
    }

    const deviceId = await this.obterDeviceId();
    const res = await fetch('/api/v2/sync/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        device_id: deviceId,
        events: pendentes.map((p) => ({
          event_id: p.event_id,
          event_type: p.event_type,
          chamado_id: p.chamado_id,
          occurred_at_client_utc: p.occurred_at_client_utc,
          payload: p.payload
        }))
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 409 && res.status !== 207) {
      throw new Error(data.erro || `Falha na sincronizacao HTTP ${res.status}`);
    }

    const results = Array.isArray(data.results) ? data.results : [];
    let aplicados = 0;
    let conflitos = 0;

    for (const item of results) {
      if (item.status === 'APLICADO' || item.status === 'IGNORADO_DUPLICADO') {
        await runTx(STORES.OUTBOX, 'readwrite', (s) => s.delete(item.event_id));
        aplicados += 1;
      } else if (item.status === 'CONFLITO_REATRIBUICAO') {
        conflitos += 1;
        const original = pendentes.find((p) => p.event_id === item.event_id);
        if (original) {
          await runTx(STORES.OUTBOX, 'readwrite', (s) =>
            s.put({
              ...original,
              sync_status: 'CONFLITO_REATRIBUICAO',
              motivo_conflito: item.motivo,
              estado_servidor: item.estado_servidor
            })
          );
        }
      }
    }

    const restantes = (await this.listarEventosPendentes()).length;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('vanguard-outbox-changed', {
          detail: { aplicados, conflitos, restantes }
        })
      );
    }

    return { executado: true, aplicados, conflitos, pendentesRestantes: restantes, results };
  }
};
