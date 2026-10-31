import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
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
  Eye,
  QrCode,
  Plus,
  Printer,
  FileText,
  BarChart3,
  TrendingUp,
  Zap,
  Layers,
  ArrowUpDown,
  History,
  Check,
  Building2,
  ExternalLink
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

  // Aba ativa: 'triagem', 'ativos', 'indicadores'
  const [abaAtiva, setAbaAtiva] = useState('triagem');

  // Estados dos chamados e triagem
  const [chamados, setChamados] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linhaSelecionada, setLinhaSelecionada] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('ativos'); // 'ativos', 'todos', 'aberto', 'atribuido', 'em_reparo', 'pausado_peca', 'concluido'
  const [ordenacao, setOrdenacao] = useState('prioridade'); // 'prioridade' ou 'recentes'
  const [busca, setBusca] = useState('');

  // Estados de Ativos e Árvore de Falhas
  const [ativos, setAtivos] = useState([]);
  const [sintomas, setSintomas] = useState([]);
  const [loadingAtivos, setLoadingAtivos] = useState(false);
  const [buscaAtivo, setBuscaAtivo] = useState('');
  const [filtroCriticidadeAtivo, setFiltroCriticidadeAtivo] = useState('');

  // Modais de Gestão de Ativos
  const [modalNovoAtivo, setModalNovoAtivo] = useState(false);
  const [formAtivo, setFormAtivo] = useState({
    linha_id: '',
    tag_patrimonio: '',
    nome: '',
    posto_trabalho: '',
    criticidade: 'B'
  });
  const [salvandoAtivo, setSalvandoAtivo] = useState(false);

  const [modalNovoSintoma, setModalNovoSintoma] = useState(false);
  const [formSintoma, setFormSintoma] = useState({
    descricao: '',
    categoria: 'mecanica'
  });
  const [salvandoSintoma, setSalvandoSintoma] = useState(false);

  // Modal de Etiqueta Industrial QR Code
  const [modalEtiqueta, setModalEtiqueta] = useState(null);
  const qrCanvasRef = useRef(null);

  // Modal de Prontuário / Histórico do Ativo
  const [modalProntuario, setModalProntuario] = useState(null);
  const [dadosProntuario, setDadosProntuario] = useState(null);
  const [loadingProntuario, setLoadingProntuario] = useState(false);

  // Estados de Indicadores / Métricas do TCC
  const [metricasDashboard, setMetricasDashboard] = useState(null);
  const [periodoDias, setPeriodoDias] = useState(30);
  const [loadingMetricas, setLoadingMetricas] = useState(false);

  // Controle de áudio e alerta sonoro
  const [somAtivo, setSomAtivo] = useState(soundAlert.isHabilitado());
  const [novoAlerta, setNovoAlerta] = useState(null);

  // Modais de ação rápida da Triagem
  const [modalAtribuir, setModalAtribuir] = useState(null); // chamado selecionado para despacho T1
  const [tecnicoAtribuirId, setTecnicoAtribuirId] = useState('');
  const [modalDossie, setModalDossie] = useState(null); // chamado completo com confronto Trigger vs Field
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

  // Atualiza dados conforme aba ativa
  useEffect(() => {
    if (abaAtiva === 'ativos') {
      carregarAtivosESintomas();
    } else if (abaAtiva === 'indicadores') {
      carregarMetricas();
    }
  }, [abaAtiva, periodoDias, linhaSelecionada]);

  // Renderiza QR code no canvas do modal de etiqueta
  useEffect(() => {
    if (modalEtiqueta && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        modalEtiqueta.qr_code_token || modalEtiqueta.tag_patrimonio,
        {
          width: 220,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'H'
        },
        (err) => {
          if (err) console.error('Erro ao renderizar QR code na etiqueta:', err);
        }
      );
    }
  }, [modalEtiqueta]);

  async function inicializarSessao() {
    try {
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

      // Carrega técnicos para atribuição
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
        api.get(`/chamados?ordenar=${ordenacao}`),
        api.get('/linhas')
      ]);
      setChamados(chamadosRes);
      setLinhas(linhasRes);
      if (linhasRes.length > 0 && !formAtivo.linha_id) {
        setFormAtivo((prev) => ({ ...prev, linha_id: linhasRes[0].id }));
      }
    } catch (err) {
      console.error('Erro ao carregar dados da central:', err);
    } finally {
      setLoading(false);
    }
  }

  async function carregarAtivosESintomas() {
    setLoadingAtivos(true);
    try {
      const [ativosRes, sintomasRes] = await Promise.all([
        api.get('/ativos'),
        api.get('/sintomas')
      ]);
      setAtivos(ativosRes);
      setSintomas(sintomasRes);
    } catch (err) {
      console.error('Erro ao carregar ativos e sintomas:', err);
    } finally {
      setLoadingAtivos(false);
    }
  }

  async function carregarMetricas() {
    setLoadingMetricas(true);
    try {
      const params = new URLSearchParams();
      params.append('dias', periodoDias);
      if (linhaSelecionada) params.append('linha_id', linhaSelecionada);

      const res = await fetch(`/api/metricas/dashboard?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${tokenAuth}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMetricasDashboard(data);
      }
    } catch (err) {
      console.error('Erro ao carregar indicadores:', err);
    } finally {
      setLoadingMetricas(false);
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

      if (!res.ok) throw new Error('Falha ao despachar técnico');

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

  // Abre prontuário histórico do ativo
  async function abrirProntuario(ativoItem) {
    setModalProntuario(ativoItem);
    setLoadingProntuario(true);
    try {
      const res = await fetch(`/api/ativos/${ativoItem.id}/prontuario`, {
        headers: { Authorization: `Bearer ${tokenAuth}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDadosProntuario(data);
      }
    } catch (err) {
      console.error('Erro ao abrir prontuário:', err);
    } finally {
      setLoadingProntuario(false);
    }
  }

  // Salvar novo ativo
  async function handleSalvarNovoAtivo(e) {
    e.preventDefault();
    if (!formAtivo.linha_id || !formAtivo.tag_patrimonio || !formAtivo.nome || !formAtivo.posto_trabalho) {
      alert('Por favor preencha todos os campos obrigatórios do ativo.');
      return;
    }

    setSalvandoAtivo(true);
    try {
      const res = await fetch('/api/ativos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAuth}`
        },
        body: JSON.stringify(formAtivo)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Falha ao cadastrar ativo.');

      alert('Ativo cadastrado com sucesso!');
      setModalNovoAtivo(false);
      setFormAtivo({
        linha_id: linhas[0]?.id || '',
        tag_patrimonio: '',
        nome: '',
        posto_trabalho: '',
        criticidade: 'B'
      });
      carregarAtivosESintomas();
    } catch (err) {
      alert(err.message);
    } finally {
      setSalvandoAtivo(false);
    }
  }

  // Salvar novo sintoma na árvore de falhas
  async function handleSalvarNovoSintoma(e) {
    e.preventDefault();
    if (!formSintoma.descricao.trim()) return;

    setSalvandoSintoma(true);
    try {
      const res = await fetch('/api/sintomas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAuth}`
        },
        body: JSON.stringify(formSintoma)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Falha ao cadastrar sintoma.');

      alert('Sintoma cadastrado na árvore de falhas!');
      setModalNovoSintoma(false);
      setFormSintoma({ descricao: '', categoria: 'mecanica' });
      carregarAtivosESintomas();
    } catch (err) {
      alert(err.message);
    } finally {
      setSalvandoSintoma(false);
    }
  }

  // Impressão nativa da etiqueta de QR code
  function handleImprimirEtiqueta() {
    window.print();
  }

  // Filtragem e ordenação dos chamados
  const chamadosFiltrados = chamados
    .filter((c) => {
      if (linhaSelecionada && String(c.linha_id) !== String(linhaSelecionada)) {
        return false;
      }

      if (statusFiltro === 'ativos') {
        if (c.status === 'concluido' || c.status === 'cancelado_invalido') return false;
      } else if (statusFiltro !== 'todos') {
        if (c.status !== statusFiltro) return false;
      }

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchOS = c.numero_os?.toLowerCase().includes(termo);
        const matchTag = c.tag_patrimonio?.toLowerCase().includes(termo);
        const matchAtivo = c.ativo_nome?.toLowerCase().includes(termo);
        const matchOperador = c.operador_nome?.toLowerCase().includes(termo);
        return matchOS || matchTag || matchAtivo || matchOperador;
      }

      return true;
    })
    .sort((a, b) => {
      if (ordenacao === 'prioridade') {
        const aAtivo = a.status !== 'concluido' && a.status !== 'cancelado_invalido';
        const bAtivo = b.status !== 'concluido' && b.status !== 'cancelado_invalido';
        if (aAtivo && !bAtivo) return -1;
        if (!aAtivo && bAtivo) return 1;
        if (aAtivo && bAtivo) {
          return (b.score_prioridade || 0) - (a.score_prioridade || 0);
        }
      }
      return new Date(b.t0_abertura).getTime() - new Date(a.t0_abertura).getTime();
    });

  // Filtragem de ativos
  const ativosFiltrados = ativos.filter((a) => {
    if (filtroCriticidadeAtivo && a.criticidade !== filtroCriticidadeAtivo) return false;
    if (linhaSelecionada && String(a.linha_id) !== String(linhaSelecionada)) return false;
    if (buscaAtivo.trim()) {
      const termo = buscaAtivo.toLowerCase();
      return (
        a.tag_patrimonio?.toLowerCase().includes(termo) ||
        a.nome?.toLowerCase().includes(termo) ||
        a.posto_trabalho?.toLowerCase().includes(termo)
      );
    }
    return true;
  });

  // KPIs calculados em tempo real
  const totalParadas = chamados.filter(
    (c) => c.status !== 'concluido' && c.status !== 'cancelado_invalido'
  ).length;
  const totalAguardandoAtribuicao = chamados.filter((c) => c.status === 'aberto').length;
  const totalEmAtendimento = chamados.filter(
    (c) => c.status === 'em_reparo' || c.status === 'atribuido' || c.status === 'em_deslocamento'
  ).length;
  const totalConcluidosHoje = chamados.filter((c) => c.status === 'concluido').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Topo / Barra Superior Fixa da Vanguard Central */}
      <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 text-slate-400 hover:text-white rounded-[2px] hover:bg-slate-800 transition-colors"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <VanguardLogo variant="horizontal" size="sm" />
            <div className="hidden sm:block border-l border-slate-800 pl-3">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-xs tracking-wider uppercase text-slate-200">
                  Vanguard Central
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  Gestão & Triagem
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Cérebro Operacional: Matriz de Priorização, SLA, Prontuário e Despacho de Especialistas
              </p>
            </div>
          </div>

          {/* Abas de Navegação Principal */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-[2px] border border-slate-800 self-center md:self-auto">
            <button
              onClick={() => setAbaAtiva('triagem')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-bold transition-all ${
                abaAtiva === 'triagem'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Triagem & Fila</span>
              {totalAguardandoAtribuicao > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-white text-red-700 rounded-full font-black">
                  {totalAguardandoAtribuicao}
                </span>
              )}
            </button>

            <button
              onClick={() => setAbaAtiva('ativos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-bold transition-all ${
                abaAtiva === 'ativos'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Ativos & Prontuário</span>
            </button>

            <button
              onClick={() => setAbaAtiva('indicadores')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-bold transition-all ${
                abaAtiva === 'indicadores'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard TCC</span>
            </button>
          </div>

          {/* Ações Rápidas: Alarme Sonoro, Rede e Atualizar */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => {
                const novoEstado = soundAlert.toggleSom();
                setSomAtivo(novoEstado);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] text-xs font-semibold border transition-all ${
                somAtivo
                  ? 'bg-red-600/20 border-red-500/40 text-red-300 hover:bg-red-600/30'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
              }`}
              title={somAtivo ? 'Silenciar alarme de emergência' : 'Ativar sirene sonora'}
            >
              {somAtivo ? <Volume2 className="w-4 h-4 text-red-400" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{somAtivo ? 'Sirene Ativa' : 'Mudo'}</span>
            </button>

            <NetworkStatusBadge />

            <button
              onClick={() => {
                if (abaAtiva === 'triagem') carregarDados();
                if (abaAtiva === 'ativos') carregarAtivosESintomas();
                if (abaAtiva === 'indicadores') carregarMetricas();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-[2px] hover:bg-slate-800"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notificação Flutuante de Chamado Recebido via Socket.io */}
        {novoAlerta && (
          <div className="max-w-7xl mx-auto mt-2 bg-rose-600 border border-rose-400 text-white rounded-[2px] p-3 shadow-2xl flex items-center justify-between animate-bounce">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-white shrink-0 animate-pulse" />
              <div>
                <p className="font-bold text-sm">NOVO DISPARO VANGUARD TRIGGER RECEBIDO!</p>
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

      {/* CONTEÚDO PRINCIPAL: MUDANÇA CONFORME ABA */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 w-full space-y-6">

        {/* ======================================================== */}
        {/* ABA 1: FILA DE TRIAGEM, PRIORIZAÇÃO E DESPACHO ($T_0 \to T_1$) */}
        {/* ======================================================== */}
        {abaAtiva === 'triagem' && (
          <div className="space-y-6">
            {/* Faixa de KPIs Operacionais (Ergonomia Cognitiva NBR 7195) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-rose-500/30 rounded-[2px] p-4 shadow-lg relative overflow-hidden">
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

              <div className="bg-slate-900 border border-amber-500/30 rounded-[2px] p-4 shadow-lg">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Aguardando Triagem ($T_0$)
                  </span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-3xl font-black text-white mt-2 font-mono">
                  {totalAguardandoAtribuicao}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Tempo de resposta correndo na Central</p>
              </div>

              <div className="bg-slate-900 border border-indigo-500/30 rounded-[2px] p-4 shadow-lg">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Em Atendimento ($T_2$)
                  </span>
                  <Wrench className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-3xl font-black text-white mt-2 font-mono">
                  {totalEmAtendimento}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Mantenedores em campo no posto</p>
              </div>

              <div className="bg-slate-900 border border-emerald-500/30 rounded-[2px] p-4 shadow-lg">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    OSs Concluídas ($T_3$)
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-white mt-2 font-mono">
                  {totalConcluidosHoje}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Ativos liberados para produção</p>
              </div>
            </div>

            {/* Barra de Filtros, Ordenação Inteligente e Busca */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-3 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Seletor de Linha */}
                <select
                  value={linhaSelecionada}
                  onChange={(e) => setLinhaSelecionada(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-[2px] px-3 py-2 font-medium focus:outline-none focus:border-red-500"
                >
                  <option value="">Todas as Linhas da Planta</option>
                  {linhas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome} ({l.setor})
                    </option>
                  ))}
                </select>

                {/* Alternância de Ordenação por Matriz de Priorização Industrial */}
                <button
                  onClick={() => setOrdenacao(ordenacao === 'prioridade' ? 'recentes' : 'prioridade')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-[2px] text-xs font-bold border transition-all ${
                    ordenacao === 'prioridade'
                      ? 'bg-red-600/20 text-red-300 border-red-500/50 shadow-md'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="Ordenar por Matriz de Priorização (Criticidade + Impacto + Tempo de Espera)"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>
                    {ordenacao === 'prioridade' ? 'Fila Priorizada (SLA / Risco)' : 'Mais Recentes ($T_0$)'}
                  </span>
                </button>

                {/* Pílulas de Status da Máquina de Estados */}
                <div className="flex gap-1 overflow-x-auto text-xs">
                  {[
                    { id: 'ativos', label: 'Paradas Ativas' },
                    { id: 'aberto', label: 'Abertos ($T_0$)' },
                    { id: 'atribuido', label: 'Despachados ($T_1$)' },
                    { id: 'em_reparo', label: 'Em Reparo ($T_2$)' },
                    { id: 'pausado_peca', label: 'Pausados' },
                    { id: 'concluido', label: 'Concluídos ($T_3$)' },
                    { id: 'todos', label: 'Todos' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStatusFiltro(s.id)}
                      className={`px-3 py-1.5 rounded-[2px] font-medium transition-all ${
                        statusFiltro === s.id
                          ? 'bg-red-600 text-white font-bold'
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-[2px] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Grid de Chamados / Fila de Triagem */}
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Carregando fila de triagem da planta...</p>
              </div>
            ) : chamadosFiltrados.length === 0 ? (
              <div className="py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-[2px]">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-white mt-3">
                  Nenhuma ordem de serviço pendente neste filtro
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Todas as máquinas operando em regime estável ou chamados arquivados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chamadosFiltrados.map((item) => {
                  const t0Ms = new Date(item.t0_abertura).getTime();
                  const fimMs = item.t3_conclusao_reparo
                    ? new Date(item.t3_conclusao_reparo).getTime()
                    : relogio;
                  const segundosDowntime = Math.max(0, Math.floor((fimMs - t0Ms) / 1000));

                  const isCritico = item.ativo_criticidade === 'A' || item.status_impacto === 'maquina_parada';
                  const isConcluido = item.status === 'concluido';

                  return (
                    <div
                      key={item.id}
                      className={`bg-slate-900 rounded-[2px] border transition-all p-4 flex flex-col justify-between shadow-xl relative overflow-hidden ${
                        isConcluido
                          ? 'border-emerald-500/30'
                          : isCritico
                          ? 'border-rose-500/50 shadow-rose-950/20'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Topo do Card: Número OS + TAG + Criticidade do Ativo */}
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-400">
                                {item.numero_os}
                              </span>
                              {item.score_prioridade && item.status !== 'concluido' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-950/50 text-red-300 border border-red-500/30">
                                  Score: {item.score_prioridade} pts
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <h2 className="text-lg font-black text-white font-mono tracking-wider">
                                {item.tag_patrimonio}
                              </h2>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  item.ativo_criticidade === 'A'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                    : item.ativo_criticidade === 'B'
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                    : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                }`}
                              >
                                Criticidade {item.ativo_criticidade}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium">{item.ativo_nome}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.linha_nome} • {item.posto_trabalho}
                            </p>
                          </div>

                          {/* Ticker de Downtime */}
                          <div className="text-right">
                            <div
                              className={`font-mono text-xs font-bold px-2 py-1 rounded-[2px] inline-flex items-center gap-1.5 ${
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

                        {/* Monitoramento de SLA na Triagem */}
                        {item.status === 'aberto' && (
                          <div className="mt-2.5">
                            {item.sla_estourado ? (
                              <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 rounded-[2px] px-2.5 py-1 text-[10px] font-bold flex items-center justify-between animate-pulse">
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  SLA ESTOURADO (+{item.minutos_em_aberto - item.sla_limite_t1} min além do limite)
                                </span>
                                <span>T0: {item.sla_limite_t1}m max</span>
                              </div>
                            ) : (
                              <div className="bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 rounded-[2px] px-2.5 py-1 text-[10px] font-bold flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-emerald-400" />
                                  Dentro do SLA de Triagem
                                </span>
                                <span>{item.sla_restante_minutos} min restantes</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sintoma Reportado no Vanguard Trigger */}
                        <div className="mt-2.5 bg-slate-950/60 border border-slate-800/80 rounded-[2px] p-2.5">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            Sintoma Inicial Reportado:
                          </span>
                          <p className="text-xs text-slate-200 font-medium mt-0.5 line-clamp-2">
                            {item.descricao_sintoma || item.sintoma_descricao || 'Não especificado'}
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

                        {/* Miniatura de Foto Anexada (se houver) */}
                        {item.foto_anexo && (
                          <div
                            className="mt-2 relative group cursor-pointer"
                            onClick={() => abrirDossieOS(item)}
                          >
                            <img
                              src={item.foto_anexo}
                              alt="Evidência fotográfica"
                              className="w-full h-24 object-cover rounded-[2px] border border-slate-700/80 group-hover:opacity-90 transition-all"
                            />
                            <span className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-sm text-[9px] text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                              📸 Evidência Anexada
                            </span>
                          </div>
                        )}

                        {/* Player de Áudio do Ruído (se houver) */}
                        {item.audio_anexo && (
                          <div className="mt-2 bg-slate-950/80 border border-slate-800 rounded-[2px] p-2 flex items-center gap-2">
                            <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <audio src={item.audio_anexo} controls className="h-6 w-full" />
                          </div>
                        )}

                        {/* Identificação de Operador e Técnico Atribuído */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Operador: {item.operador_nome || item.operador_matricula}</span>
                          <span className="font-medium text-slate-300">
                            {item.mantenedor_nome ? (
                              <span className="text-red-400">Téc: {item.mantenedor_nome}</span>
                            ) : (
                              <span className="text-amber-400 font-bold">Sem mantenedor</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Rodapé do Card: Máquina de Estados e Ações */}
                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                        {/* Status da Máquina de Estados */}
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            item.status === 'aberto'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : item.status === 'atribuido'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : item.status === 'em_deslocamento'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : item.status === 'em_reparo'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : item.status === 'pausado_peca'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {item.status === 'aberto'
                            ? '1. Aberto ($T_0$)'
                            : item.status === 'atribuido'
                            ? '2. Despachado ($T_1$)'
                            : item.status === 'em_deslocamento'
                            ? '2. Em Trânsito'
                            : item.status === 'em_reparo'
                            ? '3. Em Atendimento ($T_2$)'
                            : item.status === 'pausado_peca'
                            ? '4. Aguardando Peça'
                            : '5. Concluído ($T_3$)'}
                        </span>

                        {/* Botões de Ação */}
                        <div className="flex gap-1.5">
                          {item.status === 'aberto' && (
                            <button
                              onClick={() => {
                                setModalAtribuir(item);
                                if (tecnicos.length > 0) setTecnicoAtribuirId(tecnicos[0].id);
                              }}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-[2px] text-xs flex items-center gap-1 shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Despachar ($T_1$)</span>
                            </button>
                          )}

                          <button
                            onClick={() => abrirDossieOS(item)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-[2px] transition-colors"
                            title="Ver dossiê técnico e confronto Trigger vs Field"
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
        )}

        {/* ======================================================== */}
        {/* ABA 2: GESTÃO DE ATIVOS, GERADOR QR CODE E PRONTUÁRIO */}
        {/* ======================================================== */}
        {abaAtiva === 'ativos' && (
          <div className="space-y-6">
            {/* Topo da Aba de Ativos */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-red-500" />
                  <span>Cadastro de Dispositivos e Histórico de Manutenção (Prontuário)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gere plaquetas industriais QR Code para os postos e consulte o histórico de vida de cada máquina.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setModalNovoSintoma(true)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-[2px] flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Árvore de Falhas</span>
                </button>

                <button
                  onClick={() => setModalNovoAtivo(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-[2px] flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Novo Ativo</span>
                </button>
              </div>
            </div>

            {/* Filtros de Busca de Ativos */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={filtroCriticidadeAtivo}
                  onChange={(e) => setFiltroCriticidadeAtivo(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-[2px] px-3 py-2 font-medium focus:outline-none focus:border-red-500"
                >
                  <option value="">Todas as Criticidades</option>
                  <option value="A">Criticidade A (Gargalo da Linha)</option>
                  <option value="B">Criticidade B (Operação Normal)</option>
                  <option value="C">Criticidade C (Secundário)</option>
                </select>

                <select
                  value={linhaSelecionada}
                  onChange={(e) => setLinhaSelecionada(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-[2px] px-3 py-2 font-medium focus:outline-none focus:border-red-500"
                >
                  <option value="">Todas as Linhas</option>
                  {linhas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={buscaAtivo}
                  onChange={(e) => setBuscaAtivo(e.target.value)}
                  placeholder="Filtrar por TAG ou nome da máquina..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-[2px] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Grid dos Ativos Cadastrados */}
            {loadingAtivos ? (
              <div className="py-20 text-center text-xs text-slate-400">
                Carregando parque fabril...
              </div>
            ) : ativosFiltrados.length === 0 ? (
              <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-[2px]">
                <Boxes className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white mt-3">Nenhum ativo encontrado</h3>
                <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou cadastre uma nova máquina.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ativosFiltrados.map((ativo) => (
                  <div
                    key={ativo.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-[2px] p-4 flex flex-col justify-between shadow-xl transition-all"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {ativo.linha_nome}
                          </span>
                          <h3 className="text-base font-black text-white font-mono mt-0.5">
                            {ativo.tag_patrimonio}
                          </h3>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            ativo.criticidade === 'A'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : ativo.criticidade === 'B'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          }`}
                        >
                          Classe {ativo.criticidade}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-200 mt-2">{ativo.nome}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{ativo.posto_trabalho}</p>

                      <div className="mt-3 bg-slate-950/70 border border-slate-800 rounded-[2px] p-2.5 flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">Status Operacional:</span>
                        <span
                          className={`font-bold text-[11px] ${
                            ativo.status_operacional === 'em_operacao'
                              ? 'text-emerald-400'
                              : ativo.status_operacional === 'parado_quebra'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {ativo.status_operacional === 'em_operacao'
                            ? 'Operando Normalmente'
                            : ativo.status_operacional === 'parado_quebra'
                            ? 'Parado por Quebra'
                            : 'Alerta / Manutenção'}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação do Ativo */}
                    <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setModalEtiqueta(ativo)}
                        className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-[2px] flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                      >
                        <QrCode className="w-3.5 h-3.5 text-red-400" />
                        <span>Gerar Etiqueta</span>
                      </button>

                      <button
                        onClick={() => abrirProntuario(ativo)}
                        className="py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold rounded-[2px] flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Prontuário</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Painel da Árvore de Falhas e Sintomas Cadastrados */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Árvore de Falhas do Catálogo Operacional (Vanguard Trigger)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sintomas disponibilizados em 2 toques no celular do operador quando escaneia a etiqueta.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-2">
                {sintomas.map((s) => (
                  <div
                    key={s.id}
                    className="bg-slate-950 border border-slate-800 p-2.5 rounded-[2px] text-xs flex flex-col justify-between"
                  >
                    <span className="text-slate-200 font-medium">{s.descricao}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                      Subsistema: {s.categoria}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 3: DASHBOARD DE INDICADORES (O OURO DA BANCA DO TCC) */}
        {/* ======================================================== */}
        {abaAtiva === 'indicadores' && (
          <div className="space-y-6">
            {/* Topo do Dashboard */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-red-500" />
                  <span>Dashboard de Confiabilidade & Engenharia de Manutenção (TCC FAETERJ)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cálculo automático de MTTR, MTBF, Wait Time e Pareto de Confiabilidade em tempo real.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={periodoDias}
                  onChange={(e) => setPeriodoDias(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-[2px] px-3 py-2 font-medium focus:outline-none focus:border-red-500"
                >
                  <option value={7}>Últimos 7 dias</option>
                  <option value={15}>Últimos 15 dias</option>
                  <option value={30}>Últimos 30 dias (Padrão)</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>

                <select
                  value={linhaSelecionada}
                  onChange={(e) => setLinhaSelecionada(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-[2px] px-3 py-2 font-medium focus:outline-none focus:border-red-500"
                >
                  <option value="">Todas as Linhas</option>
                  {linhas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingMetricas ? (
              <div className="py-20 text-center text-xs text-slate-400">
                Processando fórmulas analíticas de MTTR e MTBF...
              </div>
            ) : metricasDashboard ? (
              <div className="space-y-6">
                {/* 4 Cards de Métricas Industriais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* MTTR */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 shadow-xl">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      MTTR Líquido Médio
                    </span>
                    <div className="text-3xl font-black text-white font-mono mt-2">
                      {metricasDashboard.resumo_geral?.mttr_medio_minutos || 0} <span className="text-base text-slate-400">min</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tempo médio que a equipe leva para consertar (descontando pausas).
                    </p>
                  </div>

                  {/* MTBF */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 shadow-xl">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      MTBF Médio Estimado
                    </span>
                    <div className="text-3xl font-black text-emerald-400 font-mono mt-2">
                      {metricasDashboard.resumo_geral?.mtbf_medio_horas || 0} <span className="text-base text-slate-400">h</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tempo médio de operação ininterrupta entre falhas mecânicas.
                    </p>
                  </div>

                  {/* Wait Time / Tempo de Resposta */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 shadow-xl">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      Tempo Médio Resposta (Wait Time)
                    </span>
                    <div className="text-3xl font-black text-amber-300 font-mono mt-2">
                      {metricasDashboard.resumo_geral?.tempo_medio_resposta_minutos || 0} <span className="text-base text-slate-400">min</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tempo entre o operador disparar no Trigger e o despacho da Central ($T_0 \to T_1$).
                    </p>
                  </div>

                  {/* Disponibilidade Operacional */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 shadow-xl">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                      Disponibilidade Inerente (A%)
                    </span>
                    <div className="text-3xl font-black text-indigo-300 font-mono mt-2">
                      {metricasDashboard.resumo_geral?.disponibilidade_percentual || 100}%
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Régua World Class Manufacturing (WCM &gt; 95%).
                    </p>
                  </div>
                </div>

                {/* Pareto de Quebras por Subsistema & Top Ofensores */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Diagrama de Pareto */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-red-500" />
                      <span>Diagrama de Pareto de Falhas por Subsistema (Curva 80/20)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Identifica a categoria de falha que mais consome downtime na fábrica.
                    </p>

                    <div className="space-y-3 pt-2">
                      {metricasDashboard.pareto_subsistemas?.map((sub, idx) => (
                        <div key={idx} className="space-y-1 text-xs">
                          <div className="flex justify-between font-medium">
                            <span className="text-slate-200 capitalize font-mono">{sub.subsistema}</span>
                            <span className="text-slate-400">
                              {sub.quantidade_ocorrencias} falhas ({sub.percentual_impacto}%) • Acumulado: {sub.percentual_acumulado}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className="bg-red-500 h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, sub.percentual_impacto)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top 3 Máquinas Ofensoras de Downtime */}
                  <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-5 space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span>Top Máquinas Ofensoras de Downtime (Bad Actors)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Equipamentos com maior somatório de horas paradas no período selecionado.
                    </p>

                    <div className="space-y-2 pt-2">
                      {metricasDashboard.top_ofensores?.map((ofensor, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950 border border-slate-800 p-3 rounded-[2px] flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="text-xs font-mono font-bold text-red-400">
                              {ofensor.tag_patrimonio}
                            </span>
                            <p className="font-semibold text-slate-200">{ofensor.ativo_nome}</p>
                            <p className="text-[10px] text-slate-500">
                              {ofensor.linha_nome} • {ofensor.total_falhas} falhas reportadas
                            </p>
                          </div>
                          <div className="text-right font-mono">
                            <span className="text-base font-bold text-white">
                              {ofensor.downtime_total_minutos} min
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              {Math.round(ofensor.downtime_total_minutos / 60)}h paradas
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ATRIBUIÇÃO E DESPACHO DE TÉCNICO ($T_1$) */}
      {/* ======================================================== */}
      {modalAtribuir && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2px] max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Despachar Técnico da Linha ($T_1$)
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
                Selecione o mantenedor responsável pelo atendimento:
              </label>
              <select
                value={tecnicoAtribuirId}
                onChange={(e) => setTecnicoAtribuirId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-[2px] p-3 focus:outline-none focus:border-red-500"
              >
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.matricula}) • Ramal {t.ramal_telefone || 'N/A'}
                  </option>
                ))}
              </select>

              <div className="bg-red-950/30 border border-red-500/20 rounded-[2px] p-3 text-xs text-red-300 space-y-1">
                <p className="font-semibold text-red-200">
                  Transição da Máquina de Estados:
                </p>
                <p className="text-slate-400">
                  A confirmação congela o marco <strong>$T_1$ (Tempo de Resposta / Wait Time)</strong> e envia a ordem diretamente para o <strong>Vanguard Field</strong> do mantenedor.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalAtribuir(null)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-[2px] text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submetendoAcao}
                onClick={handleConfirmarAtribuicao}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-[2px] text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30"
              >
                {submetendoAcao ? 'Despachando...' : 'Confirmar Despacho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: DOSSIÊ TÉCNICO & CONFRONTO (TRIGGER VS FIELD) */}
      {/* ======================================================== */}
      {modalDossie && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2px] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-wider">
                  Dossiê Integrado Vanguard
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
                {/* 1. Cronologia dos 4 Marcos de Engenharia (T0 a T3) */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-[2px] p-3.5 space-y-2">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-red-400" />
                    Ciclo de Vida do Chamado (Marcos $T_0$ a $T_3$):
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                    <div className="bg-slate-900 p-2 rounded-[2px] border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">$T_0$ Disparo Trigger</span>
                      <span className="text-slate-200 font-bold">
                        {modalDossie.t0_abertura ? new Date(modalDossie.t0_abertura).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-[2px] border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">$T_1$ Despacho Central</span>
                      <span className="text-slate-200 font-bold">
                        {modalDossie.t1_atribuicao ? new Date(modalDossie.t1_atribuicao).toLocaleTimeString() : 'Pendente'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-[2px] border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">$T_2$ Chegada Field</span>
                      <span className="text-slate-200 font-bold">
                        {modalDossie.t2_inicio_reparo ? new Date(modalDossie.t2_inicio_reparo).toLocaleTimeString() : 'Pendente'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-[2px] border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">$T_3$ Liberação</span>
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

                {/* 2. Confronto: Diagnóstico Inicial do Trigger vs Causa Raiz Real do Field */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-[2px] p-3.5 space-y-3">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    Confronto: Operador (Trigger) vs Mantenedor (Field)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Lado Operador */}
                    <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-[2px] space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-red-400">
                        1. Relato Inicial (Vanguard Trigger):
                      </span>
                      <p className="text-white font-medium">
                        {modalDossie.sintoma_descricao || 'Sintoma de catálogo'}
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        "{modalDossie.descricao_sintoma || 'Sem descrição livre adicional'}"
                      </p>
                      <p className="text-[10px] text-slate-500 pt-1">
                        Reportado por: <strong>{modalDossie.operador_nome || modalDossie.operador_matricula}</strong>
                      </p>
                    </div>

                    {/* Lado Técnico (Field) */}
                    <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-[2px] space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-emerald-400">
                        2. Causa Raiz Real (Vanguard Field):
                      </span>
                      {modalDossie.apontamento ? (
                        <>
                          <p className="text-white font-bold">{modalDossie.apontamento.causa_raiz}</p>
                          <p className="text-slate-300 text-[11px]">
                            Ação: {modalDossie.apontamento.acao_executada}
                          </p>
                          <p className="text-[10px] text-slate-500 pt-1">
                            Subsistema: <strong className="uppercase text-slate-300">{modalDossie.apontamento.arvore_falha_sistema}</strong> • Téc: {modalDossie.apontamento.mantenedor_nome}
                          </p>
                        </>
                      ) : (
                        <p className="text-slate-500 italic">
                          Aguardando laudo técnico e encerramento no Vanguard Field.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Evidências Multimídia do Vanguard Trigger */}
                {(modalDossie.foto_anexo || modalDossie.audio_anexo) && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-[2px] p-3.5 space-y-2">
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-emerald-400" />
                      Evidências Registradas pelo Operador (Foto / Áudio):
                    </h4>
                    {modalDossie.foto_anexo && (
                      <div className="mt-1">
                        <img
                          src={modalDossie.foto_anexo}
                          alt="Evidência da peça"
                          className="w-full max-h-72 object-contain rounded-[2px] border border-slate-800 bg-black"
                        />
                      </div>
                    )}
                    {modalDossie.audio_anexo && (
                      <div className="mt-2">
                        <span className="text-[10px] text-slate-400 block mb-1">Ruído Mecânico Gravado:</span>
                        <audio src={modalDossie.audio_anexo} controls className="h-8 w-full" />
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Peças Sobressalentes Baixadas */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-[2px] p-3.5 space-y-2">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-amber-400" />
                    Peças Sobressalentes Utilizadas no Reparo:
                  </h4>
                  {modalDossie.pecas?.length > 0 ? (
                    <div className="space-y-1.5">
                      {modalDossie.pecas.map((p) => (
                        <div key={p.id} className="flex justify-between items-center bg-slate-900 p-2 rounded-[2px] border border-slate-800">
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
                    <p className="text-slate-500">Nenhum componente substituído nesta intervenção.</p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setModalDossie(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-[2px] text-xs"
              >
                Fechar Dossiê
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: GERADOR E IMPRESSÃO DE ETIQUETA QR CODE */}
      {/* ======================================================== */}
      {modalEtiqueta && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2px] max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Printer className="w-5 h-5 text-red-500" />
                  <span>Etiqueta Industrial de Posto</span>
                </h3>
                <p className="text-xs text-slate-400">Plaqueta física com código QR de alta densidade.</p>
              </div>
              <button onClick={() => setModalEtiqueta(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plaqueta Industrial Padronizada (Área Imprimível) */}
            <div
              id="etiqueta-industrial-print"
              className="bg-white text-slate-900 rounded-[2px] p-5 border-4 border-black space-y-3 shadow-inner"
            >
              {/* Cabeçalho da Placa com Logo e Indústria */}
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-600 rounded-[2px] flex items-center justify-center text-white font-black text-sm">
                    V
                  </div>
                  <div>
                    <span className="font-black text-xs uppercase tracking-wider block leading-none">
                      CORP.VANGUARD
                    </span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase">
                      Sistema Fabril CMMS
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-black px-2 py-0.5 bg-black text-white rounded">
                    CRIT. {modalEtiqueta.criticidade}
                  </span>
                </div>
              </div>

              {/* Informações da Máquina */}
              <div className="text-center space-y-0.5">
                <span className="font-mono text-2xl font-black text-black tracking-widest block">
                  {modalEtiqueta.tag_patrimonio}
                </span>
                <p className="font-bold text-xs text-slate-800">{modalEtiqueta.nome}</p>
                <p className="text-[10px] text-slate-600 font-medium">
                  {modalEtiqueta.linha_nome} • {modalEtiqueta.posto_trabalho}
                </p>
              </div>

              {/* Canvas do QR Code em Alta Resolução */}
              <div className="flex justify-center py-1">
                <canvas ref={qrCanvasRef} className="rounded-[2px] shadow-sm" />
              </div>

              {/* Instrução ao Operador no Chão de Fábrica */}
              <div className="text-center border-t-2 border-black pt-2 space-y-0.5">
                <span className="text-[10px] font-black uppercase text-red-600 tracking-wide block">
                  VANGUARD TRIGGER • APONTE A CÂMERA
                </span>
                <p className="text-[8px] text-slate-500">
                  Abertura imediata de chamado em 2 toques sem digitação.
                </p>
              </div>
            </div>

            {/* Ações de Impressão e Fechar */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEtiqueta(null)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-[2px] text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleImprimirEtiqueta}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-[2px] text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Etiqueta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: PRONTUÁRIO DE MANUTENÇÃO (HISTÓRICO DO ATIVO) */}
      {/* ======================================================== */}
      {modalProntuario && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-[2px] max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-wider">
                  Prontuário Médico do Equipamento
                </span>
                <h3 className="text-lg font-black text-white">
                  {modalProntuario.tag_patrimonio} • {modalProntuario.nome}
                </h3>
                <p className="text-xs text-slate-400">
                  {modalProntuario.linha_nome} • {modalProntuario.posto_trabalho} • Criticidade {modalProntuario.criticidade}
                </p>
              </div>
              <button onClick={() => setModalProntuario(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingProntuario ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Consultando histórico de intervenções deste ativo...
              </div>
            ) : dadosProntuario ? (
              <div className="space-y-4 text-xs">
                {/* 1. Indicadores de Saúde Deste Ativo Específico */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-950 p-3 rounded-[2px] border border-slate-800">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Total de Chamados</span>
                    <span className="text-xl font-black text-white font-mono mt-1 block">
                      {dadosProntuario.metricas?.total_chamados || 0}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-[2px] border border-slate-800">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Downtime Acumulado</span>
                    <span className="text-xl font-black text-rose-400 font-mono mt-1 block">
                      {dadosProntuario.metricas?.total_downtime_horas || 0}h
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-[2px] border border-slate-800">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">MTTR Individual</span>
                    <span className="text-xl font-black text-amber-300 font-mono mt-1 block">
                      {dadosProntuario.metricas?.mttr_medio_minutos || 0} min
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-[2px] border border-slate-800">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">MTBF Máquina</span>
                    <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                      {dadosProntuario.metricas?.mtbf_horas || 0}h
                    </span>
                  </div>
                </div>

                {/* 2. Reincidência de Falhas por Subsistema */}
                <div className="bg-slate-950 border border-slate-800 rounded-[2px] p-3 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Reincidência por Subsistema (Detecção de Bad Actor):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(dadosProntuario.metricas?.reincidencia_sistemas || {}).map(([sist, count]) => (
                      <span
                        key={sist}
                        className="px-2.5 py-1 rounded-[2px] bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium"
                      >
                        <strong className="uppercase text-red-400">{sist}:</strong> {count} falhas
                      </span>
                    ))}
                  </div>
                </div>

                {/* 3. Linha do Tempo de Chamados e Laudos do Ativo */}
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <History className="w-4 h-4 text-red-400" />
                    Histórico Cronológico de Ordens de Serviço Desta Máquina:
                  </h4>

                  {dadosProntuario.historico?.length === 0 ? (
                    <p className="text-slate-500 italic py-4 text-center">
                      Nenhum chamado registrado para esta máquina até o momento.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {dadosProntuario.historico?.map((ch) => (
                        <div
                          key={ch.id}
                          className="bg-slate-950 border border-slate-800 p-3 rounded-[2px] space-y-2 text-xs"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono font-bold text-white">{ch.numero_os}</span>
                              <span className="text-slate-500 ml-2">
                                {new Date(ch.t0_abertura).toLocaleDateString()} às {new Date(ch.t0_abertura).toLocaleTimeString()}
                              </span>
                            </div>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                                ch.status === 'concluido'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {ch.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block">Sintoma Trigger (Operação):</span>
                              <span className="text-slate-300 font-medium">
                                {ch.descricao_sintoma || ch.sintoma_descricao || 'Não informado'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Causa Raiz Constatada (Field):</span>
                              <span className="text-slate-200 font-medium">
                                {ch.causa_raiz || 'Em diagnóstico/aberto no campo'}
                              </span>
                            </div>
                          </div>

                          {/* Log Escrito da Manutenção Pós-Operatório */}
                          {(ch.acao_executada || ch.observacoes_tecnicas) && (
                            <div className="bg-slate-900/80 p-2 rounded-[2px] border border-slate-800 text-[11px] space-y-1">
                              <span className="text-emerald-400 font-bold block text-[10px] uppercase tracking-wider">
                                Log Escrito da Manutenção (Pós-Operatório):
                              </span>
                              {ch.acao_executada && (
                                <p className="text-slate-200 leading-relaxed font-mono text-[10.5px]">
                                  {ch.acao_executada}
                                </p>
                              )}
                              {ch.observacoes_tecnicas && ch.observacoes_tecnicas !== ch.acao_executada && (
                                <p className="text-slate-400 text-[10px] italic">
                                  Obs: {ch.observacoes_tecnicas}
                                </p>
                              )}
                            </div>
                          )}

                          {ch.pecas?.length > 0 && (
                            <div className="border-t border-slate-900 pt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                              <span className="text-slate-500 font-bold">Peças trocadas:</span>
                              {ch.pecas.map((p, idx) => (
                                <span key={idx} className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-300 border border-slate-800">
                                  {p.codigo_sap} - {p.descricao} ({p.quantidade} un)
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setModalProntuario(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-[2px] text-xs"
              >
                Fechar Prontuário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: CADASTRO DE NOVO ATIVO / DISPOSITIVO */}
      {/* ======================================================== */}
      {modalNovoAtivo && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSalvarNovoAtivo}
            className="bg-slate-900 border border-slate-700 rounded-[2px] max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-red-500" />
                  <span>Cadastrar Novo Ativo</span>
                </h3>
                <p className="text-xs text-slate-400">Adiciona uma máquina ao parque fabril da montadora.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoAtivo(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Linha de Produção:</label>
                <select
                  value={formAtivo.linha_id}
                  onChange={(e) => setFormAtivo({ ...formAtivo, linha_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2.5 text-white focus:outline-none focus:border-red-500"
                  required
                >
                  <option value="">Selecione a Linha</option>
                  {linhas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome} ({l.setor})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">TAG de Patrimônio:</label>
                <input
                  type="text"
                  placeholder="Ex: MV3-PRS-02"
                  value={formAtivo.tag_patrimonio}
                  onChange={(e) => setFormAtivo({ ...formAtivo, tag_patrimonio: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2.5 text-white font-mono uppercase focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nome do Dispositivo / Máquina:</label>
                <input
                  type="text"
                  placeholder="Ex: Prensa Hidráulica 400T Komatsu"
                  value={formAtivo.nome}
                  onChange={(e) => setFormAtivo({ ...formAtivo, nome: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2.5 text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Posto de Trabalho Físico:</label>
                <input
                  type="text"
                  placeholder="Ex: Posto 10 - Estamparia Lateral"
                  value={formAtivo.posto_trabalho}
                  onChange={(e) => setFormAtivo({ ...formAtivo, posto_trabalho: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2.5 text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Classificação de Criticidade:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['A', 'B', 'C'].map((crit) => (
                    <button
                      key={crit}
                      type="button"
                      onClick={() => setFormAtivo({ ...formAtivo, criticidade: crit })}
                      className={`py-2 rounded-[2px] text-xs font-bold border transition-all ${
                        formAtivo.criticidade === crit
                          ? crit === 'A'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                            : crit === 'B'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      Classe {crit}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  A: Gargalo crítico (15 min SLA) | B: Linha normal (30 min) | C: Secundário (60 min)
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalNovoAtivo(false)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-[2px] text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoAtivo}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-[2px] text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30"
              >
                {salvandoAtivo ? 'Salvando...' : 'Cadastrar Ativo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: NOVO SINTOMA NA ÁRVORE DE FALHAS */}
      {/* ======================================================== */}
      {modalNovoSintoma && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSalvarNovoSintoma}
            className="bg-slate-900 border border-slate-700 rounded-[2px] max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-500" />
                  <span>Novo Sintoma na Árvore de Falhas</span>
                </h3>
                <p className="text-xs text-slate-400">Adicione uma opção ao catálogo do Vanguard Trigger.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoSintoma(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Subsistema / Categoria Técnica:</label>
                <select
                  value={formSintoma.categoria}
                  onChange={(e) => setFormSintoma({ ...formSintoma, categoria: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2.5 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="mecanica">Mecânica</option>
                  <option value="eletrica">Elétrica / Automação</option>
                  <option value="pneumatica">Pneumática / Ar Comprimido</option>
                  <option value="hidraulica">Hidráulica</option>
                  <option value="seguranca">Segurança / LOTO</option>
                  <option value="qualidade">Qualidade / Torque</option>
                  <option value="geral">Geral</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Descrição do Sintoma (2 toques):</label>
                <input
                  type="text"
                  placeholder="Ex: Aquecimento Anormal no Motorredutor"
                  value={formSintoma.descricao}
                  onChange={(e) => setFormSintoma({ ...formSintoma, descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-[2px] p-2.5 text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalNovoSintoma(false)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-[2px] text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoSintoma}
                className="w-1/2 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-[2px] text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/30"
              >
                {salvandoSintoma ? 'Gravando...' : 'Salvar Sintoma'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rodapé institucional */}
      <div className="border-t border-slate-900 p-3 text-center text-[10px] text-slate-500">
        Corp.Vanguard • Vanguard Central (Gestão, Triagem, Prontuário e Métricas) • FAETERJ Barra Mansa
      </div>
    </div>
  );
}
