import React from 'react';

/**
 * Componente Oficial da Marca Corp.Vanguard
 * Industrial Maintenance Systems
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

  const renderIcon = (
    <div className={`relative ${scale.icon} shrink-0 flex items-center justify-center`}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M50 14 L84 32 L50 48 L16 32 Z" fill={light ? '#0F172A' : '#FFFFFF'} />
        <path d="M16 36 L44 51 L44 80 L16 66 Z" fill={light ? '#1E293B' : '#E2E8F0'} />
        <path d="M84 36 L56 51 L56 80 L84 66 Z" fill={light ? '#334155' : '#CBD5E1'} />
        <path d="M50 88 L34 56 L44 56 L50 68 L56 56 L66 56 Z" fill={light ? '#FFFFFF' : '#090A0F'} />
      </svg>
      <span className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
    </div>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center ${className}`}>{renderIcon}</div>;
  }

  const renderWordmark = (
    <div className="flex items-center leading-none tracking-tight select-none">
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