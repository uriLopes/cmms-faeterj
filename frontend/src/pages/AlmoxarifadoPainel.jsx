import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  AlertTriangle,
  Search,
  CheckCircle2,
  PackagePlus,
  ArrowLeft,
  Clock,
  User,
  Plus,
  X,
  ShieldAlert,
  ArrowDownToLine,
  Layers,
  Wrench,
  Check,
  Bell
} from 'lucide-react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import NetworkStatusBadge from '../components/NetworkStatusBadge';
import { playTowerAlarm } from '../services/soundAlert';

export default function AlmoxarifadoPainel() {
  const navigate = useNavigate();

  // Autenticação do Almoxarife (Padrão Carlos Alberto RE-4012)
  const [tokenAuth, setTokenAuth] = useState(localStorage.getItem('cmms_auth_token_almoxarife') || '');
  const [almoxarifeAtual, setAlmoxarifeAtual] = useState(null);

  // Estados dos dados
  const [abaAtiva, setAbaAtiva] = useState('requisicoes'); // 'requisicoes' | 'catalogo'
  const [requisicoes, setRequisicoes] = useState([]);
  const [pecas, setPecas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros de busca
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [apenasCritico, setApenasCritico] = useState(false);

  // Modal de Entrada de Estoque
  const [modalEntrada, setModalEntrada] = useState(false);
  const [pecaEntrada, setPecaEntrada] = useState(null);
  const [qtdEntrada, setQtdEntrada] = useState(1);
  const [obsEntrada, setObsEntrada] = useState('');
  const [processando, setProcessando] = useState(false);

  // Alerta sonoro / Toast de nova requisição
  const [toastAlerta, setToastAlerta] = useState(null);

  useEffect(() => {
    inicializarAlmoxarife();
    carregarDados();

    const socket = getSocket();

    // Eventos em tempo real
    socket.on('reserva_peca_solicitada', (data) => {
      setToastAlerta(`Nova requisição de peça para ${data.numero_os}!`);
      try {
        playTowerAlarm();
      } catch (e) {
        // Áudio liberado após interação
      }
      carregarRequisicoes();
      carregarEstoque();
    });

    socket.on('alerta_estoque_critico', (data) => {
      setToastAlerta(`ALERTA: Peça ${data.peca?.codigo_sap} atingiu nível crítico!`);
      carregarEstoque();
    });

    socket.on('estoque_atualizado', () => {
      carregarEstoque();
    });

    return () => {
      socket.off('reserva_peca_solicitada');
      socket.off('alerta_estoque_critico');
      socket.off('estoque_atualizado');
    };
  }, []);

  async function inicializarAlmoxarife() {
    try {
      let token = tokenAuth;
      if (!token) {
        // Login automático de demonstração como Carlos Alberto (Almoxarife)
        const res = await api.post('/auth/login', {
          matricula: 'RE-4012',
          senha: 'cmms123'
        });
        token = res.token;
        setTokenAuth(token);
        localStorage.setItem('cmms_auth_token_almoxarife', token);
        setAlmoxarifeAtual(res.usuario);
      } else {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAlmoxarifeAtual(data.usuario);
        }
      }
    } catch (err) {
      console.warn('Erro ao inicializar almoxarife:', err);
    }
  }

  async function carregarDados() {
    setLoading(true);
    try {
      await Promise.all([carregarRequisicoes(), carregarEstoque()]);
    } finally {
      setLoading(false);
    }
  }

  async function carregarRequisicoes() {
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_almoxarife');
      const res = await fetch('/api/pecas-os/requisicoes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequisicoes(data);
      }
    } catch (err) {
      console.error('Erro ao listar requisições:', err);
    }
  }

  async function carregarEstoque() {
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_almoxarife');
      const res = await fetch('/api/pecas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPecas(data);
      }
    } catch (err) {
      console.error('Erro ao consultar estoque:', err);
    }
  }

  // Almoxarife confirma a entrega física da peça e decrementa estoque
  async function handleConfirmarBaixa(reqId) {
    setProcessando(true);
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_almoxarife');
      const res = await fetch(`/api/pecas-os/${reqId}/baixar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.erro || 'Falha ao baixar peça');
      }

      await Promise.all([carregarRequisicoes(), carregarEstoque()]);
      setToastAlerta('Peça baixada com sucesso e liberada para o técnico!');
      setTimeout(() => setToastAlerta(null), 4000);
    } catch (err) {
      alert(err.message || 'Erro ao realizar baixa no almoxarifado');
    } finally {
      setProcessando(false);
    }
  }

  // Almoxarife registra entrada de reposição de estoque
  async function handleConfirmarEntrada() {
    if (!pecaEntrada || qtdEntrada <= 0) return;
    setProcessando(true);
    try {
      const token = tokenAuth || localStorage.getItem('cmms_auth_token_almoxarife');
      const res = await fetch(`/api/pecas/${pecaEntrada.id}/entrada`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          quantidade: Number(qtdEntrada),
          observacao: obsEntrada.trim() || 'Entrada manual / Reposição de lote'
        })
      });
      if (!res.ok) throw new Error('Falha ao registrar entrada de estoque');

      setModalEntrada(false);
      setPecaEntrada(null);
      setQtdEntrada(1);
      setObsEntrada('');
      await carregarEstoque();
      setToastAlerta('Entrada de estoque confirmada com sucesso!');
      setTimeout(() => setToastAlerta(null), 4000);
    } catch (err) {
      alert(err.message || 'Erro na entrada de peças');
    } finally {
      setProcessando(false);
    }
  }

  // Cálculos de KPIs
  const requisicoesPendentes = requisicoes.filter((r) => r.status_movimentacao === 'reserva_pendente');
  const pecasCriticas = pecas.filter((p) => p.quantidade_estoque <= p.quantidade_minima);
  const pecasFiltradas = pecas.filter((p) => {
    const bateTexto =
      p.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      p.codigo_sap.toLowerCase().includes(busca.toLowerCase());
    const bateCategoria = filtroCategoria ? p.categoria === filtroCategoria : true;
    const bateCritico = apenasCritico ? p.quantidade_estoque <= p.quantidade_minima : true;
    return bateTexto && bateCategoria && bateCritico;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-5xl mx-auto p-4 sm:p-6">
      {/* Topo / Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 -ml-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-white tracking-wide">
                  Painel do Almoxarifado
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Sobressalentes
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>{almoxarifeAtual?.nome || 'Carlos Alberto'}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-slate-400">{almoxarifeAtual?.matricula || 'RE-4012'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <NetworkStatusBadge />
          </div>
        </div>

        {/* Notificação Toast Flutuante */}
        {toastAlerta && (
          <div className="mt-4 bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-500/40 p-3 rounded-xl flex items-center justify-between text-xs text-amber-200 shadow-xl animate-fade-in-up">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
              <span className="font-semibold">{toastAlerta}</span>
            </div>
            <button onClick={() => setToastAlerta(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Cards de Métricas / Indicadores do Almoxarifado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-indigo-400" />
              Total de Itens
            </span>
            <div className="text-2xl font-black font-mono text-white mt-1">
              {pecas.length}
            </div>
            <span className="text-[10px] text-slate-500">Cadastrados no catálogo</span>
          </div>

          <div
            onClick={() => {
              setAbaAtiva('catalogo');
              setApenasCritico(true);
            }}
            className={`border p-3.5 rounded-xl cursor-pointer transition-all ${
              pecasCriticas.length > 0
                ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400'
                : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Estoque Crítico
            </span>
            <div className="text-2xl font-black font-mono text-rose-300 mt-1 flex items-center gap-2">
              {pecasCriticas.length}
              {pecasCriticas.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
            <span className="text-[10px] text-slate-400">Saldo ≤ Estoque mínimo</span>
          </div>

          <div
            onClick={() => setAbaAtiva('requisicoes')}
            className={`border p-3.5 rounded-xl cursor-pointer transition-all ${
              requisicoesPendentes.length > 0
                ? 'bg-amber-950/30 border-amber-500/40 hover:border-amber-400'
                : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Reserva Pendente
            </span>
            <div className="text-2xl font-black font-mono text-amber-300 mt-1">
              {requisicoesPendentes.length}
            </div>
            <span className="text-[10px] text-slate-400">Aguardando entrega física</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Baixas Realizadas
            </span>
            <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
              {requisicoes.filter((r) => r.status_movimentacao === 'baixado_almoxarifado').length}
            </div>
            <span className="text-[10px] text-slate-500">Histórico de saídas</span>
          </div>
        </div>

        {/* Seleção de Abas */}
        <div className="flex border-b border-slate-800 mt-6 gap-6 text-sm font-bold">
          <button
            onClick={() => setAbaAtiva('requisicoes')}
            className={`pb-3 flex items-center gap-2 transition-colors relative ${
              abaAtiva === 'requisicoes'
                ? 'text-white border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Fila de Requisições da Fábrica</span>
            {requisicoesPendentes.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-amber-500 text-slate-950 rounded-full font-black">
                {requisicoesPendentes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setAbaAtiva('catalogo')}
            className={`pb-3 flex items-center gap-2 transition-colors relative ${
              abaAtiva === 'catalogo'
                ? 'text-white border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Catálogo de Estoque & Sobressalentes</span>
            {pecasCriticas.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-rose-500 text-white rounded-full font-black">
                {pecasCriticas.length}
              </span>
            )}
          </button>
        </div>

        {/* ABA 1: FILA DE REQUISIÇÕES (RESERVA PENDENTE / BAIXADAS) */}
        {abaAtiva === 'requisicoes' && (
          <div className="mt-4 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">
                Peças requisitadas pelos técnicos durante o atendimento de campo ($T_2$).
              </span>
              <button
                onClick={carregarRequisicoes}
                className="text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Atualizar Fila
              </button>
            </div>

            {loading ? (
              <div className="text-center py-10 text-xs text-slate-500">
                Carregando requisições do chão de fábrica...
              </div>
            ) : requisicoes.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
                Nenhuma peça foi requisitada em ordens de serviço até o momento.
              </div>
            ) : (
              <div className="space-y-3">
                {requisicoes.map((reqItem) => {
                  const isPendente = reqItem.status_movimentacao === 'reserva_pendente';
                  const estoqueInsuficiente = reqItem.quantidade_estoque < reqItem.quantidade_solicitada;

                  return (
                    <div
                      key={reqItem.id}
                      className={`rounded-2xl border p-4 transition-all shadow-md ${
                        isPendente
                          ? 'bg-slate-900 border-amber-500/40 hover:border-amber-400'
                          : 'bg-slate-900/50 border-slate-800/80 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Identificação da OS e Posto */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-amber-400">
                              {reqItem.numero_os}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="font-mono font-bold text-white text-sm">
                              {reqItem.tag_patrimonio}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                reqItem.ativo_criticidade === 'A'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              Crit. {reqItem.ativo_criticidade}
                            </span>
                            <span className="text-xs text-slate-400">
                              {reqItem.linha_nome}
                            </span>
                          </div>

                          {/* Detalhes da Peça Requisitada */}
                          <div className="pt-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-xs">
                                SAP: {reqItem.codigo_sap}
                              </span>
                              <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-300">
                                {reqItem.peca_categoria}
                              </span>
                            </div>
                            <h3 className="font-bold text-sm text-slate-200 mt-0.5">
                              {reqItem.peca_descricao}
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Localização física:{' '}
                              <span className="text-amber-300 font-mono font-semibold">
                                {reqItem.localizacao_almoxarifado}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                            <span>Solicitado por: <strong className="text-slate-300">{reqItem.solicitado_por_nome || 'Mantenedor'}</strong></span>
                            <span>•</span>
                            <span>{new Date(reqItem.created_at).toLocaleTimeString()} ({new Date(reqItem.created_at).toLocaleDateString()})</span>
                            {reqItem.data_baixa && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-400">Baixado por: {reqItem.atendido_por_nome} às {new Date(reqItem.data_baixa).toLocaleTimeString()}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Coluna da Direita: Quantidade e Ação */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                          <div className="text-left sm:text-right">
                            <div className="text-xs text-slate-400">Quantidade Requisitada:</div>
                            <div className="font-mono text-xl font-black text-white">
                              {reqItem.quantidade_solicitada} {reqItem.unidade_medida || 'UN'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Saldo Atual em Estoque:{' '}
                              <strong className={estoqueInsuficiente ? 'text-rose-400 font-mono' : 'text-slate-200 font-mono'}>
                                {reqItem.quantidade_estoque} {reqItem.unidade_medida || 'UN'}
                              </strong>
                            </div>
                          </div>

                          {isPendente ? (
                            <button
                              disabled={processando || estoqueInsuficiente}
                              onClick={() => handleConfirmarBaixa(reqItem.id)}
                              className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all ${
                                estoqueInsuficiente
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-amber-600/25'
                              }`}
                            >
                              <ArrowDownToLine className="w-4 h-4" />
                              <span>{estoqueInsuficiente ? 'Estoque Zerado' : 'Confirmar Entrega & Baixa'}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                              <Check className="w-4 h-4" />
                              <span>Baixado do Estoque</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 2: CATÁLOGO DE SOBRESSALENTES & REPOSIÇÃO */}
        {abaAtiva === 'catalogo' && (
          <div className="mt-4 space-y-4">
            {/* Barra de Filtros e Busca */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar sobressalente por código SAP ou descrição..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Todas as Categorias</option>
                  <option value="Pneumática">Pneumática</option>
                  <option value="Elétrica">Elétrica</option>
                  <option value="Mecânica">Mecânica</option>
                  <option value="Automação">Automação</option>
                </select>

                <button
                  type="button"
                  onClick={() => setApenasCritico(!apenasCritico)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    apenasCritico
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Críticos</span>
                </button>
              </div>
            </div>

            {/* Grid / Tabela de Sobressalentes */}
            {pecasFiltradas.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
                Nenhuma peça encontrada com os critérios informados.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pecasFiltradas.map((peca) => {
                  const isCritico = peca.quantidade_estoque <= peca.quantidade_minima;
                  const percentual = Math.min(
                    100,
                    Math.round((peca.quantidade_estoque / (peca.quantidade_minima * 2 || 1)) * 100)
                  );

                  return (
                    <div
                      key={peca.id}
                      className={`bg-slate-900 border rounded-2xl p-4 space-y-3 transition-all ${
                        isCritico
                          ? 'border-rose-500/40 hover:border-rose-400 shadow-rose-950/20'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-amber-400">
                              {peca.codigo_sap}
                            </span>
                            <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-300">
                              {peca.categoria}
                            </span>
                          </div>
                          <h3 className="font-bold text-sm text-white mt-1">
                            {peca.descricao}
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Loc: <strong className="text-slate-300 font-mono">{peca.localizacao_almoxarifado}</strong>
                          </p>
                        </div>

                        {/* Badge de Status do Saldo */}
                        {isCritico ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full flex items-center gap-1 shrink-0">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Crítico</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full shrink-0">
                            Nominal
                          </span>
                        )}
                      </div>

                      {/* Nível de Estoque com Barra de Progresso */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">
                            Saldo: <strong className="text-white font-mono">{peca.quantidade_estoque}</strong> {peca.unidade_medida}
                          </span>
                          <span className="text-slate-500">
                            Mínimo: <strong className="text-slate-400 font-mono">{peca.quantidade_minima}</strong> {peca.unidade_medida}
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isCritico ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                      </div>

                      {/* Rodapé do Card com Ação de Entrada */}
                      <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-mono text-[11px]">
                          R$ {Number(peca.custo_unitario || 0).toFixed(2)} / {peca.unidade_medida}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setPecaEntrada(peca);
                            setModalEntrada(true);
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold rounded-lg flex items-center gap-1 text-[11px] active:scale-95 transition-all"
                        >
                          <PackagePlus className="w-3.5 h-3.5 text-amber-400" />
                          <span>+ Entrada</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: ENTRADA DE ESTOQUE / REPOSIÇÃO */}
      {modalEntrada && pecaEntrada && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-4 sm:p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                  Recebimento / Reposição de Sobressalente
                </span>
                <h3 className="font-bold text-base text-white mt-0.5">
                  {pecaEntrada.descricao}
                </h3>
                <span className="font-mono text-xs text-slate-400">
                  SAP: {pecaEntrada.codigo_sap} • Saldo atual: {pecaEntrada.quantidade_estoque} {pecaEntrada.unidade_medida}
                </span>
              </div>
              <button
                onClick={() => setModalEntrada(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Quantidade a Adicionar ({pecaEntrada.unidade_medida}):
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQtdEntrada(Math.max(1, qtdEntrada - 1))}
                    className="w-9 h-9 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={qtdEntrada}
                    onChange={(e) => setQtdEntrada(Math.max(1, Number(e.target.value)))}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg py-2 text-center text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQtdEntrada(qtdEntrada + 1)}
                    className="w-9 h-9 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-sm"
                  >
                    +
                  </button>
                  <span className="text-slate-400 text-xs">
                    Novo saldo será:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {pecaEntrada.quantidade_estoque + qtdEntrada}
                    </strong>
                  </span>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Origem / Observação da Entrada:
                </label>
                <input
                  type="text"
                  value={obsEntrada}
                  onChange={(e) => setObsEntrada(e.target.value)}
                  placeholder="Ex: NF 104423 - Lote reposição Festo Stellantis"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEntrada(false)}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={processando}
                onClick={handleConfirmarEntrada}
                className="w-1/2 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-600/20 active:scale-95 transition-all"
              >
                {processando ? 'Gravando...' : 'Confirmar Entrada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé institucional */}
      <div className="border-t border-slate-900 pt-3 text-center text-[10px] text-slate-500 mt-6">
        CMMS FAETERJ • Terminal do Almoxarifado • Modo Reserva Pendente & Controle de Sobressalentes
      </div>
    </div>
  );
}