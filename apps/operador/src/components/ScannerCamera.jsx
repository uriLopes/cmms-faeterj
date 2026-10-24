import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Zap, ZapOff, RefreshCw, AlertCircle, Camera } from 'lucide-react';

export default function ScannerCamera({ onScanSuccess, nomeOperador, matricula, onEditOperador }) {
  const [iniciando, setIniciando] = useState(true);
  const [erroCamera, setErroCamera] = useState(null);
  const [lanternaAtiva, setLanternaAtiva] = useState(false);
  const [suportaLanterna, setSuportaLanterna] = useState(false);

  const html5QrCodeRef = useRef(null);
  const videoTrackRef = useRef(null);
  const containerId = 'vanguard-camera-stream';

  useEffect(() => {
    let qrScannerInstance;

    async function inicializarScanner() {
      try {
        setIniciando(true);
        setErroCamera(null);

        qrScannerInstance = new Html5Qrcode(containerId);
        html5QrCodeRef.current = qrScannerInstance;

        const config = {
          fps: 20,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0
        };

        await qrScannerInstance.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Sucesso na leitura do QR Code
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]); // Resposta tátil industrial
            }
            // Desliga a lanterna ao sair do scanner
            desligarLanterna();
            if (qrScannerInstance && qrScannerInstance.isScanning) {
              qrScannerInstance.stop().then(() => {
                onScanSuccess(decodedText);
              }).catch(() => {
                onScanSuccess(decodedText);
              });
            } else {
              onScanSuccess(decodedText);
            }
          },
          () => {} // Ignora quadros vazios
        );

        setIniciando(false);

        // Acessa a track de vídeo nativa para ligar a lanterna
        setTimeout(() => {
          tentarLigarLanternaInicial();
        }, 600);

      } catch (err) {
        console.warn('Erro ao abrir câmera nativa:', err);
        setErroCamera(
          'Permissão de câmera não concedida ou dispositivo sem câmera traseira.'
        );
        setIniciando(false);
      }
    }

    inicializarScanner();

    return () => {
      desligarLanterna();
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((e) => console.log('Scanner finalizado', e));
      }
    };
  }, []);

  // Tenta ligar a lanterna automaticamente na entrada do app
  async function tentarLigarLanternaInicial() {
    try {
      const videoEl = document.querySelector(`#${containerId} video`);
      if (videoEl && videoEl.srcObject) {
        const track = videoEl.srcObject.getVideoTracks()[0];
        videoTrackRef.current = track;
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};

        if (capabilities.torch) {
          setSuportaLanterna(true);
          await track.applyConstraints({
            advanced: [{ torch: true }]
          });
          setLanternaAtiva(true);
        }
      }
    } catch (e) {
      console.warn('Não foi possível ativar a lanterna automaticamente:', e);
    }
  }

  // Alterna lanterna ligada / desligada
  async function toggleLanterna() {
    try {
      const track = videoTrackRef.current;
      if (track) {
        const novoEstado = !lanternaAtiva;
        await track.applyConstraints({
          advanced: [{ torch: novoEstado }]
        });
        setLanternaAtiva(novoEstado);
      }
    } catch (e) {
      console.warn('Erro ao alternar lanterna:', e);
    }
  }

  function desligarLanterna() {
    try {
      const track = videoTrackRef.current;
      if (track && lanternaAtiva) {
        track.applyConstraints({ advanced: [{ torch: false }] });
      }
    } catch (e) {}
  }

  return (
    <div className="flex-1 flex flex-col justify-between relative bg-[#2a2a2a] overflow-hidden select-none">
      {/* Visualizador da Câmera (Preenche o centro) */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4">
        {/* Container do Vídeo da Câmera */}
        <div className="w-full max-w-sm aspect-square relative flex items-center justify-center overflow-hidden rounded-xl">
          <div id={containerId} className="w-full h-full object-cover"></div>

          {/* RETÍCULO VERMELHO EXATO DO WIREFRAME DO USUÁRIO */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
            <div className="relative w-64 h-64 border-4 border-red-600 bg-red-900/20 rounded-lg flex flex-col items-center justify-center text-center p-4 shadow-[0_0_30px_rgba(220,38,38,0.35)]">
              {/* Cantos vermelhos destacados */}
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
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white text-xs gap-3">
              <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
              <span className="font-bold tracking-wide">Iniciando câmera e lanterna...</span>
            </div>
          )}

          {/* Alerta de Erro de Câmera (Com fallback) */}
          {erroCamera && (
            <div className="absolute inset-0 bg-slate-950/95 p-5 flex flex-col items-center justify-center text-center gap-2">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-slate-300 max-w-xs">{erroCamera}</p>
              <span className="text-[11px] text-slate-400 mt-2">
                Use os botões de simulação abaixo para testar diretamente.
              </span>
            </div>
          )}
        </div>

        {/* Botão de Controle da Lanterna (Ligada / Desligada) */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={toggleLanterna}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg ${
              lanternaAtiva
                ? 'bg-amber-500 text-slate-950 shadow-amber-500/30 ring-2 ring-amber-400'
                : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {lanternaAtiva ? (
              <>
                <Zap className="w-4 h-4 fill-current text-slate-950 animate-pulse" />
                <span>Lanterna: LIGADA</span>
              </>
            ) : (
              <>
                <ZapOff className="w-4 h-4 text-slate-400" />
                <span>Ligar Lanterna</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Simulador rápido para teste sem câmera física */}
      <div className="bg-[#1a1a1a] border-t border-slate-800 p-3 space-y-1.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block text-center">
          Simular leitura de QR Code físico:
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onScanSuccess('qr_mv3_rob_04_token_hash_faeterj_2026')}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-left active:scale-95 transition-all"
          >
            <span className="font-mono font-bold text-white block text-xs">MV3-ROB-04</span>
            <span className="text-[10px] text-slate-400">Robô KUKA • Chaparia</span>
          </button>
          <button
            type="button"
            onClick={() => onScanSuccess('qr_hc1_apt_02_token_hash_faeterj_2026')}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-left active:scale-95 transition-all"
          >
            <span className="font-mono font-bold text-white block text-xs">HC1-APT-02</span>
            <span className="text-[10px] text-slate-400">Apertadeira • Montagem</span>
          </button>
        </div>
      </div>
    </div>
  );
}