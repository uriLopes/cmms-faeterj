import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  ArrowLeft,
  Search,
  User,
  Plus,
  X,
  FileText,
  ShieldAlert,
  HelpCircle,
  QrCode
} from 'lucide-react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import NetworkStatusBadge from '../components/NetworkStatusBadge';
import { vanguardOfflineDB } from '../services/vanguardOfflineDB';

// Formatador de segundos para MM:SS ou HH:MM:SS
function formatarTempoCronometro(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MantenedorPainel() {
  const navigate = useNavigate();

  // Autenticação do técnico (Padrão Rodrigo Silva RE-3088)
  const [tokenAuth, setTokenAuth] = useState(localStorage.getItem('cmms_auth_token_tecnico') || '');
  const [tecnicoAtual, setTecnicoAtual] = useState(null);

  // Estados dos chamados
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [osAtiva, setOsAtiva] = useState(null); // OS atualmente em atendimento na tela de campo

  // Modais de Peças e Conclusão
  const [modalPeca, setModalPeca] = useState(false);
  const [pecasCatalogo, setPecasCatalogo] = useState([]);
  const [buscaPeca, setBuscaPeca] = useState('');
  const [pecaSelecionada, setPecaSelecionada] = useState(null);
  const [qtdPeca, setQtdPeca] = useState(1);
  const [pecasDaOS, setPecasDaOS] = useState([]);

  // Modal de Pausa
  const [modalPausa, setModalPausa] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState('aguardando_peca');
  const [justificativaPausa, setJustificativaPausa] = useState('');

  // Modal de Conclusão Técnica ($T_3$)
  const [modalConcluir, setModalConcluir] = useState(false);
  const [causaRaiz, setCausaRaiz] = useState('');
  const [acaoExecutada, setAcaoExecutada] = useState('');
  const [arvoreFalha, setArvoreFalha] = useState('mecanica');
  const [revisaoPreventiva, setRevisaoPreventiva] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [resultadoConclusao, setResultadoConclusao] = useState(null);
  const [submetendo, setSubmetendo] = useState(false);

  // Relógio do cronômetro em tempo real
  const [relogio, setRelogio] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setRelogio(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Inicialização e autenticação do mantenedor
  useEffect(() => {
    inicializarTecnico();
    carregarChamados();

    const socket = getSocket();
    socket.on('status_alterado', () => carregarChamados());
    socket.on('novo_chamado', () => carregarChamados());

    return () => {
      socket.off('status_alterado');
      socket.off('novo_chamado');
    };
  }, []);

  async function inicializarTecnico() {
    try {
      let token = tokenAuth;
      if (!token) {
        // Login automático de demonstração como Rodrigo Silva (Mecatrônica)
        const res = await api.post('/auth/login', {
          matricula: 'RE-3088',
          senha: 'cmms123'
        });
        token = res.token;
        setTokenAuth(token);
        localStorage.setItem('cmms_auth_token_tecnico', token);
        setTecnicoAtual(res.usuario);
      } else {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTecnicoAtual(data.usuario);
        }
      }
    } catch (err) {
      console.warn('Erro ao inicializar técnico:', err);
    }
  }

  async function carregarChamados() {
    setLoading(true);
    try {
      const data = await api.get('/chamados');
      setChamados(data);

      // Se houver uma OS em andamento selecionada, recarrega seus dados frescos
      if (osAtiva) {
        const fresca = data.find((c) => c.id === osAtiva.id);
        if (fresca) {
          setOsAtiva(fresca);
          carregarPecasOS(fresca.id);
        }
      }
    } catch (err) {
      console.warn('Sem rede ao buscar chamados, carregando snapshot IndexedDB:', err);
      const snapshot = await vanguardOfflineDB.lerSnapshotOS();
      if (snapshot.length > 0) {
        setChamados(snapshot);
      }
    } finally {
      setLoading(false);
    }
  }

  async function carregarPecasOS(chamadoId) {
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
      const res = await fetch(`/api/chamados/${chamadoId}/pecas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const pecas = await res.json();
        setPecasDaOS(pecas);
      }
    } catch (err) {
      console.warn('Erro ao carregar peças da OS:', err);
    }
  }

  async function abrirCatalogoPecas() {
    setModalPeca(true);
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
      const res = await fetch('/api/pecas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPecasCatalogo(data);
      }
    } catch (err) {
      console.error('Erro ao abrir catálogo de peças:', err);
    }
  }

  // Estados Vanguard V2: Local-First IndexedDB Outbox, Taxonomia ISO 14224 & BOM Direta
  const [pendentesSync, setPendentesSync] = useState([]);
  const [conflitosSync, setConflitosSync] = useState([]);
  const [sincronizandoOffline, setSincronizandoOffline] = useState(false);
  const [taxonomiaIso, setTaxonomiaIso] = useState({ modos_falha: [], acoes_corretivas: [] });
  const [subsistemaIso, setSubsistemaIso] = useState('mecanico');
  const [modoFalhaId, setModoFalhaId] = useState('');
  const [causaRaizId, setCausaRaizId] = useState('');
  const [acaoCorretivaId, setAcaoCorretivaId] = useState('');
  const [modalidadePeca, setModalidadePeca] = useState('BAIXA_DIRETA');
  const [pecasBomAtivo, setPecasBomAtivo] = useState([]);

  async function atualizarEstadoOutbox() {
    const [p, c] = await Promise.all([
      vanguardOfflineDB.listarEventosPendentes(),
      vanguardOfflineDB.listarConflitos()
    ]);
    setPendentesSync(p);
    setConflitosSync(c);
  }

  async function dispararSincronizacaoOffline() {
    const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
    if (!token || !navigator.onLine) return;
    setSincronizandoOffline(true);
    try {
      const resumo = await vanguardOfflineDB.sincronizarComServidor(token);
      await atualizarEstadoOutbox();
      if (resumo.aplicados > 0) {
        carregarChamados();
      }
    } catch (err) {
      console.warn('[Field Sync] Erro ao reconciliar fila:', err.message);
    } finally {
      setSincronizandoOffline(false);
    }
  }

  async function carregarTaxonomiaIso() {
    try {
      const res = await fetch('/api/v2/taxonomia');
      if (res.ok) {
        const data = await res.json();
        setTaxonomiaIso(data);
        localStorage.setItem('vanguard_iso_taxonomia_cache', JSON.stringify(data));
        return;
      }
    } catch {
      // Fallback cache local
    }
    try {
      const cached = localStorage.getItem('vanguard_iso_taxonomia_cache');
      if (cached) setTaxonomiaIso(JSON.parse(cached));
    } catch {}
  }

  async function abrirCatalogoBomV2() {
    setModalPeca(true);
    setPecaSelecionada(null);
    setQtdPeca(1);
    setModalidadePeca('BAIXA_DIRETA');
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
      if (osAtiva?.ativo_id) {
        const subParam = osAtiva.subsistema ? `?subsistema=${encodeURIComponent(osAtiva.subsistema)}` : '';
        const resBom = await fetch(`/api/v2/ativos/${osAtiva.ativo_id}/bom${subParam}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resBom.ok) {
          const dataBom = await resBom.json();
          const unificado = [
            ...(dataBom.bom_pecas || []),
            ...(dataBom.catalogo_adicional || [])
          ];
          setPecasBomAtivo(unificado);
          setPecasCatalogo(unificado);
          return;
        }
      }
      const res = await fetch('/api/pecas', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPecasCatalogo(data);
        setPecasBomAtivo(data);
      }
    } catch (err) {
      console.error('Erro ao abrir BOM de sobressalentes:', err);
    }
  }

  useEffect(() => {
    carregarTaxonomiaIso();
    atualizarEstadoOutbox();
    dispararSincronizacaoOffline();

    const onOnline = () => dispararSincronizacaoOffline();
    const onOutboxChanged = () => atualizarEstadoOutbox();
    const onSwMessage = (event) => {
      if (event.data?.type === 'TRIGGER_OUTBOX_SYNC') dispararSincronizacaoOffline();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('vanguard-outbox-changed', onOutboxChanged);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('vanguard-outbox-changed', onOutboxChanged);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
    };
  }, [tokenAuth]);

  useEffect(() => {
    if (chamados && chamados.length > 0) {
      vanguardOfflineDB.salvarSnapshotOS(chamados);
    }
  }, [chamados]);

  useEffect(() => {
    if (osAtiva?.subsistema) {
      setSubsistemaIso(osAtiva.subsistema);
    }
  }, [osAtiva]);

  // AÇÃO 1: Mantenedor assume a OS para si mesmo ($T_1$)
  async function handleAutoAtribuir(chamadoItem) {
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
      const res = await fetch(`/api/chamados/${chamadoItem.id}/atribuir`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mantenedor_id: tecnicoAtual?.id })
      });
      if (!res.ok) throw new Error('Falha ao assumir OS');
      const data = await res.json();
      setOsAtiva(data.chamado);
      carregarChamados();
    } catch (err) {
      alert(err.message || 'Erro ao assumir chamado');
    }
  }

  // AÇÃO 2: Mantenedor chega no posto e inicia o reparo ($T_2$) com fallback Local-First IndexedDB
  async function handleIniciarReparo() {
    if (!osAtiva) return;
    const clientIso = new Date().toISOString();
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
      if (!navigator.onLine) throw new TypeError('offline');
      const res = await fetch(`/api/chamados/${osAtiva.id}/iniciar-reparo`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao registrar início do reparo');
      const data = await res.json();
      setOsAtiva(data.chamado);
      carregarChamados();
    } catch (err) {
      if (err instanceof TypeError || !navigator.onLine) {
        await vanguardOfflineDB.enfileirarEventoOffline({
          event_type: 'T2_INICIAR_REPARO',
          chamado_id: osAtiva.id,
          occurred_at_client_utc: clientIso,
          payload: { mantenedor_id: tecnicoAtual?.id }
        });
        const otimista = { ...osAtiva, status: 'em_reparo', t2_inicio_reparo: clientIso };
        setOsAtiva(otimista);
        setChamados((prev) => prev.map((c) => (c.id === osAtiva.id ? otimista : c)));
        await atualizarEstadoOutbox();
        return;
      }
      alert(err.message || 'Erro ao iniciar reparo');
    }
  }

  // AÇÃO 3: Registrar Pausa Operacional (Congela MTTR) com fallback Local-First IndexedDB
  async function handleConfirmarPausa() {
    if (!osAtiva) return;
    setSubmetendo(true);
    const clientIso = new Date().toISOString();
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
      if (!navigator.onLine) throw new TypeError('offline');
      const res = await fetch(`/api/chamados/${osAtiva.id}/pausar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          motivo: motivoPausa,
          justificativa: justificativaPausa
        })
      });
      if (!res.ok) throw new Error('Falha ao registrar pausa');
      const data = await res.json();
      setOsAtiva(data.chamado);
      setModalPausa(false);
      carregarChamados();
    } catch (err) {
      if (err instanceof TypeError || !navigator.onLine) {
        await vanguardOfflineDB.enfileirarEventoOffline({
          event_type: 'PAUSAR_OS',
          chamado_id: osAtiva.id,
          occurred_at_client_utc: clientIso,
          payload: { motivo: motivoPausa, justificativa: justificativaPausa }
        });
        const otimista = { ...osAtiva, status: 'pausado_peca' };
        setOsAtiva(otimista);
        setChamados((prev) => prev.map((c) => (c.id === osAtiva.id ? otimista : c)));
        setModalPausa(false);
        await atualizarEstadoOutbox();
        return;
      }
      alert(err.message || 'Erro ao pausar atendimento');
    } finally {
      setSubmetendo(false);
    }
  }

  // AÇÃO 4: Retomar Trabalho após Pausa com fallback Local-First IndexedDB
  async function handleRetomarTrabalho() {
    if (!osAtiva) return;
    const clientIso = new Date().toISOString();
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
      if (!navigator.onLine) throw new TypeError('offline');
      const res = await fetch(`/api/chamados/${osAtiva.id}/retomar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao retomar trabalho');
      const data = await res.json();
      setOsAtiva(data.chamado);
      carregarChamados();
    } catch (err) {
      if (err instanceof TypeError || !navigator.onLine) {
        await vanguardOfflineDB.enfileirarEventoOffline({
          event_type: 'RETOMAR_OS',
          chamado_id: osAtiva.id,
          occurred_at_client_utc: clientIso,
          payload: {}
        });
        const otimista = { ...osAtiva, status: 'em_reparo' };
        setOsAtiva(otimista);
        setChamados((prev) => prev.map((c) => (c.id === osAtiva.id ? otimista : c)));
        await atualizarEstadoOutbox();
        return;
      }
      alert(err.message || 'Erro ao retomar trabalho');
    }
  }

  // AÇÃO 5: Movimentar Peça sobressalente (Baixa Direta Atomica ou Reserva Pendente)
  async function handleSolicitarPeca() {
    if (!osAtiva || !pecaSelecionada) return;
    setSubmetendo(true);
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
      if (!navigator.onLine) throw new TypeError('offline');
      const endpoint =
        modalidadePeca === 'BAIXA_DIRETA'
          ? `/api/v2/chamados/${osAtiva.id}/pecas/baixa-direta`
          : `/api/chamados/${osAtiva.id}/pecas`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          peca_id: pecaSelecionada.id,
          quantidade: qtdPeca,
          modalidade: modalidadePeca
        })
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.erro || 'Falha ao apontar peça');
      }
      setModalPeca(false);
      setPecaSelecionada(null);
      setQtdPeca(1);
      carregarPecasOS(osAtiva.id);
    } catch (err) {
      if (err instanceof TypeError || !navigator.onLine) {
        await vanguardOfflineDB.enfileirarEventoOffline({
          event_type: 'APONTAR_PECA',
          chamado_id: osAtiva.id,
          payload: { peca_id: pecaSelecionada.id, quantidade: qtdPeca, modalidade: modalidadePeca }
        });
        setModalPeca(false);
        setPecaSelecionada(null);
        await atualizarEstadoOutbox();
        return;
      }
      alert(err.message || 'Erro ao movimentar peça');
    } finally {
      setSubmetendo(false);
    }
  }

  // AÇÃO 6: Concluir Reparo Técnico ISO 14224 ($T_3$) com Queue Offline
  async function handleConfirmarConclusao() {
    if (!osAtiva) return;
    const usaIso = Boolean(modoFalhaId && causaRaizId && acaoCorretivaId);
    if (!usaIso && (!causaRaiz.trim() || !acaoExecutada.trim())) {
      alert('Selecione Modo de Falha, Causa Raiz e Ação Corretiva ISO 14224.');
      return;
    }

    setSubmetendo(true);
    const clientIso = new Date().toISOString();
    const payloadConclusao = usaIso
      ? {
          modo_falha_id: Number(modoFalhaId),
          causa_raiz_id: Number(causaRaizId),
          acao_corretiva_id: Number(acaoCorretivaId),
          necessita_revisao_preventiva: revisaoPreventiva,
          observacoes_tecnicas: observacoes.trim()
        }
      : {
          causa_raiz: causaRaiz.trim(),
          acao_executada: acaoExecutada.trim(),
          arvore_falha_sistema: arvoreFalha,
          necessita_revisao_preventiva: revisaoPreventiva,
          observacoes_tecnicas: observacoes.trim()
        };

    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_tecnico');
      if (!navigator.onLine) throw new TypeError('offline');

      const res = await fetch(`/api/chamados/${osAtiva.id}/concluir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payloadConclusao)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.erro || 'Falha ao concluir ordem de serviço');
      }
      const data = await res.json();
      setResultadoConclusao(data);
      carregarChamados();
    } catch (err) {
      if (err instanceof TypeError || !navigator.onLine) {
        await vanguardOfflineDB.enfileirarEventoOffline({
          event_type: 'T3_CONCLUIR_OS',
          chamado_id: osAtiva.id,
          occurred_at_client_utc: clientIso,
          payload: payloadConclusao
        });
        setModalConcluir(false);
        setOsAtiva(null);
        setChamados((prev) =>
          prev.map((c) => (c.id === osAtiva.id ? { ...c, status: 'concluido' } : c))
        );
        await atualizarEstadoOutbox();
        alert('Sem sinal na fábrica: T3 salvo no IndexedDB e será sincronizado assim que reconectar.');
        return;
      }
      alert(err.message || 'Erro ao concluir ordem de serviço');
    } finally {
      setSubmetendo(false);
    }
  }

  // Filtros de OSs para o técnico
  const meusChamados = chamados.filter(
    (c) => c.mantenedor_id === tecnicoAtual?.id && c.status !== 'concluido'
  );
  const chamadosDisponiveis = chamados.filter((c) => c.status === 'aberto');

  // Cálculo do cronômetro da OS ativa em segundos
  let segundosAtendimento = 0;
  if (osAtiva?.t2_inicio_reparo) {
    const t2Ms = new Date(osAtiva.t2_inicio_reparo).getTime();
    segundosAtendimento = Math.max(0, Math.floor((relogio - t2Ms) / 1000));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-2xl mx-auto p-4 sm:p-5">
      {/* Topo / Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 -ml-1.5 text-slate-400 hover:text-white rounded-[2px] hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm tracking-wide uppercase text-white">
                  Terminal do Mantenedor
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Campo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <User className="w-3 h-3 text-indigo-400" />
                <span>{tecnicoAtual?.nome || 'Rodrigo Silva'}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-slate-400">{tecnicoAtual?.matricula || 'RE-3088'}</span>
              </p>
            </div>
          </div>
          <NetworkStatusBadge />
        </div>

        {/* BANNER LOCAL-FIRST INDEXEDDB: OUTBOX PENDENTE & CONFLITOS DE REATRIBUICAO */}
        {(pendentesSync.length > 0 || conflitosSync.length > 0) && (
          <div className="mt-3 space-y-2">
            {pendentesSync.length > 0 && (
              <div className="bg-amber-500/15 border border-amber-500/40 rounded-[2px] p-2.5 px-3 flex items-center justify-between text-xs">
                <div className="text-amber-200 font-semibold">
                  Fila Offline Local-First (IndexedDB): {pendentesSync.length} evento(s) aguardando sincronização
                </div>
                <button
                  type="button"
                  disabled={sincronizandoOffline}
                  onClick={dispararSincronizacaoOffline}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-[2px] text-[11px]"
                >
                  {sincronizandoOffline ? 'Sincronizando...' : 'Sincronizar Agora'}
                </button>
              </div>
            )}

            {conflitosSync.map((conf) => (
              <div
                key={conf.event_id}
                className="bg-rose-500/15 border border-rose-500/40 rounded-[2px] p-2.5 px-3 flex items-start justify-between gap-2 text-xs"
              >
                <div className="text-rose-200">
                  <span className="font-bold block">Conflito de Sincronização (OS #{conf.chamado_id})</span>
                  <span className="text-[11px] text-rose-300/90">
                    {conf.motivo_conflito || 'OS modificada/reatribuida na Central enquanto voce estava offline. Notas preservadas em Adendos.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await vanguardOfflineDB.removerEventoOutbox(conf.event_id);
                    atualizarEstadoOutbox();
                  }}
                  className="text-rose-300 hover:text-white text-[11px] font-bold shrink-0"
                >
                  Ciente
                </button>
              </div>
            ))}
          </div>
        )}

        {/* MODO 1: COCKPIT DE ATENDIMENTO ATIVO (SELECIONADO) */}
        {osAtiva ? (
          <div className="pt-4 space-y-4">
            {/* Banner de Voltar à Fila */}
            <div className="flex justify-between items-center bg-slate-900 px-3.5 py-2 rounded-[2px] border border-slate-800 text-xs">
              <span className="text-slate-400 font-mono font-bold text-indigo-400">
                {osAtiva.numero_os}
              </span>
              <button
                onClick={() => setOsAtiva(null)}
                className="text-slate-400 hover:text-white font-medium flex items-center gap-1 text-[11px]"
              >
                <span>Voltar à lista de chamados</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Cartão Central do Maquinário */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 space-y-3 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xl text-white tracking-wider">
                      {osAtiva.tag_patrimonio}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        osAtiva.ativo_criticidade === 'A'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      }`}
                    >
                      Crit. {osAtiva.ativo_criticidade}
                    </span>
                  </div>
                  <h2 className="text-xs font-semibold text-slate-300 mt-0.5">
                    {osAtiva.ativo_nome}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {osAtiva.linha_nome} • {osAtiva.posto_trabalho}
                  </p>
                </div>

                {/* Status Badge */}
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    osAtiva.status === 'em_reparo'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                      : osAtiva.status === 'pausado_peca'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {osAtiva.status === 'em_reparo'
                    ? 'Em Reparo ($T_2$)'
                    : osAtiva.status === 'pausado_peca'
                    ? 'Pausado (Peça)'
                    : 'Atribuído ($T_1$)'}
                </span>
              </div>

              {/* Sintoma Reportado pelo Operador */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-[2px] p-3 text-xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                  Problema Reportado pelo Operador:
                </span>
                <p className="text-slate-200 font-medium mt-1">
                  {osAtiva.descricao_sintoma || osAtiva.sintoma_descricao || 'Sem descrição'}
                </p>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Reportado por: {osAtiva.operador_nome} • $T_0$: {new Date(osAtiva.t0_abertura).toLocaleTimeString()}
                </span>
              </div>

              {/* CRONÔMETRO DE INTERVENÇÃO TÉCNICA ($T_2$) */}
              {osAtiva.status === 'em_reparo' && (
                <div className="bg-gradient-to-r from-amber-950/40 via-slate-950 to-slate-950 border border-amber-500/30 rounded-[2px] p-3 text-center space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold flex items-center justify-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    Cronômetro de Reparo Líquido Ativo ($T_2$)
                  </span>
                  <div className="text-3xl font-black font-mono text-white tracking-wider">
                    {formatarTempoCronometro(segundosAtendimento)}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    O tempo de pausas justificadas não conta no cálculo do MTTR líquido.
                  </p>
                </div>
              )}

              {/* ALERTA DE PAUSA ATIVA */}
              {osAtiva.status === 'pausado_peca' && (
                <div className="bg-purple-950/40 border border-purple-500/30 rounded-[2px] p-3 text-xs text-purple-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-purple-200">
                    <Pause className="w-4 h-4 text-purple-400" />
                    <span>Atendimento Pausado (MTTR Congelado)</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    O cronômetro técnico está temporariamente suspenso para que a espera por peça ou turno não infle seu indicador de eficiência.
                  </p>
                  <button
                    onClick={handleRetomarTrabalho}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-[2px] text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Retomar Trabalho Agora</span>
                  </button>
                </div>
              )}
            </div>

            {/* SEÇÃO: PEÇAS REQUISITADAS NA OS */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider">
                    Peças da OS ({pecasDaOS.length})
                  </h3>
                </div>
                <button
                  onClick={abrirCatalogoPecas}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-[2px] flex items-center gap-1 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Requisitar Peça</span>
                </button>
              </div>

              {pecasDaOS.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">
                  Nenhuma peça sobressalente requisitada até o momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {pecasDaOS.map((p) => (
                    <div
                      key={p.id}
                      className="bg-slate-950 p-2.5 rounded-[2px] border border-slate-800 flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-mono text-white font-bold">{p.codigo_sap}</span>
                        <p className="text-slate-300 text-[11px]">{p.descricao}</p>
                        <span className="text-[10px] text-slate-500">Loc: {p.localizacao_almoxarifado}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          p.status_movimentacao === 'baixado_almoxarifado'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {p.quantidade} {p.unidade_medida || 'UN'} • {p.status_movimentacao}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BOTÕES DE CONTROLE DA OPERAÇÃO DE CAMPO */}
            <div className="space-y-2 pt-2">
              {osAtiva.status === 'atribuido' && (
                <button
                  onClick={handleIniciarReparo}
                  className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-[2px] text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-600/30 active:scale-98 transition-all"
                >
                  <Wrench className="w-5 h-5" />
                  <span>Cheguei no Posto / Iniciar Reparo ($T_2$)</span>
                </button>
              )}

              {osAtiva.status === 'em_reparo' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setModalPausa(true)}
                      className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-[2px] text-xs flex items-center justify-center gap-1.5 border border-slate-700 active:scale-98 transition-all"
                    >
                      <Pause className="w-4 h-4 text-purple-400" />
                      <span>Pausar Atendimento</span>
                    </button>
                    <button
                      onClick={abrirCatalogoBomV2}
                      className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-[2px] text-xs flex items-center justify-center gap-1.5 border border-slate-700 active:scale-98 transition-all"
                    >
                      <Boxes className="w-4 h-4 text-amber-400" />
                      <span>BOM / Peças</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setModalConcluir(true)}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold rounded-[2px] text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 active:scale-98 transition-all"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Concluir Reparo e Liberar Máquina ($T_3$)</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* MODO 2: FILA DE CHAMADOS DO MANTENEDOR */
          <div className="pt-4 space-y-5">
            {/* Seção 1: Minhas Ordens de Serviço em Aberto */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-indigo-400" />
                  Minhas Ordens Atribuídas ({meusChamados.length})
                </h2>
                <span className="text-[11px] text-slate-500">Toque para atender</span>
              </div>

              {meusChamados.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-[2px] p-4 text-center text-xs text-slate-500">
                  Você não possui nenhuma OS em andamento no momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {meusChamados.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setOsAtiva(item);
                        carregarPecasOS(item.id);
                      }}
                      className="bg-slate-900 border border-slate-800 hover:border-indigo-500 p-3.5 rounded-[2px] cursor-pointer transition-all active:scale-98 shadow-md"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-xs font-bold text-indigo-400">
                            {item.numero_os}
                          </span>
                          <h3 className="font-mono text-base font-black text-white mt-0.5">
                            {item.tag_patrimonio}
                          </h3>
                          <p className="text-xs text-slate-300">{item.ativo_nome}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.linha_nome} • {item.posto_trabalho}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            item.status === 'em_reparo'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Seção 2: Chamados Disponíveis na Fábrica (Auto-atribuição) */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  Chamados Sem Técnico na Planta ({chamadosDisponiveis.length})
                </h2>
                <span className="text-[11px] text-slate-500">Auto-atribuição</span>
              </div>

              {chamadosDisponiveis.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-[2px] p-4 text-center text-xs text-slate-500">
                  Nenhum chamado pendente sem técnico no chão de fábrica.
                </div>
              ) : (
                <div className="space-y-2">
                  {chamadosDisponiveis.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900 border border-rose-500/30 p-3.5 rounded-[2px] flex justify-between items-center shadow-md"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-rose-400">
                            {item.numero_os}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                            Crit. {item.ativo_criticidade}
                          </span>
                        </div>
                        <h3 className="font-mono text-sm font-bold text-white mt-0.5">
                          {item.tag_patrimonio} • {item.linha_nome}
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                          {item.descricao_sintoma || item.sintoma_descricao}
                        </p>
                      </div>

                      <button
                        onClick={() => handleAutoAtribuir(item)}
                        className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-[2px] shadow-md shrink-0 ml-2 active:scale-95 transition-all"
                      >
                        Assumir ($T_1$)
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: REQUISITAR PEÇA SOBRESSALENTE (RESERVA PENDENTE) */}
      {modalPeca && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2px] max-w-md w-full p-4 space-y-3.5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-amber-400" />
                Catálogo de Sobressalentes
              </h3>
              <button onClick={() => setModalPeca(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Busca rápida de peça */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={buscaPeca}
                onChange={(e) => setBuscaPeca(e.target.value)}
                placeholder="Buscar por código SAP ou descrição..."
                className="w-full bg-slate-950 border border-slate-700 rounded-[2px] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Lista de Peças */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {pecasCatalogo
                .filter((p) => {
                  const termo = buscaPeca.toLowerCase();
                  return p.descricao.toLowerCase().includes(termo) || p.codigo_sap.toLowerCase().includes(termo);
                })
                .map((p) => {
                  const isSelected = pecaSelecionada?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setPecaSelecionada(p)}
                      className={`p-2.5 rounded-[2px] border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-white">{p.codigo_sap}</span>
                          {p.pertence_bom && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                              BOM {p.criticidade_reposicao || 'ATIVO'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-emerald-300 font-mono shrink-0">
                          Livre: {p.saldo_livre !== undefined ? p.saldo_livre : p.quantidade_estoque} {p.unidade_medida}
                        </span>
                      </div>
                      <p className="text-slate-300 mt-1 font-medium">{p.descricao}</p>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        {p.localizacao_almoxarifado} • Físico: {p.quantidade_estoque}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Quantidade, Modalidade (Baixa Direta vs Reserva) e Botão */}
            {pecaSelecionada && (
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setModalidadePeca('BAIXA_DIRETA')}
                    className={`py-2 px-2 rounded-[2px] font-bold border ${
                      modalidadePeca === 'BAIXA_DIRETA'
                        ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Baixa Direta em Campo
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalidadePeca('RESERVA_PENDENTE')}
                    className={`py-2 px-2 rounded-[2px] font-bold border ${
                      modalidadePeca === 'RESERVA_PENDENTE'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Reserva Almoxarifado
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Quantidade:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQtdPeca(Math.max(1, qtdPeca - 1))}
                      className="w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded font-bold text-white"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-white w-6 text-center">{qtdPeca}</span>
                    <button
                      type="button"
                      onClick={() => setQtdPeca(qtdPeca + 1)}
                      className="w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded font-bold text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submetendo || qtdPeca > (pecaSelecionada.saldo_livre ?? pecaSelecionada.quantidade_estoque)}
                  onClick={handleSolicitarPeca}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-[2px] text-xs shadow-lg active:scale-98 transition-all"
                >
                  {submetendo
                    ? 'Processando...'
                    : modalidadePeca === 'BAIXA_DIRETA'
                      ? 'Confirmar Baixa Direta na OS'
                      : 'Vincular Peça (Reserva Pendente)'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: PAUSAR ATENDIMENTO (CONGELA MTTR LÍQUIDO) */}
      {modalPausa && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2px] max-w-md w-full p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <Pause className="w-4 h-4 text-purple-400" />
                Registrar Pausa Operacional
              </h3>
              <button onClick={() => setModalPausa(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="text-slate-300 font-semibold block">Motivo da Interrupção:</label>
              <select
                value={motivoPausa}
                onChange={(e) => setMotivoPausa(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-[2px] p-2.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="aguardando_peca">Aguardando Peça no Almoxarifado</option>
                <option value="apoio_especialista">Aguardando Apoio de Especialista</option>
                <option value="seguranca_loto">Procedimento de Bloqueio / LOTO</option>
                <option value="troca_turno">Passagem de Turno Operacional</option>
                <option value="teste_operacional">Teste Operacional da Produção</option>
              </select>

              <label className="text-slate-300 font-semibold block pt-1">Justificativa (Opcional):</label>
              <textarea
                rows={2}
                value={justificativaPausa}
                onChange={(e) => setJustificativaPausa(e.target.value)}
                placeholder="Ex: Aguardando almoxarife liberar válvula sobressalente..."
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-[2px] p-2.5 text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalPausa(false)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-[2px] text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submetendo}
                onClick={handleConfirmarPausa}
                className="w-1/2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-[2px] text-xs shadow-lg"
              >
                {submetendo ? 'Pausando...' : 'Confirmar Pausa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONCLUIR REPARO ($T_3$) COM ÁRVORE DE FALHAS */}
      {modalConcluir && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2px] max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-2.5">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  Encerramento Técnico ($T_3$)
                </span>
                <h3 className="font-black text-base text-white">
                  Liberar Máquina {osAtiva?.tag_patrimonio}
                </h3>
              </div>
              <button onClick={() => setModalConcluir(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {resultadoConclusao ? (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-lg font-bold text-white">Reparo Concluído com Sucesso!</h4>
                <div className="bg-slate-950 p-4 rounded-[2px] border border-slate-800 text-xs text-left space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tempo de Reparo Líquido (MTTR):</span>
                    <span className="text-emerald-400 font-bold">
                      {resultadoConclusao.metricas?.tempo_reparo_liquido_minutos} min
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tempo Total de Máquina Parada:</span>
                    <span className="text-white font-bold">
                      {resultadoConclusao.metricas?.tempo_downtime_total_minutos} min
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tempo em Pausas Descontado:</span>
                    <span className="text-purple-300 font-bold">
                      {resultadoConclusao.metricas?.soma_pausas_minutos} min
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalConcluir(false);
                    setResultadoConclusao(null);
                    setOsAtiva(null);
                    carregarChamados();
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-[2px] text-xs"
                >
                  Retornar à Lista de Chamados
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-[2px] p-2.5 text-[11px] text-indigo-200">
                  Encerramento Estruturado ISO 14224: selecione em cascata sem digitação livre obrigatória.
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    1. Subsistema Afetado (ISO 14224):
                  </label>
                  <select
                    value={subsistemaIso}
                    onChange={(e) => {
                      setSubsistemaIso(e.target.value);
                      setModoFalhaId('');
                      setCausaRaizId('');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-[2px] p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="mecanico">Mecânico</option>
                    <option value="eletrico">Elétrico / Automação</option>
                    <option value="pneumatico">Pneumático</option>
                    <option value="hidraulico">Hidráulico</option>
                    <option value="operacional">Operacional / Setup</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    2. Modo de Falha (ISO 14224):
                  </label>
                  <select
                    value={modoFalhaId}
                    onChange={(e) => {
                      setModoFalhaId(e.target.value);
                      setCausaRaizId('');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-[2px] p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Selecione o Modo de Falha --</option>
                    {(taxonomiaIso.modos_falha || [])
                      .filter((m) => m.subsistema === subsistemaIso)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          [{m.codigo_iso}] {m.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    3. Causa Raiz Identificada:
                  </label>
                  <select
                    value={causaRaizId}
                    disabled={!modoFalhaId}
                    onChange={(e) => setCausaRaizId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-[2px] p-2.5 text-xs disabled:opacity-50 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Selecione a Causa Raiz --</option>
                    {(
                      (taxonomiaIso.modos_falha || []).find((m) => String(m.id) === String(modoFalhaId))
                        ?.causas_raiz || []
                    ).map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.codigo_iso}] {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    4. Ação Corretiva Executada:
                  </label>
                  <select
                    value={acaoCorretivaId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAcaoCorretivaId(val);
                      const acao = (taxonomiaIso.acoes_corretivas || []).find(
                        (a) => String(a.id) === String(val)
                      );
                      if (acao?.gera_pendencia_preventiva) {
                        setRevisaoPreventiva(true);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-[2px] p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Selecione a Ação Corretiva --</option>
                    {(taxonomiaIso.acoes_corretivas || []).map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.codigo_iso}] {a.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Observações Complementares (Opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Notas opcionais sobre ajuste ou medição em campo..."
                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-[2px] p-2.5 text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="revPrev"
                    checked={revisaoPreventiva}
                    onChange={(e) => setRevisaoPreventiva(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-950 border-slate-700"
                  />
                  <label htmlFor="revPrev" className="text-slate-300 font-medium">
                    Sinalizar necessidade de revisão do plano de preventiva
                  </label>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalConcluir(false)}
                    className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-[2px] text-xs"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={submetendo}
                    onClick={handleConfirmarConclusao}
                    className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-[2px] text-xs shadow-lg shadow-emerald-600/30"
                  >
                    {submetendo ? 'Gravando T3...' : 'Confirmar e Liberar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rodapé institucional */}
      <div className="border-t border-slate-900 pt-3 text-center text-[10px] text-slate-500">
        CMMS FAETERJ • Terminal Mobile do Mantenedor em Campo • Métricas $T_1$, $T_2$ e $T_3$
      </div>
    </div>
  );
}
