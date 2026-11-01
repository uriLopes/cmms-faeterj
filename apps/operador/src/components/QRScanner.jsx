import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, Zap, AlertCircle } from 'lucide-react';

export default function QRScanner({ onScanSuccess, onClose }) {
  const [scannerError, setScannerError] = useState(null);
  const [iniciando, setIniciando] = useState(true);
  const html5QrCodeRef = useRef(null);
  const scannerContainerId = 'qr-reader-container';

  useEffect(() => {
    let html5QrCode;

    async function startScanner() {
      try {
        setIniciando(true);
        setScannerError(null);

        html5QrCode = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: 'environment' }, // Câmera traseira do celular
          config,
          (decodedText) => {
            // Sucesso na leitura do QR Code
            if (html5QrCode && html5QrCode.isScanning) {
              html5QrCode.stop().then(() => {
                onScanSuccess(decodedText);
              }).catch(() => {
                onScanSuccess(decodedText);
              });
            } else {
              onScanSuccess(decodedText);
            }
          },
          () => {
            // Leitura em andamento sem QR no quadro (ignora ruído)
          }
        );
        setIniciando(false);
      } catch (err) {
        console.warn('Erro ao acessar câmera nativa:', err);
        setScannerError(
          'Não foi possível acessar a câmera do dispositivo. Verifique as permissões do navegador ou selecione um ativo de teste abaixo.'
        );
        setIniciando(false);
      }
    }

    startScanner();

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((e) => console.log('Scanner parado', e));
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 select-none">
      {/* Topo com botão fechar */}
      <div className="flex items-center justify-between pt-2 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[2px] bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Leitor de QR Code</h3>
            <p className="text-[11px] text-zinc-200">Aponte para a etiqueta fixada na máquina</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Área da Câmera */}
      <div className="flex-1 flex flex-col items-center justify-center my-4 relative">
        <div className="w-full max-w-xs aspect-square bg-slate-900/50 rounded-[2px] overflow-hidden border-2 border-rose-500/50 relative shadow-2xl shadow-rose-950/40 flex items-center justify-center">
          {/* Container onde o html5-qrcode renderiza o vídeo */}
          <div id={scannerContainerId} className="w-full h-full object-cover"></div>

          {/* Mira animada */}
          {!scannerError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-rose-500 rounded-[2px] relative animate-pulse">
                <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-rose-500 rounded-tl"></span>
                <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-rose-500 rounded-tr"></span>
                <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-rose-500 rounded-bl"></span>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-rose-500 rounded-br"></span>
              </div>
            </div>
          )}

          {iniciando && !scannerError && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-xs text-slate-300 gap-2">
              <RefreshCw className="w-6 h-6 text-rose-500 animate-spin" />
              <span>Iniciando câmera...</span>
            </div>
          )}

          {scannerError && (
            <div className="p-4 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300">{scannerError}</p>
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-200 font-medium text-center mt-3 max-w-xs">
          Posicione o QR Code dentro do quadro vermelho para leitura automática.
        </p>
      </div>

      {/* Simulador rápido para teste sem câmera física */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-[2px] p-3 space-y-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-200 block">
          Ou selecione uma máquina de teste rápido:
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onScanSuccess('qr_mv3_rob_04_token_hash_faeterj_2026')}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-[2px] text-left active:scale-95 transition-all"
          >
            <span className="font-mono font-bold text-white block">MV3-ROB-04</span>
            <span className="text-[10px] text-zinc-200">Robô KUKA • Chaparia</span>
          </button>
          <button
            type="button"
            onClick={() => onScanSuccess('qr_hc1_apt_02_token_hash_faeterj_2026')}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-[2px] text-left active:scale-95 transition-all"
          >
            <span className="font-mono font-bold text-white block">HC1-APT-02</span>
            <span className="text-[10px] text-zinc-200">Apertadeira • Montagem</span>
          </button>
        </div>
      </div>
    </div>
  );
}