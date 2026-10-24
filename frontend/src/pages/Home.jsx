import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  LayoutDashboard,
  Wrench,
  Boxes,
  Activity,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HardHat
} from 'lucide-react';
import NetworkStatusBadge from '../components/NetworkStatusBadge';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 max-w-4xl mx-auto flex flex-col justify-between">
      {/* Topo / Header */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">
                CMMS FAETERJ
              </h1>
              <p className="text-xs text-slate-400">
                Sistema de Gestão de Manutenção Fabril • TCC
              </p>
            </div>
          </div>
          <NetworkStatusBadge />
        </div>

        {/* Banner do Módulo do Operador (Etapa 04 - Destaque) */}
        <div className="mt-6 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 rounded-2xl p-5 relative overflow-hidden shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold tracking-wide uppercase border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Módulo Ativo • Etapa 04
              </div>
              <h2 className="text-xl font-black text-white">
                Terminal do Operador (Fricção Zero)
              </h2>
              <p className="text-xs text-slate-400 max-w-md">
                Abertura de chamados em 2 toques via QR Code no maquinário, identificação ágil por crachá e resiliência offline contra galpões metálicos.
              </p>
            </div>

            <button
              onClick={() => navigate('/operador')}
              className="py-3.5 px-6 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 transition-all shrink-0"
            >
              <QrCode className="w-5 h-5" />
              <span>Abrir Chamado ($T_0$)</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>

        {/* Grid dos Módulos do CMMS */}
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Módulos Integrados do Sistema (9 Etapas)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Operador (Concluído) */}
            <div
              onClick={() => navigate('/operador')}
              className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl cursor-pointer transition-all hover:bg-slate-900 group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                  Etapa 04 • Ativo
                </span>
              </div>
              <h4 className="font-bold text-sm text-white mt-3 group-hover:text-indigo-400 transition-colors">
                Terminal Operador (Mobile PWA)
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Leitura de QR Code, auto-preenchimento e abertura de OS sem senha.
              </p>
            </div>

            {/* Card 2: Cockpit PCM & TL (Ativo) */}
            <div
              onClick={() => navigate('/cockpit')}
              className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl cursor-pointer transition-all hover:bg-slate-900 group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                  Etapa 05 • Ativo
                </span>
              </div>
              <h4 className="font-bold text-sm text-white mt-3 group-hover:text-indigo-400 transition-colors">
                Cockpit Manutenção & TL
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Painel em tempo real, matriz GUT, alarme sonoro e atribuição $T_1$.
              </p>
            </div>

            {/* Card 3: Mantenedor em Campo (Concluído) */}
            <div
              onClick={() => navigate('/mantenedor')}
              className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl cursor-pointer transition-all hover:bg-slate-900 group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                  Etapa 06 • Ativo
                </span>
              </div>
              <h4 className="font-bold text-sm text-white mt-3 group-hover:text-indigo-400 transition-colors">
                Terminal Mantenedor (Mobile)
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Registro de chegada ($T_2$), pausas, árvore de falhas e encerramento ($T_3$).
              </p>
            </div>

            {/* Card 4: Almoxarifado & Estoque (Concluído) */}
            <div
              onClick={() => navigate('/almoxarifado')}
              className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 p-4 rounded-xl cursor-pointer transition-all hover:bg-slate-900 group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                  Etapa 07 • Ativo
                </span>
              </div>
              <h4 className="font-bold text-sm text-white mt-3 group-hover:text-amber-400 transition-colors">
                Almoxarifado & Sobressalentes
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Controle de peças com modo reserva pendente e alerta de estoque mínimo.
              </p>
            </div>

            {/* Card 5: Motor de Indicadores & Métricas Industriais (Concluído) */}
            <div
              onClick={() => navigate('/indicadores')}
              className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl cursor-pointer transition-all hover:bg-slate-900 group sm:col-span-2"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                  Etapa 08 • Ativo
                </span>
              </div>
              <h4 className="font-bold text-sm text-white mt-3 group-hover:text-indigo-400 transition-colors">
                Motor de Indicadores & Métricas Industriais (MTBF / MTTR / Pareto)
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Cálculo automatizado de confiabilidade, MTTR Líquido Puro, Disponibilidade WCM e Curva 80/20 por subsistema.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé institucional */}
      <div className="pt-6 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>FAETERJ Barra Mansa • ADS • Trabalho de Conclusão de Curso (TCC)</p>
        <p className="text-[10px] text-slate-600 mt-0.5">Autor: Iury Lopes • Orientação Industrial Stellantis/Paraman</p>
      </div>
    </div>
  );
}
