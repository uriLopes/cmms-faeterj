const API_BASE = '/api';

export const api = {
  async get(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ erro: 'Erro na requisição' }));
      throw new Error(err.erro || `Erro HTTP ${res.status}`);
    }
    return res.json();
  },

  async post(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ erro: 'Erro na requisição' }));
      throw new Error(err.erro || `Erro HTTP ${res.status}`);
    }
    return res.json();
  },

  async patch(endpoint, body = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ erro: 'Erro na requisição' }));
      throw new Error(err.erro || `Erro HTTP ${res.status}`);
    }
    return res.json();
  }
};
