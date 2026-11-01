import { useEffect, useRef, useState } from 'react';
import { Camera, X, Check, RefreshCw, AlertCircle, Image as ImageIcon, Zap, ZapOff } from 'lucide-react';

export default function CameraFotoModal({ isOpen, onClose, onFotoConfirmada }) {
  const [stream, setStream] = useState(null);
  const [fotoCongelada, setFotoCongelada] = useState(null);
  const [erroCamera, setErroCamera] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [lanternaAtiva, setLanternaAtiva] = useState(false);
  const [suportaLanterna, setSuportaLanterna] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    if (isOpen && !fotoCongelada) {
      iniciarCamera(facingMode);
    } else {
      pararCamera();
    }
    return () => pararCamera();
  }, [isOpen, fotoCongelada, facingMode]);

  async function iniciarCamera(modo) {
    setErroCamera(null);
    setLanternaAtiva(false);
    setSuportaLanterna(false);

    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: modo },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Checa suporte a flash / lanterna no sensor traseiro
      const tracks = mediaStream.getVideoTracks();
      if (tracks.length > 0) {
        const track = tracks[0];
        trackRef.current = track;
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.torch) {
          setSuportaLanterna(true);
        }
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
    trackRef.current = null;
  }

  async function alternarLanterna() {
    if (!trackRef.current || !suportaLanterna) return;
    try {
      const novoEstado = !lanternaAtiva;
      await trackRef.current.applyConstraints({
        advanced: [{ torch: novoEstado }]
      });
      setLanternaAtiva(novoEstado);
    } catch (e) {
      console.warn('Falha ao alternar lanterna:', e);
    }
  }

  function alternarCamera() {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
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

  function handleArquivoGaleria(e) {
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none animate-fade-in">
      {/* Input oculto sem capture para galeria leve */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleArquivoGaleria}
      />

      {/* STREAM DE VÍDEO EM TELA CHEIA (FULL-BLEED TOTAL COMO NA FOTO DE REFERÊNCIA) */}
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

      {/* HEADER SUPERIOR FLUTUANTE (SOBREPOSTO À CÂMERA EM TELA CHEIA) */}
      <div className="relative z-30 pt-4 pb-2 px-4 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/60 via-black/20 to-transparent">
        {/* Botão Fechar no Canto Superior Esquerdo */}
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/60 active:scale-95 transition-all shadow-md"
          title="Fechar Câmera"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Controles de Status do Sensor (Flash / Lanterna + Indicador de Resolução) */}
        <div className="flex items-center gap-2.5">
          {suportaLanterna && !fotoCongelada && (
            <button
              type="button"
              onClick={alternarLanterna}
              className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all active:scale-95 shadow-md ${
                lanternaAtiva
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
                  : 'bg-black/40 border-white/20 text-white hover:bg-black/60'
              }`}
              title={lanternaAtiva ? 'Desligar Flash' : 'Ligar Flash'}
            >
              {lanternaAtiva ? (
                <Zap className="w-5 h-5 fill-current" />
              ) : (
                <ZapOff className="w-5 h-5" />
              )}
            </button>
          )}

          <div className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white font-mono text-[11px] font-bold tracking-wider">
            {fotoCongelada ? 'PREVIEW' : '12M'}
          </div>
        </div>
      </div>

      {/* ALERTA DE ERRO DE CÂMERA CASO NÃO AUTORIZADA */}
      {erroCamera && !fotoCongelada && (
        <div className="relative z-30 m-4 p-4 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-zinc-700 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-xs text-zinc-200">{erroCamera}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 px-4 py-2.5 bg-white text-zinc-950 font-bold rounded-[2px] text-xs flex items-center justify-center gap-2 mx-auto active:scale-95"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Selecionar da Galeria</span>
          </button>
        </div>
      )}

      {/* CONTROLES INFERIORES NATIVOS (IDÊNTICOS À FOTO DE REFERÊNCIA) */}
      <div className="relative z-30 mt-auto pb-8 pt-6 px-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center gap-4">
        {fotoCongelada ? (
          /* MODO DE REVISÃO DA FOTO CONGELADA */
          <div className="w-full max-w-sm flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFotoCongelada(null)}
              className="flex-1 py-3.5 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tirar Outra</span>
            </button>
            <button
              type="button"
              onClick={confirmarFoto}
              className="flex-1 py-3.5 bg-[#10B981] hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Usar Esta Foto</span>
            </button>
          </div>
        ) : (
          /* MODO DISPARADOR AO VIVO (IDÊNTICO À REFERÊNCIA DO CELULAR) */
          <>
            {/* Pílula de Modo da Câmera (Zoom / Categoria) */}
            <div className="flex items-center justify-center">
              <div className="bg-black/50 backdrop-blur-md border border-white/15 rounded-full px-4 py-1.5 flex items-center gap-4 text-xs font-mono font-bold text-white shadow-md">
                <span className="text-zinc-400 text-[11px]">.6</span>
                <span className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-black">
                  1x
                </span>
                <span className="text-zinc-400 text-[11px]">2</span>
              </div>
            </div>

            {/* Linha dos 3 Botões de Ação: Galeria, Disparador Branco Puro e Alternar Câmera */}
            <div className="w-full max-w-xs flex items-center justify-between px-4">
              {/* 1. Botão de Galeria (Canto Esquerdo) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/70 active:scale-90 transition-all shadow-md"
                title="Escolher Foto da Galeria"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* 2. BOTÃO DE DISPARO BRANCO PURO (EXATAMENTE COMO NA FOTO DE REFERÊNCIA) */}
              <button
                type="button"
                onClick={dispararFoto}
                className="w-20 h-20 rounded-full bg-white shadow-md active:scale-90 hover:scale-102 transition-all cursor-pointer flex items-center justify-center p-1"
                title="Tirar Foto"
              >
                <div className="w-full h-full rounded-full border-2 border-zinc-300 bg-white"></div>
              </button>

              {/* 3. Botão Alternar Câmera Frontal / Traseira (Canto Direito) */}
              <button
                type="button"
                onClick={alternarCamera}
                className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/70 active:scale-90 transition-all shadow-lg"
                title="Alternar Câmera Frontal / Traseira"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Rótulo de Modo Inferior */}
            <div className="flex items-center gap-6 text-[11px] font-mono tracking-widest uppercase">
              <span className="text-zinc-400 font-semibold">Retrato</span>
              <span className="text-white font-black border-b-2 border-white pb-0.5">Foto</span>
              <span className="text-zinc-400 font-semibold">Vídeo</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
