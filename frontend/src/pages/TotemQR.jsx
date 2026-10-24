import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';
import { CheckCircle2, Sparkles } from 'lucide-react';

const MAQUINAS = [
  {
    id: 1,
    tag: 'MV3-ROB-04',
    setor: 'Chaparia',
    token: 'qr_mv3_rob_04_token_hash_faeterj_2026'
  },
  {
    id: 2,
    tag: 'HC1-APT-02',
    setor: 'Montagem Final',
    token: 'qr_hc1_apt_02_token_hash_faeterj_2026'
  },
  {
    id: 3,
    tag: 'BNC-CNV-01',
    setor: 'Tapeçaria & Assentos',
    token: 'qr_bnc_cnv_01_token_hash_faeterj_2026'
  },
  {
    id: 4,
    tag: 'PIN-CAB-01',
    setor: 'Pintura Automotiva',
    token: 'qr_pnt_cab_01_token_hash_faeterj_2026'
  }
];

export default function TotemQR() {
  const [maquinaAtiva, setMaquinaAtiva] = useState(MAQUINAS[0]);
  const [ultimoDisparo, setUltimoDisparo] = useState(null);
  const canvasRef = useRef(null);

  // Renderiza o QR Code no Canvas com alta densidade e nitidez
  useEffect(() => {
    if (canvasRef.current && maquinaAtiva) {
      QRCode.toCanvas(
        canvasRef.current,
        maquinaAtiva.token,
        {
          width: 300,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'H'
        },
        (err) => {
          if (err) console.error('Erro ao renderizar QR Code:', err);
        }
      );
    }
  }, [maquinaAtiva]);

  // Teclas de atalho para apresentação (1 a 4 alternam sem precisar de mouse)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === '1') setMaquinaAtiva(MAQUINAS[0]);
      if (e.key === '2') setMaquinaAtiva(MAQUINAS[1]);
      if (e.key === '3') setMaquinaAtiva(MAQUINAS[2]);
      if (e.key === '4') setMaquinaAtiva(MAQUINAS[3]);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Escuta WebSocket do backend em tempo real para feedback do disparo T0
  useEffect(() => {
    const socket = io('http://localhost:3001');

    socket.on('connect', () => {
      socket.emit('entrar_sala', 'cockpit_pcm');
    });

    socket.on('novo_chamado', (data) => {
      const registro = {
        os: data.numero_os || data.chamado?.numero_os || 'OS-NOVA',
        maquina: data.tag_patrimonio || data.chamado?.tag_patrimonio || 'Ativo',
        operador: data.operador_nome || data.chamado?.operador_nome || 'Operador',
        matricula: data.operador_matricula || data.chamado?.operador_matricula || '226244',
        hora: new Date().toLocaleTimeString()
      };

      setUltimoDisparo(registro);

      // Sinal sonoro sutil
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch (e) {}

      setTimeout(() => {
        setUltimoDisparo(null);
      }, 7000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-6 sm:p-10 relative select-none font-sans overflow-hidden">
      {/* ÁREA CENTRAL PRINCIPAL: 100% FIEL AO WIREFRAME DO CANVA */}
      <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-20 my-auto">
        {/* LADO ESQUERDO: LOGO ORIGINAL CORP.VANGUARD + QR CODE COM MOLDURA VERMELHA */}
        <div className="flex flex-col items-start space-y-6">
          {/* LOGO ORIGINAL EXTRAÍDO DIRETAMENTE DO MATERIAL DE MARCA */}
          <div>
            <img
              src="/brand/corp-vanguard-logo-official-transparent.png?v=4"
              alt="Corp.Vanguard - Industrial Maintenance Systems"
              className="h-14 sm:h-16 w-auto object-contain block"
            />
          </div>

          {/* QUADRO DO QR CODE COM BORDA VERMELHA EXATA DO CANVA */}
          <div className="p-3 bg-red-600 rounded-lg shadow-[0_0_40px_rgba(220,38,38,0.35)]">
            <div className="bg-white p-3 rounded flex flex-col items-center">
              {/* CANVAS DO QR CODE */}
              <canvas
                ref={canvasRef}
                className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] block"
              ></canvas>

              {/* RÓTULO MONOSPACE DA MÁQUINA ABAIXO DO QR CODE */}
              <span className="font-mono font-black text-xs sm:text-sm text-black tracking-widest uppercase mt-2 select-all">
                {maquinaAtiva.tag}
              </span>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: LISTA VERTICAL DE SELEÇÃO DE MÁQUINAS (CANVA) */}
        <div className="w-full max-w-xs flex flex-col gap-3.5">
          {MAQUINAS.map((maq) => {
            const isSelected = maq.id === maquinaAtiva.id;

            return (
              <button
                key={maq.id}
                type="button"
                onClick={() => setMaquinaAtiva(maq)}
                className={`w-full p-4 rounded-2xl text-left transition-all duration-150 active:scale-98 cursor-pointer ${
                  isSelected
                    ? 'border-2 border-red-600 bg-[#1e0a0d] shadow-[0_0_25px_rgba(220,38,38,0.25)] ring-1 ring-red-600/40'
                    : 'border border-zinc-900 bg-[#111113] hover:bg-[#18181b] hover:border-zinc-800'
                }`}
              >
                {/* TAG DA MÁQUINA */}
                <h3 className="font-mono font-black text-base sm:text-lg text-white tracking-wide">
                  {maq.tag}
                </h3>

                {/* SETOR DA FÁBRICA */}
                <p className="text-xs text-zinc-400 mt-0.5 tracking-wide">
                  {maq.setor}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* NOTIFICAÇÃO FLUTUANTE EM TEMPO REAL QUANDO O OPERADOR DISPARAR T0 */}
      {ultimoDisparo && (
        <div className="fixed bottom-6 z-50 bg-emerald-950/90 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl flex items-center gap-3.5 animate-bounce">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="font-mono text-xs">
            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>MARCO T₀ REGISTRADO ({ultimoDisparo.hora})</span>
            </div>
            <div className="text-white mt-0.5">
              <strong>{ultimoDisparo.os}</strong> • {ultimoDisparo.maquina} por {ultimoDisparo.operador} ({ultimoDisparo.matricula})
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
