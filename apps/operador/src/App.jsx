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
  ShieldAlert,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  FileText,
  AlertCircle,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import ScannerCamera from './components/ScannerCamera';
import CameraFotoModal from './components/CameraFotoModal';
import VanguardLogo from './components/VanguardLogo';

export default function App() {
  // 0. Splash Screen inicial com animação Uiverse.io (#EF4444)
  const [splashVisivel, setSplashVisivel] = useState(true);
  const [splashOpacidade, setSplashOpacidade] = useState(true);

  useEffect(() => {
    // Limpa qualquer rascunho residual para que o app sempre inicie na câmera do QR code
    try {
      localStorage.removeItem('cmms_trigger_active_draft');
    } catch (e) {}

    // Transição limpa e sólida para evitar qualquer oscilação de cor entre branco e cinza
    const timerRemover = setTimeout(() => {
      setSplashVisivel(false);
    }, 1500);

    return () => {
      clearTimeout(timerRemover);
    };
  }, []);

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
  const [sucessoOperador, setSucessoOperador] = useState(null);

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

  // 5. Anexo de Mídia Rápido (Câmera Integrada In-App + Áudio de ruído)
  const [modalCameraAberto, setModalCameraAberto] = useState(false);
  const [fotoBase64, setFotoBase64] = useState(null);
  const cameraInputRef = useRef(null);
  const [audioBase64, setAudioBase64] = useState(null);
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [tocandoAudio, setTocandoAudio] = useState(false);
  const audioPlayerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerGravacaoRef = useRef(null);

  // Status de envio e resultado
  const [dashboardAberto, setDashboardAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [chamadoCriado, setChamadoCriado] = useState(null);

  // 6. Homebar Flutuante e Ações Rápidas (Inspirada na referência @jsav.design)
  const [abaAtivaHomebar, setAbaAtivaHomebar] = useState(null); // null | 'camera' | 'audio' | 'registro'
  const [avisoValidacaoHomebar, setAvisoValidacaoHomebar] = useState(null);

  // Lista padrão de sintomas de fábrica (Formato Penumbra Radio)
  const sintomasPadrao = [
    { id: 2, titulo: 'Vazamento Pneumático', hint: 'Queda de pressão de ar ou mangueira rompida', descricao: 'Vazamento Pneumático / Queda de Pressão de Ar', categoria: 'pneumatica' },
    { id: 1, titulo: 'Falha de Alimentação', hint: 'Peça travada no posto ou magazine vazio', descricao: 'Falha de Alimentação / Peça Travada no Posto', categoria: 'mecanica' },
    { id: 3, titulo: 'Falha Elétrica / Sensor', hint: 'Sensor óptico apagado ou interrupção de sinal', descricao: 'Sensor Óptico Apagado / Falha Elétrica', categoria: 'eletrica' },
    { id: 4, titulo: 'Superaquecimento / Fumaça', hint: 'Temperatura excessiva no motor ou mancal', descricao: 'Superaquecimento ou Fumaça no Motor/Mancal', categoria: 'mecanica' },
    { id: 5, titulo: 'Ruído Estranho / Vibração', hint: 'Vibração anormal ou estalos mecânicos na linha', descricao: 'Ruído Estranho / Vibração Anormal na Linha', categoria: 'mecanica' },
    { id: 6, titulo: 'Braço Robótico / Pinça', hint: 'Não trava no ciclo ou perda de posicionamento', descricao: 'Braço Robótico / Pinça não trava no ciclo', categoria: 'automacao' },
    { id: 7, titulo: 'Outro Defeito / Anomalia', hint: 'Desvio operacional complementar não listado', descricao: 'Outro Defeito / Anomalia Mecânica', categoria: 'geral' }
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
    setCodigoInput('');
    setErroOperador(null);
    setSucessoOperador(null);
    setModalEditarOperador(true);
  }

  // Catálogo de operadores locais para contingência offline / ambiente de demonstração
  const OPERADORES_FALLBACK = {
    '226244': 'Jhon Doe',
    '228190': 'Márcio Souza',
    '231045': 'Lucas Andrade',
    '221317': 'Alucard',
    '679902': 'Killer Bee',
    '018561': 'Picasso',
    'RE-0001': 'Iury Lopes (Admin)',
    'RE-1042': 'Carlos Eduardo (Gestor PCM)',
    'RE-2105': 'Marcos Vinicius (Team Leader Chaparia)',
    'RE-3088': 'Rodrigo Silva (Mecatrônica)',
    'RE-3092': 'Felipe Santos (Elétrica/Robótica)',
    'RE-5001': 'João Silva (Operador Solda)'
  };

  // Validação direta e instantânea de Identifiant (Estados: Repouso, Sucesso Verde, Erro Vermelho)
  async function validarEConfirmarOperador(cod) {
    const limpo = String(cod || '').trim();
    if (!limpo) return;
    setValidandoOperador(true);
    setErroOperador(null);
    setSucessoOperador(null);
    try {
      let nomeEncontrado = null;
      let matriculaEncontrada = limpo;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`/api/auth/operador/${encodeURIComponent(limpo)}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.operador) {
            nomeEncontrado = data.operador.nome;
            matriculaEncontrada = data.operador.matricula;
          }
        }
      } catch (e) {
        console.warn('API de operador indisponível, consultando catálogo de contingência:', e);
      }

      // Se a API não respondeu ou deu 404, recorre ao catálogo de contingência
      if (!nomeEncontrado) {
        if (OPERADORES_FALLBACK[limpo]) {
          nomeEncontrado = OPERADORES_FALLBACK[limpo];
        } else if (limpo.length >= 4) {
          // Permite qualquer RE plausível em modo offline/demonstração
          nomeEncontrado = `Operador RE-${limpo}`;
        }
      }

      if (!nomeEncontrado) {
        throw new Error('Usuário não encontrado!');
      }

      setSucessoOperador(nomeEncontrado);
      setIdentifiant(matriculaEncontrada);
      setNomeOperador(nomeEncontrado);
      localStorage.setItem('cmms_operador_identifiant', matriculaEncontrada);
      localStorage.setItem('cmms_operador_nome', nomeEncontrado);

      // Fecha suavemente após 1.4s para o operador visualizar a saudação de sucesso
      setTimeout(() => {
        setModalEditarOperador(false);
        setSucessoOperador(null);
      }, 1400);
    } catch (err) {
      setSucessoOperador(null);
      setErroOperador('Usuário não encontrado!');
    } finally {
      setValidandoOperador(false);
    }
  }

  function voltarAoScanner() {
    processandoQRRef.current = false;
    localStorage.removeItem('cmms_trigger_active_draft');
    setAbaAtivaHomebar(null);
    setAvisoValidacaoHomebar(null);
    setDashboardAberto(false);
    setTela('scanner');
    setChamadoCriado(null);
    setAtivoData(null);
    setChamadoAtivoAlerta(null);
    setIgnorarTravaDuplicada(false);
    setCarregandoAtivo(false);
    setFotoBase64(null);
    setAudioBase64(null);
    setTocandoAudio(false);
    setStatusImpacto('maquina_parada');
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
    setTocandoAudio(false);
  }

  // Acionamento direto da Câmera Nativa do Celular (Samsung, Motorola, iOS, Xiaomi)
  function acionarCameraNativa() {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  }

  function handleFotoNativaCapturada(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
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

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setFotoBase64(dataUrl);
        setAbaAtivaHomebar('camera');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // AÇÃO: QR Code Lido com Sucesso (Trava contra múltiplos disparos + Detecção de Duplicidade)
  async function handleQRScanned(qrContent) {
    if (processandoQRRef.current) return;
    processandoQRRef.current = true;

    setCarregandoAtivo(true);
    setAbaAtivaHomebar(null);
    setAvisoValidacaoHomebar(null);
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

  // Selecionar/Desmarcar Sintoma no formato Penumbra Radio
  function toggleSintoma(sintoma) {
    if (sintomasSelecionados.some((s) => s.id === sintoma.id)) {
      setSintomasSelecionados([]);
    } else {
      setSintomasSelecionados([sintoma]);
    }
  }

  // Confirmar e Enviar Chamado ($T_0$) com Status de Impacto e Mídias
  async function handleEnviarChamado() {
    if (sintomasSelecionados.length === 0 && !observacaoTexto.trim() && !fotoBase64) {
      alert('Marque no gabarito pelo menos um sintoma ou anexe uma foto da falha.');
      return;
    }

    setEnviando(true);
    let chamadoFinal = null;

    try {
      const sintomaPrincipal = sintomasSelecionados[0];
      const descricaoConsolidada = [
        ...sintomasSelecionados.map((s) => s.descricao),
        observacaoTexto.trim() ? `Obs: ${observacaoTexto.trim()}` : ''
      ].filter(Boolean).join(' | ');

      // 1. Tenta enviar para o backend real (caso esteja ativo localmente ou com proxy)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch('/api/chamados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
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
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          chamadoFinal = data.chamado;
        } else if (res.status === 404 || res.status === 502 || res.status === 503) {
          // Servidor backend ausente no host estático da Vercel / sem proxy local ativo
          console.warn(`Host estático/offline (Status ${res.status}). Acionando contingência local de OS.`);
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.erro || errData.mensagem || `Falha ao registrar chamado (Status ${res.status}).`);
        }
      } catch (fetchErr) {
        if (fetchErr.message && fetchErr.message.includes('Status') && !fetchErr.message.includes('404')) {
          throw fetchErr;
        }
        console.warn('Backend indisponível, ativando contingência offline:', fetchErr);
      }

      // 2. Contingência Operacional (PWA / Demonstração Cloud / Chão de Fábrica Sem Sinal)
      // Se não houver backend ativo na nuvem, gera o dossiê da OS imediatamente com numeração oficial
      if (!chamadoFinal) {
        const anoAtual = new Date().getFullYear();
        const randomOS = Math.floor(1000 + Math.random() * 9000);
        chamadoFinal = {
          id: Date.now(),
          numero_os: `OS-${anoAtual}-${randomOS}`,
          status: 'aberto',
          ativo_id: ativoData?.id || 1,
          tag_patrimonio: ativoData?.tag_patrimonio || 'MV3-ROB-04',
          posto_trabalho: ativoData?.posto_trabalho || 'Posto 40 - Geometria Lateral',
          operador_matricula: identifiant,
          operador_nome: nomeOperador,
          status_impacto: statusImpacto,
          descricao_sintoma: descricaoConsolidada,
          foto_anexo: fotoBase64,
          audio_anexo: audioBase64,
          created_at: new Date().toISOString()
        };

        // Salva na fila de contingência do navegador para não perder histórico
        try {
          const historico = JSON.parse(localStorage.getItem('cmms_offline_chamados') || '[]');
          historico.unshift(chamadoFinal);
          localStorage.setItem('cmms_offline_chamados', JSON.stringify(historico.slice(0, 30)));
        } catch (e) {}
      }

      setChamadoCriado(chamadoFinal);
      setDashboardAberto(false);
      setAbaAtivaHomebar(null);
      setAvisoValidacaoHomebar(null);
      setTela('sucesso');
    } catch (err) {
      alert(err.message || 'Erro ao enviar chamado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  // Ações da Homebar Flutuante (@jsav.design)
  function handleCliqueHomebar(aba) {
    setAvisoValidacaoHomebar(null);

    if (aba === 'camera') {
      if (!fotoBase64) {
        setModalCameraAberto(true);
      } else {
        setAbaAtivaHomebar((prev) => (prev === 'camera' ? null : 'camera'));
      }
    } else if (aba === 'audio') {
      if (gravandoAudio) {
        pararGravacaoAudio();
      } else if (!audioBase64) {
        iniciarGravacaoAudio();
        setAbaAtivaHomebar('audio');
      } else {
        setAbaAtivaHomebar((prev) => (prev === 'audio' ? null : 'audio'));
      }
    } else if (aba === 'registro') {
      setAbaAtivaHomebar((prev) => (prev === 'registro' ? null : 'registro'));
    }
  }

  const podeDisparar = sintomasSelecionados.length > 0 || observacaoTexto.trim() || fotoBase64;

  function handleDisparoHomebar() {
    if (!podeDisparar) {
      setAvisoValidacaoHomebar('Selecione ao menos 1 sintoma acima');
      setTimeout(() => setAvisoValidacaoHomebar(null), 3500);
      return;
    }
    handleEnviarChamado();
  }

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] bg-[#000000] text-slate-100 flex flex-col max-w-md mx-auto relative select-none overflow-hidden no-scrollbar">
      {/* SPLASH SCREEN INICIAL COM LOGO CORP. VANGUARD E LOADER #EF4444 */}
      {splashVisivel && (
        <div
          className="fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-center select-none"
        >
          <div className="flex flex-col items-center gap-2.5">
            {/* Logo Oficial Corp.Vanguard */}
            <img
              src="/brand/corp-vanguard-wordmark-transparent.png?v=20"
              alt="Corp.Vanguard"
              className="w-60 sm:w-72 max-w-[85vw] object-contain"
            />

            {/* Subtítulo Trigger */}
            <span className="text-white font-mono text-xs font-bold uppercase tracking-[0.3em] mt-1">
              Trigger
            </span>

            {/* Animação dos Retângulos em Vermelho Industrial #EF4444 */}
            <div className="loaderRectangle mt-3">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL ULTRA-MINIMALISTA DE IDENTIFIANT (3 ESTADOS: REPOUSO, SUCESSO VERDE #10B981, ERRO VERMELHO #EF4444) */}
      {modalEditarOperador && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#16161A] border border-white/[0.08] rounded-2xl max-w-[320px] w-full overflow-hidden shadow-2xl flex flex-col">
            {/* Bloco Superior: Fechar + Linha de Ação */}
            <div className="p-4 space-y-3">
              {/* Fechar no canto superior direito */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setModalEditarOperador(false);
                    setErroOperador(null);
                    setSucessoOperador(null);
                  }}
                  className="w-7 h-7 rounded-full bg-[#1E1E26] text-[#8E8E93] hover:text-white flex items-center justify-center font-bold text-sm leading-none transition-transform active:scale-90"
                  title="Fechar"
                >
                  ✕
                </button>
              </div>

              {/* Linha com input Floating Label Uiverse.io (ClawHack1) e botão validar */}
              <div className="flex gap-2.5 items-center pt-1">
                <div
                  className={`ui-identifiant-input flex-1 min-w-0 ${
                    erroOperador ? 'has-error' : ''
                  } ${sucessoOperador ? 'has-success' : ''}`}
                >
                  <input
                    type="text"
                    id="identifiant-field"
                    required
                    autoComplete="off"
                    autoFocus
                    value={codigoInput}
                    onChange={(e) => {
                      setCodigoInput(e.target.value);
                      setErroOperador(null);
                      setSucessoOperador(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') validarEConfirmarOperador(codigoInput);
                    }}
                  />
                  <label htmlFor="identifiant-field">Identifiant</label>
                </div>

                <button
                  type="button"
                  disabled={validandoOperador || !codigoInput.trim()}
                  onClick={() => validarEConfirmarOperador(codigoInput)}
                  className="bg-[#22222C] hover:bg-[#2A2A36] text-white font-semibold text-xs sm:text-sm rounded-xl px-3.5 h-[42px] border border-white/[0.08] transition-all flex items-center justify-center min-w-[75px] shrink-0 active:scale-95 disabled:opacity-40"
                >
                  {validandoOperador ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    'Validar'
                  )}
                </button>
              </div>
            </div>

            {/* ESTADO 2: SUCESSO VERDE (#10B981) - Olá, [Nome]! */}
            {sucessoOperador && (
              <div className="bg-[#10B981] py-3.5 px-3 text-center transition-all animate-fadeIn">
                <p className="text-white font-extrabold text-sm sm:text-base leading-tight">
                  Olá, {sucessoOperador}!
                </p>
              </div>
            )}

            {/* ESTADO 3: ERRO VERMELHO (#EF4444) - Usuário não encontrado! */}
            {erroOperador && (
              <div className="bg-[#EF4444] py-3.5 px-3 text-center transition-all animate-fadeIn">
                <p className="text-white font-extrabold text-sm sm:text-base leading-tight">
                  {erroOperador}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TELA 1: SCANNER DIRETO (CÂMERA ATIVA AO ABRIR O APP + LANTERNA AUTOMÁTICA) */}
      {tela === 'scanner' && (
        <ScannerCamera
          onScanSuccess={handleQRScanned}
          nomeOperador={nomeOperador}
          matricula={identifiant}
          onAbrirModalOperador={abrirModalOperador}
        />
      )}

      {/* TELA DE ALERTA: TRAVA DE CHAMADO DUPLICADO */}
      {tela === 'duplicado_aviso' && (
        <div className="flex-1 flex flex-col justify-between p-5 bg-[#000000] space-y-4">
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
              <p className="text-xs text-[#8E8E93] font-medium">
                A equipe técnica já foi notificada. Evite tickets repetidos na troca de turno.
              </p>
            </div>

            {/* Dossiê do Chamado Ativo */}
            <div className="bg-[#16161A] border border-amber-500/30 rounded-2xl p-4 text-xs font-mono space-y-2 shadow-xl">
              <div className="flex justify-between items-center border-b border-white/[0.08] pb-2">
                <span className="text-[#8E8E93] font-semibold">Ordem de Serviço:</span>
                <span className="text-amber-400 font-black text-sm">{chamadoAtivoAlerta?.numero_os}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8E8E93] font-semibold">Tempo Aberto:</span>
                <span className="text-white font-bold">
                  Aberto há {chamadoAtivoAlerta?.minutos_aberto || 1} min
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8E8E93] font-semibold">Operador Solicitante:</span>
                <span className="text-white">{chamadoAtivoAlerta?.operador_nome}</span>
              </div>
              <div className="pt-1 border-t border-white/[0.08]">
                <span className="text-[#8E8E93] block text-[10px] uppercase font-bold">Problema Reportado:</span>
                <p className="text-white font-sans text-xs mt-0.5">
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
              className="w-full py-3 bg-[#1E1E26] border border-white/[0.08] hover:bg-[#282832] text-[#8E8E93] hover:text-white font-bold text-xs rounded-xl transition-all"
            >
              Agravou o problema? Abrir Reforço de OS
            </button>
          </div>
        </div>
      )}

      {/* TELA 2: HUD DO OPERADOR COM BOTTOM SHEET RETRÁTIL (DASHBOARD DE DISPARO) */}
      {tela === 'gabarito' && (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-[#000000] relative">
          {/* TOPO: BANNER DA MÁQUINA (EX: MV3-ROB-04) COM PERFEITA SIMETRIA BILATERAL */}
          <div className="bg-[#000000]/95 backdrop-blur-md py-4 px-4 sm:px-5 border-b border-white/[0.08] flex items-center justify-between shrink-0 z-20 shadow-md">
            <button
              type="button"
              onClick={voltarAoScanner}
              className="w-10 h-10 rounded-full bg-[#181820] border border-white/[0.08] flex items-center justify-center text-white hover:bg-[#22222A] transition-all active:scale-95 shadow-md"
              title="Voltar ao scanner"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center flex flex-col items-center">
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#8E8E93]">
                Equipamento Selecionado
              </span>
              <h1 className="font-mono font-black text-xl sm:text-2xl text-white tracking-widest uppercase mt-0.5">
                {ativoData?.tag_patrimonio || 'MV3-ROB-04'}
              </h1>
            </div>
            {/* Espaçador invisível simétrico para manter o título perfeitamente centralizado sem a redundância do X */}
            <div className="w-10 h-10 shrink-0 pointer-events-none" aria-hidden="true" />
          </div>

          {/* CORPO DO HUD: SINTOMAS E IMPACTO COM ESPAÇAMENTOS GENEROSOS E HARMONIOSOS (ÁREA INTERNA ROLÁVEL COM NO-SCROLLBAR) */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 sm:p-5 pt-6 sm:pt-7 pb-36 flex flex-col gap-7 sm:gap-8 max-w-md mx-auto w-full">
            {/* 1. SEÇÃO POSSÍVEL PROBLEMA (PENUMBRA RADIO GROUP BY UIVERSE-ASTRONAUT) */}
            <fieldset className="penumbra-radio-group">
              <legend className="penumbra-radio-group__legend">Possível Problema</legend>
              {sintomasDisponiveis.map((item) => {
                const isChecked = sintomasSelecionados.some((s) => s.id === item.id);
                const titulo = item.titulo || (item.descricao.includes('/') ? item.descricao.split('/')[0].trim() : item.descricao);
                const hint = item.hint || (item.descricao.includes('/') ? item.descricao.split('/').slice(1).join('/').trim() : item.categoria || 'Anomalia operacional');

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={`penumbra-radio ${isChecked ? 'is-selected' : ''}`}
                    onClick={() => toggleSintoma(item)}
                  >
                    <span
                      className="penumbra-radio__mark"
                      aria-hidden="true"
                      style={{
                        backgroundColor: isChecked ? '#FFFFFF' : 'transparent',
                        borderColor: isChecked ? '#FFFFFF' : '#58596D',
                        forcedColorAdjust: 'none',
                        colorScheme: 'only dark'
                      }}
                    >
                      {isChecked && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '6px',
                            height: '6px',
                            borderRadius: '999px',
                            backgroundColor: '#16161A',
                            forcedColorAdjust: 'none'
                          }}
                        />
                      )}
                    </span>
                    <span className="penumbra-radio__text">
                      <span className="penumbra-radio__title">{titulo}</span>
                      <span className="penumbra-radio__hint">{hint}</span>
                    </span>
                  </div>
                );
              })}
            </fieldset>

            {/* 2. SEÇÃO IMPACTO DO PROBLEMA NA LINHA (PENUMBRA RADIO GROUP) */}
            <fieldset className="penumbra-radio-group">
              <legend className="penumbra-radio-group__legend">Impacto do Problema na Linha</legend>

              {/* 1. ALTO - MÁQUINA PARADA (#EF4444) */}
              <div
                role="button"
                tabIndex={0}
                className={`penumbra-radio ${statusImpacto === 'maquina_parada' ? 'is-selected' : ''}`}
                data-impact="alto"
                onClick={() => setStatusImpacto('maquina_parada')}
              >
                <span
                  className="penumbra-radio__mark"
                  aria-hidden="true"
                  style={{
                    backgroundColor: statusImpacto === 'maquina_parada' ? '#EF4444' : 'transparent',
                    borderColor: statusImpacto === 'maquina_parada' ? '#EF4444' : '#58596D',
                    forcedColorAdjust: 'none',
                    colorScheme: 'only dark'
                  }}
                >
                  {statusImpacto === 'maquina_parada' && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '999px',
                        backgroundColor: '#FFFFFF',
                        forcedColorAdjust: 'none'
                      }}
                    />
                  )}
                </span>
                <span className="penumbra-radio__text">
                  <span className="penumbra-radio__title flex items-center gap-2">
                    <span className="text-[#EF4444] font-bold">ALTO</span>
                    <span className="text-white font-semibold">- Máquina Parada</span>
                  </span>
                  <span className="penumbra-radio__hint">
                    Interrupção total da produção no posto de trabalho
                  </span>
                </span>
              </div>

              {/* 2. MÉDIO - OPERANDO COM RESTRIÇÃO (#F59E0B) */}
              <div
                role="button"
                tabIndex={0}
                className={`penumbra-radio ${statusImpacto === 'operando_com_restricao' ? 'is-selected' : ''}`}
                data-impact="medio"
                onClick={() => setStatusImpacto('operando_com_restricao')}
              >
                <span
                  className="penumbra-radio__mark"
                  aria-hidden="true"
                  style={{
                    backgroundColor: statusImpacto === 'operando_com_restricao' ? '#F59E0B' : 'transparent',
                    borderColor: statusImpacto === 'operando_com_restricao' ? '#F59E0B' : '#58596D',
                    forcedColorAdjust: 'none',
                    colorScheme: 'only dark'
                  }}
                >
                  {statusImpacto === 'operando_com_restricao' && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '999px',
                        backgroundColor: '#16161A',
                        forcedColorAdjust: 'none'
                      }}
                    />
                  )}
                </span>
                <span className="penumbra-radio__text">
                  <span className="penumbra-radio__title flex items-center gap-2">
                    <span className="text-[#F59E0B] font-bold">MÉDIO</span>
                    <span className="text-white font-semibold">- Operando com Restrição</span>
                  </span>
                  <span className="penumbra-radio__hint">
                    Velocidade reduzida, retrabalho ou desvio temporário
                  </span>
                </span>
              </div>

              {/* 3. BAIXO - SEM IMPACTO / MELHORIA (#10B981) */}
              <div
                role="button"
                tabIndex={0}
                className={`penumbra-radio ${statusImpacto === 'melhoria_estetica' ? 'is-selected' : ''}`}
                data-impact="baixo"
                onClick={() => setStatusImpacto('melhoria_estetica')}
              >
                <span
                  className="penumbra-radio__mark"
                  aria-hidden="true"
                  style={{
                    backgroundColor: statusImpacto === 'melhoria_estetica' ? '#10B981' : 'transparent',
                    borderColor: statusImpacto === 'melhoria_estetica' ? '#10B981' : '#58596D',
                    forcedColorAdjust: 'none',
                    colorScheme: 'only dark'
                  }}
                >
                  {statusImpacto === 'melhoria_estetica' && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '999px',
                        backgroundColor: '#16161A',
                        forcedColorAdjust: 'none'
                      }}
                    />
                  )}
                </span>
                <span className="penumbra-radio__text">
                  <span className="penumbra-radio__title flex items-center gap-2">
                    <span className="text-[#10B981] font-bold">BAIXO</span>
                    <span className="text-white font-semibold">- Sem Interrupção de Linha</span>
                  </span>
                  <span className="penumbra-radio__hint">
                    Melhoria estética ou anomalia que não impede o ciclo
                  </span>
                </span>
              </div>
            </fieldset>
          </div>

          {/* Fundo de clique externo quando o cartão contextual estiver aberto */}
          {abaAtivaHomebar && (
            <div
              onClick={() => setAbaAtivaHomebar(null)}
              className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in"
            ></div>
          )}

          {/* HOMEBAR FLUTUANTE INSPIRADA DIRETAMENTE NA REFERÊNCIA (@jsav.design) */}
          <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 z-40 px-3 sm:px-4 pointer-events-none">
            <div className="max-w-[365px] mx-auto pointer-events-auto flex flex-col gap-2.5">
              {/* Aviso Flutuante de Validação (Toast) */}
              {avisoValidacaoHomebar && (
                <div className="bg-amber-500 text-zinc-950 font-bold text-xs py-2 px-4 rounded-full text-center shadow-2xl animate-fade-in flex items-center justify-center gap-2 mx-auto">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{avisoValidacaoHomebar}</span>
                </div>
              )}

              {/* CARD CONTEXTUAL FLUTUANTE: CÂMERA */}
              {abaAtivaHomebar === 'camera' && (
                <div className="bg-[#16161A] border border-white/[0.08] rounded-2xl p-4 shadow-2xl animate-slide-up space-y-3">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-white" />
                      <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                        Foto da Anomalia
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAbaAtivaHomebar(null)}
                      className="text-[#8E8E93] hover:text-white p-1 text-xs"
                      title="Fechar"
                    >
                      ✕
                    </button>
                  </div>

                  {fotoBase64 ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={fotoBase64}
                        alt="Foto Anexada"
                        className="w-16 h-16 object-cover rounded-xl border border-white/[0.08]"
                      />
                      <div className="flex-1 space-y-2">
                        <span className="text-xs text-[#10B981] font-mono font-bold block">
                          Foto anexada ao ticket ✓
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setModalCameraAberto(true)}
                            className="px-3 py-1.5 bg-[#22222C] hover:bg-[#2A2A36] text-white text-xs rounded-xl font-semibold border border-white/[0.08] active:scale-95 transition-all"
                          >
                            Tirar outra
                          </button>
                          <button
                            type="button"
                            onClick={() => setFotoBase64(null)}
                            className="px-3 py-1.5 bg-red-950/40 text-red-400 hover:text-red-300 text-xs rounded-xl font-semibold flex items-center gap-1 border border-red-900/40 active:scale-95 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 space-y-2">
                      <p className="text-xs text-[#8E8E93] font-medium">
                        Nenhuma foto anexada. Registre uma evidência visual da falha.
                      </p>
                      <button
                        type="button"
                        onClick={() => setModalCameraAberto(true)}
                        className="w-full py-2.5 bg-[#22222C] hover:bg-[#2A2A36] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-white/[0.08] shadow-md active:scale-95 transition-all"
                      >
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>Abrir Câmera</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* CARD CONTEXTUAL FLUTUANTE: ÁUDIO ESTILO CHATGPT 4O VOICE COM ANIMAÇÃO */}
              {abaAtivaHomebar === 'audio' && (
                <div className="chatgpt-voice-card p-5 shadow-lg animate-slide-up relative overflow-hidden select-none">
                  {/* Header superior minimalista */}
                  <div className="relative z-10 flex items-center justify-between pb-1">
                    {gravandoAudio ? (
                      <span className="text-[11px] font-mono font-bold text-orange-400 bg-orange-950/60 px-2.5 py-0.5 rounded-full border border-orange-800/60 animate-pulse">
                        00:{tempoGravacao < 10 ? `0${tempoGravacao}` : tempoGravacao} / 10s
                      </span>
                    ) : (
                      <div></div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (gravandoAudio) pararGravacaoAudio();
                        setAbaAtivaHomebar(null);
                      }}
                      className="text-zinc-300 hover:text-white p-1 rounded-full hover:bg-zinc-800/60 transition-colors ml-auto"
                      title="Fechar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Centro: O Visualizador de Ondas Sonoras (9 Barras em Cápsula Fiel ao ChatGPT 4o) */}
                  <div className="relative z-10 py-5 flex flex-col items-center justify-center">
                    <div className={`chatgpt-voice-wave ${gravandoAudio || tocandoAudio ? 'is-active' : ''}`}>
                      <div className="chatgpt-voice-bar"></div>
                      <div className="chatgpt-voice-bar"></div>
                      <div className="chatgpt-voice-bar"></div>
                      <div className="chatgpt-voice-bar"></div>
                      <div className="chatgpt-voice-bar"></div>
                      <div className="chatgpt-voice-bar"></div>
                      <div className="chatgpt-voice-bar"></div>
                      <div className="chatgpt-voice-bar"></div>
                      <div className="chatgpt-voice-bar"></div>
                    </div>

                    {/* Texto dinâmico apenas quando reproduzindo áudio */}
                    {tocandoAudio && (
                      <div className="mt-4 text-center">
                        <p className="text-sm font-semibold text-white tracking-wide">
                          Reproduzindo áudio...
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Rodapé: Ações e Botão Circular Laranja com Stop Quadrado */}
                  <div className="relative z-10 flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-1">
                    {/* Lado Esquerdo: Ações secundárias */}
                    <div>
                      {audioBase64 && !gravandoAudio ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (audioPlayerRef.current) {
                                if (tocandoAudio) {
                                  audioPlayerRef.current.pause();
                                } else {
                                  audioPlayerRef.current.play();
                                }
                              }
                            }}
                            className="px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 active:scale-95 transition-all"
                            title={tocandoAudio ? 'Pausar áudio' : 'Ouvir ruído'}
                          >
                            {tocandoAudio ? (
                              <>
                                <Pause className="w-3.5 h-3.5 fill-current" />
                                <span>Pausar</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Ouvir</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={iniciarGravacaoAudio}
                            className="p-1.5 text-zinc-300 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
                            title="Gravar novamente"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAudioBase64(null);
                              setTocandoAudio(false);
                            }}
                            className="p-1.5 text-red-400 hover:text-red-300 rounded-full hover:bg-red-950/40 transition-colors"
                            title="Excluir gravação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div></div>
                      )}
                    </div>

                    {/* Lado Direito: Botão Circular Laranja de Parar / Iniciar (Fiel à referência ChatGPT 4o) */}
                    <div>
                      {gravandoAudio ? (
                        <button
                          type="button"
                          onClick={pararGravacaoAudio}
                          className="btn-chatgpt-stop"
                          title="Parar e Salvar Gravação"
                        >
                          <div className="btn-chatgpt-stop-inner"></div>
                        </button>
                      ) : audioBase64 ? (
                        <button
                          type="button"
                          onClick={() => setAbaAtivaHomebar(null)}
                          className="px-4 py-1.5 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs rounded-full flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                          title="Confirmar"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Confirmar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={iniciarGravacaoAudio}
                          className="w-11 h-11 rounded-full border-2 border-orange-500 bg-orange-600/20 text-orange-400 hover:bg-orange-600 hover:text-white flex items-center justify-center transition-all active:scale-95 shadow-[0_0_16px_rgba(234,88,12,0.35)]"
                          title="Iniciar gravação de ruído"
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Elemento de áudio invisível para playback */}
                  {audioBase64 && (
                    <audio
                      ref={audioPlayerRef}
                      src={audioBase64}
                      onPlay={() => setTocandoAudio(true)}
                      onPause={() => setTocandoAudio(false)}
                      onEnded={() => setTocandoAudio(false)}
                      className="hidden"
                    />
                  )}
                </div>
              )}

              {/* CARD CONTEXTUAL FLUTUANTE: REGISTRO ESCRITO (ESTILO BOX DO ÁUDIO) */}
              {abaAtivaHomebar === 'registro' && (
                <div className="chatgpt-voice-card p-5 shadow-lg animate-slide-up relative overflow-hidden select-none space-y-3 mb-1">
                  {/* Header superior */}
                  <div className="relative z-10 flex items-center justify-between pb-1">
                    <span className="text-sm font-bold text-white tracking-tight">
                      Registro Escrito
                    </span>
                    <button
                      type="button"
                      onClick={() => setAbaAtivaHomebar(null)}
                      className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800/60 transition-colors"
                      title="Fechar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Corpo do Registro com Textarea */}
                  <div className="relative z-10 space-y-2.5">
                    <textarea
                      rows={3}
                      autoFocus
                      value={observacaoTexto}
                      onChange={(e) => setObservacaoTexto(e.target.value)}
                      placeholder="Descreva detalhes específicos da falha, sintomas secundários ou orientações para a manutenção..."
                      className="w-full bg-[#111114] border border-white/[0.08] rounded-xl p-3 text-xs sm:text-sm text-white placeholder-[#8E8E93] focus:outline-none focus:border-white resize-none transition-all"
                    />
                    <div className="flex items-center justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => setAbaAtivaHomebar(null)}
                        className="px-4 py-1.5 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs rounded-full flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Confirmar</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* A CÁPSULA DA HOMEBAR: 4 ITENS FIÉIS AO DESIGN SYSTEM (@jsav.design & WORKOUTS VIBE) */}
              <nav className="h-[68px] bg-[#14141A]/95 border border-white/[0.08] rounded-full px-3 py-2 flex items-center justify-between shadow-2xl backdrop-blur-xl">
                {/* 1. CÂMERA */}
                <button
                  type="button"
                  onClick={() => handleCliqueHomebar('camera')}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    abaAtivaHomebar === 'camera'
                      ? 'bg-white text-zinc-950 shadow-md scale-105 border-transparent'
                      : 'bg-[#1E1E26] text-white hover:bg-[#282832] border border-white/[0.08] shadow-sm active:scale-95'
                  }`}
                  title="Câmera da falha"
                >
                  <Camera className={`w-5 h-5 ${abaAtivaHomebar === 'camera' ? 'stroke-[2.5]' : ''}`} />
                  {fotoBase64 && abaAtivaHomebar !== 'camera' && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#16161D]"></span>
                  )}
                </button>

                {/* 2. ÁUDIO */}
                <button
                  type="button"
                  onClick={() => handleCliqueHomebar('audio')}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    gravandoAudio
                      ? 'bg-[#EF4444] text-white animate-pulse shadow-md border-transparent'
                      : abaAtivaHomebar === 'audio'
                      ? 'bg-white text-zinc-950 shadow-md scale-105 border-transparent'
                      : 'bg-[#1E1E26] text-white hover:bg-[#282832] border border-white/[0.08] shadow-sm active:scale-95'
                  }`}
                  title="Gravar áudio do ruído"
                >
                  {gravandoAudio ? (
                    <span className="text-[11px] font-mono font-black">{tempoGravacao}s</span>
                  ) : (
                    <Mic className={`w-5 h-5 ${abaAtivaHomebar === 'audio' ? 'stroke-[2.5]' : ''}`} />
                  )}
                  {audioBase64 && !gravandoAudio && abaAtivaHomebar !== 'audio' && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#16161D]"></span>
                  )}
                </button>

                {/* 3. REGISTRO ESCRITO */}
                <button
                  type="button"
                  onClick={() => handleCliqueHomebar('registro')}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    abaAtivaHomebar === 'registro'
                      ? 'bg-white text-zinc-950 shadow-md scale-105 border-transparent'
                      : 'bg-[#1E1E26] text-white hover:bg-[#282832] border border-white/[0.08] shadow-sm active:scale-95'
                  }`}
                  title="Registro escrito complementar"
                >
                  <FileText className={`w-5 h-5 ${abaAtivaHomebar === 'registro' ? 'stroke-[2.5]' : ''}`} />
                  {observacaoTexto.trim() && abaAtivaHomebar !== 'registro' && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#16161D]"></span>
                  )}
                </button>

                {/* 4. ENVIAR TICKET (UIVERSE.IO BY ADAMGIEBL) */}
                <button
                  type="button"
                  disabled={enviando}
                  onClick={handleDisparoHomebar}
                  className={`btn-uiverse-send ${
                    podeDisparar ? 'btn-ready' : 'btn-disabled'
                  }`}
                  title="Enviar Ticket para Manutenção"
                >
                  <div className="svg-wrapper-1">
                    <div className="svg-wrapper">
                      {enviando ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-white" />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="20"
                          height="20"
                        >
                          <path fill="none" d="M0 0h24v24H0z" />
                          <path
                            fill="currentColor"
                            d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span>{enviando ? 'Enviando...' : 'Enviar'}</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* TELA 3: SUCESSO / CONFIRMAÇÃO IMEDIATA */}
      {tela === 'sucesso' && (
        <div className="flex-1 flex flex-col justify-between p-6 bg-[#000000] text-center">
          <div className="my-auto space-y-4">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 shadow-2xl animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400 block">
                Marco T₀ Registrado
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Chamado Enviado à Manutenção!
              </h2>
              <p className="text-xs text-[#8E8E93] mt-1 font-medium">
                O Team Leader e a equipe técnica já receberam o alerta no Cockpit.
              </p>
            </div>

            {/* Dossiê da OS */}
            <div className="bg-[#16161A] border border-white/[0.08] rounded-2xl p-4 text-left space-y-2 max-w-xs mx-auto shadow-xl text-xs font-mono">
              <div className="flex justify-between border-b border-white/[0.08] pb-2">
                <span className="text-[#8E8E93] font-semibold">Número da OS:</span>
                <span className="text-white font-bold text-sm">{chamadoCriado?.numero_os}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8E93] font-semibold">Impacto:</span>
                <span className="text-red-400 font-bold uppercase">
                  {statusImpacto.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8E93] font-semibold">Máquina:</span>
                <span className="text-white">{ativoData?.tag_patrimonio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8E93] font-semibold">Posto:</span>
                <span className="text-white font-bold">{ativoData?.posto_trabalho}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8E8E93] font-semibold">Operador:</span>
                <span className="text-white font-bold">{nomeOperador} ({identifiant})</span>
              </div>
              {fotoBase64 && (
                <div className="flex justify-between items-center pt-1 border-t border-white/[0.08]">
                  <span className="text-[#8E8E93] font-semibold">Anexo:</span>
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

      {/* MODAL DE CÂMERA INTEGRADA FULL-SCREEN (NUNCA RECARREGA A ABA NEM VOLTA AO SCANNER) */}
      <CameraFotoModal
        isOpen={modalCameraAberto}
        onClose={() => setModalCameraAberto(false)}
        onFotoConfirmada={(fotoDataUrl) => {
          setFotoBase64(fotoDataUrl);
          setModalCameraAberto(false);
          setAbaAtivaHomebar('camera');
        }}
      />

      {/* DISPARADOR NATIVO DA CÂMERA DO CELULAR (SAMSUNG / IPHONE / MOTOROLA / XIAOMI) */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFotoNativaCapturada}
      />
    </div>
  );
}
