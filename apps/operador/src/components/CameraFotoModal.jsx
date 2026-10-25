import { useEffect, useRef, useState } from 'react';
import { Camera, X, Check, RefreshCw, AlertCircle, Image as ImageIcon } from 'lucide-react';

export default function CameraFotoModal({ isOpen, onClose, onFotoConfirmada }) {
  const [stream, setStream] = useState(null);
  const [fotoCongelada, setFotoCongelada] = useState(null);
  const [erroCamera, setErroCamera] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

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
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
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
    const maxDim = 800;
    let width = video.videoWidth || 800;
    let height = video.videoHeight || 600;

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

    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    setFotoCongelada(dataUrl);
    pararCamera();
  }

  function handleArquivoGaleria(e) {
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setFotoCongelada(dataUrl);
        pararCamera();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function confirmarFoto() {
    if (!fotoCongelada) return;
    onFotoConfirmada(fotoCongelada);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 select-none animate-fade-in">
      {/* Input oculto sem capture para galeria leve (não aciona app externo pesado) */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleArquivoGaleria}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div>
          <h3 className="text-xs font-black text-white flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-red-500" />
            Fotografar Peça / Alarme
          </h3>
          <p className="text-[10px] text-zinc-400">
            {fotoCongelada ? 'Confira o enquadramento da evidência' : 'Aponte para a falha e aperte o disparador'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Viewfinder Central */}
      <div className="flex-1 my-3 flex items-center justify-center overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-800 relative">
        {fotoCongelada ? (
          <img
            src={fotoCongelada}
            alt="Evidência capturada"
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Retículo Guia */}
            <div className="absolute inset-8 border border-white/20 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="text-[9px] font-mono text-white/40 tracking-wider uppercase">
                Área de Foco
              </span>
            </div>
          </>
        )}

        {erroCamera && !fotoCongelada && (
          <div className="absolute inset-0 bg-black/90 p-4 flex flex-col items-center justify-center text-center gap-2">
            <AlertCircle className="w-8 h-8 text-amber-400" />
            <p className="text-xs text-zinc-300">{erroCamera}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 px-4 py-2 bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Selecionar da Galeria</span>
            </button>
          </div>
        )}
      </div>

      {/* Controles Inferiores */}
      <div className="pt-2">
        {fotoCongelada ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFotoCongelada(null)}
              className="flex-1 py-3 bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tirar Outra</span>
            </button>
            <button
              type="button"
              onClick={confirmarFoto}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Usar Esta Foto</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-8 py-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
              title="Escolher da Galeria"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Botão Disparador */}
            <button
              type="button"
              onClick={dispararFoto}
              className="w-16 h-16 rounded-full border-4 border-white bg-red-600 active:scale-90 transition-all flex items-center justify-center shadow-xl shadow-red-600/40"
              title="Disparar Foto"
            >
              <div className="w-11 h-11 rounded-full bg-red-500 border border-red-400" />
            </button>

            <div className="w-10 h-10" />
          </div>
        )}
      </div>
    </div>
  );
}
