import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Clock,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Filter,
  BarChart3,
  TrendingUp,
  Percent,
  Download,
  Printer,
  ShieldCheck,
  Zap,
  RotateCcw
} from 'lucide-react';
import { api } from '../services/api';
import NetworkStatusBadge from '../components/NetworkStatusBadge';

export default function IndicadoresPainel() {
  const navigate = useNavigate();

  // Estados dos filtros
  const [periodoDias, setPeriodoDias] = useState(30);
  const [linhaSelecionada, setLinhaSelecionada] = useState('');
  const [linhas, setLinhas] = useState([]);

  // Estados dos dados analíticos
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarLinhas();
  }, []);

  useEffect(() => {
    carregarDashboard();
  }, [periodoDias, linhaSelecionada]);

  async function carregarLinhas() {
    try {
      const res = await api.get('/linhas');
      setLinhas(res);
    } catch (e) {
      console.warn('Erro ao carregar linhas:', e);
    }
  }

  async function carregarDashboard() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('dias', periodoDias);
      if (linhaSelecionada) params.append('linha_id', linhaSelecionada);

      const res = await fetch(`/api/metricas/dashboard?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('cmms_auth_token_pcm') || localStorage.getItem('cmms_token') || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMetricas(data);
      }
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  }

  const resumo = metricas?.resumo_geral || {};
  const pareto = metricas?.pareto_subsistemas || [];
  const ofensoresDowntime = metricas?.top_ofensores_downtime || metricas?.top_ofensores || [];
  const ofensoresVolume = metricas?.top_ofensores_volume || [];
  const causasPorSetor = metricas?.causas_raiz_por_setor || [];
  const linhasData = metricas?.metricas_linhas || [];
  const [modoOfensores, setModoOfensores] = useState('downtime'); // 'downtime' | 'volume'
  const ofensores = modoOfensores === 'volume' && ofensoresVolume.length > 0 ? ofensoresVolume : ofensoresDowntime;

  // Classificação WCM de Disponibilidade
  const disp = resumo.disponibilidade_percentual || 100;
  let statusWcm = {
    texto: 'Classe Mundial (WCM > 95%)',
    cor: 'text-emerald-400',
    borda: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10'
  };
  if (disp < 90) {
    statusWcm = {
      texto: 'Nível Crítico (< 90%)',
      cor: 'text-rose-400',
      borda: 'border-rose-500/40',
      bg: 'bg-rose-500/10'
    };
  } else if (disp < 95) {
    statusWcm = {
      texto: 'Atenção Operacional (90% - 95%)',
      cor: 'text-amber-400',
      borda: 'border-amber-500/40',
      bg: 'bg-amber-500/10'
    };
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-6xl mx-auto p-4 sm:p-6 print:p-0 print:bg-white print:text-black">
      {/* Topo / Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 print:border-b-2 print:border-slate-300">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/central'))}
              className="p-1.5 -ml-1.5 text-slate-400 hover:text-white rounded-[2px] hover:bg-slate-800 transition-colors print:hidden"
              title="Voltar ao Cockpit Central"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-white print:text-black tracking-wide">
                  Motor de Indicadores & Métricas Industriais
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 print:hidden">
                  Etapa 08
                </span>
              </div>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                Cálculo automatizado de MTTR Líquido Puro, MTBF, Disponibilidade ($A$) e Curva de Pareto 80/20
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 print:hidden">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-[2px] flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Imprimir / PDF</span>
            </button>
            <NetworkStatusBadge />
          </div>
        </div>

        {/* Barra de Filtros Operacionais */}
        <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-[2px] p-3 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-300">Filtros de Análise:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Linha:</span>
              <select
                value={linhaSelecionada}
                onChange={(e) => setLinhaSelecionada(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Todas as Linhas da Fábrica</option>
                {linhas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome} ({l.setor})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Janela Temporal:</span>
              <select
                value={periodoDias}
                onChange={(e) => setPeriodoDias(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias (Mensal)</option>
                <option value={90}>Últimos 90 dias (Trimestral)</option>
              </select>
            </div>

            <button
              onClick={carregarDashboard}
              className="p-1.5 text-slate-400 hover:text-white rounded-[2px] hover:bg-slate-800"
              title="Recarregar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-xs text-slate-500">
            Processando cálculos analíticos de confiabilidade...
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* BIG NUMBERS: INDICADORES PRINCIPAIS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* CARD 1: DISPONIBILIDADE OPERACIONAL */}
              <div className={`p-4 rounded-[2px] border ${statusWcm.bg} ${statusWcm.borda} space-y-2 relative overflow-hidden`}>
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Activity className={`w-3.5 h-3.5 ${statusWcm.cor}`} />
                    Disp. Operacional (Aop)
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${statusWcm.bg} ${statusWcm.cor} border ${statusWcm.borda}`}>
                    WCM
                  </span>
                </div>
                <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white flex items-baseline gap-2">
                  <span>{resumo.disponibilidade_operacional_pct ?? resumo.disponibilidade_percentual}%</span>
                  <span className="text-xs font-semibold text-indigo-300">
                    Inerente: {resumo.disponibilidade_inerente_pct ?? 100}%
                  </span>
                </div>
                <div className="space-y-1">
                  <div className={`text-[11px] font-semibold ${statusWcm.cor}`}>
                    {statusWcm.texto}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Espera/Logística ({resumo.tempo_perdido_espera_horas || 0}h) separada da Disponibilidade Inerente ({resumo.linhas_ativas_consideradas || 1} linha(s))
                  </p>
                </div>
              </div>

              {/* CARD 2: MTTR LÍQUIDO PURO */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-[2px] space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    MTTR Líquido Puro
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    Intervenção
                  </span>
                </div>
                <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white flex items-baseline gap-1.5">
                  <span>{resumo.mttr_medio_minutos}</span>
                  <span className="text-xs text-slate-400 font-sans font-normal">min</span>
                </div>
                <div>
                  <div className="text-[11px] text-slate-300">
                    Equivalente a <strong>{resumo.mttr_medio_horas}h</strong> por falha
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Desconta pausas operacionais e espera de peças (T3 - T2 - Pausas)
                  </p>
                </div>
              </div>

              {/* CARD 3: MTBF */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-[2px] space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    MTBF (Entre Falhas)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                    Confiabilidade
                  </span>
                </div>
                <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white flex items-baseline gap-1.5">
                  <span>{resumo.mtbf_horas}</span>
                  <span className="text-xs text-slate-400 font-sans font-normal">h</span>
                </div>
                <div>
                  <div className="text-[11px] text-slate-300">
                    Horas nominais entre quebras
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Base: 16h/dia x {periodoDias} dias ({resumo.horas_planejadas}h planejadas)
                  </p>
                </div>
              </div>

              {/* CARD 4: MTTA & DOWNTIME TOTAL */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-[2px] space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Tempo Resposta (MTTA)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                    $T_1 - T_0$
                  </span>
                </div>
                <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white flex items-baseline gap-1.5">
                  <span>{resumo.mtta_medio_minutos}</span>
                  <span className="text-xs text-slate-400 font-sans font-normal">min</span>
                </div>
                <div>
                  <div className="text-[11px] text-slate-300">
                    Downtime Total Acumulado: <strong>{resumo.downtime_total_horas}h</strong>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Total de {resumo.total_os_concluidas} OS concluídas ({resumo.total_os_em_aberto} em aberto)
                  </p>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: DIAGRAMA DE PARETO (CURVA 80/20) & TOP OFENSORES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* GRÁFICO DE PARETO POR SUBSISTEMA */}
              <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 sm:p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-400" />
                      Diagrama de Pareto de Falhas (Regra 80/20)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Distribuição de falhas por subsistema da árvore de falhas
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 font-mono">
                    {resumo.total_os_concluidas} Falhas
                  </span>
                </div>

                {pareto.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Nenhum dado de falha registrado para compor a curva de Pareto.
                  </p>
                ) : (
                  <div className="space-y-3 pt-2">
                    {pareto.map((item, idx) => {
                      const subsistemaNomes = {
                        mecanico: 'Mecânico (Guias / Rolamentos / Estrutura)',
                        mecanica: 'Mecânica (Guias / Rolamentos / Estrutura)',
                        pneumatico: 'Pneumático (Válvulas / Cilindros)',
                        pneumatica: 'Pneumática (Válvulas / Cilindros)',
                        eletrico: 'Elétrico / Automação (Sensores / CLP)',
                        eletrica: 'Elétrica (Sensores / Motores / Cabos)',
                        hidraulico: 'Hidráulico (Pressão / Bombas / Mangueiras)',
                        operacional: 'Operacional / Setup / Dispositivo',
                        automacao: 'Automação / Software (PLC / Robôs)'
                      };

                      const cores = [
                        'bg-rose-500 text-rose-300',
                        'bg-amber-500 text-amber-300',
                        'bg-indigo-500 text-indigo-300',
                        'bg-purple-500 text-purple-300'
                      ];

                      return (
                        <div key={item.subsistema} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-slate-200">
                              {idx + 1}. {subsistemaNomes[item.subsistema] || item.subsistema}
                            </span>
                            <div className="space-x-2 font-mono">
                              <span className="text-white font-bold">{item.quantidade} falhas</span>
                              <span className="text-slate-400">({item.percentual}%)</span>
                              <span className="text-indigo-400 font-semibold">Acum: {item.percentual_acumulado}%</span>
                            </div>
                          </div>

                          {/* Barra de Proporção + Linha Acumulada */}
                          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 relative">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${cores[idx % cores.length].split(' ')[0]}`}
                              style={{ width: `${item.percentual}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* TOP 5 MAIORES OFENSORES DA PLANTA (DUAL PARETO: DOWNTIME VS VOLUME) */}
              <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      Top 5 Bad Actors (Dual Pareto)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ranking por horas paradas (Downtime) ou repetitividade (Frequência)
                    </p>
                  </div>
                  <div className="flex gap-1 bg-slate-950 p-1 rounded-[2px] border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setModoOfensores('downtime')}
                      className={`px-2 py-1 rounded-[2px] font-bold ${
                        modoOfensores === 'downtime' ? 'bg-rose-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      Downtime (h)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoOfensores('volume')}
                      className={`px-2 py-1 rounded-[2px] font-bold ${
                        modoOfensores === 'volume' ? 'bg-amber-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      Volume (Qtd)
                    </button>
                  </div>
                </div>

                {ofensores.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Nenhum maquinário com tempo de parada acumulado no período.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {ofensores.map((ofensor, idx) => (
                      <div
                        key={ofensor.ativo_id}
                        className="bg-slate-950 border border-slate-800 p-3 rounded-[2px] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-400 font-mono font-bold flex items-center justify-center text-xs shrink-0 border border-rose-500/20">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-sm">
                                {ofensor.tag_patrimonio}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  ofensor.criticidade === 'A'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                Crit. {ofensor.criticidade}
                              </span>
                            </div>
                            <p className="text-slate-300 font-medium mt-0.5">{ofensor.ativo_nome}</p>
                            <span className="text-[10px] text-slate-500">{ofensor.linha_nome}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-black text-rose-400 text-sm">
                            {ofensor.downtime_horas}h parada
                          </div>
                          <span className="text-[11px] text-slate-400 block">
                            {ofensor.total_quebras} quebras • MTTR: {ofensor.mttr_medio_minutos} min
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO 2B: CAUSAS RAIZ ISO 14224 (% POR SETOR FABRIL) */}
            {causasPorSetor.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 sm:p-5 space-y-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Distribuição de Causas Raiz ISO 14224 (% por Setor)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {causasPorSetor.slice(0, 6).map((item, idx) => (
                    <div
                      key={`${item.setor}-${item.codigo_iso}-${idx}`}
                      className="bg-slate-950 border border-slate-800 p-3 rounded-[2px] text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-300 uppercase text-[10px]">
                          Setor: {item.setor}
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {item.percentual_setor}% ({item.quantidade}x)
                        </span>
                      </div>
                      <p className="text-white font-semibold">
                        [{item.codigo_iso}] {item.causa_raiz}
                      </p>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, item.percentual_setor)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEÇÃO 3: DESEMPENHO POR LINHA DE PRODUÇÃO */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 sm:p-5 space-y-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                Performance Consolidada por Linha de Produção
              </h3>

              {linhasData.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  Nenhum chamado concluído nas linhas no período selecionado.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2 font-semibold">Linha Fabril</th>
                        <th className="pb-2 font-semibold text-center">Total de Ordens de Serviço</th>
                        <th className="pb-2 font-semibold text-center">Downtime Acumulado</th>
                        <th className="pb-2 font-semibold text-center">MTTR Médio Líquido</th>
                        <th className="pb-2 font-semibold text-right">Status Operacional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {linhasData.map((l) => (
                        <tr key={l.linha_id} className="hover:bg-slate-950/40">
                          <td className="py-2.5 font-bold text-white font-sans">{l.linha_nome}</td>
                          <td className="py-2.5 text-center text-slate-300">{l.total_os} OS</td>
                          <td className="py-2.5 text-center text-amber-400 font-bold">{l.downtime_horas} h</td>
                          <td className="py-2.5 text-center text-slate-200">{l.mttr_medio_minutos} min</td>
                          <td className="py-2.5 text-right font-sans">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              Operação Estável
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SEÇÃO 4: SINALIZAÇÕES DE REVISÃO PREVENTIVA (FEEDBACK LOOP) */}
            {resumo.revisao_preventiva_sinalizada > 0 && (
              <div className="bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-[2px] p-4 flex items-center justify-between text-xs text-amber-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-[2px] text-amber-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {resumo.revisao_preventiva_sinalizada} Falhas Sinalizadas para Revisão Preventiva
                    </h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Os técnicos de campo apontaram necessidade de ajustar planos de manutenção periódica para evitar quebras repetitivas.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rodapé institucional */}
      <div className="border-t border-slate-900 pt-3 text-center text-[10px] text-slate-500 mt-6 print:hidden">
        CMMS FAETERJ • Motor de Indicadores Industriais & Confiabilidade (MTBF / MTTR Líquido / Disponibilidade WCM)
      </div>
    </div>
  );
}