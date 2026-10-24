import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';
import {
  Maximize2,
  Minimize2,
  ExternalLink,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import VanguardLogo from '../components/VanguardLogo';

const MAQUINAS = [
  {
    id: 1,
    tag: 'MV3-ROB-04',
    setor: 'Chaparia',
    nome: 'Robô de Solda a Ponto KUKA KR210',
    linha: 'Chaparia - Linha MV3',
    posto: 'Posto 40 - Geometria Lateral',
    token: 'qr_mv3_rob_04_token_hash_faeterj_2026'
  },
  {
    id: 2,
    tag: 'HC1-APT-02',
    setor: 'Montagem Final',
    nome: 'Apertadeira Pneumática Atlas Copco QST',
    linha: 'Montagem Final - Linha HC1',
    posto: 'Posto 12 - Fixação de Amortecedor LD',
    token: 'qr_hc1_apt_02_token_hash_faeterj_2026'
  },
  {
    id: 3,
    tag: 'BNC-CNV-01',
    setor: 'Tapeçaria & Assentos',
    nome: 'Transportador de Roletes Montagem Bancos',
    linha: 'Tapeçaria & Assentos - Linha 01',
    posto: 'Posto 01 - Abastecimento de Estruturas',
    token: 'qr_bnc_cnv_01_token_hash_faeterj_2026'
  },
  {
    id: 4,
    tag: 'PIN-CAB-01',
    setor: 'Pintura Automotiva',
    nome: 'Cabine de Aplicação KTL Eletrostática',
    linha: 'Pintura Automotiva - Linha 01',
    posto: 'Posto 08 - Tanque de Imersão e Cura',
    token: 'qr_pnt_cab_01_token_hash_faeterj_2026'
  }
];

export default function TotemQR() {
  const [maquinaAtiva, setMaquinaAtiva] = useState(MAQUINAS[0]);
  const [ultimoDisparo, setUltimoDisparo] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef(null);

  // Renderiza o QR Code no Canvas de alta fidelidade
  useEffect(() => {
    if (canvasRef.current && maquinaAtiva) {
      QRCode.toCanvas(
        canvasRef.current,
        maquinaAtiva.token,
        {
          width: 290,
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

  // Teclas de atalho para a apresentação do TCC (1 a 4 para trocar de máquina rapidamente)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === '1') setMaquinaAtiva(MAQUINAS[0]);
      if (e.key === '2') setMaquinaAtiva(MAQUINAS[1]);
      if (e.key === '3') setMaquinaAtiva(MAQUINAS[2]);
      if (e.key === '4') setMaquinaAtiva(MAQUINAS[3]);
      if (e.key.toLowerCase() === 'f') toggleFullscreen();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Conexão WebSocket em tempo real para capturar o disparo do operador no celular
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

      // Efeito sonoro discreto de confirmação
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

      // Remove o aviso após 7 segundos
      setTimeout(() => {
        setUltimoDisparo(null);
      }, 7000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-6 relative select-none font-sans overflow-hidden">
      {/* BOTÕES DISCRETOS DE UTILITÁRIOS (Canto superior direito) */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-30">
        <a
          href="/cockpit"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-mono text-zinc-500 hover:text-white px-2.5 py-1 rounded bg-zinc-950/80 border border-zinc-900 flex items-center gap-1.5 transition-colors"
          title="Abrir Cockpit PCM da Manutenção em nova aba"
        >
          <span>Cockpit</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        <button
          onClick={toggleFullscreen}
          className="text-zinc-500 hover:text-white p-1.5 rounded bg-zinc-950/80 border border-zinc-900 transition-colors"
          title="Tela Cheia para Apresentação do TCC (Tecla F)"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* ÁREA CENTRAL PRINCIPAL: EXATAMENTE COMO NO DESIGN DO CANVA */}
      <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-20 my-auto py-6">
        {/* LADO ESQUERDO: LOGO CORP.VANGUARD + QR CODE COM MOLDURA VERMELHA */}
        <div className="flex flex-col items-start space-y-7">
          {/* LOGO OFICIAL CORP.VANGUARD (HORIZONTAL COM SUBTÍTULO) */}
          <div className="pl-1">
            <VanguardLogo variant="full" size="lg" />
          </div>

          {/* QUADRO DO QR CODE COM BORDA VERMELHA EXATA DO CANVA */}
          <div className="p-3 bg-red-600 rounded-lg shadow-[0_0_40px_rgba(220,38,38,0.3)]">
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

        {/* LADO DIREITO: LISTA VERTICAL DE SELEÇÃO DE MÁQUINAS */}
        <div className="w-full max-w-xs flex flex-col gap-3.5">
          {MAQUINAS.map((maq, index) => {
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

      {/* RODAPÉ DISCRETO PARA APRESENTAÇÃO */}
      <footer className="text-center text-[11px] text-zinc-600 font-mono mt-auto pt-4">
        Corp.Vanguard • Pressione 1, 2, 3 ou 4 para alternar a máquina • Tecla F para Tela Cheia
      </footer>
    </div>
  );
}
