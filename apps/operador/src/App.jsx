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
import VanguardLogo from './components/VanguardLogo';

export default function App() {
  // 0. Splash Screen inicial com animação Uiverse.io (#EF4444)
  const [splashVisivel, setSplashVisivel] = useState(true);
  const [splashOpacidade, setSplashOpacidade] = useState(true);

  useEffect(() => {
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

  // 5. Anexo de Mídia Rápido (Câmera Nativa do Celular + Áudio de ruído)
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

  // Salva rascunho de tela no sessionStorage para tolerância a falhas do navegador mobile
  useEffect(() => {
    if (tela === 'gabarito' && ativoData) {
      const draft = {
        tela: 'gabarito',
        ativoData,
        sintomasSelecionados,
        statusImpacto,
        observacaoTexto,
        fotoBase64,
        audioBase64
      };
      sessionStorage.setItem('cmms_trigger_active_draft', JSON.stringify(draft));
    } else if (tela === 'scanner' || tela === 'sucesso') {
      sessionStorage.removeItem('cmms_trigger_active_draft');
    }
  }, [tela, ativoData, sintomasSelecionados, statusImpacto, observacaoTexto, fotoBase64, audioBase64]);

  // Recupera rascunho se a aba tiver sido restaurada pelo navegador
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('cmms_trigger_active_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.ativoData && parsed.tela === 'gabarito') {
          setAtivoData(parsed.ativoData);
          setSintomasSelecionados(parsed.sintomasSelecionados || []);
          setStatusImpacto(parsed.statusImpacto || 'maquina_parada');
          setObservacaoTexto(parsed.observacaoTexto || '');
          setFotoBase64(parsed.fotoBase64 || null);
          setAudioBase64(parsed.audioBase64 || null);
          setTela('gabarito');
        }
      }
    } catch (e) {}
  }, []);

  function abrirModalOperador() {
    setCodigoInput('');
    setErroOperador(null);
    setSucessoOperador(null);
    setModalEditarOperador(true);
  }

  // Validação direta e instantânea de Identifiant (Estados: Repouso, Sucesso Verde, Erro Vermelho)
  async function validarEConfirmarOperador(cod) {
    const limpo = String(cod || '').trim();
    if (!limpo) return;
    setValidandoOperador(true);
    setErroOperador(null);
    setSucessoOperador(null);
    try {
      const res = await fetch(`/api/auth/operador/${encodeURIComponent(limpo)}`);
      if (!res.ok) {
        throw new Error('Usuário não encontrado!');
      }
      const data = await res.json();
      if (!data.operador) throw new Error('Usuário não encontrado!');

      setSucessoOperador(data.operador.nome);
      setIdentifiant(data.operador.matricula);
      setNomeOperador(data.operador.nome);
      localStorage.setItem('cmms_operador_identifiant', data.operador.matricula);
      localStorage.setItem('cmms_operador_nome', data.operador.nome);

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
    sessionStorage.removeItem('cmms_trigger_active_draft');
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.erro || errData.mensagem || `Falha ao registrar chamado (Status ${res.status}).`);
      }
      const data = await res.json();
      setChamadoCriado(data.chamado);
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
        acionarCameraNativa();
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
    <div className={`${tela === 'scanner' ? 'h-screen' : 'min-h-screen'} bg-[#212121] text-slate-100 flex flex-col justify-between max-w-md mx-auto relative select-none overflow-hidden`}>
      {/* SPLASH SCREEN INICIAL COM LOGO CORP. VANGUARD E LOADER #EF4444 */}
      {splashVisivel && (
        <div
          className="fixed inset-0 z-50 bg-[#212121] flex flex-col items-center justify-center select-none"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#212121] border border-zinc-700 rounded-[2px] max-w-[310px] w-full overflow-hidden shadow-2xl flex flex-col">
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
                  className="text-zinc-200 hover:text-white font-bold text-lg leading-none p-1 transition-transform active:scale-90"
                  title="Fechar"
                >
                  ✕
                </button>
              </div>

              {/* Linha com input Floating Label Uiverse.io (ClawHack1) e botão validar */}
              <div className="flex gap-2.5 items-center pt-1.5">
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
                  className="bg-[#525252] hover:bg-[#616161] text-white font-medium text-xs sm:text-sm rounded-[2px] px-3.5 h-[42px] transition-all flex items-center justify-center min-w-[75px] shrink-0 active:scale-95 disabled:opacity-40"
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
        <div className="flex-1 flex flex-col justify-between p-5 bg-zinc-950 space-y-4">
          <div className="space-y-4 my-auto">
            {/* Ícone de Alerta */}
            <div className="w-16 h-16 bg-amber-500/20 border-2 border-amber-500 rounded-[2px] flex items-center justify-center mx-auto text-amber-400 shadow-2xl animate-pulse">
              <ShieldAlert className="w-9 h-9" />
            </div>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
                Bloqueio Preventivo de Duplicidade
              </span>
              <h2 className="text-lg font-black text-white leading-tight">
                Chamado já em andamento para esta máquina!
              </h2>
              <p className="text-xs text-zinc-200 font-medium">
                A equipe técnica já foi notificada. Evite tickets repetidos na troca de turno.
              </p>
            </div>

            {/* Dossiê do Chamado Ativo */}
            <div className="bg-zinc-900 border border-amber-500/40 rounded-[2px] p-4 text-xs font-mono space-y-2 shadow-xl">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-zinc-200 font-semibold">Ordem de Serviço:</span>
                <span className="text-amber-400 font-black text-sm">{chamadoAtivoAlerta?.numero_os}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-200 font-semibold">Tempo Aberto:</span>
                <span className="text-white font-bold">
                  Aberto há {chamadoAtivoAlerta?.minutos_aberto || 1} min
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-200 font-semibold">Operador Solicitante:</span>
                <span className="text-zinc-200">{chamadoAtivoAlerta?.operador_nome}</span>
              </div>
              <div className="pt-1 border-t border-zinc-800/80">
                <span className="text-zinc-200 block text-[10px] uppercase font-bold">Problema Reportado:</span>
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
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-[2px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Voltar ao Scanner (Ciente)</span>
            </button>

            <button
              type="button"
              onClick={prosseguirComReforco}
              className="w-full py-2.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white font-bold text-[11px] rounded-[2px] transition-all"
            >
              Agravou o problema? Abrir Reforço de OS
            </button>
          </div>
        </div>
      )}

      {/* TELA 2: HUD DO OPERADOR COM BOTTOM SHEET RETRÁTIL (DASHBOARD DE DISPARO) */}
      {tela === 'gabarito' && (
        <div className="flex-1 flex flex-col justify-between bg-[#212121] overflow-y-auto relative">
          {/* TOPO: BANNER DA MÁQUINA (EX: MV3-ROB-04) */}
          <div className="bg-[#161616] py-3.5 px-4 border-b border-zinc-800 flex items-center justify-between shrink-0 sticky top-0 z-20">
            <button
              type="button"
              onClick={voltarAoScanner}
              className="text-zinc-200 hover:text-white p-1 transition-all active:scale-90"
              title="Voltar ao scanner"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-200 block">
                Equipamento Selecionado
              </span>
              <h1 className="font-mono font-black text-lg sm:text-xl text-white tracking-widest uppercase">
                {ativoData?.tag_patrimonio || 'MV3-ROB-04'}
              </h1>
            </div>
            <button
              type="button"
              onClick={voltarAoScanner}
              className="text-zinc-200 hover:text-white p-1 font-bold text-base transition-all active:scale-90"
              title="Cancelar e escanear outra"
            >
              ✕
            </button>
          </div>

          {/* CORPO DO HUD: SINTOMAS E IMPACTO (LIMPO, SEM ROLAGEM EXCESSIVA) */}
          <div className="p-4 space-y-5 flex-1 pb-32">
            {/* 1. SEÇÃO POSSÍVEL PROBLEMA (PENUMBRA RADIO GROUP BY UIVERSE-ASTRONAUT) */}
            <fieldset className="penumbra-radio-group">
              <legend className="penumbra-radio-group__legend">Possível Problema</legend>
              {sintomasDisponiveis.map((item) => {
                const isChecked = sintomasSelecionados.some((s) => s.id === item.id);
                const titulo = item.titulo || (item.descricao.includes('/') ? item.descricao.split('/')[0].trim() : item.descricao);
                const hint = item.hint || (item.descricao.includes('/') ? item.descricao.split('/').slice(1).join('/').trim() : item.categoria || 'Anomalia operacional');

                return (
                  <label
                    key={item.id}
                    className={`penumbra-radio ${isChecked ? 'is-selected' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleSintoma(item);
                    }}
                  >
                    <input
                      className="penumbra-radio__input"
                      type="radio"
                      name="penumbra-problema"
                      value={item.id}
                      checked={isChecked}
                      readOnly
                    />
                    <span className="penumbra-radio__mark" aria-hidden="true"></span>
                    <span className="penumbra-radio__text">
                      <span className="penumbra-radio__title">{titulo}</span>
                      <span className="penumbra-radio__hint">{hint}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {/* 2. SEÇÃO IMPACTO DO PROBLEMA NA LINHA */}
            <div className="space-y-3 pt-1">
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Impacto do Problema na Linha
              </h2>

              {/* BANNERS BOOKMARK DE IMPACTO (UIVERSE.IO + CORES DO SEGUNDO CÉREBRO) */}
              <div className="flex items-center justify-around py-3.5 px-3 bg-[#161616] border border-zinc-800 rounded-[2px] shadow-inner">
                {/* 1. Banner Vermelho - ALTO (#EF4444) */}
                <label
                  className="ui-bookmark"
                  style={{ '--icon-primary-color': '#EF4444' }}
                  title="Alto (Máquina Parada)"
                >
                  <input
                    type="radio"
                    name="impacto-banner"
                    checked={statusImpacto === 'maquina_parada'}
                    onChange={() => setStatusImpacto('maquina_parada')}
                  />
                  <div className="bookmark">
                    <svg viewBox="0 0 32 32">
                      <g>
                        <path d="M27 4v27a1 1 0 0 1-1.625.781L16 24.281l-9.375 7.5A1 1 0 0 1 5 31V4a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4z"></path>
                      </g>
                    </svg>
                  </div>
                  <span
                    className={`text-[10px] sm:text-[11px] font-mono mt-2 transition-colors whitespace-nowrap ${
                      statusImpacto === 'maquina_parada'
                        ? 'font-black text-[#EF4444]'
                        : 'text-zinc-200 font-bold'
                    }`}
                  >
                    ALTO
                  </span>
                </label>

                {/* 2. Banner Âmbar - MÉDIO (#F59E0B) */}
                <label
                  className="ui-bookmark"
                  style={{ '--icon-primary-color': '#F59E0B' }}
                  title="Médio (Operando com Restrição)"
                >
                  <input
                    type="radio"
                    name="impacto-banner"
                    checked={statusImpacto === 'operando_com_restricao'}
                    onChange={() => setStatusImpacto('operando_com_restricao')}
                  />
                  <div className="bookmark">
                    <svg viewBox="0 0 32 32">
                      <g>
                        <path d="M27 4v27a1 1 0 0 1-1.625.781L16 24.281l-9.375 7.5A1 1 0 0 1 5 31V4a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4z"></path>
                      </g>
                    </svg>
                  </div>
                  <span
                    className={`text-[10px] sm:text-[11px] font-mono mt-2 transition-colors whitespace-nowrap ${
                      statusImpacto === 'operando_com_restricao'
                        ? 'font-black text-[#F59E0B]'
                        : 'text-zinc-200 font-bold'
                    }`}
                  >
                    MÉDIO
                  </span>
                </label>

                {/* 3. Banner Verde - BAIXO (#10B981) */}
                <label
                  className="ui-bookmark"
                  style={{ '--icon-primary-color': '#10B981' }}
                  title="Baixo (Melhoria)"
                >
                  <input
                    type="radio"
                    name="impacto-banner"
                    checked={statusImpacto === 'melhoria_estetica'}
                    onChange={() => setStatusImpacto('melhoria_estetica')}
                  />
                  <div className="bookmark">
                    <svg viewBox="0 0 32 32">
                      <g>
                        <path d="M27 4v27a1 1 0 0 1-1.625.781L16 24.281l-9.375 7.5A1 1 0 0 1 5 31V4a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4z"></path>
                      </g>
                    </svg>
                  </div>
                  <span
                    className={`text-[10px] sm:text-[11px] font-mono mt-2 transition-colors whitespace-nowrap ${
                      statusImpacto === 'melhoria_estetica'
                        ? 'font-black text-[#10B981]'
                        : 'text-zinc-200 font-bold'
                    }`}
                  >
                    BAIXO
                  </span>
                </label>
              </div>
            </div>
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
                <div className="bg-[#18181b] border border-zinc-700 rounded-2xl p-4 shadow-2xl animate-slide-up space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-white" />
                      <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                        Foto da Anomalia
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAbaAtivaHomebar(null)}
                      className="text-zinc-200 hover:text-white p-1 text-xs"
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
                        className="w-16 h-16 object-cover rounded-[2px] border border-zinc-700"
                      />
                      <div className="flex-1 space-y-2">
                        <span className="text-xs text-[#10B981] font-mono font-bold block">
                          Foto anexada ao ticket ✓
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={acionarCameraNativa}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-[2px] font-semibold border border-zinc-700 active:scale-95 transition-all"
                          >
                            Tirar outra
                          </button>
                          <button
                            type="button"
                            onClick={() => setFotoBase64(null)}
                            className="px-3 py-1.5 bg-red-950/40 text-red-400 hover:text-red-300 text-xs rounded-[2px] font-semibold flex items-center gap-1 border border-red-900/40 active:scale-95 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 space-y-2">
                      <p className="text-xs text-zinc-100 font-medium">
                        Nenhuma foto anexada. Registre uma evidência visual da falha.
                      </p>
                      <button
                        type="button"
                        onClick={acionarCameraNativa}
                        className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-[2px] flex items-center justify-center gap-2 border border-zinc-700 shadow-md active:scale-95 transition-all"
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
                <div className="chatgpt-voice-card p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] animate-slide-up relative overflow-hidden select-none">
                  {/* Brilho radial ambiente suave ao fundo das barras */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_0%,transparent_70%)] pointer-events-none"></div>

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
                <div className="chatgpt-voice-card p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] animate-slide-up relative overflow-hidden select-none space-y-3 mb-1">
                  {/* Brilho radial ambiente sutil */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04)_0%,transparent_70%)] pointer-events-none"></div>

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
                      className="w-full bg-[#121214] border border-zinc-700/80 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-white resize-none transition-all"
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

              {/* A CÁPSULA DA HOMEBAR: 4 ITENS FIÉIS AO DESIGN SYSTEM (@jsav.design) */}
              <nav className="h-[64px] bg-[#121214] border border-zinc-700/80 rounded-full px-2.5 py-1.5 flex items-center justify-between shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-md">
                {/* 1. CÂMERA */}
                <button
                  type="button"
                  onClick={() => handleCliqueHomebar('camera')}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    abaAtivaHomebar === 'camera'
                      ? 'bg-white text-zinc-950 shadow-md scale-105'
                      : 'text-zinc-300 hover:text-white active:scale-95'
                  }`}
                  title="Câmera da falha"
                >
                  <Camera className={`w-5 h-5 ${abaAtivaHomebar === 'camera' ? 'stroke-[2.5]' : ''}`} />
                  {fotoBase64 && abaAtivaHomebar !== 'camera' && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#10B981] ring-2 ring-[#121214]"></span>
                  )}
                </button>

                {/* 2. ÁUDIO */}
                <button
                  type="button"
                  onClick={() => handleCliqueHomebar('audio')}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    gravandoAudio
                      ? 'bg-red-600 text-white animate-pulse shadow-red-900/50'
                      : abaAtivaHomebar === 'audio'
                      ? 'bg-white text-zinc-950 shadow-md scale-105'
                      : 'text-zinc-300 hover:text-white active:scale-95'
                  }`}
                  title="Gravar áudio do ruído"
                >
                  {gravandoAudio ? (
                    <span className="text-[11px] font-mono font-black">{tempoGravacao}s</span>
                  ) : (
                    <Mic className={`w-5 h-5 ${abaAtivaHomebar === 'audio' ? 'stroke-[2.5]' : ''}`} />
                  )}
                  {audioBase64 && !gravandoAudio && abaAtivaHomebar !== 'audio' && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#10B981] ring-2 ring-[#121214]"></span>
                  )}
                </button>

                {/* 3. REGISTRO ESCRITO */}
                <button
                  type="button"
                  onClick={() => handleCliqueHomebar('registro')}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    abaAtivaHomebar === 'registro'
                      ? 'bg-white text-zinc-950 shadow-md scale-105'
                      : 'text-zinc-300 hover:text-white active:scale-95'
                  }`}
                  title="Registro escrito complementar"
                >
                  <FileText className={`w-5 h-5 ${abaAtivaHomebar === 'registro' ? 'stroke-[2.5]' : ''}`} />
                  {observacaoTexto.trim() && abaAtivaHomebar !== 'registro' && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#10B981] ring-2 ring-[#121214]"></span>
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
        <div className="flex-1 flex flex-col justify-between p-6 bg-zinc-950 text-center">
          <div className="my-auto space-y-4">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 rounded-[2px] flex items-center justify-center mx-auto text-emerald-400 shadow-2xl animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400 block">
                Marco T₀ Registrado
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Chamado Enviado à Manutenção!
              </h2>
              <p className="text-xs text-zinc-200 mt-1 font-medium">
                O Team Leader e a equipe técnica já receberam o alerta no Cockpit.
              </p>
            </div>

            {/* Dossiê da OS */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[2px] p-4 text-left space-y-2 max-w-xs mx-auto shadow-lg text-xs font-mono">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-200 font-semibold">Número da OS:</span>
                <span className="text-white font-bold text-sm">{chamadoCriado?.numero_os}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-200 font-semibold">Impacto:</span>
                <span className="text-red-400 font-bold uppercase">
                  {statusImpacto.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-200 font-semibold">Máquina:</span>
                <span className="text-white">{ativoData?.tag_patrimonio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-200 font-semibold">Posto:</span>
                <span className="text-white font-bold">{ativoData?.posto_trabalho}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-200 font-semibold">Operador:</span>
                <span className="text-white font-bold">{nomeOperador} ({identifiant})</span>
              </div>
              {fotoBase64 && (
                <div className="flex justify-between items-center pt-1 border-t border-zinc-800">
                  <span className="text-zinc-200 font-semibold">Anexo:</span>
                  <span className="text-emerald-400 font-bold">1 Foto Anexada</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={voltarAoScanner}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-[2px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>Escanear Próxima Máquina</span>
          </button>
        </div>
      )}

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
