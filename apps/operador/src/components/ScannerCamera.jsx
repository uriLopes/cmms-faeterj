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

  const html5QrCodeRef = useRef(null);
  const containerId = 'vanguard-camera-stream';

  useEffect(() => {
    // Verifica se a conexão é segura (HTTPS ou localhost)
    // Navegadores de celular bloqueiam a câmera em HTTP por IP de rede local
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
    setIniciando(true);
    setErroCamera(null);

    try {
      // 1. Tenta obter permissão explícita de mídia
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
          });
          // Para o stream temporário para deixar o html5-qrcode assumir
          tempStream.getTracks().forEach((t) => t.stop());
        } catch (permErr) {
          console.warn('Permissão inicial via getUserMedia:', permErr);
        }
      }

      // 2. Se já havia uma instância, para
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

      // 3. Tenta enumerar câmeras traseiras
      let cameraSelecionada = { facingMode: 'environment' };
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const traseira =
            cameras.find(
              (c) =>
                c.label.toLowerCase().includes('back') ||
                c.label.toLowerCase().includes('traseira') ||
                c.label.toLowerCase().includes('environment') ||
                c.label.toLowerCase().includes('0')
            ) || cameras[cameras.length - 1];

          if (traseira && traseira.id) {
            cameraSelecionada = traseira.id;
          }
        }
      } catch (camListErr) {
        console.warn('Enumeração de câmeras indisponível, usando facingMode:', camListErr);
      }

      // 4. Inicia o leitor
      await qrScannerInstance.start(
        cameraSelecionada,
        config,
        (decodedText) => {
          // Sucesso na leitura do QR Code
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
          finalizarCamera();
          onScanSuccess(decodedText);
        },
        () => {} // Ignora quadros sem QR
      );

      setIniciando(false);

      // 5. Aciona a lanterna automaticamente após 800ms
      setTimeout(() => {
        tentarLigarLanternaAutomatica();
      }, 800);
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

  // Tenta ligar a lanterna (Torch)
  async function tentarLigarLanternaAutomatica() {
    await aplicarEstadoLanterna(true);
  }

  async function alternarLanterna() {
    await aplicarEstadoLanterna(!lanternaAtiva);
  }

  async function aplicarEstadoLanterna(ligar) {
    let sucesso = false;

    // Método 1: Via Html5Qrcode applyVideoConstraints
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: ligar }]
        });
        sucesso = true;
      } catch (e) {
        // Pode falhar se o browser preferir via MediaStreamTrack direta
      }
    }

    // Método 2: Via Track nativo do elemento de vídeo
    try {
      const videoEl = document.querySelector(`#${containerId} video`);
      if (videoEl && videoEl.srcObject) {
        const tracks = videoEl.srcObject.getVideoTracks();
        if (tracks && tracks.length > 0) {
          const track = tracks[0];
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (caps && caps.torch) {
            setSuportaLanterna(true);
          }
          await track.applyConstraints({
            advanced: [{ torch: ligar }]
          });
          sucesso = true;
        }
      }
    } catch (e) {
      console.warn('Controle nativo de lanterna falhou:', e);
    }

    if (sucesso) {
      setLanternaAtiva(ligar);
      setSuportaLanterna(true);
    }
  }

  function finalizarCamera() {
    try {
      aplicarEstadoLanterna(false);
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    } catch (e) {}
  }

  function handleConfirmarTagManual() {
    if (!tagDigitada.trim()) return;
    finalizarCamera();
    onScanSuccess(tagDigitada.trim().toUpperCase());
  }

  return (
    <div className="flex-1 flex flex-col justify-between relative bg-[#2a2a2a] overflow-hidden select-none">
      {/* Alerta de Conexão HTTP Insegura (Quando aberto via IP local sem HTTPS) */}
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
          {/* Botão de Lanterna (Torch) */}
          <button
            type="button"
            onClick={alternarLanterna}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg ${
              lanternaAtiva
                ? 'bg-amber-500 text-zinc-950 shadow-amber-500/30 ring-2 ring-amber-400'
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

      {/* RODAPÉ DO APP: LIMPO E SEM OS BOTÕES DE SIMULAÇÃO REMOVIDOS */}
      <footer className="bg-[#1e1e1e] border-t border-zinc-800 p-3 text-center">
        <p className="text-[11px] text-zinc-400">
          Aponte a câmera para a placa QR da máquina na linha
        </p>
      </footer>

      {/* MODAL PARA DIGITAÇÃO MANUAL DE TAG (CASO A CÂMERA FÍSICA ESTEJA INDISPONÍVEL) */}
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
