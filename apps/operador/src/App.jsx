import { useState, useEffect } from 'react';
import {
  Check,
  CheckSquare,
  Send,
  ArrowLeft,
  Camera,
  RefreshCw,
  CheckCircle2,
  Edit2,
  X
} from 'lucide-react';
import ScannerCamera from './components/ScannerCamera';
import VanguardLogo from './components/VanguardLogo';

export default function App() {
  // O app já abre DIRETAMENTE na tela do scanner (Zero cliques intermediários)
  const [tela, setTela] = useState('scanner'); // 'scanner' | 'gabarito' | 'sucesso'

  // Identificação do Operador: Nome + Identifiant (Código da Fábrica)
  // Conforme padrão do chão de fábrica e mockup: Jhon Doe - 226244
  const [identifiant, setIdentifiant] = useState(
    localStorage.getItem('cmms_operador_identifiant') || '226244'
  );
  const [nomeOperador, setNomeOperador] = useState(
    localStorage.getItem('cmms_operador_nome') || 'Jhon Doe'
  );
  const [modalEditarOperador, setModalEditarOperador] = useState(false);

  // Dados do Ativo escaneado
  const [ativoData, setAtivoData] = useState(null);
  const [carregandoAtivo, setCarregandoAtivo] = useState(false);

  // Gabarito de Sintomas (Múltipla Escolha / Conferes)
  const [sintomasDisponiveis, setSintomasDisponiveis] = useState([]);
  const [sintomasSelecionados, setSintomasSelecionados] = useState([]);
  const [observacaoTexto, setObservacaoTexto] = useState('');

  // Status de envio e resultado
  const [enviando, setEnviando] = useState(false);
  const [chamadoCriado, setChamadoCriado] = useState(null);

  // Lista padrão de sintomas de fábrica (Gabarito de Conferes)
  const sintomasPadrao = [
    { id: 2, descricao: 'Vazamento Pneumático / Queda de Pressão de Ar', categoria: 'pneumatica' },
    { id: 1, descricao: 'Falha de Alimentação / Peça Travada no Posto', categoria: 'mecanica' },
    { id: 3, descricao: 'Sensor Óptico Apagado / Falha Elétrica', categoria: 'eletrica' },
    { id: 4, descricao: 'Superaquecimento ou Fumaça no Motor/Mancal', categoria: 'mecanica' },
    { id: 5, descricao: 'Ruído Estranho / Vibração Anormal na Linha', categoria: 'mecanica' },
    { id: 6, descricao: 'Braço Robótico / Pinça não trava no ciclo', categoria: 'automacao' },
    { id: 7, descricao: 'Outro Defeito / Anomalia Mecânica', categoria: 'geral' }
  ];

  function salvarOperador(codigo, nome) {
    setIdentifiant(codigo);
    setNomeOperador(nome);
    localStorage.setItem('cmms_operador_identifiant', codigo);
    localStorage.setItem('cmms_operador_nome', nome);
    setModalEditarOperador(false);
  }

  // 1. AÇÃO: QR Code Lido com Sucesso
  async function handleQRScanned(qrContent) {
    setTela('gabarito');
    setCarregandoAtivo(true);
    setSintomasSelecionados([]);
    setObservacaoTexto('');

    try {
      let token = qrContent;
      if (qrContent.includes('/')) {
        token = qrContent.split('/').pop();
      }

      const res = await fetch(`/api/ativos/qr/${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error('Máquina não localizada.');
      const data = await res.json();
      setAtivoData(data.ativo);

      if (data.sintomas && data.sintomas.length > 0) {
        setSintomasDisponiveis(data.sintomas);
      } else {
        setSintomasDisponiveis(sintomasPadrao);
      }
    } catch (err) {
      console.warn('Fallback de ativo:', err);
      // Fallback seguro caso offline
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

  // 2. AÇÃO: Marcar/Desmarcar Confere no Gabarito
  function toggleSintoma(sintoma) {
    if (sintomasSelecionados.some((s) => s.id === sintoma.id)) {
      setSintomasSelecionados(sintomasSelecionados.filter((s) => s.id !== sintoma.id));
    } else {
      setSintomasSelecionados([...sintomasSelecionados, sintoma]);
    }
  }

  // 3. AÇÃO: Confirmar e Enviar Chamado ($T_0$)
  async function handleEnviarChamado() {
    if (sintomasSelecionados.length === 0 && !observacaoTexto.trim()) {
      alert('Marque no gabarito pelo menos um sintoma da falha.');
      return;
    }

    setEnviando(true);
    try {
      const sintomaPrincipal = sintomasSelecionados[0];
      const descricaoConsolidada = [
        ...sintomasSelecionados.map((s) => s.descricao),
        observacaoTexto.trim() ? `Obs: ${observacaoTexto.trim()}` : ''
      ].filter(Boolean).join(' | ');

      const res = await fetch('/api/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ativo_id: ativoData?.id || 1,
          operador_matricula: identifiant,
          operador_nome: nomeOperador,
          sintoma_id: sintomaPrincipal?.id || 1,
          descricao_sintoma: descricaoConsolidada
        })
      });

      if (!res.ok) throw new Error('Falha ao registrar chamado.');
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
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between max-w-md mx-auto relative select-none">
      {/* HEADER SUPERIOR (EXATAMENTE COMO NO WIREFRAME DO USUÁRIO) */}
      <header className="bg-black pt-3 pb-3 px-4 text-center border-b border-zinc-900 shrink-0">
        {/* Ícone Central da Vanguard */}
        <div className="flex justify-center mb-1.5">
          <VanguardLogo variant="icon" size="lg" />
        </div>

        {/* Linha do Operador: Nome - Identifiant */}
        <div
          onClick={() => setModalEditarOperador(true)}
          className="cursor-pointer inline-flex items-center gap-1.5 hover:opacity-80 active:scale-95 transition-all"
          title="Toque para alterar nome ou Identifiant da fábrica"
        >
          <h2 className="text-sm font-black text-white tracking-wide">
            Operador: {nomeOperador} - {identifiant}
          </h2>
          <Edit2 className="w-3 h-3 text-zinc-500" />
        </div>
      </header>

      {/* MODAL DE EDIÇÃO DE IDENTIFIANT / OPERADOR */}
      {modalEditarOperador && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="font-bold text-xs text-white">Identificação da Fábrica</span>
              <button onClick={() => setModalEditarOperador(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <label className="text-zinc-400 block font-semibold">Nome do Operador:</label>
              <input
                type="text"
                value={nomeOperador}
                onChange={(e) => setNomeOperador(e.target.value)}
                placeholder="Ex: Jhon Doe"
                className="w-full bg-black border border-zinc-700 rounded-xl p-2.5 text-white"
              />
              <label className="text-zinc-400 block font-semibold pt-1">Identifiant (Código da Fábrica):</label>
              <input
                type="text"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                placeholder="Ex: 226244"
                className="w-full bg-black border border-zinc-700 rounded-xl p-2.5 text-white font-mono"
              />
            </div>
            <button
              onClick={() => salvarOperador(identifiant, nomeOperador)}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg"
            >
              Salvar Identifiant
            </button>
          </div>
        </div>
      )}

      {/* TELA 1: SCANNER DIRETO (CÂMERA ATIVA AO ABRIR O APP + LANTERNA AUTOMÁTICA) */}
      {tela === 'scanner' && (
        <ScannerCamera
          onScanSuccess={handleQRScanned}
          nomeOperador={nomeOperador}
          matricula={identifiant}
        />
      )}

      {/* TELA 2: GABARITO DE SINTOMAS COM CONFERES (PÓS-LEITURA DO QR CODE) */}
      {tela === 'gabarito' && (
        <div className="flex-1 flex flex-col justify-between p-4 bg-zinc-950 space-y-3">
          <div>
            {/* Barra de Retorno ao Scanner */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <button
                type="button"
                onClick={() => setTela('scanner')}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar à Câmera</span>
              </button>
              <button
                type="button"
                onClick={() => setTela('scanner')}
                className="text-xs text-red-400 font-bold flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Escanear Outra</span>
              </button>
            </div>

            {/* Cartão de Identificação da Máquina */}
            {carregandoAtivo ? (
              <div className="py-8 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 text-red-500 animate-spin" />
                <span>Identificando máquina...</span>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 mt-2 space-y-1 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-lg text-white tracking-wider">
                    {ativoData?.tag_patrimonio}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      ativoData?.criticidade === 'A'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    Criticidade {ativoData?.criticidade}
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-zinc-200">{ativoData?.nome}</h3>
                <p className="text-[11px] text-zinc-400">
                  {ativoData?.linha_nome} • {ativoData?.posto_trabalho}
                </p>
              </div>
            )}

            {/* GABARITO DE SINTOMAS: LISTINHA COM CONFERES */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-red-500" />
                  Marque o que está acontecendo:
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {sintomasSelecionados.length} selecionado(s)
                </span>
              </div>

              {/* Lista dos Conferes */}
              <div className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
                {sintomasDisponiveis.map((item) => {
                  const isChecked = sintomasSelecionados.some((s) => s.id === item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSintoma(item)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between active:scale-98 ${
                        isChecked
                          ? 'bg-red-950/40 border-red-500 shadow-md text-white ring-1 ring-red-500'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 pr-2">
                        {/* Confere Tátil */}
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all ${
                            isChecked
                              ? 'bg-red-600 text-white'
                              : 'bg-black border border-zinc-700 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>

                        <span className="font-semibold text-xs leading-snug">
                          {item.descricao}
                        </span>
                      </div>

                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-black text-zinc-500 shrink-0">
                        {item.categoria}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Campo de Texto Opcional */}
              <div className="pt-2">
                <input
                  type="text"
                  value={observacaoTexto}
                  onChange={(e) => setObservacaoTexto(e.target.value)}
                  placeholder="Alguma observação extra? (Opcional)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* BOTÃO CONFIRMAR E ENVIAR ($T_0$) */}
          <div className="pt-2">
            <button
              type="button"
              disabled={enviando || sintomasSelecionados.length === 0}
              onClick={handleEnviarChamado}
              className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all ${
                sintomasSelecionados.length > 0
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/40 border border-red-500 animate-pulse'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
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
                  <span>Confirmar e Enviar ($T_0$)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TELA 3: SUCESSO / CONFIRMAÇÃO IMEDIATA */}
      {tela === 'sucesso' && (
        <div className="flex-1 flex flex-col justify-between p-6 bg-zinc-950 text-center">
          <div className="my-auto space-y-4">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 rounded-3xl flex items-center justify-center mx-auto text-emerald-400 shadow-2xl animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400 block">
                Marco T₀ Registrado
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Chamado Enviado à Manutenção!
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                O Team Leader e a equipe técnica já receberam o alerta no Cockpit.
              </p>
            </div>

            {/* Dossiê da OS */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left space-y-2 max-w-xs mx-auto shadow-lg text-xs font-mono">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Número da OS:</span>
                <span className="text-white font-bold text-sm">{chamadoCriado?.numero_os}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Máquina:</span>
                <span className="text-white">{ativoData?.tag_patrimonio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Posto:</span>
                <span className="text-zinc-300">{ativoData?.posto_trabalho}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Operador:</span>
                <span className="text-zinc-300">{nomeOperador} ({identifiant})</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTela('scanner'); // Volta direto para a câmera pronta para a próxima máquina
              setChamadoCriado(null);
              setAtivoData(null);
            }}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>Escanear Próxima Máquina</span>
          </button>
        </div>
      )}
    </div>
  );
}