import { useEffect, useRef, useState } from 'react';
import { X, Check, RefreshCw, AlertCircle } from 'lucide-react';

export default function CameraFotoModal({ isOpen, onClose, onFotoConfirmada }) {
  const [stream, setStream] = useState(null);
  const [fotoCongelada, setFotoCongelada] = useState(null);
  const [erroCamera, setErroCamera] = useState(null);

  const videoRef = useRef(null);

  useEffect(() => {
    if (isOpen && !fotoCongelada) {
      iniciarCamera();
    } else {
      pararCamera();
    }
    return () => pararCamera();
  }, [isOpen, fotoCongelada]);

  async function iniciarCamera() {
    setErroCamera(null);

    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn('Erro ao abrir câmera in-app:', err);
      setErroCamera('Não foi possível abrir o sensor de câmera diretamente.');
    }
  }

  function pararCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }

  function dispararFoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const maxDim = 1280;
    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;

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
    ctx.drawImage(video, 0, 0, width, height);

    if (navigator.vibrate) {
      try {
        navigator.vibrate(60);
      } catch (e) {}
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setFotoCongelada(dataUrl);
    pararCamera();
  }

  function confirmarFoto() {
    if (!fotoCongelada) return;
    onFotoConfirmada(fotoCongelada);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none animate-fade-in">
      {/* STREAM DE VÍDEO EM TELA CHEIA (FULL-BLEED TOTAL) */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
        {fotoCongelada ? (
          <img
            src={fotoCongelada}
            alt="Evidência capturada"
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* HEADER SUPERIOR FLUTUANTE COM BOTÃO FECHAR */}
      <div className="relative z-30 pt-4 pb-2 px-4 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/60 via-black/20 to-transparent">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-[#16161A]/80 backdrop-blur-md border border-white/[0.08] flex items-center justify-center text-white hover:bg-[#202028] active:scale-95 transition-all shadow-md cursor-pointer"
          title="Fechar Câmera"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* ALERTA DE ERRO DE CÂMERA CASO NÃO AUTORIZADA */}
      {erroCamera && !fotoCongelada && (
        <div className="relative z-30 m-4 p-4 rounded-xl bg-[#16161A]/95 backdrop-blur-md border border-white/[0.08] text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-xs text-[#8E8E93]">{erroCamera}</p>
        </div>
      )}

      {/* CONTROLE INFERIOR: APENAS A BOLINHA LIMPA PARA TIRAR A FOTO (OU OPÇÕES DE REVISÃO) */}
      <div className="relative z-30 mt-auto pb-10 pt-6 px-6 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col items-center justify-center">
        {fotoCongelada ? (
          /* MODO DE REVISÃO DA FOTO CONGELADA */
          <div className="w-full max-w-sm flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFotoCongelada(null)}
              className="flex-1 py-3.5 bg-[#1E1E26] backdrop-blur-md border border-white/[0.08] text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tirar Outra</span>
            </button>
            <button
              type="button"
              onClick={confirmarFoto}
              className="flex-1 py-3.5 bg-[#10B981] hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Usar Esta Foto</span>
            </button>
          </div>
        ) : (
          /* MODO DISPARADOR: APENAS A BOLINHA LIMPA PARA TIRAR A FOTO */
          <button
            type="button"
            onClick={dispararFoto}
            className="w-20 h-20 rounded-full bg-white shadow-2xl active:scale-90 hover:scale-105 transition-all cursor-pointer flex items-center justify-center p-1.5 ring-4 ring-white/30"
            title="Tirar Foto"
          >
            <div className="w-full h-full rounded-full border-2 border-zinc-300 bg-white"></div>
          </button>
        )}
      </div>
    </div>
  );
}
