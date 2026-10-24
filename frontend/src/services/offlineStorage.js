/**
 * Gerenciador de Resiliência Offline para Chão de Fábrica (PWA)
 * Resolve oscilações de Wi-Fi e zonas de sombra metálica (gaiola de Faraday).
 */

const STORAGE_KEYS = {
  OPERADOR_RE: 'cmms_operador_re',
  OPERADOR_NOME: 'cmms_operador_nome',
  FILA_OFFLINE: 'cmms_fila_chamados_offline',
  CACHE_ATIVOS: 'cmms_cache_ativos'
};

export const offlineStorage = {
  // Salva o RE no aparelho para o operador não precisar digitar toda vez
  salvarOperador(re, nome = '') {
    if (re) localStorage.setItem(STORAGE_KEYS.OPERADOR_RE, re.trim());
    if (nome) localStorage.setItem(STORAGE_KEYS.OPERADOR_NOME, nome.trim());
  },

  obterOperador() {
    return {
      matricula: localStorage.getItem(STORAGE_KEYS.OPERADOR_RE) || '',
      nome: localStorage.getItem(STORAGE_KEYS.OPERADOR_NOME) || ''
    };
  },

  // Enfileira chamado caso a rede caia durante o preenchimento
  enfileirarChamado(payload) {
    const fila = this.obterFila();
    const item = {
      ...payload,
      id_temporario: `temp_${Date.now()}`,
      data_criacao_local: new Date().toISOString()
    };
    fila.push(item);
    localStorage.setItem(STORAGE_KEYS.FILA_OFFLINE, JSON.stringify(fila));
    return item;
  },

  obterFila() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FILA_OFFLINE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  removerDaFila(idTemporario) {
    const fila = this.obterFila().filter((i) => i.id_temporario !== idTemporario);
    localStorage.setItem(STORAGE_KEYS.FILA_OFFLINE, JSON.stringify(fila));
  },

  // Cache dos dados do ativo para carregar mesmo se o scan for offline
  salvarCacheAtivo(token, dados) {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_ATIVOS) || '{}');
      cache[token] = { dados, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEYS.CACHE_ATIVOS, JSON.stringify(cache));
    } catch (e) {
      console.warn('Erro ao salvar cache de ativo:', e);
    }
  },

  obterCacheAtivo(token) {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_ATIVOS) || '{}');
      return cache[token] ? cache[token].dados : null;
    } catch {
      return null;
    }
  }
};
