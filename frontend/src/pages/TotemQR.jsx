import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';
import {
  QrCode,
  Radio,
  CheckCircle2,
  Clock,
  Layers,
  Wrench,
  AlertTriangle,
  Monitor,
  ExternalLink,
  Smartphone,
  Sparkles
} from 'lucide-react';
import VanguardLogo from '../components/VanguardLogo';

const MAQUINAS_PADRAO = [
  {
    id: 1,
    tag: 'MV3-ROB-04',
    nome: 'Robô de Solda a Ponto KUKA KR210',
    linha: 'Chaparia - Linha MV3',
    posto: 'Posto 40 - Geometria Lateral',
    criticidade: 'A',
    token: 'qr_mv3_rob_04_token_hash_faeterj_2026',
    descricao: 'Braço robótico articulado para solda por resistência do assoalho lateral.'
  },
  {
    id: 2,
    tag: 'HC1-APT-02',
    nome: 'Apertadeira Pneumática Atlas Copco QST',
    linha: 'Montagem Final - Linha HC1',
    posto: 'Posto 12 - Fixação de Amortecedor LD',
    criticidade: 'A',
    token: 'qr_hc1_apt_02_token_hash_faeterj_2026',
    descricao: 'Apertadeira de alto torque monitorada por transdutor de ângulo/torque.'
  },
  {
    id: 3,
    tag: 'PIN-CAB-01',
    nome: 'Cabine de Aplicação KTL Eletrostática',
    linha: 'Pintura Automotiva - Linha 01',
    posto: 'Posto 08 - Tanque de Imersão e Cura',
    criticidade: 'B',
    token: 'qr_pnt_cab_01_token_hash_faeterj_2026',
    descricao: 'Sistema de eletrodeposição de fundo anticorrosivo catódico.'
  },
  {
    id: 4,
    tag: 'BNC-CNV-01',
    nome: 'Transportador de Roletes Montagem Bancos',
    linha: 'Tapeçaria & Assentos - Linha 01',
    posto: 'Posto 01 - Abastecimento de Estruturas',
    criticidade: 'B',
    token: 'qr_bnc_cnv_01_token_hash_faeterj_2026',
    descricao: 'Mesa de roletes tracionada com inversor de frequência e sensor óptico.'
  }
];

export default function TotemQR() {
  const [maquinaAtiva, setMaquinaAtiva] = useState(MAQUINAS_PADRAO[0]);
  const [eventosLog, setEventosLog] = useState([]);
  const [ultimoDisparo, setUltimoDisparo] = useState(null);
  const [conectadoSocket, setConectadoSocket] = useState(false);
  const canvasRef = useRef(null);

  // Renderiza o QR Code sempre que a máquina selecionada mudar
  useEffect(() => {
    if (canvasRef.current && maquinaAtiva) {
      QRCode.toCanvas(
        canvasRef.current,
        maquinaAtiva.token,
        {
          width: 280,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'H'
        },
        (err) => {
          if (err) console.error('Erro ao gerar QR Code:', err);
        }
      );
    }
  }, [maquinaAtiva]);

  // Conexão WebSocket em tempo real para capturar os disparos T0 do operador
  useEffect(() => {
    const socket = io('http://localhost:3001');

    socket.on('connect', () => {
      setConectadoSocket(true);
      socket.emit('entrar_sala', 'cockpit_pcm');
    });

    socket.on('disconnect', () => {
      setConectadoSocket(false);
    });

    socket.on('novo_chamado', (data) => {
      const registro = {
        id: Date.now(),
        tipo: 'T0_DISPARADO',
        hora: new Date().toLocaleTimeString(),
        os: data.numero_os || data.chamado?.numero_os || 'OS-NOVA',
        maquina: data.tag_patrimonio || data.chamado?.tag_patrimonio || 'Ativo',
        operador: data.operador_nome || data.chamado?.operador_nome || 'Operador',
        matricula: data.operador_matricula || data.chamado?.operador_matricula || 'N/A',
        sintoma: data.descricao_sintoma || data.chamado?.descricao_sintoma || 'Falha reportada',
        criticidade: data.criticidade || data.chamado?.criticidade || 'A'
      };

      setUltimoDisparo(registro);
      setEventosLog((prev) => [registro, ...prev.slice(0, 9)]);

      // Feedback sonoro sutil
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch (e) {}
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100 flex flex-col justify-between selection:bg-red-600">
      {/* HEADER CORP.VANGUARD */}
      <header className="bg-black border-b border-zinc-900 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <VanguardLogo variant="horizontal" size="md" />
          <div className="h-6 w-px bg-zinc-800 hidden sm:block"></div>
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">
            Totem de Posto • Simulador de Plaquetas QR Code
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5 border ${
              conectadoSocket
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${conectadoSocket ? 'animate-pulse' : ''}`} />
            <span>{conectadoSocket ? 'Barramento WebSocket Ativo' : 'Conectando ao Core...'}</span>
          </div>

          <a
            href="/cockpit"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all"
          >
            <Monitor className="w-3.5 h-3.5 text-red-500" />
            <span>Abrir Cockpit PCM</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        </div>
      </header>

      {/* ÁREA PRINCIPAL: SELETOR DE MÁQUINAS + PLAQUETA COM QR CODE */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: PLAQUETA FÍSICA COM QR CODE (7 COLUNAS) */}
        <section className="lg:col-span-7 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Luz focal industrial */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Seletor de Ativos Fabris */}
          <div className="mb-6">
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 block mb-2">
              Selecione a Máquina da Linha para Simular:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MAQUINAS_PADRAO.map((maq) => {
                const ativo = maq.id === maquinaAtiva.id;
                return (
                  <button
                    key={maq.id}
                    onClick={() => setMaquinaAtiva(maq)}
                    className={`p-3 rounded-2xl text-left border transition-all active:scale-95 ${
                      ativo
                        ? 'bg-red-600/20 border-red-500 text-white shadow-lg ring-1 ring-red-500'
                        : 'bg-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span className="font-mono font-black text-xs block text-white">{maq.tag}</span>
                    <span className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{maq.linha.split('-')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PLAQUETA DE PATRIMÔNIO INDUSTRIAL (IDENTIFICAÇÃO DE MÁQUINA) */}
          <div className="bg-black border-2 border-zinc-700 rounded-3xl p-6 shadow-2xl relative">
            {/* Rebites nos cantos estilo plaqueta industrial de metal */}
            <span className="absolute top-3 left-3 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-600 shadow-inner"></span>
            <span className="absolute top-3 right-3 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-600 shadow-inner"></span>
            <span className="absolute bottom-3 left-3 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-600 shadow-inner"></span>
            <span className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-600 shadow-inner"></span>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* O QR CODE EM SI */}
              <div className="bg-white p-3 rounded-2xl shadow-2xl shrink-0 border-4 border-zinc-800 flex flex-col items-center">
                <canvas ref={canvasRef} className="rounded-lg"></canvas>
                <span className="text-[10px] font-mono font-bold text-zinc-700 mt-1 uppercase tracking-wider">
                  {maquinaAtiva.tag}
                </span>
              </div>

              {/* DADOS TÉCNICOS DA MÁQUINA */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="px-2.5 py-1 bg-red-600 text-white font-mono font-black text-sm rounded-lg">
                    {maquinaAtiva.tag}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                      maquinaAtiva.criticidade === 'A'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    Criticidade {maquinaAtiva.criticidade}
                  </span>
                </div>

                <div>
                  <h2 className="text-base font-black text-white leading-tight">
                    {maquinaAtiva.nome}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    {maquinaAtiva.linha} • {maquinaAtiva.posto}
                  </p>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
                  {maquinaAtiva.descricao}
                </p>

                {/* INSTRUÇÃO AO USUÁRIO */}
                <div className="pt-2 flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-emerald-400">
                  <Smartphone className="w-4 h-4 animate-bounce" />
                  <span>Aponte o App do Operador no celular para o QR Code acima</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: EVENTOS EM TEMPO REAL & LOG DE DISPARO (5 COLUNAS) */}
        <section className="lg:col-span-5 space-y-4">
          {/* CARTÃO DE ÚLTIMO DISPARO $T_0$ */}
          {ultimoDisparo ? (
            <div className="bg-emerald-950/30 border-2 border-emerald-500/60 rounded-3xl p-5 shadow-2xl animate-fade-in relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-500/30">
                <span className="text-[11px] font-mono font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                  Marco T₀ Recebido com Sucesso!
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">{ultimoDisparo.hora}</span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">OS Aberta:</span>
                  <span className="text-white font-black">{ultimoDisparo.os}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Equipamento:</span>
                  <span className="text-emerald-300 font-bold">{ultimoDisparo.maquina}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Operador:</span>
                  <span className="text-white">{ultimoDisparo.operador} ({ultimoDisparo.matricula})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Sintoma:</span>
                  <span className="text-zinc-200 line-clamp-1">{ultimoDisparo.sintoma}</span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-emerald-500/20 text-[11px] text-emerald-400 flex items-center justify-between">
                <span>Alerta emitido ao Cockpit do PCM</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-center text-xs text-zinc-500">
              <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-2 animate-pulse" />
              <p className="font-semibold text-zinc-400">Aguardando Leitura de QR Code...</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Quando você escanear o QR Code no celular e clicar em Confirmar ($T_0$), o evento aparecerá aqui instantaneamente.
              </p>
            </div>
          )}

          {/* HISTÓRICO DE DISPAROS DESTA SESSÃO */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-500" />
                Log de Disparos de Turno
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {eventosLog.length} evento(s)
              </span>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {eventosLog.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-600">
                  Nenhum chamado disparado ainda neste ciclo.
                </div>
              ) : (
                eventosLog.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-black/60 border border-zinc-800 rounded-2xl text-xs space-y-1 hover:border-zinc-700 transition-all font-mono"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-red-400 font-bold">{ev.os}</span>
                      <span className="text-[10px] text-zinc-500">{ev.hora}</span>
                    </div>
                    <div className="text-zinc-300">
                      {ev.maquina} • {ev.operador}
                    </div>
                    <div className="text-[11px] text-zinc-500 line-clamp-1">
                      {ev.sintoma}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* RODAPÉ CORP.VANGUARD */}
      <footer className="bg-black border-t border-zinc-900 px-6 py-3 text-center text-xs text-zinc-500 font-mono">
        Corp.Vanguard Industrial Maintenance Systems • FAETERJ Barra Mansa (TCC ADS)
      </footer>
    </div>
  );
}
