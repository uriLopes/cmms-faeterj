import React from 'react';

/**
 * Componente Oficial da Marca Corp.Vanguard
 * Industrial Maintenance Systems
 * 
 * Utiliza o novo emblema oficial (arquitetural verde e branco) e wordmark oficial Corp.Vanguard.
 */
export default function VanguardLogo({
  variant = 'full',
  size = 'md',
  className = '',
  light = false
}) {
  const scale = {
    sm: { icon: 'w-6 h-6', wm: 'h-4', sub: 'text-[7px]' },
    md: { icon: 'w-8 h-8', wm: 'h-6', sub: 'text-[8.5px]' },
    lg: { icon: 'w-11 h-11', wm: 'h-8', sub: 'text-[10px]' },
    xl: { icon: 'w-16 h-16', wm: 'h-11', sub: 'text-xs' },
    header: { icon: 'w-14 h-14', wm: 'h-10', sub: 'text-xs' }
  }[size] || { icon: 'w-8 h-8', wm: 'h-6', sub: 'text-[8.5px]' };

  // Emblema oficial transparente (verde industrial + branco em alta definição)
  const renderIcon = (
    <div className={`relative ${scale.icon} shrink-0 flex items-center justify-center`}>
      <img
        src="/brand/vanguard-emblem-transparent.png?v=5"
        alt="Vanguard Trigger"
        className="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(115,175,1,0.25)]"
      />
    </div>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{renderIcon}</div>;
  }

  // Wordmark oficial recortado
  const renderWordmark = (
    <img
      src={light ? '/brand/corp-vanguard-wordmark-light.png?v=5' : '/brand/corp-vanguard-wordmark-transparent.png?v=5'}
      alt="Corp.Vanguard"
      className={`${scale.wm} object-contain select-none`}
    />
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
          className={`font-mono uppercase font-semibold tracking-[0.25em] text-zinc-200 mt-1 ${scale.sub}`}
        >
          Industrial Maintenance Systems
        </span>
      </div>
    </div>
  );
}
