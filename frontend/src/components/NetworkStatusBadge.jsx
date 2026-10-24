import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { offlineStorage } from '../services/offlineStorage';
import { api } from '../services/api';

export default function NetworkStatusBadge({ onSyncComplete }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [filaCount, setFilaCount] = useState(offlineStorage.obterFila().length);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      sincronizarFila();
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function sincronizarFila() {
    const fila = offlineStorage.obterFila();
    if (fila.length === 0) return;

    setSincronizando(true);
    for (const item of fila) {
      try {
        await api.post('/chamados', {
          qr_code_token: item.qr_code_token,
          operador_matricula: item.operador_matricula,
          operador_nome: item.operador_nome,
          sintoma_id: item.sintoma_id,
          descricao_sintoma: `[Sincronizado Offline] ${item.descricao_sintoma || ''}`
        });
        offlineStorage.removerDaFila(item.id_temporario);
      } catch (err) {
        console.error('Falha ao sincronizar item offline:', err);
      }
    }
    setFilaCount(offlineStorage.obterFila().length);
    setSincronizando(false);
    if (onSyncComplete) onSyncComplete();
  }

  if (isOnline && filaCount === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
        <Wifi className="w-3.5 h-3.5 animate-pulse" />
        <span>Conectado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {!isOnline && (
        <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline (Cache ativo)</span>
        </div>
      )}
      {filaCount > 0 && (
        <button
          onClick={sincronizarFila}
          disabled={sincronizando || !isOnline}
          className="flex items-center gap-1 text-xs text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 px-2.5 py-1 rounded-full active:scale-95 transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${sincronizando ? 'animate-spin' : ''}`} />
          <span>{filaCount} pendente(s)</span>
        </button>
      )}
    </div>
  );
}
