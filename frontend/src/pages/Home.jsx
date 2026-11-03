import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  LayoutDashboard,
  Wrench,
  Boxes,
  BarChart3,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import NetworkStatusBadge from '../components/NetworkStatusBadge';
import VanguardLogo from '../components/VanguardLogo';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#000000] text-white p-4 sm:p-6 max-w-4xl mx-auto flex flex-col justify-between font-sans">
      {/* Topo / Header */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <VanguardLogo variant="full" size="md" />
          <NetworkStatusBadge />
        </div>

        {/* Banner do Módulo do Operador (Vanguard Trigger - Mobile First) */}
        <div className="mt-6 bg-[#16161A] border border-white/[0.08] rounded-2xl p-5 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#262629] text-rose-400 text-[11px] font-bold tracking-wide uppercase border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Módulo Mobile • Vanguard Trigger
              </div>
              <h2 className="text-xl font-black text-white">
                Terminal do Operador (Fricção Zero)
              </h2>
              <p className="text-xs text-[#8E8E93] max-w-md">
                Abertura de chamados em 2 toques via QR Code no maquinário, identificação ágil por crachá e gravação de áudio.
              </p>
            </div>

            <button
              onClick={() => navigate('/operador')}
              className="py-3 px-5 bg-[#EF4444] hover:bg-red-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0"
            >
              <QrCode className="w-5 h-5" />
              <span>Abrir Chamado ($T_0$)</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>

        {/* Grid dos Módulos do CMMS */}
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8E8E93] mb-3">
            Módulos Integrados do Sistema
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card: Vanguard Central (Cockpit PCM Desktop) */}
            <div
              onClick={() => navigate('/central')}
              className="bg-[#16161A] border border-white/[0.08] hover:border-white/[0.2] p-4.5 rounded-2xl cursor-pointer transition-all hover:bg-[#1C1C1E] group col-span-1 sm:col-span-2"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-[#262629] border border-white/[0.08] rounded-xl text-white">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#EF4444]/20 text-rose-400 border border-[#EF4444]/30 rounded-full">
                  Exclusivo Desktop • PC & Notebook
                </span>
              </div>
              <h4 className="font-bold text-base text-white mt-3 group-hover:text-red-400 transition-colors flex items-center gap-2">
                <span>Vanguard Central (Cockpit PCM & Gestão)</span>
                <ArrowRight className="w-4 h-4 text-[#8E8E93] group-hover:text-white transition-colors" />
              </h4>
              <p className="text-xs text-[#8E8E93] mt-1">
                Central de triagem com matriz de criticidade, despacho imediato de técnicos, prontuário histórico e métricas de confiabilidade.
              </p>
            </div>

            {/* Card: Totem de Posto / Simulador de QR Code */}
            <div
              onClick={() => navigate('/totem-qr')}
              className="bg-[#16161A] border border-white/[0.08] hover:border-white/[0.2] p-4.5 rounded-2xl cursor-pointer transition-all hover:bg-[#1C1C1E] group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-[#262629] border border-white/[0.08] rounded-xl text-amber-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#262629] text-[#8E8E93] border border-white/[0.08] rounded-full uppercase tracking-wider">
                  Desktop • Telão
                </span>
              </div>
              <h4 className="font-bold text-sm text-white mt-3 group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                <span>Totem de Posto • Plaquetas QR</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#8E8E93] group-hover:text-amber-400 transition-colors" />
              </h4>
              <p className="text-xs text-[#8E8E93] mt-1">
                Exibe na tela do computador as plaquetas de QR code das máquinas para leitura e teste com o celular do Operador.
              </p>
            </div>

            {/* Card: Almoxarifado & Estoque */}
            <div
              onClick={() => navigate('/almoxarifado')}
              className="bg-[#16161A] border border-white/[0.08] hover:border-white/[0.2] p-4.5 rounded-2xl cursor-pointer transition-all hover:bg-[#1C1C1E] group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-[#262629] border border-white/[0.08] rounded-xl text-amber-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#262629] text-amber-400 border border-amber-500/30 rounded-full">
                  Sobressalentes
                </span>
              </div>
              <h4 className="font-bold text-sm text-white mt-3 group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                <span>Almoxarifado & Sobressalentes</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#8E8E93] group-hover:text-amber-400 transition-colors" />
              </h4>
              <p className="text-xs text-[#8E8E93] mt-1">
                Fila de requisições físicas da fábrica, confirmação de baixa e catálogo de peças críticas.
              </p>
            </div>

            {/* Card: Vanguard Trigger (Mobile) */}
            <div
              onClick={() => navigate('/operador')}
              className="bg-[#16161A] border border-white/[0.08] hover:border-white/[0.2] p-4.5 rounded-2xl cursor-pointer transition-all hover:bg-[#1C1C1E] group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-[#262629] border border-white/[0.08] rounded-xl text-rose-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Mobile
                </span>
              </div>
              <h4 className="font-bold text-sm text-white mt-3 group-hover:text-rose-400 transition-colors flex items-center gap-1.5">
                <span>Vanguard Trigger (Operador)</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#8E8E93] group-hover:text-rose-400 transition-colors" />
              </h4>
              <p className="text-xs text-[#8E8E93] mt-1">
                Terminal para smartphone do operador: leitura de plaquetas QR, foto da avaria e chamada imediata.
              </p>
            </div>

            {/* Card: Vanguard Field (Mobile) */}
            <div
              onClick={() => navigate('/mantenedor')}
              className="bg-[#16161A] border border-white/[0.08] hover:border-white/[0.2] p-4.5 rounded-2xl cursor-pointer transition-all hover:bg-[#1C1C1E] group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-[#262629] border border-white/[0.08] rounded-xl text-indigo-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Mobile
                </span>
              </div>
              <h4 className="font-bold text-sm text-white mt-3 group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                <span>Vanguard Field (Mantenedor)</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#8E8E93] group-hover:text-indigo-400 transition-colors" />
              </h4>
              <p className="text-xs text-[#8E8E93] mt-1">
                Terminal de atendimento em campo: check-in no posto ($T_2$), requisição de peças e liberação da máquina.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé institucional */}
      <div className="pt-6 border-t border-white/[0.08] text-center text-xs text-[#8E8E93] mt-8">
        <p>FAETERJ Barra Mansa • ADS • Trabalho de Conclusão de Curso (TCC)</p>
        <p className="text-[10px] text-[#8E8E93]/70 mt-0.5">Autor: Iury Lopes • Orientação Industrial Stellantis/Paraman</p>
      </div>
    </div>
  );
}
