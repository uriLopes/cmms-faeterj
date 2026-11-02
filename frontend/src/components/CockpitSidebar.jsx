import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Boxes,
  BarChart3,
  QrCode,
  Flame,
  Wrench,
  Layers,
  Volume2,
  VolumeX,
  RefreshCw,
  ArrowLeft,
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import VanguardLogo from './VanguardLogo';

/**
 * CockpitSidebar - Barra de Navegação Lateral Inspirada no Redesign do Discord
 * 
 * Estrutura:
 * 1. Topo: Brand Oficial Corp.Vanguard + Selo Central
 * 2. Navegação Principal com Pílula Ativa Lateral e Badges Dinâmicos
 * 3. Atalhos do Ecossistema CMMS (Totem QR, Trigger, Field, Almoxarifado)
 * 4. Rodapé de Perfil: Avatar com Indicador Verde Online + Controles de Sirene, Refresh e Retorno
 */
export default function CockpitSidebar({
  abaAtiva,
  setAbaAtiva,
  totalAguardandoAtribuicao = 0,
  totalParadas = 0,
  somAtivo,
  toggleSom,
  loading = false,
  recarregarDados,
  isOpenMobile,
  setIsOpenMobile
}) {
  const navigate = useNavigate();

  const navItemsPrincipais = [
    {
      id: 'triagem',
      label: 'Triagem & Fila',
      hint: 'SLA T0 → T1',
      icon: Activity,
      badge: totalAguardandoAtribuicao > 0 ? totalAguardandoAtribuicao : null,
      badgeColor: 'bg-red-500 text-white animate-pulse'
    },
    {
      id: 'ativos',
      label: 'Ativos & Máquinas',
      hint: 'Parque & QR Codes',
      icon: Boxes,
      badge: null
    },
    {
      id: 'indicadores',
      label: 'Dashboard & Métricas',
      hint: 'MTBF, MTTR & SLA',
      icon: BarChart3,
      badge: null
    }
  ];

  const atalhosEcossistema = [
    {
      label: 'Totem de Posto (QR)',
      hint: 'Plaquetas das máquinas',
      icon: QrCode,
      onClick: () => navigate('/totem-qr')
    },
    {
      label: 'Terminal Operador',
      hint: 'Vanguard Trigger',
      icon: Flame,
      onClick: () => navigate('/operador')
    },
    {
      label: 'Terminal Mantenedor',
      hint: 'Vanguard Field',
      icon: Wrench,
      onClick: () => navigate('/mantenedor')
    },
    {
      label: 'Almoxarifado & Peças',
      hint: 'Estoque sobressalente',
      icon: Layers,
      onClick: () => navigate('/almoxarifado')
    }
  ];

  return (
    <>
      {/* Overlay Mobile */}
      {isOpenMobile && (
        <div
          onClick={() => setIsOpenMobile(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[#14151B] border-r border-white/[0.08] flex flex-col justify-between select-none transition-transform duration-300 ease-in-out shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* TOPO: LOGO & BRAND HEADER */}
        <div>
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <VanguardLogo variant="icon" size="md" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black tracking-widest text-white uppercase">
                    Vanguard
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    CENTRAL
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono tracking-wider">
                  Cockpit de Gestão PCM
                </span>
              </div>
            </div>

            {/* Fechar no Mobile */}
            <button
              onClick={() => setIsOpenMobile(false)}
              className="lg:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ÁREA DE NAVEGAÇÃO PRINCIPAL (ESTILO DISCORD REDESIGN) */}
          <div className="p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
            {/* Seção 1: Operação & Triagem */}
            <div>
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Gestão Central
                </span>
                {totalParadas > 0 && (
                  <span className="text-[9px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                    {totalParadas} {totalParadas === 1 ? 'parada' : 'paradas'}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {navItemsPrincipais.map((item) => {
                  const Icon = item.icon;
                  const isActive = abaAtiva === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setAbaAtiva(item.id);
                        if (setIsOpenMobile) setIsOpenMobile(false);
                      }}
                      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                        isActive
                          ? 'bg-[#252733] text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* Pílula Indicadora Lateral Ativa (Assinatura do Discord Redesign) */}
                      {isActive && (
                        <span className="absolute -left-3 top-2 bottom-2 w-1.5 rounded-r-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]" />
                      )}

                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-red-400' : 'text-zinc-400 group-hover:text-zinc-200'
                        }`}
                      />

                      <div className="flex-1 min-w-0">
                        <div className={`text-xs truncate ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                          {item.label}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate font-mono">
                          {item.hint}
                        </div>
                      </div>

                      {/* Badge Contador */}
                      {item.badge !== null && item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 font-mono shadow-sm ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seção 2: Ecossistema CMMS (Atalhos Integrados) */}
            <div>
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Ecossistema
                </span>
                <span className="text-[9px] font-mono text-zinc-400">9 etapas</span>
              </div>

              <div className="space-y-1">
                {atalhosEcossistema.map((item, idx) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        item.onClick();
                        if (setIsOpenMobile) setIsOpenMobile(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all group"
                    >
                      <Icon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 shrink-0 transition-colors" />

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate text-zinc-300 group-hover:text-white">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate font-mono">
                          {item.hint}
                        </div>
                      </div>

                      <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-zinc-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO SIDEBAR: PERFIL DO USUÁRIO & CONTROLES RÁPIDOS (ESTILO DISCORD) */}
        <div className="p-2.5 bg-[#0F1015] border-t border-white/[0.08] flex items-center justify-between">
          {/* Avatar com Indicador Verde Online + Nome */}
          <div className="flex items-center gap-2.5 min-w-0 pl-1">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 border border-white/10 flex items-center justify-center text-white font-mono text-xs font-bold shadow-xs">
                PCM
              </div>
              {/* Presença Online Verde */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0F1015]" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate leading-tight">
                Iury Lopes
              </span>
              <span className="text-[10px] text-emerald-400 font-mono tracking-tight leading-tight flex items-center gap-1">
                <span>Supervisor</span>
                <span className="w-1 h-1 rounded-full bg-emerald-400" />
                <span>Online</span>
              </span>
            </div>
          </div>

          {/* Controles de Ação Rápida */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Toggle Alarme / Sirene Sonora */}
            <button
              onClick={toggleSom}
              className={`p-1.5 rounded-lg transition-all ${
                somAtivo
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-zinc-400 hover:text-zinc-300 hover:bg-white/5'
              }`}
              title={somAtivo ? 'Sirene ativa (clique para silenciar)' : 'Sirene desativada (clique para ativar)'}
            >
              {somAtivo ? <Volume2 className="w-4 h-4 text-red-400 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Atualizar Dados */}
            <button
              onClick={recarregarDados}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
              title="Sincronizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-400' : ''}`} />
            </button>

            {/* Voltar ao Início / Hub */}
            <button
              onClick={() => navigate('/')}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
              title="Voltar ao Hub Principal"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
