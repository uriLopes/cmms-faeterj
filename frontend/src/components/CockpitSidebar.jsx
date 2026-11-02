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
  ExternalLink,
  Laptop
} from 'lucide-react';
import VanguardLogo from './VanguardLogo';

/**
 * CockpitSidebar - Barra de Navegação Lateral Exclusiva para PC / Notebook
 * Paleta Fiel ao Vanguard Trigger (OLED Dark Mode / Workouts Reference)
 * 
 * Fundo: #16161A (Superfície Neutra Sólida)
 * Borda: border-white/[0.08]
 * Item Ativo: #262629 com border-white/[0.16] e pílula lateral vermelha #EF4444
 * Tipografia: Títulos #FFFFFF puro, Textos secundários #8E8E93
 */
export default function CockpitSidebar({
  abaAtiva,
  setAbaAtiva,
  totalAguardandoAtribuicao = 0,
  totalParadas = 0,
  somAtivo,
  toggleSom,
  loading = false,
  recarregarDados
}) {
  const navigate = useNavigate();

  const navItemsPrincipais = [
    {
      id: 'triagem',
      label: 'Triagem & Fila',
      hint: 'SLA T0 → T1 e Despacho',
      icon: Activity,
      badge: totalAguardandoAtribuicao > 0 ? totalAguardandoAtribuicao : null,
      badgeColor: 'bg-[#EF4444] text-white animate-pulse'
    },
    {
      id: 'ativos',
      label: 'Ativos & Máquinas',
      hint: 'Parque Fabril & QR Codes',
      icon: Boxes,
      badge: null
    },
    {
      id: 'indicadores',
      label: 'Dashboard & Métricas',
      hint: 'MTBF, MTTR & SLA TCC',
      icon: BarChart3,
      badge: null
    }
  ];

  const atalhosEcossistema = [
    {
      label: 'Totem de Posto (QR)',
      hint: 'Plaquetas das Máquinas',
      icon: QrCode,
      onClick: () => navigate('/totem-qr')
    },
    {
      label: 'Terminal Operador',
      hint: 'Trigger (Mobile)',
      icon: Flame,
      onClick: () => navigate('/operador')
    },
    {
      label: 'Terminal Mantenedor',
      hint: 'Field (Mobile)',
      icon: Wrench,
      onClick: () => navigate('/mantenedor')
    },
    {
      label: 'Almoxarifado & Peças',
      hint: 'Estoque Sobressalente',
      icon: Layers,
      onClick: () => navigate('/almoxarifado')
    }
  ];

  return (
    <aside className="h-screen sticky top-0 left-0 w-64 bg-[#16161A] border-r border-white/[0.08] flex flex-col justify-between select-none shrink-0 z-40">
      {/* TOPO: BRAND HEADER OFICIAL VANGUARD */}
      <div>
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-[#16161A]">
          <div className="flex items-center gap-3">
            <VanguardLogo variant="icon" size="md" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-black tracking-widest text-white uppercase">
                  Vanguard
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#262629] text-white border border-white/[0.16]">
                  CENTRAL
                </span>
              </div>
              <span className="text-[10px] text-[#8E8E93] font-mono tracking-wider flex items-center gap-1 mt-0.5">
                <Laptop className="w-2.5 h-2.5 text-[#8E8E93]" />
                <span>Estação Desktop PCM</span>
              </span>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL (ESTILO DISCORD COM CORES TRIGGER) */}
        <div className="p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
          {/* Seção 1: Gestão Operacional */}
          <div>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest font-mono">
                Gestão Central
              </span>
              {totalParadas > 0 && (
                <span className="text-[9px] font-mono font-bold text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded border border-[#EF4444]/20">
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
                    onClick={() => setAbaAtiva(item.id)}
                    className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                      isActive
                        ? 'bg-[#262629] text-white border border-white/[0.16]'
                        : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    {/* Pílula Indicadora Lateral Ativa (Vermelho Vanguard) */}
                    {isActive && (
                      <span className="absolute -left-3 top-2 bottom-2 w-1.5 rounded-r-full bg-[#EF4444] shadow-[0_0_12px_rgba(239,68,68,0.7)]" />
                    )}

                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-[#EF4444]' : 'text-[#8E8E93] group-hover:text-white'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className={`text-xs truncate ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-[#8E8E93] truncate font-mono">
                        {item.hint}
                      </div>
                    </div>

                    {/* Badge Contador Dinâmico */}
                    {item.badge !== null && item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 font-mono ${item.badgeColor}`}
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
              <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest font-mono">
                Ecossistema
              </span>
              <span className="text-[9px] font-mono text-[#8E8E93]">9 etapas</span>
            </div>

            <div className="space-y-1">
              {atalhosEcossistema.map((item, idx) => {
                const Icon = item.icon;

                return (
                  <button
                    key={idx}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-[#8E8E93] hover:text-white hover:bg-white/[0.04] transition-all group border border-transparent"
                  >
                    <Icon className="w-4 h-4 text-[#8E8E93] group-hover:text-white shrink-0 transition-colors" />

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate text-zinc-300 group-hover:text-white">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-[#8E8E93] truncate font-mono">
                        {item.hint}
                      </div>
                    </div>

                    <ExternalLink className="w-3 h-3 text-[#8E8E93] group-hover:text-white shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RODAPÉ DO SIDEBAR: PERFIL DO USUÁRIO & AÇÕES RÁPIDAS */}
      <div className="p-2.5 bg-[#121216] border-t border-white/[0.08] flex items-center justify-between">
        {/* Avatar + Nome */}
        <div className="flex items-center gap-2.5 min-w-0 pl-1">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#262629] border border-white/[0.16] flex items-center justify-center text-white font-mono text-xs font-bold">
              PCM
            </div>
            {/* Presença Online Verde */}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#121216]" />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white truncate leading-tight">
              Iury Lopes
            </span>
            <span className="text-[10px] text-[#8E8E93] font-mono tracking-tight leading-tight flex items-center gap-1">
              <span>Supervisor</span>
              <span className="w-1 h-1 rounded-full bg-[#10B981]" />
              <span className="text-[#10B981]">Online</span>
            </span>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Sirene Sonora */}
          <button
            onClick={toggleSom}
            className={`p-1.5 rounded-lg transition-all ${
              somAtivo
                ? 'text-[#EF4444] hover:bg-[#EF4444]/10'
                : 'text-[#8E8E93] hover:text-white hover:bg-white/[0.08]'
            }`}
            title={somAtivo ? 'Sirene ativa (clique para silenciar)' : 'Sirene desativada (clique para ativar)'}
          >
            {somAtivo ? <Volume2 className="w-4 h-4 text-[#EF4444] animate-pulse" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Sincronizar Dados */}
          <button
            onClick={recarregarDados}
            className="p-1.5 text-[#8E8E93] hover:text-white rounded-lg hover:bg-white/[0.08] transition-all"
            title="Sincronizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EF4444]' : ''}`} />
          </button>

          {/* Voltar ao Hub */}
          <button
            onClick={() => navigate('/')}
            className="p-1.5 text-[#8E8E93] hover:text-white rounded-lg hover:bg-white/[0.08] transition-all"
            title="Voltar ao Hub Principal"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
