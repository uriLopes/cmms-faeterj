import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Zap,
  Wind,
  ShieldAlert,
  HelpCircle,
  Clock,
  QrCode,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api';
import { offlineStorage } from '../services/offlineStorage';
import NetworkStatusBadge from '../components/NetworkStatusBadge';

// Ícones por categoria de sintoma
function getSintomaIcon(categoria) {
  switch (categoria) {
    case 'pneumatica':
      return <Wind className="w-6 h-6 text-cyan-400" />;
    case 'eletrica':
      return <Zap className="w-6 h-6 text-amber-400" />;
    case 'seguranca':
      return <ShieldAlert className="w-6 h-6 text-rose-500" />;
    case 'mecanica':
    default:
      return <Wrench className="w-6 h-6 text-indigo-400" />;
  }
}

export default function OperadorChamado() {
  const { token: paramToken } = useParams();
  const navigate = useNavigate();

  // Estados principais
  const [token, setToken] = useState(paramToken || 'qr_mv3_rob_04_token_hash_faeterj_2026');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [ativoData, setAtivoData] = useState(null);
  const [sintomas, setSintomas] = useState([]);
  const [emAtendimento, setEmAtendimento] = useState(false);
  const [osAtiva, setOsAtiva] = useState(null);

  // Dados do formulário
  const [matricula, setMatricula] = useState('');
  const [nomeOperador, setNomeOperador] = useState('');
  const [sintomaSelecionado, setSintomaSelecionado] = useState(null);
  const [descricaoExtra, setDescricaoExtra] = useState('');
  const [mostrarExtra, setMostrarExtra] = useState(false);
  const [submetendo, setSubmetendo] = useState(false);

  // Estado de confirmação pós-abertura
  const [sucessoChamado, setSucessoChamado] = useState(null);

  // Carrega RE salvo previamente no aparelho
  useEffect(() => {
    const salvo = offlineStorage.obterOperador();
    if (salvo.matricula) setMatricula(salvo.matricula);
    if (salvo.nome) setNomeOperador(salvo.nome);
  }, []);

  // Carrega dados do ativo via QR Code
  useEffect(() => {
    carregarAtivo(token);
  }, [token]);

  async function carregarAtivo(tokenConsultar) {
    setLoading(true);
    setErro(null);
    try {
      if (navigator.onLine) {
        const data = await api.get(`/ativos/qr/${tokenConsultar}`);
        setAtivoData(data.ativo);
        setSintomas(data.sintomas || []);
        setEmAtendimento(data.em_atendimento);
        setOsAtiva(data.os_ativa);
        offlineStorage.salvarCacheAtivo(tokenConsultar, data);
      } else {
        // Fallback offline (Gaiola de Faraday)
        const cached = offlineStorage.obterCacheAtivo(tokenConsultar);
        if (cached) {
          setAtivoData(cached.ativo);
          setSintomas(cached.sintomas || []);
          setEmAtendimento(cached.em_atendimento);
          setOsAtiva(cached.os_ativa);
        } else {
          setErro('Sem conexão e sem cache prévio para este QR Code.');
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar online, verificando cache:', err);
      const cached = offlineStorage.obterCacheAtivo(tokenConsultar);
      if (cached) {
        setAtivoData(cached.ativo);
        setSintomas(cached.sintomas || []);
        setEmAtendimento(cached.em_atendimento);
        setOsAtiva(cached.os_ativa);
      } else {
        setErro(err.message || 'Ativo não identificado.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Submissão com Fricção Zero (2 toques)
  async function handleAbrirChamado(e) {
    if (e) e.preventDefault();

    if (!matricula.trim()) {
      alert('Por favor, informe seu RE/Matrícula de crachá.');
      return;
    }

    if (!sintomaSelecionado) {
      alert('Selecione o sintoma da anomalia no maquinário.');
      return;
    }

    setSubmetendo(true);
    offlineStorage.salvarOperador(matricula, nomeOperador);

    const payload = {
      qr_code_token: token,
      ativo_id: ativoData?.id,
      operador_matricula: matricula.trim(),
      operador_nome: nomeOperador.trim() || `Operador RE-${matricula.trim()}`,
      sintoma_id: sintomaSelecionado.id,
      descricao_sintoma: descricaoExtra.trim() || sintomaSelecionado.descricao
    };

    try {
      if (navigator.onLine) {
        const resposta = await api.post('/chamados', payload);
        setSucessoChamado(resposta.chamado);
      } else {
        // Resiliência Offline: enfileira localmente
        const itemFila = offlineStorage.enfileirarChamado(payload);
        setSucessoChamado({
          numero_os: `OFFLINE-${Date.now().toString().slice(-4)}`,
          ativo_nome: ativoData?.nome,
          tag_patrimonio: ativoData?.tag_patrimonio,
          linha_nome: ativoData?.linha_nome,
          t0_abertura: itemFila.data_criacao_local,
          status: 'aberto (pendente de sincronização)',
          offline: true
        });
      }
    } catch (err) {
      alert('Falha ao abrir chamado online. Salvando offline no aparelho...');
      const itemFila = offlineStorage.enfileirarChamado(payload);
      setSucessoChamado({
        numero_os: `OFFLINE-${Date.now().toString().slice(-4)}`,
        ativo_nome: ativoData?.nome,
        tag_patrimonio: ativoData?.tag_patrimonio,
        linha_nome: ativoData?.linha_nome,
        t0_abertura: itemFila.data_criacao_local,
        status: 'aberto (pendente de sincronização)',
        offline: true
      });
    } finally {
      setSubmetendo(false);
    }
  }

  // TELA DE SUCESSO / CONFIRMAÇÃO DO CHAMADO (T0)
  if (sucessoChamado) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 flex flex-col justify-between max-w-md mx-auto">
        <div className="pt-6 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>

          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
              {sucessoChamado.offline ? 'Gravado no Aparelho' : 'Registrado com Sucesso'}
            </span>
            <h1 className="text-2xl font-black text-white mt-1">
              {sucessoChamado.numero_os}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Timestamp $T_0$: {new Date(sucessoChamado.t0_abertura).toLocaleTimeString()}
            </p>
          </div>

          {/* Cartão de Resumo da Parada */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-4 text-left space-y-2 text-sm shadow-xl">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Ativo / Posto:</span>
              <span className="font-mono font-bold text-white">{sucessoChamado.tag_patrimonio || ativoData?.tag_patrimonio}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Linha:</span>
              <span className="font-medium text-slate-200">{sucessoChamado.linha_nome || ativoData?.linha_nome}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Status da Máquina:</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Parada (Quebra Reportada)
              </span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Operador:</span>
              <span className="text-slate-300 font-mono">RE-{matricula}</span>
            </div>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-[2px] p-3 text-xs text-indigo-300 text-left">
            <p className="font-semibold flex items-center gap-1.5 text-indigo-200">
              <Clock className="w-4 h-4 text-indigo-400" />
              Notificação em Tempo Real Disparada
            </p>
            <p className="mt-1 text-slate-400">
              O Team Leader e a central de manutenção já receberam o alerta sonoro e visual. O técnico está sendo atribuído.
            </p>
          </div>
        </div>

        <div className="py-6 space-y-3">
          <button
            onClick={() => {
              setSucessoChamado(null);
              setSintomaSelecionado(null);
              setDescricaoExtra('');
              carregarAtivo(token);
            }}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-[2px] active:scale-98 transition-all"
          >
            Acompanhar Status da Máquina
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 text-slate-400 hover:text-white text-sm"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  // TELA PRINCIPAL DE ABERTURA EM 2 TOQUES
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-md mx-auto p-4">
      {/* Topo / Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 -ml-1.5 text-slate-400 hover:text-white rounded-[2px] hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-sm tracking-wide uppercase text-slate-200">
                Abertura de Chamado
              </h1>
              <span className="text-[10px] text-slate-500">CMMS Operador • Fricção Zero</span>
            </div>
          </div>
          <NetworkStatusBadge onSyncComplete={() => carregarAtivo(token)} />
        </div>

        {/* Seletor rápido de máquinas para teste/simulação em desktop */}
        <div className="pt-3 pb-2 flex gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
          <span className="text-slate-500 shrink-0 self-center">Exemplos:</span>
          {[
            { tag: 'MV3-ROB-04', token: 'qr_mv3_rob_04_token_hash_faeterj_2026' },
            { tag: 'HC1-APT-02', token: 'qr_hc1_apt_02_token_hash_faeterj_2026' },
            { tag: 'PNT-CAB-01', token: 'qr_pnt_cab_01_token_hash_faeterj_2026' },
            { tag: 'BNC-CNV-01', token: 'qr_bnc_cnv_01_token_hash_faeterj_2026' }
          ].map((item) => (
            <button
              key={item.tag}
              onClick={() => {
                setToken(item.token);
                setSucessoChamado(null);
              }}
              className={`px-2.5 py-1 rounded font-mono shrink-0 transition-all ${
                token === item.token
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {item.tag}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Identificando maquinário físico...</p>
          </div>
        ) : erro ? (
          <div className="py-12 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm text-slate-300">{erro}</p>
            <button
              onClick={() => carregarAtivo(token)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-[2px] font-medium"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Cartão do Ativo Escaneado */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-3.5 shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg text-white tracking-wider">
                      {ativoData?.tag_patrimonio}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        ativoData?.criticidade === 'A'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : ativoData?.criticidade === 'B'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      }`}
                    >
                      Criticidade {ativoData?.criticidade}
                    </span>
                  </div>
                  <h2 className="text-xs font-medium text-slate-300 mt-0.5">
                    {ativoData?.nome}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {ativoData?.linha_nome} • {ativoData?.posto_trabalho}
                  </p>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-[2px] text-slate-400">
                  <QrCode className="w-5 h-5 text-indigo-400" />
                </div>
              </div>

              {/* Alerta de Máquina Já Em Atendimento (Evita duplicidade) */}
              {emAtendimento && osAtiva && (
                <div className="mt-3 bg-amber-500/15 border border-amber-500/30 rounded-[2px] p-2.5 text-xs text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Máquina já possui chamado em andamento:</span>
                  </div>
                  <p className="text-[11px] text-slate-300 pl-5">
                    OS <strong className="text-white">{osAtiva.numero_os}</strong> aberta por {osAtiva.operador_nome}.
                    Status atual: <span className="uppercase text-amber-400 font-semibold">{osAtiva.status}</span>.
                  </p>
                </div>
              )}
            </div>

            {/* Identificação do Operador (Matrícula/RE) */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2px] p-3 space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Sua Matrícula / RE (Crachá):
                </span>
                <span className="text-[10px] text-slate-500">Salva no dispositivo</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                  placeholder="Ex: RE-5001"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-[2px] px-3 py-2 text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {/* TOQUE 1: Grid de Sintomas Tácteis Grandes */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Qual a anomalia observada? (Toque para selecionar)</span>
                {sintomaSelecionado && (
                  <span className="text-[11px] text-indigo-400 font-bold">1 selecionado</span>
                )}
              </label>

              <div className="grid grid-cols-2 gap-2">
                {sintomas.map((s) => {
                  const isSelected = sintomaSelecionado?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSintomaSelecionado(s)}
                      className={`p-3 rounded-[2px] border text-left flex flex-col justify-between min-h-[90px] transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-indigo-600/25 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div>{getSintomaIcon(s.categoria)}</div>
                      <span className={`text-xs font-medium mt-2 leading-tight ${isSelected ? 'text-white font-bold' : 'text-slate-300'}`}>
                        {s.descricao}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opcional: Detalhes extras (expansível) */}
            <div>
              <button
                type="button"
                onClick={() => setMostrarExtra(!mostrarExtra)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 py-1"
              >
                {mostrarExtra ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>Adicionar observação detalhada (opcional)</span>
              </button>

              {mostrarExtra && (
                <textarea
                  rows={2}
                  value={descricaoExtra}
                  onChange={(e) => setDescricaoExtra(e.target.value)}
                  placeholder="Ex: Pinça de solda número 2 vazando na conexão superior..."
                  className="w-full mt-1.5 bg-slate-950 border border-slate-700 rounded-[2px] p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* TOQUE 2: Botão Gigante de Acionamento de Emergência */}
      <div className="pt-4 pb-2">
        <button
          type="button"
          disabled={loading || submetendo || !sintomaSelecionado || !matricula.trim()}
          onClick={handleAbrirChamado}
          className={`w-full py-4 rounded-[2px] font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 shadow-2xl transition-all ${
            !sintomaSelecionado || !matricula.trim() || loading || submetendo
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 active:scale-98'
          }`}
        >
          {submetendo ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Disparando Alarme T0...</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
              <span>Abrir Chamado de Emergência ($T_0$)</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-slate-500 mt-2">
          Protocolo Camaleão • Normas de Segurança ABNT NBR 7195 e ISO 3864
        </p>
      </div>
    </div>
  );
}
