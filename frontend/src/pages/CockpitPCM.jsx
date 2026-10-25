import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Clock,
  Wrench,
  CheckCircle2,
  Volume2,
  VolumeX,
  Filter,
  UserCheck,
  PauseCircle,
  PlayCircle,
  ArrowLeft,
  ChevronRight,
  Boxes,
  X,
  ShieldAlert,
  Search,
  RefreshCw,
  Eye
} from 'lucide-react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { soundAlert } from '../services/soundAlert';
import NetworkStatusBadge from '../components/NetworkStatusBadge';
import VanguardLogo from '../components/VanguardLogo';

// Formatador de segundos para HH:MM:SS
function formatarTempoDowntime(segundosTotais) {
  const h = Math.floor(segundosTotais / 3600);
  const m = Math.floor((segundosTotais % 3600) / 60);
  const s = segundosTotais % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CockpitPCM() {
  const navigate = useNavigate();

  // Estados dos chamados e filtros
  const [chamados, setChamados] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linhaSelecionada, setLinhaSelecionada] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('ativos'); // 'ativos', 'todos', 'aberto', 'em_reparo', 'concluido'
  const [busca, setBusca] = useState('');

  // Controle de áudio
  const [somAtivo, setSomAtivo] = useState(soundAlert.isHabilitado());
  const [novoAlerta, setNovoAlerta] = useState(null);

  // Modais de ação rápida
  const [modalAtribuir, setModalAtribuir] = useState(null); // chamado selecionado
  const [tecnicoAtribuirId, setTecnicoAtribuirId] = useState('');
  const [modalDossie, setModalDossie] = useState(null); // chamado completo
  const [loadingDossie, setLoadingDossie] = useState(false);
  const [submetendoAcao, setSubmetendoAcao] = useState(false);

  // Simulação de usuário autenticado (PCM Gestor padrão com token)
  const [tokenAuth, setTokenAuth] = useState(localStorage.getItem('cmms_auth_token') || '');
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  // Cronômetro em tempo real para contagem progressiva de segundos
  const [relogio, setRelogio] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setRelogio(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Inicialização e autenticação padrão automática como PCM para demonstração
  useEffect(() => {
    inicializarSessao();
    carregarDados();

    // Conexão e ouvintes do barramento WebSocket
    const socket = getSocket();
    socket.emit('entrar_sala', 'cockpit_pcm');

    socket.on('novo_chamado', (data) => {
      soundAlert.tocarAlarmeEmergencia();
      setNovoAlerta({
        mensagem: data.mensagem,
        tag: data.chamado?.tag_patrimonio,
        numero_os: data.chamado?.numero_os,
        prioridade: data.chamado?.prioridade
      });
      setTimeout(() => setNovoAlerta(null), 8000);
      setChamados((prev) => [data.chamado, ...prev.filter((c) => c.id !== data.chamado.id)]);
    });

    socket.on('status_alterado', (data) => {
      setChamados((prev) =>
        prev.map((c) => (c.id === data.chamado.id ? { ...c, ...data.chamado } : c))
      );
    });

    socket.on('os_concluida', (data) => {
      setChamados((prev) =>
        prev.map((c) => (c.id === data.chamado.id ? { ...c, ...data.chamado } : c))
      );
    });

    return () => {
      socket.off('novo_chamado');
      socket.off('status_alterado');
      socket.off('os_concluida');
    };
  }, []);

  async function inicializarSessao() {
    try {
      // Se não tiver token, faz login automático com RE-1042 (PCM Gestor)
      let token = tokenAuth;
      if (!token) {
        const loginRes = await api.post('/auth/login', {
          matricula: 'RE-1042',
          senha: 'cmms123'
        });
        token = loginRes.token;
        setTokenAuth(token);
        localStorage.setItem('cmms_auth_token', token);
        setUsuarioAtual(loginRes.usuario);
      }

      // Carrega lista de técnicos para o modal de atribuição
      const usuariosRes = await fetch('/api/auth/usuarios?perfil=manutentor', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (usuariosRes.ok) {
        const data = await usuariosRes.json();
        setTecnicos(data);
        if (data.length > 0) setTecnicoAtribuirId(data[0].id);
      }
    } catch (err) {
      console.warn('Erro na autenticação inicial:', err);
    }
  }

  async function carregarDados() {
    setLoading(true);
    try {
      const [chamadosRes, linhasRes] = await Promise.all([
        api.get('/chamados'),
        api.get('/linhas')
      ]);
      setChamados(chamadosRes);
      setLinhas(linhasRes);
    } catch (err) {
      console.error('Erro ao carregar dados do cockpit:', err);
    } finally {
      setLoading(false);
    }
  }

  // Atribuição de técnico ($T_1$)
  async function handleConfirmarAtribuicao() {
    if (!modalAtribuir || !tecnicoAtribuirId) return;

    setSubmetendoAcao(true);
    try {
      const res = await fetch(`/api/chamados/${modalAtribuir.id}/atribuir`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAuth}`
        },
        body: JSON.stringify({ mantenedor_id: Number(tecnicoAtribuirId) })
      });

      if (!res.ok) throw new Error('Falha ao atribuir mantenedor');

      const data = await res.json();
      setChamados((prev) =>
        prev.map((c) => (c.id === modalAtribuir.id ? data.chamado : c))
      );
      setModalAtribuir(null);
    } catch (err) {
      alert(err.message || 'Erro ao atribuir técnico');
    } finally {
      setSubmetendoAcao(false);
    }
  }

  // Abre dossiê completo da OS
  async function abrirDossieOS(chamadoItem) {
    setModalDossie(chamadoItem);
    setLoadingDossie(true);
    try {
      const dadosCompletos = await api.get(`/chamados/${chamadoItem.id}`);
      setModalDossie(dadosCompletos);
    } catch (err) {
      console.error('Erro ao carregar dossiê:', err);
    } finally {
      setLoadingDossie(false);
    }
  }

  // Filtragem dos chamados
  const chamadosFiltrados = chamados.filter((c) => {
    // Filtro por linha
    if (linhaSelecionada && String(c.linha_id) !== String(linhaSelecionada)) {
      return false;
    }

    // Filtro por status
    if (statusFiltro === 'ativos') {
      if (c.status === 'concluido' || c.status === 'cancelado_invalido') return false;
    } else if (statusFiltro !== 'todos') {
      if (c.status !== statusFiltro) return false;
    }

    // Filtro por busca textual
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      const matchOS = c.numero_os?.toLowerCase().includes(termo);
      const matchTag = c.tag_patrimonio?.toLowerCase().includes(termo);
      const matchAtivo = c.ativo_nome?.toLowerCase().includes(termo);
      const matchOperador = c.operador_nome?.toLowerCase().includes(termo);
      return matchOS || matchTag || matchAtivo || matchOperador;
    }

    return true;
  });

  // KPIs calculados em tempo real
  const totalParadas = chamados.filter(
    (c) => c.status !== 'concluido' && c.status !== 'cancelado_invalido'
  ).length;

  const totalAguardandoAtribuicao = chamados.filter((c) => c.status === 'aberto').length;
  const totalEmAtendimento = chamados.filter(
    (c) => c.status === 'em_reparo' || c.status === 'atribuido'
  ).length;
  const totalConcluidosHoje = chamados.filter((c) => c.status === 'concluido').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Topo / Barra Superior Fixa */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <VanguardLogo variant="horizontal" size="sm" />
            <div className="hidden sm:block border-l border-slate-800 pl-3">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-xs tracking-wide uppercase text-slate-300">
                  Cockpit PCM & Team Leader
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Tempo Real
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Monitoramento Operacional de Linhas e Despacho de Especialistas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Botão de Toggle do Alarme Sonoro */}
            <button
              onClick={() => {
                const novoEstado = soundAlert.toggleSom();
                setSomAtivo(novoEstado);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                somAtivo
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
              }`}
              title={somAtivo ? 'Silenciar alarme sonoro' : 'Ativar alarme sonoro'}
            >
              {somAtivo ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4" />}
              <span>{somAtivo ? 'Alarme Torre Ativo' : 'Mudo'}</span>
            </button>

            <NetworkStatusBadge />

            <button
              onClick={carregarDados}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notificação Flutuante de Novo Chamado (Socket.io) */}
        {novoAlerta && (
          <div className="max-w-7xl mx-auto mt-2 bg-rose-600 border border-rose-400 text-white rounded-xl p-3 shadow-2xl flex items-center justify-between animate-bounce">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-white shrink-0 animate-pulse" />
              <div>
                <p className="font-bold text-sm">NOVA PARADA DE MÁQUINA REPORTADA!</p>
                <p className="text-xs text-rose-100">
                  {novoAlerta.numero_os} • Ativo {novoAlerta.tag} • Prioridade {novoAlerta.prioridade?.toUpperCase()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setNovoAlerta(null)}
              className="p-1 text-rose-200 hover:text-white rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 w-full space-y-6">
        {/* Faixa de KPIs Operacionais (Ergonomia Cognitiva) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Downtime Ativo (Vermelho NBR 7195) */}
          <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Máquinas Paradas
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            </div>
            <div className="text-3xl font-black text-white mt-2 font-mono">
              {totalParadas}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Downtime fabril em andamento</p>
          </div>

          {/* Card 2: Sem Técnico (Âmbar NBR 7195) */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 shadow-lg">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Aguardando Atribuição ($T_0$)
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white mt-2 font-mono">
              {totalAguardandoAtribuicao}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Tempo de resposta correndo</p>
          </div>

          {/* Card 3: Em Atendimento ($T_2$) */}
          <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-4 shadow-lg">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Em Reparo Técnico ($T_2$)
              </span>
              <Wrench className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white mt-2 font-mono">
              {totalEmAtendimento}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Mantenedores no posto</p>
          </div>

          {/* Card 4: Concluídos Hoje (Verde Esmeralda) */}
          <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 shadow-lg">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                OSs Concluídas ($T_3$)
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white mt-2 font-mono">
              {totalConcluidosHoje}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Máquinas liberadas para produção</p>
          </div>
        </div>

        {/* Barra de Filtros e Busca Rápida */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Seletor de Linha */}
            <select
              value={linhaSelecionada}
              onChange={(e) => setLinhaSelecionada(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="">Todas as Linhas da Planta</option>
              {linhas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome} ({l.setor})
                </option>
              ))}
            </select>

            {/* Pílulas de Status */}
            <div className="flex gap-1 overflow-x-auto text-xs">
              {[
                { id: 'ativos', label: 'Paradas Ativas' },
                { id: 'aberto', label: 'Sem Técnico' },
                { id: 'em_reparo', label: 'Em Reparo' },
                { id: 'concluido', label: 'Concluídas' },
                { id: 'todos', label: 'Ver Todas' }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFiltro(s.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    statusFiltro === s.id
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar TAG, OS ou Operador..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Grid de Chamados / Cockpit Visual */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Carregando telemetria fabril...</p>
          </div>
        ) : chamadosFiltrados.length === 0 ? (
          <div className="py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-white mt-3">
              Nenhuma parada de máquina neste filtro
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Todas as linhas operando em regime nominal ou chamados encerrados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chamadosFiltrados.map((item) => {
              // Cálculo de tempo de parada em segundos para o ticker
              const t0Ms = new Date(item.t0_abertura).getTime();
              const fimMs = item.t3_conclusao_reparo
                ? new Date(item.t3_conclusao_reparo).getTime()
                : relogio;
              const segundosDowntime = Math.max(0, Math.floor((fimMs - t0Ms) / 1000));

              const isCritico = item.ativo_criticidade === 'A' || item.prioridade === 'critica';
              const isConcluido = item.status === 'concluido';

              return (
                <div
                  key={item.id}
                  className={`bg-slate-900 rounded-2xl border transition-all p-4 flex flex-col justify-between shadow-xl relative overflow-hidden ${
                    isConcluido
                      ? 'border-emerald-500/30'
                      : isCritico
                      ? 'border-rose-500/50 shadow-rose-950/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Cabeçalho do Card */}
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-400">
                          {item.numero_os}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <h2 className="text-lg font-black text-white font-mono tracking-wider">
                            {item.tag_patrimonio}
                          </h2>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                              item.ativo_criticidade === 'A'
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            }`}
                          >
                            Crit. {item.ativo_criticidade}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium">{item.ativo_nome}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.linha_nome} • {item.posto_trabalho}
                        </p>
                      </div>

                      {/* Ticker de Downtime em Segundos */}
                      <div className="text-right">
                        <div
                          className={`font-mono text-xs font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1.5 ${
                            isConcluido
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatarTempoDowntime(segundosDowntime)}</span>
                        </div>
                        <span className="block text-[9px] text-slate-500 mt-0.5">
                          {isConcluido ? 'Downtime Total' : 'Parada em Curso'}
                        </span>
                      </div>
                    </div>

                    {/* Sintoma Reportado */}
                    <div className="mt-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Sintoma da Anomalia:
                      </span>
                      <p className="text-xs text-slate-200 font-medium mt-0.5 line-clamp-2">
                        {item.descricao_sintoma || item.sintoma_descricao || 'Não detalhado'}
                      </p>
                    </div>

                    {/* Impacto da Máquina (Trigger Flag) */}
                    {item.status_impacto && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider inline-flex items-center gap-1 ${
                            item.status_impacto === 'maquina_parada'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : item.status_impacto === 'operando_com_restricao'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          }`}
                        >
                          {item.status_impacto === 'maquina_parada'
                            ? '🔴 Máquina Parada (Crítico)'
                            : item.status_impacto === 'operando_com_restricao'
                            ? '🟡 Com Restrição / Anomalia'
                            : '🔵 Melhoria / Baixa'}
                        </span>
                      </div>
                    )}

                    {/* Foto da Peça / Evidência */}
                    {item.foto_anexo && (
                      <div className="mt-2 relative group cursor-pointer" onClick={() => abrirDossieOS(item)}>
                        <img
                          src={item.foto_anexo}
                          alt="Evidência do operador"
                          className="w-full h-24 object-cover rounded-xl border border-slate-700/80 group-hover:opacity-90 transition-all"
                        />
                        <span className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-sm text-[9px] text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                          📸 Evidência Anexada
                        </span>
                      </div>
                    )}

                    {/* Áudio de Ruído Mecânico */}
                    {item.audio_anexo && (
                      <div className="mt-2 bg-slate-950/80 border border-slate-800 rounded-xl p-2 flex items-center gap-2">
                        <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <audio src={item.audio_anexo} controls className="h-6 w-full" />
                      </div>
                    )}

                    {/* Operador e Técnico Responsável */}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Op: {item.operador_nome || item.operador_matricula}</span>
                      <span className="font-medium text-slate-300">
                        {item.mantenedor_nome ? (
                          <span className="text-indigo-300">Téc: {item.mantenedor_nome}</span>
                        ) : (
                          <span className="text-amber-400 font-bold">Sem técnico atribuído</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Rodapé e Ações do Card */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    {/* Status Badge */}
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        item.status === 'aberto'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : item.status === 'atribuido'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : item.status === 'em_reparo'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : item.status === 'pausado_peca'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {item.status === 'aberto'
                        ? 'Aberto ($T_0$)'
                        : item.status === 'atribuido'
                        ? 'Atribuído ($T_1$)'
                        : item.status === 'em_reparo'
                        ? 'Em Reparo ($T_2$)'
                        : item.status === 'pausado_peca'
                        ? 'Pausado (Peça)'
                        : 'Liberada ($T_3$)'}
                    </span>

                    {/* Botões de Ação */}
                    <div className="flex gap-1.5">
                      {item.status === 'aberto' && (
                        <button
                          onClick={() => {
                            setModalAtribuir(item);
                            if (tecnicos.length > 0) setTecnicoAtribuirId(tecnicos[0].id);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Atribuir ($T_1$)</span>
                        </button>
                      )}

                      <button
                        onClick={() => abrirDossieOS(item)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                        title="Ver dossiê completo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: ATRIBUIÇÃO DE TÉCNICO ($T_1$) */}
      {modalAtribuir && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Atribuir Técnico à OS ($T_1$)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalAtribuir.numero_os} • {modalAtribuir.tag_patrimonio} ({modalAtribuir.linha_nome})
                </p>
              </div>
              <button
                onClick={() => setModalAtribuir(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300">
                Selecione o mantenedor responsável:
              </label>
              <select
                value={tecnicoAtribuirId}
                onChange={(e) => setTecnicoAtribuirId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-xl p-3 focus:outline-none focus:border-indigo-500"
              >
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.matricula}) • Ramal {t.ramal_telefone || 'N/A'}
                  </option>
                ))}
              </select>

              <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300 space-y-1">
                <p className="font-semibold text-indigo-200">
                  Impacto Operacional de Engenharia:
                </p>
                <p className="text-slate-400">
                  A confirmação registrará o marco temporal <strong>$T_1$ (Tempo de Resposta)</strong> e enviará uma notificação direta no smartphone do técnico.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalAtribuir(null)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submetendoAcao}
                onClick={handleConfirmarAtribuicao}
                className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                {submetendoAcao ? 'Gravando T1...' : 'Confirmar Atribuição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DOSSIÊ COMPLETO DA OS (TIMESTAMPS, PAUSAS E PEÇAS) */}
      {modalDossie && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                  Dossiê de Manutenção Fabril
                </span>
                <h3 className="text-lg font-black text-white">
                  {modalDossie.numero_os} • {modalDossie.tag_patrimonio}
                </h3>
                <p className="text-xs text-slate-400">
                  {modalDossie.linha_nome} • {modalDossie.posto_trabalho}
                </p>
              </div>
              <button
                onClick={() => setModalDossie(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDossie ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Carregando apontamentos técnicos...
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* 1. Timeline dos 4 Marcos de Engenharia (T0 a T3) */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    Cronologia dos 4 Marcos Operacionais ($T_0$ a $T_3$):
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">$T_0$ Abertura</span>
                      <span className="text-slate-200 font-bold">
                        {modalDossie.t0_abertura ? new Date(modalDossie.t0_abertura).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">$T_1$ Atribuição</span>
                      <span className="text-slate-200 font-bold">
                        {modalDossie.t1_atribuicao ? new Date(modalDossie.t1_atribuicao).toLocaleTimeString() : 'Pendente'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">$T_2$ Início Reparo</span>
                      <span className="text-slate-200 font-bold">
                        {modalDossie.t2_inicio_reparo ? new Date(modalDossie.t2_inicio_reparo).toLocaleTimeString() : 'Pendente'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">$T_3$ Conclusão</span>
                      <span className="text-slate-200 font-bold">
                        {modalDossie.t3_conclusao_reparo ? new Date(modalDossie.t3_conclusao_reparo).toLocaleTimeString() : 'Em curso'}
                      </span>
                    </div>
                  </div>

                  {modalDossie.tempo_reparo_liquido_minutos && (
                    <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between font-mono text-emerald-400 font-bold">
                      <span>MTTR Líquido Puro (Intervenção):</span>
                      <span>{modalDossie.tempo_reparo_liquido_minutos} min</span>
                    </div>
                  )}
                </div>

                {/* Evidências Fotográficas e de Áudio do Vanguard Trigger */}
                {(modalDossie.foto_anexo || modalDossie.audio_anexo) && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-emerald-400" />
                      Evidências Registradas pelo Operador (Vanguard Trigger):
                    </h4>
                    {modalDossie.foto_anexo && (
                      <div className="mt-1">
                        <span className="text-[10px] text-slate-400 block mb-1">Foto da Peça / Painel de Alarme:</span>
                        <img
                          src={modalDossie.foto_anexo}
                          alt="Evidência da peça"
                          className="w-full max-h-72 object-contain rounded-xl border border-slate-800 bg-black"
                        />
                      </div>
                    )}
                    {modalDossie.audio_anexo && (
                      <div className="mt-2">
                        <span className="text-[10px] text-slate-400 block mb-1">Gravação de Ruído Anormal:</span>
                        <audio src={modalDossie.audio_anexo} controls className="h-8 w-full" />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Apontamento Técnico de Encerramento */}
                {modalDossie.apontamento ? (
                  <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
                    <h4 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Diagnóstico Técnico & Causa Raiz:
                    </h4>
                    <p className="text-slate-300">
                      <strong className="text-slate-400">Causa Raiz:</strong> {modalDossie.apontamento.causa_raiz}
                    </p>
                    <p className="text-slate-300">
                      <strong className="text-slate-400">Ação Executada:</strong> {modalDossie.apontamento.acao_executada}
                    </p>
                    <div className="flex gap-4 text-slate-400 text-[11px] pt-1">
                      <span>Sistema: <strong className="text-white uppercase">{modalDossie.apontamento.arvore_falha_sistema}</strong></span>
                      <span>Técnico: <strong className="text-white">{modalDossie.apontamento.mantenedor_nome}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-slate-500">
                    Apontamento técnico ainda não registrado (reparo em andamento).
                  </div>
                )}

                {/* 3. Peças Utilizadas */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-amber-400" />
                    Peças Sobressalentes Vinculadas:
                  </h4>
                  {modalDossie.pecas?.length > 0 ? (
                    <div className="space-y-1.5">
                      {modalDossie.pecas.map((p) => (
                        <div key={p.id} className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <div>
                            <span className="font-mono text-white font-bold">{p.codigo_sap}</span>
                            <span className="text-slate-400 ml-2">{p.descricao}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            p.status_movimentacao === 'baixado_almoxarifado'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {p.quantidade} un • {p.status_movimentacao}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500">Nenhuma peça sobressalente requisitada nesta OS.</p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setModalDossie(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
              >
                Fechar Dossiê
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé institucional */}
      <div className="border-t border-slate-900 p-3 text-center text-[10px] text-slate-500">
        CMMS FAETERJ • Cockpit de Manutenção e Linhas • Atualização Contínua via WebSocket (Socket.io)
      </div>
    </div>
  );
}
