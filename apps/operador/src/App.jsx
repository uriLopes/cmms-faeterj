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
  ChevronDown
} from 'lucide-react';
import ScannerCamera from './components/ScannerCamera';
import VanguardLogo from './components/VanguardLogo';
import CameraFotoModal from './components/CameraFotoModal';

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

  // 5. Anexo de Mídia Rápido (Foto in-app + Áudio de ruído)
  const [fotoBase64, setFotoBase64] = useState(null);
  const [modalFotoAberta, setModalFotoAberta] = useState(false);
  const [audioBase64, setAudioBase64] = useState(null);
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerGravacaoRef = useRef(null);

  // Status de envio e resultado
  const [dashboardAberto, setDashboardAberto] = useState(false);
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
    setDashboardAberto(false);
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.erro || errData.mensagem || `Falha ao registrar chamado (Status ${res.status}).`);
      }
      const data = await res.json();
      setChamadoCriado(data.chamado);
      setDashboardAberto(false);
      setTela('sucesso');
    } catch (err) {
      alert(err.message || 'Erro ao enviar chamado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
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
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 block">
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
          <div className="p-4 space-y-5 flex-1 pb-24">
            {/* 1. SEÇÃO POSSÍVEL PROBLEMA */}
            <div className="space-y-2.5">
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Possível Problema
              </h2>
              <div className="space-y-2">
                {sintomasDisponiveis.map((item) => {
                  const isChecked = sintomasSelecionados.some((s) => s.id === item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSintoma(item)}
                      className={`p-3 bg-[#161616] border transition-all cursor-pointer rounded-[2px] flex items-center gap-3 active:scale-[0.99] ${
                        isChecked
                          ? 'border-white/50 ring-1 ring-white/30'
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* Caixa de Confere Quadrada (Cinza #525252 no repouso) */}
                      <div
                        className={`w-6 h-6 rounded-[2px] flex items-center justify-center shrink-0 transition-all ${
                          isChecked
                            ? 'bg-white text-black font-bold'
                            : 'bg-[#525252] border border-zinc-600'
                        }`}
                      >
                        {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-white leading-snug">
                        {item.descricao}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

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

          {/* DOCK INFERIOR COMPACTO DO HUD (CHAMADA DO DASHBOARD) */}
          <div className="sticky bottom-0 left-0 right-0 p-3.5 bg-gradient-to-t from-[#161616] via-[#161616]/95 to-transparent pt-5 border-t border-zinc-800/80 z-15">
            <button
              type="button"
              onClick={() => setDashboardAberto(true)}
              className="w-full py-3.5 px-4 bg-[#262626] hover:bg-[#303030] border border-zinc-700 rounded-[2px] shadow-2xl flex items-center justify-between transition-all active:scale-[0.99] group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[2px] bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500 group-hover:scale-105 transition-transform">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-xs font-mono uppercase tracking-wider">
                      Dashboard de Ações
                    </span>
                    {(fotoBase64 || audioBase64 || observacaoTexto.trim()) && (
                      <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                    )}
                  </div>
                  <span className="text-zinc-200 text-[11px] block mt-0.5">
                    {fotoBase64 || audioBase64 || observacaoTexto.trim()
                      ? [
                          fotoBase64 && '1 foto',
                          audioBase64 && '1 áudio',
                          observacaoTexto.trim() && 'Nota escrita'
                        ].filter(Boolean).join(' • ')
                      : 'Câmera, áudio, registro e envio do ticket'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#161616] border border-zinc-700 rounded-[2px] text-zinc-200 group-hover:text-white">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wide">Abrir</span>
                <ChevronUp className="w-3.5 h-3.5 text-white" />
              </div>
            </button>
          </div>

          {/* BOTTOM SHEET: DASHBOARD RETRÁTIL (CÂMERA, ÁUDIO, REGISTRO ESCRITO E ENVIAR TICKET) */}
          {dashboardAberto && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
              {/* Backdrop escurecido */}
              <div
                onClick={() => setDashboardAberto(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-xs transition-opacity animate-fade-in"
              ></div>

              {/* Painel do Dashboard Deslizante */}
              <div className="relative bg-[#1a1a1a] border-t-2 border-zinc-600 rounded-t-xl max-w-md w-full mx-auto p-4 sm:p-5 shadow-2xl flex flex-col gap-4 animate-slide-up max-h-[85vh] overflow-y-auto">
                {/* Pílula de Arraste Superior */}
                <div
                  onClick={() => setDashboardAberto(false)}
                  className="w-12 h-1.5 bg-zinc-600 hover:bg-zinc-400 rounded-full mx-auto cursor-pointer transition-colors"
                ></div>

                {/* Cabeçalho do Dashboard */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-red-500" />
                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                      Dashboard de Disparo • {ativoData?.tag_patrimonio || 'MV3-ROB-04'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDashboardAberto(false)}
                    className="p-1 text-zinc-200 hover:text-white transition-transform active:scale-90"
                    title="Recolher Dashboard"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>

                {/* 1. MÍDIAS COMPLEMENTARES: CÂMERA E ÁUDIO */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono font-bold uppercase text-zinc-200 tracking-wider block">
                    1. Mídias da Falha
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Botão Câmera 📷 */}
                    <button
                      type="button"
                      onClick={() => setModalFotoAberta(true)}
                      className={`py-3 px-3 bg-[#161616] border rounded-[2px] flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        fotoBase64
                          ? 'border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950/40 bg-emerald-950/20'
                          : 'border-zinc-700 text-white hover:border-zinc-500'
                      }`}
                      title="Tirar Foto da Falha"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="text-xs font-bold font-mono">
                        {fotoBase64 ? 'Foto Anexada ✓' : 'Tirar Foto'}
                      </span>
                    </button>

                    {/* Botão Microfone 🎙️ */}
                    <button
                      type="button"
                      onClick={iniciarGravacaoAudio}
                      className={`py-3 px-3 bg-[#161616] border rounded-[2px] flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        gravandoAudio
                          ? 'bg-red-600 border-red-500 text-white animate-pulse'
                          : audioBase64
                          ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                          : 'border-zinc-700 text-white hover:border-zinc-500'
                      }`}
                      title="Gravar Áudio de Ruído Mecânico"
                    >
                      {gravandoAudio ? (
                        <>
                          <Square className="w-5 h-5 fill-current" />
                          <span className="text-xs font-mono font-bold">{tempoGravacao}s/10s</span>
                        </>
                      ) : audioBase64 ? (
                        <>
                          <Mic className="w-5 h-5" />
                          <span className="text-xs font-bold font-mono">Áudio Gravado ✓</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-5 h-5" />
                          <span className="text-xs font-bold font-mono">Gravar Áudio</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Previews das mídias se houver */}
                  {(fotoBase64 || audioBase64) && (
                    <div className="flex flex-col gap-2 pt-1">
                      {fotoBase64 && (
                        <div className="flex items-center justify-between bg-[#161616] border border-zinc-800 p-2 rounded-[2px]">
                          <div className="flex items-center gap-2">
                            <img
                              src={fotoBase64}
                              alt="Anomalia"
                              className="w-12 h-12 object-cover rounded-[2px] border border-zinc-700"
                            />
                            <span className="text-xs text-emerald-400 font-mono font-bold">Foto da anomalia anexada</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFotoBase64(null)}
                            className="p-1.5 text-zinc-400 hover:text-red-400"
                            title="Remover foto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {audioBase64 && (
                        <div className="flex items-center gap-2 bg-[#161616] border border-zinc-800 rounded-[2px] p-2">
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
                    </div>
                  )}
                </div>

                {/* 2. REGISTRO ESCRITO (OBSERVAÇÃO COMPLEMENTAR) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono font-bold uppercase text-zinc-200 tracking-wider block">
                    2. Registro Escrito
                  </span>
                  <div className="bg-[#141414] border border-zinc-700 rounded-[2px] px-3.5 py-3 flex items-center justify-between gap-2 shadow-inner focus-within:border-zinc-500">
                    <input
                      type="text"
                      value={observacaoTexto}
                      onChange={(e) => setObservacaoTexto(e.target.value)}
                      placeholder="Registro escrito / detalhes da anomalia (opcional)..."
                      className="bg-transparent text-white placeholder-zinc-400 text-xs sm:text-sm font-medium w-full focus:outline-none"
                    />
                    <Edit2 className="w-4 h-4 text-white shrink-0" />
                  </div>
                </div>

                {/* 3. BOTÃO DE AÇÃO DOMINANTE: ENVIAR TICKET */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={enviando || (sintomasSelecionados.length === 0 && !observacaoTexto.trim() && !fotoBase64)}
                    onClick={handleEnviarChamado}
                    className={`w-full py-4 rounded-[2px] font-bold text-base sm:text-lg tracking-wider uppercase shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                      sintomasSelecionados.length > 0 || observacaoTexto.trim() || fotoBase64
                        ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-red-950/50'
                        : 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700'
                    }`}
                  >
                    {enviando ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin text-white" />
                        <span>Enviando Ticket...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Enviar Ticket</span>
                      </>
                    )}
                  </button>
                  {sintomasSelecionados.length === 0 && !observacaoTexto.trim() && !fotoBase64 && (
                    <span className="text-[10px] text-zinc-400 font-mono text-center block mt-1.5">
                      * Selecione ao menos 1 sintoma no HUD ou anexe foto/registro
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
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

      {/* MODAL DE CÂMERA INTEGRADA (ZERO RECARREGAMENTO DE ABA NO CELULAR) */}
      <CameraFotoModal
        isOpen={modalFotoAberta}
        onClose={() => setModalFotoAberta(false)}
        onFotoConfirmada={(foto) => setFotoBase64(foto)}
      />
    </div>
  );
}
