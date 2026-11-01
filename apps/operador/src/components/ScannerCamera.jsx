import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Zap,
  ZapOff,
  RefreshCw,
  AlertCircle,
  Camera,
  ShieldAlert,
  Keyboard,
  Check,
  Edit2
} from 'lucide-react';

export default function ScannerCamera({ onScanSuccess, nomeOperador, matricula, onAbrirModalOperador }) {
  const [iniciando, setIniciando] = useState(true);
  const [erroCamera, setErroCamera] = useState(null);
  const [inseguro, setInseguro] = useState(false);
  const [lanternaAtiva, setLanternaAtiva] = useState(false);
  const [suportaLanterna, setSuportaLanterna] = useState(false);
  const [modalTagManual, setModalTagManual] = useState(false);
  const [tagDigitada, setTagDigitada] = useState('');
  const [avisoLanterna, setAvisoLanterna] = useState(null);

  const html5QrCodeRef = useRef(null);
  const activeTrackRef = useRef(null);
  const jaLeuQrCode = useRef(false);
  const containerId = 'vanguard-camera-stream';

  useEffect(() => {
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocal) {
      setInseguro(true);
    }

    iniciarCameraComPermissao();

    return () => {
      finalizarCamera();
    };
  }, []);

  async function iniciarCameraComPermissao() {
    jaLeuQrCode.current = false;
    setIniciando(true);
    setErroCamera(null);
    setAvisoLanterna(null);

    try {
      // 1. Encerra qualquer scanner em execução
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {}
      }

      const qrScannerInstance = new Html5Qrcode(containerId);
      html5QrCodeRef.current = qrScannerInstance;

      const config = {
        fps: 20,
        qrbox: { width: 260, height: 260 }
      };

      // 2. Inicia diretamente com facingMode: 'environment' (lente traseira principal com flash)
      await qrScannerInstance.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          // Trava síncrona imediata: ignora os 20 frames subsequentes por segundo
          if (jaLeuQrCode.current) return;
          jaLeuQrCode.current = true;

          if (navigator.vibrate) {
            try {
              navigator.vibrate([100, 50, 100]);
            } catch (e) {}
          }
          finalizarCamera();
          onScanSuccess(decodedText);
        },
        () => {} // Ignora quadros sem QR
      );

      setIniciando(false);

      // 3. Captura o track de vídeo ativo e inicializa a lanterna
      setTimeout(() => {
        capturarTrackEAtivarLanterna();
      }, 700);

    } catch (err) {
      console.error('Falha ao iniciar câmera:', err);
      setIniciando(false);

      const msg = err?.message || String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setErroCamera(
          'Permissão de câmera negada. No topo da tela, clique no ícone de cadeado e autorize a câmera para este site.'
        );
      } else if (!window.isSecureContext) {
        setErroCamera(
          'O navegador do celular bloqueou a câmera porque a conexão é HTTP comum. É necessário acessar via link HTTPS seguro.'
        );
      } else {
        setErroCamera(
          'Não foi possível acessar a câmera traseira do dispositivo (' + msg + ').'
        );
      }
    }
  }

  // Tenta vincular o track e ligar a lanterna automaticamente
  async function capturarTrackEAtivarLanterna() {
    let trackEncontrado = null;

    // Busca o track diretamente no elemento de vídeo criado pelo html5-qrcode
    const videoElements = document.querySelectorAll(`#${containerId} video, video`);
    for (const v of videoElements) {
      if (v.srcObject && v.srcObject.getVideoTracks) {
        const tracks = v.srcObject.getVideoTracks();
        if (tracks.length > 0) {
          trackEncontrado = tracks[0];
          activeTrackRef.current = trackEncontrado;
          break;
        }
      }
    }

    // Verifica capabilities oficiais
    try {
      if (html5QrCodeRef.current) {
        const caps = html5QrCodeRef.current.getRunningTrackCameraCapabilities();
        if (caps && caps.torchFeature) {
          const torch = caps.torchFeature();
          if (torch.isSupported()) {
            setSuportaLanterna(true);
            await torch.apply(true);
            setLanternaAtiva(true);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao checar torchFeature inicial:', e);
    }

    // Fallback: via MediaStreamTrack
    if (trackEncontrado) {
      try {
        const caps = trackEncontrado.getCapabilities ? trackEncontrado.getCapabilities() : {};
        if (caps.torch) {
          setSuportaLanterna(true);
          await trackEncontrado.applyConstraints({
            advanced: [{ torch: true }]
          });
          setLanternaAtiva(true);
          return;
        }
      } catch (e) {
        console.warn('Erro ao acionar constraints nativas da lanterna:', e);
      }
    }

    // Tenta aplicação direta
    await alternarLanternaFisica(true, false);
  }

  // Alterna o estado físico da lanterna (Torch)
  async function alternarLanternaFisica(novoEstado, mostrarAlertaErro = true) {
    let ligou = false;

    // Método 1: Html5Qrcode torchFeature oficial
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        const caps = html5QrCodeRef.current.getRunningTrackCameraCapabilities();
        if (caps && caps.torchFeature) {
          const torch = caps.torchFeature();
          if (torch.isSupported()) {
            await torch.apply(novoEstado);
            ligou = true;
          }
        }
      }
    } catch (e) {
      console.warn('Método 1 (torchFeature) falhou:', e);
    }

    // Método 2: Todos os VideoTracks ativos no DOM
    if (!ligou) {
      const videos = document.querySelectorAll('video');
      for (const v of videos) {
        if (v.srcObject && v.srcObject.getVideoTracks) {
          for (const track of v.srcObject.getVideoTracks()) {
            try {
              await track.applyConstraints({
                advanced: [{ torch: novoEstado }]
              });
              ligou = true;
              activeTrackRef.current = track;
            } catch (err) {
              // Continua para o próximo track
            }
          }
        }
      }
    }

    // Método 3: applyVideoConstraints do scanner
    if (!ligou && html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: novoEstado }]
        });
        ligou = true;
      } catch (err) {}
    }

    if (ligou) {
      setLanternaAtiva(novoEstado);
      setSuportaLanterna(true);
      setAvisoLanterna(null);
    } else if (mostrarAlertaErro) {
      setAvisoLanterna(
        'Este sensor de câmera não liberou o controle de flash (Torch). Alguns dispositivos reservam o LED para o app nativo.'
      );
      setTimeout(() => setAvisoLanterna(null), 4500);
    }
  }

  function finalizarCamera() {
    try {
      alternarLanternaFisica(false, false);
    } catch (e) {}

    try {
      const videos = document.querySelectorAll('video');
      videos.forEach((v) => {
        if (v.srcObject && v.srcObject.getTracks) {
          v.srcObject.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (err) {}
          });
        }
      });
      if (activeTrackRef.current) {
        try {
          activeTrackRef.current.stop();
        } catch (err) {}
      }
    } catch (e) {}

    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    } catch (e) {}
  }

  function handleConfirmarTagManual() {
    if (!tagDigitada.trim() || jaLeuQrCode.current) return;
    jaLeuQrCode.current = true;
    finalizarCamera();
    onScanSuccess(tagDigitada.trim().toUpperCase());
  }

  return (
    <div className="flex-1 flex flex-col justify-between relative bg-[#000000] overflow-hidden select-none">
      {/* Alerta de Conexão HTTP Insegura */}
      {inseguro && (
        <div className="relative z-30 bg-amber-500/20 border-b border-amber-500/40 p-2.5 px-4 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="text-[11px] leading-tight">
              Acesso HTTP detectado. Para liberar a câmera do celular, acerte o túnel <strong>HTTPS</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Aviso temporário se a lanterna física não responder */}
      {avisoLanterna && (
        <div className="relative z-30 bg-[#1C1C22]/95 border-b border-white/10 p-2 px-4 text-[11px] text-amber-300 text-center animate-fade-in">
          {avisoLanterna}
        </div>
      )}

      {/* CONTAINER DO VÍDEO DA CÂMERA EM TELA CHEIA (SEM BORDAS OU FUNDO PRETO) */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#000000]">
        <div id={containerId} className="w-full h-full object-cover"></div>
      </div>

      {/* BOTÃO DO OPERADOR FLUTUANTE NO TOPO (SOBREPOSTO À MÁSCARA CINZA ESTENDIDA) */}
      {onAbrirModalOperador && (
        <div className="absolute top-0 left-0 right-0 z-30 pt-3 pb-1 px-4 flex justify-center pointer-events-auto">
          <button
            type="button"
            onClick={onAbrirModalOperador}
            className="cursor-pointer inline-flex items-center justify-center gap-2 py-2 px-5 rounded-full bg-[#22222A]/90 backdrop-blur-md hover:bg-[#2D2D38] active:scale-95 border border-white/15 transition-all text-xs shadow-xl"
            title="Toque para validar ou alterar Identifiant da fábrica"
          >
            <span className="font-semibold text-white text-xs">
              Operador: <strong className="text-white font-bold">{nomeOperador}</strong>{' '}
              <span className="text-zinc-200 font-mono text-[11px]">({matricula})</span>
            </span>
            <Edit2 className="w-3.5 h-3.5 text-zinc-200 ml-0.5" />
          </button>
        </div>
      )}

      {/* RETÍCULO TRANSPARENTE COM CANTONEIRAS BRANCAS ARREDONDADAS E MÁSCARA EM TODA A TELA */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 p-4 overflow-hidden">
        {/* Texto superior orientando o operador (z-20 garante renderização estrita na frente da máscara) */}
        <span className="relative z-20 text-white font-black text-xs sm:text-sm tracking-wider uppercase mb-3.5 drop-shadow-[0_2px_8px_rgba(0,0,0,1)] text-center">
          Aponte a câmera para o QR Code
        </span>

        {/* Viewfinder 100% transparente com cantoneiras brancas e máscara externa OLED cobrindo toda a tela (z-10) */}
        <div className="relative z-10 w-56 h-56 sm:w-64 sm:h-64 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.72)]">
          {/* Cantoneira Superior Esquerda */}
          <span className="absolute -top-[1.5px] -left-[1.5px] w-9 h-9 border-t-[4px] border-l-[4px] border-white rounded-tl-2xl"></span>

          {/* Cantoneira Superior Direita */}
          <span className="absolute -top-[1.5px] -right-[1.5px] w-9 h-9 border-t-[4px] border-r-[4px] border-white rounded-tr-2xl"></span>

          {/* Cantoneira Inferior Esquerda */}
          <span className="absolute -bottom-[1.5px] -left-[1.5px] w-9 h-9 border-b-[4px] border-l-[4px] border-white rounded-bl-2xl"></span>

          {/* Cantoneira Inferior Direita */}
          <span className="absolute -bottom-[1.5px] -right-[1.5px] w-9 h-9 border-b-[4px] border-r-[4px] border-white rounded-br-2xl"></span>
        </div>

        {/* Texto inferior auxiliar */}
        <span className="relative z-20 text-white font-mono font-bold text-xs sm:text-sm mt-3.5 drop-shadow-[0_2px_8px_rgba(0,0,0,1)] text-center">
          Alinhe o código no centro do quadro
        </span>
      </div>

      {/* Loader de Inicialização com Retângulos Animados */}
      {iniciando && !erroCamera && (
        <div className="absolute inset-0 bg-[#000000] z-20 flex flex-col items-center justify-center select-none p-4">
          <div className="flex flex-col items-center gap-2">
            <img
              src="/brand/corp-vanguard-wordmark-transparent.png?v=20"
              alt="Corp.Vanguard"
              className="w-48 sm:w-56 max-w-[80vw] object-contain"
            />
            <span className="text-white font-mono text-[11px] font-bold uppercase tracking-[0.3em]">
              Trigger
            </span>
            <div className="loaderRectangle mt-2">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
            <span className="font-mono text-[10px] text-white font-bold tracking-wider uppercase mt-1">
              Iniciando câmera e lanterna...
            </span>
          </div>
        </div>
      )}

      {/* Alerta de Câmera Bloqueada com Botão de Ação Direta */}
      {erroCamera && (
        <div className="absolute inset-0 bg-[#000000] p-5 flex flex-col items-center justify-center text-center gap-3 z-30">
          <AlertCircle className="w-10 h-10 text-amber-400" />
          <p className="text-xs text-zinc-100 max-w-xs font-medium">{erroCamera}</p>

          <button
            type="button"
            onClick={iniciarCameraComPermissao}
            className="mt-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4" />
            <span>Permitir e Iniciar Câmera</span>
          </button>
        </div>
      )}

      {/* CONTROLES: LANTERNA E ALTERNATIVA (ESTILO WORKOUTS ELEVADO) */}
      <div className="mt-auto relative z-20 pb-8 pt-3 flex items-center justify-center gap-3">
        {/* Botão de Lanterna (Torch) com controle físico real */}
        <button
          type="button"
          onClick={() => alternarLanternaFisica(!lanternaAtiva, true)}
          className={`cursor-pointer inline-flex items-center justify-center gap-2 py-2 px-5 rounded-full text-xs transition-all active:scale-95 shadow-md ${
            lanternaAtiva
              ? 'bg-amber-500 text-zinc-950 font-black'
              : 'bg-[#22222A]/90 backdrop-blur-md border border-white/15 text-white hover:bg-[#2D2D38] font-semibold'
          }`}
          title="Alternar lanterna / flash do leitor"
        >
          {lanternaAtiva ? (
            <>
              <span className="font-bold text-zinc-950 text-xs">Lanterna: LIGADA</span>
              <Zap className="w-3.5 h-3.5 fill-current text-zinc-950 animate-pulse ml-0.5" />
            </>
          ) : (
            <>
              <span className="font-semibold text-white text-xs">Ligar Lanterna</span>
              <ZapOff className="w-3.5 h-3.5 text-zinc-200 ml-0.5" />
            </>
          )}
        </button>

        {/* Opção de Digitar TAG (Estética Idêntica aos Botões Elevados) */}
        <button
          type="button"
          onClick={() => setModalTagManual(true)}
          className="cursor-pointer inline-flex items-center justify-center gap-2 py-2 px-5 rounded-full bg-[#22222A]/90 backdrop-blur-md hover:bg-[#2D2D38] active:scale-95 border border-white/15 transition-all text-xs shadow-md font-semibold text-white"
          title="Digitar TAG manualmente caso a câmera não leia"
        >
          <span className="font-semibold text-white text-xs">Digitar TAG</span>
          <Keyboard className="w-3.5 h-3.5 text-zinc-200 ml-0.5" />
        </button>
      </div>

      {/* MODAL PARA DIGITAÇÃO MANUAL DE TAG */}
      {modalTagManual && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C1C22] border border-white/10 rounded-2xl max-w-xs w-full p-5 space-y-3.5 shadow-2xl">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-red-500" />
              Digitar TAG da Máquina
            </h3>
            <p className="text-xs text-zinc-200 font-medium">
              Digite a TAG gravada na placa de patrimônio do equipamento:
            </p>
            <input
              type="text"
              autoFocus
              value={tagDigitada}
              onChange={(e) => setTagDigitada(e.target.value.toUpperCase())}
              placeholder="Ex: MV3-ROB-04"
              className="w-full bg-[#141418] border border-white/15 rounded-xl p-3 text-sm font-mono text-white placeholder-zinc-400 text-center uppercase tracking-wider focus:outline-none focus:border-red-500"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalTagManual(false)}
                className="flex-1 py-2.5 bg-[#252530] hover:bg-[#323240] text-zinc-200 font-bold text-xs rounded-xl border border-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarTagManual}
                className="flex-1 py-2.5 bg-[#EF4444] hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirmar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
