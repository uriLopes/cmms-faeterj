import React from 'react';

/**
 * Componente Oficial da Marca Corp.Vanguard
 * Industrial Maintenance Systems
 * 
 * Utiliza o emblema 100% transparente (sem caixa ou fundo cinza) e a tipografia oficial.
 */
export default function VanguardLogo({
  variant = 'full',
  size = 'md',
  className = '',
  light = false
}) {
  const scale = {
    sm: { icon: 'w-6 h-6', title: 'text-sm', sub: 'text-[7px]' },
    md: { icon: 'w-8 h-8', title: 'text-lg', sub: 'text-[8.5px]' },
    lg: { icon: 'w-11 h-11', title: 'text-2xl', sub: 'text-[10px]' },
    xl: { icon: 'w-16 h-16', title: 'text-3xl', sub: 'text-xs' }
  }[size] || { icon: 'w-8 h-8', title: 'text-lg', sub: 'text-[8.5px]' };

  // Ícone oficial transparente sem qualquer fundo, recorte cinza ou bolinha verde
  const renderIcon = (
    <div className={`relative ${scale.icon} shrink-0 flex items-center justify-center`}>
      <img
        src="/brand/vanguard-logo-transparent.png?v=3"
        alt="Corp.Vanguard"
        className="w-full h-full object-contain"
      />
    </div>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{renderIcon}</div>;
  }

  // Wordmark "Corp.Vanguard"
  const renderWordmark = (
    <div className="flex items-center leading-none tracking-tight select-none">
      {/* Caixa inclinada "Corp." */}
      <span
        className={`px-2 py-0.5 font-black uppercase text-xs sm:text-sm tracking-wide ${
          light ? 'bg-slate-900 text-white' : 'bg-white text-slate-950'
        }`}
        style={{
          clipPath: 'polygon(0 0, 100% 0, 84% 100%, 0% 100%)',
          paddingRight: '12px'
        }}
      >
        Corp.
      </span>

      {/* "Vanguard" em itálico de alta presença */}
      <span
        className={`font-black italic tracking-tighter ml-1 ${scale.title} ${
          light ? 'text-slate-950' : 'text-white'
        }`}
      >
        Vanguard
      </span>
    </div>
  );

  if (variant === 'wordmark') {
    return <div className={`inline-flex items-center ${className}`}>{renderWordmark}</div>;
  }

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        {renderIcon}
        {renderWordmark}
      </div>
    );
  }

  // Versão completa com subtítulo
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {renderIcon}
      <div className="flex flex-col">
        {renderWordmark}
        <span
          className={`font-mono uppercase font-semibold tracking-[0.25em] text-slate-400 mt-1 ${scale.sub}`}
        >
          Industrial Maintenance Systems
        </span>
      </div>
    </div>
  );
}
