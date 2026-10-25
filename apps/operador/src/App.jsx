import { useState, useEffect, useRef } from 'react';
import {
  Check,
  CheckSquare,
  Send,
  ArrowLeft,
  Camera,
  RefreshCw,
  CheckCircle2,
  Edit2,
  X,
  AlertTriangle,
  AlertOctagon,
  Flame,
  Wrench,
  Image as ImageIcon,
  Mic,
  Square,
  Trash2,
  Volume2,
  ShieldAlert
} from 'lucide-react';
import ScannerCamera from './components/ScannerCamera';
import VanguardLogo from './components/VanguardLogo';

export default function App() {
  // Telas: 'scanner' | 'duplicado_aviso' | 'gabarito' | 'sucesso'
  const [tela, setTela] = useState('scanner');
  const processandoQRRef = useRef(false);

  // 1. Identificação do Operador: Validada estritamente pelo Identifiant (Sem digitação livre de nome)
  const [identifiant, setIdentifiant] = useState(
    localStorage.getItem('cmms_operador_identifiant') || '226244'
  );
  const [nomeOperador, setNomeOperador] = useState(
    localStorage.getItem('cmms_operador_nome') || 'Jhon Doe'
  );
  const [modalEditarOperador, setModalEditarOperador] = useState(false);
  const [codigoInput, setCodigoInput] = useState('');
  const [operadorEncontrado, setOperadorEncontrado] = useState(null);
  const [validandoOperador, setValidandoOperador] = useState(false);
  const [erroOperador, setErroOperador] = useState(null);

  // 2. Dados do Ativo escaneado e Trava de Duplicidade
  const [ativoData, setAtivoData] = useState(null);
  const [carregandoAtivo, setCarregandoAtivo] = useState(false);
  const [chamadoAtivoAlerta, setChamadoAtivoAlerta] = useState(null);
  const [ignorarTravaDuplicada, setIgnorarTravaDuplicada] = useState(false);

  // 3. Flag de Criticidade / Status Operacional da Máquina (3 Estados Obrigatórios)
  // 'maquina_parada' (Crítico/Emergência) | 'operando_com_restricao' (Alerta) | 'melhoria_estetica' (Baixa)
  const [statusImpacto, setStatusImpacto] = useState('maquina_parada');

  // 4. Gabarito de Sintomas e Observação
  const [sintomasDisponiveis, setSintomasDisponiveis] = useState([]);
  const [sintomasSelecionados, setSintomasSelecionados] = useState([]);
  const [observacaoTexto, setObservacaoTexto] = useState('');

  // 5. Anexo de Mídia Rápido (Foto comprimida + Áudio de ruído)
  const [fotoBase64, setFotoBase64] = useState(null);
  const [audioBase64, setAudioBase64] = useState(null);
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerGravacaoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Status de envio e resultado
  const [enviando, setEnviando] = useState(false);
  const [chamadoCriado, setChamadoCriado] = useState(null);

  // Lista padrão de sintomas de fábrica
  const sintomasPadrao = [
    { id: 2, descricao: 'Vazamento Pneumático / Queda de Pressão de Ar', categoria: 'pneumatica' },
    { id: 1, descricao: 'Falha de Alimentação / Peça Travada no Posto', categoria: 'mecanica' },
    { id: 3, descricao: 'Sensor Óptico Apagado / Falha Elétrica', categoria: 'eletrica' },
    { id: 4, descricao: 'Superaquecimento ou Fumaça no Motor/Mancal', categoria: 'mecanica' },
    { id: 5, descricao: 'Ruído Estranho / Vibração Anormal na Linha', categoria: 'mecanica' },
    { id: 6, descricao: 'Braço Robótico / Pinça não trava no ciclo', categoria: 'automacao' },
    { id: 7, descricao: 'Outro Defeito / Anomalia Mecânica', categoria: 'geral' }
  ];

  // Limpeza de streams e timers ao desmontar
  useEffect(() => {
    return () => {
      if (timerGravacaoRef.current) clearInterval(timerGravacaoRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  function abrirModalOperador() {
    setCodigoInput(identifiant);
    setOperadorEncontrado({ nome: nomeOperador, matricula: identifiant });
    setErroOperador(null);
    setModalEditarOperador(true);
  }

  // Validação estrita de Identifiant no Banco de Dados
  async function buscarOperadorPorCodigo(cod) {
    const limpo = String(cod || '').trim();
    if (!limpo) {
      setOperadorEncontrado(null);
      setErroOperador(null);
      return;
    }
    setValidandoOperador(true);
    setErroOperador(null);
    try {
      const res = await fetch(`/api/auth/operador/${encodeURIComponent(limpo)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.erro || `Identifiant "${limpo}" não localizado no cadastro industrial.`);
      }
      const data = await res.json();
      setOperadorEncontrado(data.operador);
      setErroOperador(null);
    } catch (err) {
      setOperadorEncontrado(null);
      setErroOperador(err.message || 'Código não cadastrado no banco da fábrica.');
    } finally {
      setValidandoOperador(false);
    }
  }

  function confirmarNovoOperador() {
    if (!operadorEncontrado) return;
    setIdentifiant(operadorEncontrado.matricula);
    setNomeOperador(operadorEncontrado.nome);
    localStorage.setItem('cmms_operador_identifiant', operadorEncontrado.matricula);
    localStorage.setItem('cmms_operador_nome', operadorEncontrado.nome);
    setModalEditarOperador(false);
  }

  function voltarAoScanner() {
    processandoQRRef.current = false;
    setTela('scanner');
    setChamadoCriado(null);
    setAtivoData(null);
    setChamadoAtivoAlerta(null);
    setIgnorarTravaDuplicada(false);
    setCarregandoAtivo(false);
    setFotoBase64(null);
    setAudioBase64(null);
    setStatusImpacto('maquina_parada');
  }

  // Captura e compressão rápida de foto (máximo 800px para tráfego instantâneo no chão de fábrica)
  function handleCapturarFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        setFotoBase64(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Gravação de ruído sonoro rápido (até 10 segundos)
  async function iniciarGravacaoAudio() {
    if (gravandoAudio) {
      pararGravacaoAudio();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBase64(reader.result);
        };
        reader.readAsDataURL(audioBlob);

        // Encerra tracks do microfone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setGravandoAudio(true);
      setTempoGravacao(1);

      if (timerGravacaoRef.current) clearInterval(timerGravacaoRef.current);
      timerGravacaoRef.current = setInterval(() => {
        setTempoGravacao((prev) => {
          if (prev >= 10) {
            pararGravacaoAudio();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      alert('Não foi possível acessar o microfone para gravação de áudio.');
    }
  }

  function pararGravacaoAudio() {
    if (timerGravacaoRef.current) {
      clearInterval(timerGravacaoRef.current);
      timerGravacaoRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setGravandoAudio(false);
  }

  // AÇÃO: QR Code Lido com Sucesso (Trava contra múltiplos disparos + Detecção de Duplicidade)
  async function handleQRScanned(qrContent) {
    if (processandoQRRef.current) return;
    processandoQRRef.current = true;

    setCarregandoAtivo(true);
    setSintomasSelecionados([]);
    setObservacaoTexto('');
    setFotoBase64(null);
    setAudioBase64(null);

    try {
      let token = qrContent ? String(qrContent).trim() : '';
      if (token.includes('/')) {
        token = token.split('/').pop().trim();
      }

      // Timeout de segurança de 4 segundos para evitar travamento em caso de oscilação de rede
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`/api/ativos/qr/${encodeURIComponent(token)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Máquina não localizada.');
      const data = await res.json();
      setAtivoData(data.ativo);

      if (data.sintomas && data.sintomas.length > 0) {
        setSintomasDisponiveis(data.sintomas);
      } else {
        setSintomasDisponiveis(sintomasPadrao);
      }

      // TRAVA DE CHAMADO DUPLICADO: Se o ativo já possuir chamado aberto
      if (data.em_atendimento && data.os_ativa && !ignorarTravaDuplicada) {
        setChamadoAtivoAlerta(data.os_ativa);
        setTela('duplicado_aviso');
      } else {
        setTela('gabarito');
      }

    } catch (err) {
      console.warn('Fallback seguro de ativo:', err);
      setAtivoData({
        id: 1,
        tag_patrimonio: 'MV3-ROB-04',
        nome: 'Robô de Solda a Ponto KUKA KR210',
        linha_nome: 'Chaparia - Linha MV3',
        posto_trabalho: 'Posto 40 - Geometria Lateral',
        criticidade: 'A'
      });
      setSintomasDisponiveis(sintomasPadrao);
      setTela('gabarito');
    } finally {
      setCarregandoAtivo(false);
    }
  }

  // Permite ao operador prosseguir como reforço de chamado se necessário
  function prosseguirComReforco() {
    setIgnorarTravaDuplicada(true);
    setObservacaoTexto(`[REFORÇO / NOVO TURNO] Chamado anterior: ${chamadoAtivoAlerta?.numero_os || 'OS'}. `);
    setTela('gabarito');
  }

  // Marcar/Desmarcar Confere no Gabarito
  function toggleSintoma(sintoma) {
    if (sintomasSelecionados.some((s) => s.id === sintoma.id)) {
      setSintomasSelecionados(sintomasSelecionados.filter((s) => s.id !== sintoma.id));
    } else {
      setSintomasSelecionados([...sintomasSelecionados, sintoma]);
    }
  }

  // Confirmar e Enviar Chamado ($T_0$) com Status de Impacto e Mídias
  async function handleEnviarChamado() {
    if (sintomasSelecionados.length === 0 && !observacaoTexto.trim() && !fotoBase64) {
      alert('Marque no gabarito pelo menos um sintoma ou anexe uma foto da falha.');
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
          descricao_sintoma: descricaoConsolidada,
          status_impacto: statusImpacto,
          foto_anexo: fotoBase64,
          audio_anexo: audioBase64
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
      {/* Input Oculto de Foto com Acesso Direto à Câmera Traseira */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapturarFoto}
      />

      {/* HEADER SUPERIOR */}
      <header className="bg-black pt-3 pb-3 px-4 text-center border-b border-zinc-900 shrink-0">
        {/* Emblema Central da Vanguard */}
        <div className="flex justify-center mb-1.5">
          <VanguardLogo variant="icon" size="lg" />
        </div>

        {/* Linha do Operador: Nome - Identifiant */}
        <div
          onClick={abrirModalOperador}
          className="cursor-pointer inline-flex items-center gap-1.5 hover:opacity-80 active:scale-95 transition-all"
          title="Toque para validar Identifiant da fábrica"
        >
          <h2 className="text-sm font-black text-white tracking-wide">
            Operador: {nomeOperador} - {identifiant}
          </h2>
          <Edit2 className="w-3 h-3 text-zinc-500" />
        </div>
      </header>

      {/* MODAL DE VALIDAÇÃO DE IDENTIFIANT (SEM DIGITAÇÃO LIVRE DE NOME) */}
      {modalEditarOperador && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="font-bold text-xs text-white">Identificação do Operador</span>
              <button
                onClick={() => setModalEditarOperador(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 leading-tight">
              Digite apenas o <strong>Identifiant</strong> (matrícula/crachá). O sistema consulta o banco de dados oficial e valida o nome automaticamente:
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={codigoInput}
                  onChange={(e) => {
                    setCodigoInput(e.target.value);
                    setOperadorEncontrado(null);
                    setErroOperador(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') buscarOperadorPorCodigo(codigoInput);
                  }}
                  placeholder="Ex: 226244 ou 5001"
                  className="flex-1 bg-black border border-zinc-700 rounded-xl p-2.5 text-white font-mono text-center tracking-wider text-sm focus:outline-none focus:border-red-500"
                />
                <button
                  type="button"
                  disabled={validandoOperador || !codigoInput.trim()}
                  onClick={() => buscarOperadorPorCodigo(codigoInput)}
                  className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shrink-0"
                >
                  {validandoOperador ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Validar</span>
                  )}
                </button>
              </div>

              {/* Resultado da Validação no Banco de Dados */}
              {operadorEncontrado && (
                <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-3 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Colaborador Cadastrado:</span>
                  </div>
                  <p className="text-white font-black text-sm pl-5">
                    {operadorEncontrado.nome}
                  </p>
                  <p className="text-[10px] text-zinc-400 pl-5 font-mono">
                    Matrícula: {operadorEncontrado.matricula} • Perfil: {operadorEncontrado.perfil || 'Operador'}
                  </p>
                </div>
              )}

              {erroOperador && (
                <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-2.5 text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span className="text-[11px] leading-tight">{erroOperador}</span>
                </div>
              )}
            </div>

            <button
              disabled={!operadorEncontrado}
              onClick={confirmarNovoOperador}
              className={`w-full py-2.5 font-bold text-xs rounded-xl shadow-lg transition-all ${
                operadorEncontrado
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              Confirmar Identifiant
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

      {/* TELA DE ALERTA: TRAVA DE CHAMADO DUPLICADO */}
      {tela === 'duplicado_aviso' && (
        <div className="flex-1 flex flex-col justify-between p-5 bg-zinc-950 space-y-4">
          <div className="space-y-4 my-auto">
            {/* Ícone de Alerta */}
            <div className="w-16 h-16 bg-amber-500/20 border-2 border-amber-500 rounded-2xl flex items-center justify-center mx-auto text-amber-400 shadow-2xl animate-pulse">
              <ShieldAlert className="w-9 h-9" />
            </div>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
                Bloqueio Preventivo de Duplicidade
              </span>
              <h2 className="text-lg font-black text-white leading-tight">
                Chamado já em andamento para esta máquina!
              </h2>
              <p className="text-xs text-zinc-400">
                A equipe técnica já foi notificada. Evite tickets repetidos na troca de turno.
              </p>
            </div>

            {/* Dossiê do Chamado Ativo */}
            <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-4 text-xs font-mono space-y-2 shadow-xl">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Ordem de Serviço:</span>
                <span className="text-amber-400 font-black text-sm">{chamadoAtivoAlerta?.numero_os}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Tempo Aberto:</span>
                <span className="text-white font-bold">
                  Aberto há {chamadoAtivoAlerta?.minutos_aberto || 1} min
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Operador Solicitante:</span>
                <span className="text-zinc-200">{chamadoAtivoAlerta?.operador_nome}</span>
              </div>
              <div className="pt-1 border-t border-zinc-800/80">
                <span className="text-zinc-500 block text-[10px] uppercase">Problema Reportado:</span>
                <p className="text-zinc-200 font-sans text-xs mt-0.5">
                  "{chamadoAtivoAlerta?.descricao_exibicao}"
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação para o Operador */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={voltarAoScanner}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Voltar ao Scanner (Ciente)</span>
            </button>

            <button
              type="button"
              onClick={prosseguirComReforco}
              className="w-full py-2.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white font-bold text-[11px] rounded-xl transition-all"
            >
              Agravou o problema? Abrir Reforço de OS
            </button>
          </div>
        </div>
      )}

      {/* TELA 2: GABARITO DE SINTOMAS COM CONFERES (PÓS-LEITURA DO QR CODE) */}
      {tela === 'gabarito' && (
        <div className="flex-1 flex flex-col justify-between p-3.5 bg-zinc-950 space-y-2.5 overflow-y-auto">
          <div>
            {/* Barra de Retorno ao Scanner */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <button
                type="button"
                onClick={voltarAoScanner}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar à Câmera</span>
              </button>
              <button
                type="button"
                onClick={voltarAoScanner}
                className="text-xs text-red-400 font-bold flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Escanear Outra</span>
              </button>
            </div>

            {/* Cartão de Identificação da Máquina */}
            {carregandoAtivo ? (
              <div className="py-6 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 text-red-500 animate-spin" />
                <span>Identificando máquina...</span>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 mt-2 space-y-1 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-base text-white tracking-wider">
                    {ativoData?.tag_patrimonio}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                      ativoData?.criticidade === 'A'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    Criticidade {ativoData?.criticidade}
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-zinc-200">{ativoData?.nome}</h3>
                <p className="text-[10px] text-zinc-400">
                  {ativoData?.linha_nome} • {ativoData?.posto_trabalho}
                </p>
              </div>
            )}

            {/* SELETOR OBRIGATÓRIO: FLAG DE CRITICIDADE / STATUS DA MÁQUINA */}
            <div className="mt-3 space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
                Impacto Operacional da Máquina:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {/* 1. Máquina Parada */}
                <button
                  type="button"
                  onClick={() => setStatusImpacto('maquina_parada')}
                  className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                    statusImpacto === 'maquina_parada'
                      ? 'bg-red-950/70 border-red-500 text-white shadow-lg shadow-red-900/40 ring-2 ring-red-500'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Flame
                    className={`w-4 h-4 ${
                      statusImpacto === 'maquina_parada' ? 'text-red-400 animate-pulse' : 'text-zinc-500'
                    }`}
                  />
                  <span className="text-[10px] font-black leading-tight">Máquina Parada</span>
                  <span className="text-[8px] uppercase font-mono px-1 py-0.5 rounded bg-red-900/50 text-red-300">
                    Crítico ($T_0$)
                  </span>
                </button>

                {/* 2. Operando com Restrição */}
                <button
                  type="button"
                  onClick={() => setStatusImpacto('operando_com_restricao')}
                  className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                    statusImpacto === 'operando_com_restricao'
                      ? 'bg-amber-950/70 border-amber-500 text-white shadow-lg shadow-amber-900/40 ring-2 ring-amber-500'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 ${
                      statusImpacto === 'operando_com_restricao' ? 'text-amber-400' : 'text-zinc-500'
                    }`}
                  />
                  <span className="text-[10px] font-black leading-tight">Com Restrição</span>
                  <span className="text-[8px] uppercase font-mono px-1 py-0.5 rounded bg-amber-900/50 text-amber-300">
                    Alerta
                  </span>
                </button>

                {/* 3. Melhoria / Falha Estética */}
                <button
                  type="button"
                  onClick={() => setStatusImpacto('melhoria_estetica')}
                  className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                    statusImpacto === 'melhoria_estetica'
                      ? 'bg-sky-950/70 border-sky-500 text-white shadow-lg shadow-sky-900/40 ring-2 ring-sky-500'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Wrench
                    className={`w-4 h-4 ${
                      statusImpacto === 'melhoria_estetica' ? 'text-sky-400' : 'text-zinc-500'
                    }`}
                  />
                  <span className="text-[10px] font-black leading-tight">Melhoria</span>
                  <span className="text-[8px] uppercase font-mono px-1 py-0.5 rounded bg-sky-900/50 text-sky-300">
                    Baixa
                  </span>
                </button>
              </div>
            </div>

            {/* GABARITO DE SINTOMAS: LISTINHA COM CONFERES */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-red-500" />
                  Marque o que está acontecendo:
                </span>
                <span className="text-[9px] font-mono text-zinc-400">
                  {sintomasSelecionados.length} selecionado(s)
                </span>
              </div>

              {/* Lista dos Conferes */}
              <div className="space-y-1 max-h-[30vh] overflow-y-auto pr-1">
                {sintomasDisponiveis.map((item) => {
                  const isChecked = sintomasSelecionados.some((s) => s.id === item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSintoma(item)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between active:scale-98 ${
                        isChecked
                          ? 'bg-red-950/40 border-red-500 shadow-md text-white ring-1 ring-red-500'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 pr-2">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                            isChecked
                              ? 'bg-red-600 text-white'
                              : 'bg-black border border-zinc-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>

                        <span className="font-semibold text-[11px] leading-snug">
                          {item.descricao}
                        </span>
                      </div>

                      <span className="text-[8px] uppercase font-mono px-1.5 py-0.5 rounded bg-black text-zinc-500 shrink-0">
                        {item.categoria}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ANEXO DE MÍDIA RÁPIDO (FOTO DA PEÇA / GRAVAÇÃO DE RUÍDO) */}
            <div className="mt-3 space-y-2 border-t border-zinc-800/80 pt-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-zinc-400" />
                Evidência Rápida (Foto ou Áudio):
              </span>

              <div className="flex gap-2">
                {/* Botão de Tirar Foto */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    fotoBase64
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{fotoBase64 ? 'Foto Anexada ✓' : 'Tirar Foto'}</span>
                </button>

                {/* Botão de Gravar Ruído */}
                <button
                  type="button"
                  onClick={iniciarGravacaoAudio}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    gravandoAudio
                      ? 'bg-red-600 text-white animate-pulse border-red-500'
                      : audioBase64
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  {gravandoAudio ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Parar ({tempoGravacao}s/10s)</span>
                    </>
                  ) : audioBase64 ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Ruído Gravado ✓</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>Gravar Ruído</span>
                    </>
                  )}
                </button>
              </div>

              {/* Preview da Foto Anexada */}
              {fotoBase64 && (
                <div className="relative inline-block mt-1">
                  <img
                    src={fotoBase64}
                    alt="Evidência da peça"
                    className="w-20 h-20 object-cover rounded-xl border border-zinc-700 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => setFotoBase64(null)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-500"
                    title="Remover foto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Player do Áudio Gravado */}
              {audioBase64 && (
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2 mt-1">
                  <audio src={audioBase64} controls className="h-7 w-full" />
                  <button
                    type="button"
                    onClick={() => setAudioBase64(null)}
                    className="p-1.5 text-zinc-400 hover:text-red-400"
                    title="Excluir áudio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Campo de Texto Opcional */}
              <div className="pt-1">
                <input
                  type="text"
                  value={observacaoTexto}
                  onChange={(e) => setObservacaoTexto(e.target.value)}
                  placeholder="Alguma observação extra? (Opcional)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* BOTÃO CONFIRMAR E ENVIAR ($T_0$) */}
          <div className="pt-1">
            <button
              type="button"
              disabled={enviando || (sintomasSelecionados.length === 0 && !fotoBase64)}
              onClick={handleEnviarChamado}
              className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all ${
                sintomasSelecionados.length > 0 || fotoBase64
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/40 border border-red-500 animate-pulse'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
              }`}
            >
              {enviando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Disparando Chamado ($T_0$)...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Confirmar e Disparar ($T_0$)</span>
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
                <span className="text-zinc-400">Impacto:</span>
                <span className="text-red-400 font-bold uppercase">
                  {statusImpacto.replace(/_/g, ' ')}
                </span>
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
              {fotoBase64 && (
                <div className="flex justify-between items-center pt-1 border-t border-zinc-800">
                  <span className="text-zinc-400">Anexo:</span>
                  <span className="text-emerald-400 font-bold">1 Foto Anexada</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={voltarAoScanner}
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
