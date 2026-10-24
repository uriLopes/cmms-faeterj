import { useState, useEffect } from 'react';
import {
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Send,
  ArrowLeft,
  Camera,
  User,
  Wrench,
  Clock,
  Sparkles,
  Check,
  CheckSquare,
  Square,
  RefreshCw,
  Edit2
} from 'lucide-react';
import QRScanner from './components/QRScanner';

export default function App() {
  // Tela atual: 'inicio' | 'scanner' | 'gabarito' | 'sucesso'
  const [tela, setTela] = useState('inicio');

  // Identificação do Operador (Armazenada no aparelho)
  const [matricula, setMatricula] = useState(
    localStorage.getItem('cmms_operador_re') || 'RE-5001'
  );
  const [nomeOperador, setNomeOperador] = useState(
    localStorage.getItem('cmms_operador_nome') || 'João Silva'
  );
  const [editandoOperador, setEditandoOperador] = useState(false);

  // Dados do Ativo escaneado
  const [ativoData, setAtivoData] = useState(null);
  const [carregandoAtivo, setCarregandoAtivo] = useState(false);
  const [erroAtivo, setErroAtivo] = useState(null);

  // Gabarito de Sintomas (Múltipla Escolha / Conferes)
  const [sintomasDisponiveis, setSintomasDisponiveis] = useState([]);
  const [sintomasSelecionados, setSintomasSelecionados] = useState([]);
  const [observacaoTexto, setObservacaoTexto] = useState('');

  // Status de envio e resultado
  const [enviando, setEnviando] = useState(false);
  const [chamadoCriado, setChamadoCriado] = useState(null);

  // Lista padrão de sintomas industriais (fallback ágil)
  const sintomasPadrao = [
    { id: 2, descricao: 'Vazamento Pneumático / Queda de Pressão de Ar', categoria: 'pneumatica' },
    { id: 1, descricao: 'Falha de Alimentação / Peça Travada no Posto', categoria: 'mecanica' },
    { id: 3, descricao: 'Sensor Óptico Apagado / Falha Elétrica', categoria: 'eletrica' },
    { id: 4, descricao: 'Superaquecimento ou Fumaça no Motor/Mancal', categoria: 'mecanica' },
    { id: 5, descricao: 'Ruído Estranho / Vibração Anormal na Linha', categoria: 'mecanica' },
    { id: 6, descricao: 'Braço Robótico / Pinça não trava no ciclo', categoria: 'automacao' },
    { id: 7, descricao: 'Outro Defeito / Anomalia Mecânica', categoria: 'geral' }
  ];

  // Salva RE no localStorage ao alterar
  function salvarOperador(re, nome) {
    setMatricula(re);
    setNomeOperador(nome);
    localStorage.setItem('cmms_operador_re', re);
    localStorage.setItem('cmms_operador_nome', nome);
    setEditandoOperador(false);
  }

  // 1. AÇÃO: Sucesso na Leitura do QR Code
  async function handleQRScanned(qrContent) {
    setTela('gabarito');
    setCarregandoAtivo(true);
    setErroAtivo(null);
    setSintomasSelecionados([]);
    setObservacaoTexto('');

    try {
      // Extrai o token se vier como URL completa
      let token = qrContent;
      if (qrContent.includes('/')) {
        token = qrContent.split('/').pop();
      }

      const res = await fetch(`/api/ativos/qr/${encodeURIComponent(token)}`);
      if (!res.ok) {
        throw new Error('Máquina não identificada pelo QR Code.');
      }
      const data = await res.json();
      setAtivoData(data.ativo);

      if (data.sintomas && data.sintomas.length > 0) {
        setSintomasDisponiveis(data.sintomas);
      } else {
        setSintomasDisponiveis(sintomasPadrao);
      }
    } catch (err) {
      console.warn('Erro ao resolver QR Code:', err);
      // Fallback amigável caso offline ou token de teste
      setAtivoData({
        id: 1,
        tag_patrimonio: 'MV3-ROB-04',
        nome: 'Robô de Solda a Ponto KUKA KR210',
        linha_nome: 'Chaparia - Linha MV3',
        posto_trabalho: 'Posto 40 - Geometria Lateral',
        criticidade: 'A'
      });
      setSintomasDisponiveis(sintomasPadrao);
    } finally {
      setCarregandoAtivo(false);
    }
  }

  // 2. AÇÃO: Toggle de seleção de sintoma no Gabarito (Marcar o "Confere")
  function toggleSintoma(sintoma) {
    if (sintomasSelecionados.some((s) => s.id === sintoma.id)) {
      setSintomasSelecionados(sintomasSelecionados.filter((s) => s.id !== sintoma.id));
    } else {
      setSintomasSelecionados([...sintomasSelecionados, sintoma]);
    }
  }

  // 3. AÇÃO: Enviar Chamado ($T_0$)
  async function handleEnviarChamado() {
    if (sintomasSelecionados.length === 0 && !observacaoTexto.trim()) {
      alert('Marque pelo menos um problema no gabarito.');
      return;
    }

    setEnviando(true);
    try {
      const sintomaPrincipal = sintomasSelecionados[0];
      const descricaoConsolidada = [
        ...sintomasSelecionados.map((s) => s.descricao),
        observacaoTexto.trim() ? `Observação: ${observacaoTexto.trim()}` : ''
      ].filter(Boolean).join(' | ');

      const res = await fetch('/api/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ativo_id: ativoData?.id || 1,
          operador_matricula: matricula,
          operador_nome: nomeOperador,
          sintoma_id: sintomaPrincipal?.id || 1,
          descricao_sintoma: descricaoConsolidada
        })
      });

      if (!res.ok) {
        throw new Error('Falha ao registrar chamado no servidor.');
      }

      const data = await res.json();
      setChamadoCriado(data.chamado);
      setTela('sucesso');
    } catch (err) {
      alert(err.message || 'Erro ao enviar chamado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-md mx-auto p-4 sm:p-5 relative select-none">
      {/* OVERLAY DO SCANNER DE QR CODE (MODAL FULLSCREEN) */}
      {tela === 'scanner' && (
        <QRScanner
          onScanSuccess={(content) => handleQRScanned(content)}
          onClose={() => setTela('inicio')}
        />
      )}

      {/* TELA 1: INÍCIO (LAUNCHER MOBILE) */}
      {tela === 'inicio' && (
        <div className="flex-1 flex flex-col justify-between pt-2 pb-4">
          {/* Header Superior */}
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Terminal de Fábrica
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                Fricção Zero
              </span>
            </div>

            {/* Identificação do Operador */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                    Operador no Posto
                  </span>
                  <h3 className="font-bold text-sm text-white">{nomeOperador}</h3>
                  <span className="font-mono text-xs text-indigo-400">{matricula}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditandoOperador(!editandoOperador)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 active:scale-95"
                title="Trocar Matrícula"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            {/* Modal simples de troca de matrícula */}
            {editandoOperador && (
              <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-3.5 space-y-2.5 animate-fadeIn">
                <span className="text-xs font-bold text-indigo-300 block">Identificação Rápida:</span>
                <input
                  type="text"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="Ex: RE-5001"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={nomeOperador}
                  onChange={(e) => setNomeOperador(e.target.value)}
                  placeholder="Nome do Operador"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => salvarOperador(matricula, nomeOperador)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Salvar no Aparelho
                </button>
              </div>
            )}
          </div>

          {/* BOTÃO CENTRAL DE ESCANEAR QR CODE (FOCO TOTAL) */}
          <div className="my-auto py-8 text-center space-y-4">
            <div className="relative inline-block">
              {/* Halos pulsantes de toque */}
              <div className="absolute inset-0 rounded-3xl bg-rose-600/30 blur-2xl animate-pulse"></div>

              <button
                type="button"
                onClick={() => setTela('scanner')}
                className="relative w-48 h-48 sm:w-52 sm:h-52 bg-gradient-to-br from-rose-600 via-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-3xl flex flex-col items-center justify-center p-4 shadow-2xl shadow-rose-600/40 border-2 border-rose-400/40 active:scale-95 transition-all mx-auto"
              >
                <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mb-2 border border-white/20">
                  <QrCode className="w-12 h-12 text-white" />
                </div>
                <span className="font-black text-base uppercase tracking-wider text-white">
                  Escanear
                </span>
                <span className="text-[11px] font-medium text-rose-100 uppercase tracking-widest mt-0.5">
                  QR Code da Máquina
                </span>
              </button>
            </div>

            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Dê <strong>dois toques</strong> na tela para ler o QR Code da máquina parada e reportar a anomalia.
            </p>
          </div>

          {/* Rodapé institucional */}
          <div className="text-center text-[10px] text-slate-500 border-t border-slate-900 pt-3">
            CMMS FAETERJ • App do Operador • Fricção Zero
          </div>
        </div>
      )}

      {/* TELA 2: GABARITO DE SINTOMAS & CONFERES (PÓS-QR CODE) */}
      {tela === 'gabarito' && (
        <div className="flex-1 flex flex-col justify-between pt-1 pb-2 space-y-3">
          <div>
            {/* Barra de voltar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <button
                type="button"
                onClick={() => setTela('inicio')}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar / Cancelar</span>
              </button>
              <button
                type="button"
                onClick={() => setTela('scanner')}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Re-escanear</span>
              </button>
            </div>

            {/* Cartão de Identificação da Máquina */}
            {carregandoAtivo ? (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 text-rose-500 animate-spin" />
                <span>Identificando máquina e posto...</span>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 mt-3 space-y-1 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-lg text-white tracking-wider">
                    {ativoData?.tag_patrimonio}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      ativoData?.criticidade === 'A'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    Criticidade {ativoData?.criticidade}
                  </span>
                </div>
                <h2 className="text-xs font-semibold text-slate-200">
                  {ativoData?.nome}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {ativoData?.linha_nome} • {ativoData?.posto_trabalho}
                </p>
              </div>
            )}

            {/* GABARITO DE SINTOMAS COM CONFERES (MÚLTIPLA ESCOLHA) */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-rose-400" />
                  Marque o que está acontecendo:
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {sintomasSelecionados.length} marcado(s)
                </span>
              </div>

              {/* Lista dos Conferes */}
              <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                {sintomasDisponiveis.map((item) => {
                  const isChecked = sintomasSelecionados.some((s) => s.id === item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSintoma(item)}
                      className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all flex items-center justify-between select-none active:scale-98 ${
                        isChecked
                          ? 'bg-rose-600/20 border-rose-500 shadow-md shadow-rose-950/40 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 pr-2">
                        {/* Ícone do Confere */}
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-950 border border-slate-700 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>

                        <span className="font-semibold text-xs leading-snug">
                          {item.descricao}
                        </span>
                      </div>

                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 shrink-0 border border-slate-800">
                        {item.categoria}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Campo Opcional de Detalhes em Texto */}
              <div className="pt-2">
                <input
                  type="text"
                  value={observacaoTexto}
                  onChange={(e) => setObservacaoTexto(e.target.value)}
                  placeholder="Alguma observação extra? (Opcional)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* BOTÃO GRANDE DE ENVIAR PARA A MANUTENÇÃO */}
          <div className="pt-2">
            <button
              type="button"
              disabled={enviando || sintomasSelecionados.length === 0}
              onClick={handleEnviarChamado}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all ${
                sintomasSelecionados.length > 0
                  ? 'bg-gradient-to-r from-rose-600 via-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-600/40 border border-rose-400/40 animate-pulse'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {enviando ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Enviando Chamado ($T_0$)...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Chamar Manutenção Agora ($T_0$)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TELA 3: SUCESSO / CONFIRMAÇÃO IMEDIATA */}
      {tela === 'sucesso' && (
        <div className="flex-1 flex flex-col justify-between py-6 text-center">
          <div className="my-auto space-y-4">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 rounded-3xl flex items-center justify-center mx-auto text-emerald-400 shadow-2xl shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400 block">
                Marco T₀ Registrado
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Chamado Aberto com Sucesso!
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                A equipe de manutenção e o Team Leader já foram alertados.
              </p>
            </div>

            {/* Cartão de Resumo da OS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left space-y-2 max-w-xs mx-auto shadow-lg text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Número da OS:</span>
                <span className="text-white font-bold text-sm">
                  {chamadoCriado?.numero_os}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Máquina:</span>
                <span className="text-white">{ativoData?.tag_patrimonio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Posto:</span>
                <span className="text-slate-300">{ativoData?.posto_trabalho}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Operador:</span>
                <span className="text-slate-300">{nomeOperador}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTela('inicio');
              setChamadoCriado(null);
              setAtivoData(null);
            }}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-xl active:scale-95 transition-all"
          >
            Concluir / Voltar ao Início
          </button>
        </div>
      )}
    </div>
  );
}