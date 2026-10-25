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
  Check
} from 'lucide-react';

export default function ScannerCamera({ onScanSuccess, nomeOperador, matricula }) {
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
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0
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
    <div className="flex-1 flex flex-col justify-between relative bg-[#2a2a2a] overflow-hidden select-none">
      {/* Alerta de Conexão HTTP Insegura */}
      {inseguro && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 p-2.5 px-4 text-xs text-amber-300 flex items-center justify-between">
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
        <div className="bg-zinc-900/95 border-b border-zinc-700 p-2 px-4 text-[11px] text-amber-300 text-center animate-fade-in">
          {avisoLanterna}
        </div>
      )}

      {/* ÁREA CENTRAL DO SCANNER */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4">
        {/* Container do Vídeo da Câmera */}
        <div className="w-full max-w-sm aspect-square relative flex items-center justify-center overflow-hidden rounded-xl bg-black border border-zinc-800">
          <div id={containerId} className="w-full h-full object-cover"></div>

          {/* RETÍCULO VERMELHO FIEL AO WIREFRAME */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
            <div className="relative w-64 h-64 border-4 border-red-600 bg-red-900/15 rounded-lg flex flex-col items-center justify-center text-center p-4 shadow-[0_0_30px_rgba(220,38,38,0.35)]">
              {/* Cantos vermelhos chanfrados em destaque */}
              <span className="absolute -top-2 -left-2 w-8 h-8 border-t-8 border-l-8 border-red-600"></span>
              <span className="absolute -top-2 -right-2 w-8 h-8 border-t-8 border-r-8 border-red-600"></span>
              <span className="absolute -bottom-2 -left-2 w-8 h-8 border-b-8 border-l-8 border-red-600"></span>
              <span className="absolute -bottom-2 -right-2 w-8 h-8 border-b-8 border-r-8 border-red-600"></span>

              {/* Texto central em branco exatamente como no wireframe */}
              <span className="text-white font-black text-base sm:text-lg leading-tight uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] max-w-[190px]">
                Escanear QR code da maquina
              </span>
            </div>
          </div>

          {/* Loader de Inicialização */}
          {iniciando && !erroCamera && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white text-xs gap-3">
              <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
              <span className="font-bold tracking-wide">Iniciando câmera e lanterna...</span>
            </div>
          )}

          {/* Alerta de Câmera Bloqueada com Botão de Ação Direta */}
          {erroCamera && (
            <div className="absolute inset-0 bg-zinc-950/95 p-5 flex flex-col items-center justify-center text-center gap-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-zinc-300 max-w-xs">{erroCamera}</p>

              <button
                type="button"
                onClick={iniciarCameraComPermissao}
                className="mt-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Permitir e Iniciar Câmera</span>
              </button>
            </div>
          )}
        </div>

        {/* CONTROLES: LANTERNA E ALTERNATIVA */}
        <div className="mt-4 flex items-center justify-center gap-3">
          {/* Botão de Lanterna (Torch) com controle físico real */}
          <button
            type="button"
            onClick={() => alternarLanternaFisica(!lanternaAtiva, true)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg ${
              lanternaAtiva
                ? 'bg-amber-500 text-zinc-950 shadow-amber-500/30 ring-2 ring-amber-400 font-black'
                : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            {lanternaAtiva ? (
              <>
                <Zap className="w-4 h-4 fill-current text-zinc-950 animate-pulse" />
                <span>Lanterna: LIGADA</span>
              </>
            ) : (
              <>
                <ZapOff className="w-4 h-4 text-zinc-400" />
                <span>Ligar Lanterna</span>
              </>
            )}
          </button>

          {/* Opção de Digitar TAG (Fallback Industrial) */}
          <button
            type="button"
            onClick={() => setModalTagManual(true)}
            className="px-3.5 py-2.5 rounded-xl font-semibold text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5"
            title="Digitar TAG manualmente caso a câmera não leia"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Digitar TAG</span>
          </button>
        </div>
      </div>

      {/* MODAL PARA DIGITAÇÃO MANUAL DE TAG */}
      {modalTagManual && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-red-500" />
              Digitar TAG da Máquina
            </h3>
            <p className="text-[11px] text-zinc-400">
              Digite a TAG gravada na placa de patrimônio do equipamento:
            </p>
            <input
              type="text"
              autoFocus
              value={tagDigitada}
              onChange={(e) => setTagDigitada(e.target.value.toUpperCase())}
              placeholder="Ex: MV3-ROB-04"
              className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-sm font-mono text-white placeholder-zinc-500 text-center uppercase tracking-wider focus:outline-none focus:border-red-500"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalTagManual(false)}
                className="flex-1 py-2.5 bg-zinc-800 text-zinc-400 font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarTagManual}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
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
