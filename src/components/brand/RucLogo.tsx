/**
 * ROCK UC FOODS - Official Brand Logo & Seal
 * (Playbook v2 Section 4B & 6)
 * Features the crowned chef hat, RUC monogram, double gold ring, and laurel wreath.
 * Rendered with gold gradient (#F3D98B -> #D4AF37 -> #9C7A1E) on dark surfaces.
 */

import React from 'react';

interface RucLogoProps {
  size?: number; // width/height in px
  showWordmark?: boolean;
  className?: string;
}

export const RucLogo: React.FC<RucLogoProps> = ({
  size = 64,
  showWordmark = true,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Gold Seal SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-label="ROCK UC FOODS Gold Seal"
      >
        <defs>
          <linearGradient id="rucGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F3D98B" />
            <stop offset="55%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#9C7A1E" />
          </linearGradient>
          <linearGradient id="rucGoldRing" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#9C7A1E" />
            <stop offset="50%" stopColor="#F3D98B" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>

        {/* Outer Ring */}
        <circle cx="60" cy="60" r="56" stroke="url(#rucGoldRing)" strokeWidth="2.5" />
        {/* Inner Beaded Ring */}
        <circle cx="60" cy="60" r="51" stroke="url(#rucGoldGrad)" strokeWidth="1" strokeDasharray="3 3" />
        {/* Inner Solid Ring */}
        <circle cx="60" cy="60" r="47" stroke="url(#rucGoldGrad)" strokeWidth="1.5" />

        {/* Stylized Laurel Wreath Leaves (Left) */}
        <path
          d="M24 60 C 22 45, 30 32, 42 24 C 38 32, 38 46, 43 56 C 36 54, 30 58, 24 60 Z"
          fill="url(#rucGoldGrad)"
          opacity="0.75"
        />
        <path
          d="M26 62 C 24 76, 32 88, 43 96 C 39 88, 38 75, 44 65 C 37 67, 31 63, 26 62 Z"
          fill="url(#rucGoldGrad)"
          opacity="0.75"
        />

        {/* Stylized Laurel Wreath Leaves (Right) */}
        <path
          d="M96 60 C 98 45, 90 32, 78 24 C 82 32, 82 46, 77 56 C 84 54, 90 58, 96 60 Z"
          fill="url(#rucGoldGrad)"
          opacity="0.75"
        />
        <path
          d="M94 62 C 96 76, 88 88, 77 96 C 81 88, 82 75, 76 65 C 83 67, 89 63, 94 62 Z"
          fill="url(#rucGoldGrad)"
          opacity="0.75"
        />

        {/* Crowned Chef Hat */}
        {/* Crown Points */}
        <path
          d="M48 35 L 53 40 L 60 32 L 67 40 L 72 35 L 70 43 L 50 43 Z"
          fill="url(#rucGoldGrad)"
        />
        {/* Chef Hat Puffs */}
        <path
          d="M49 43 C 45 40, 47 34, 53 35 C 55 31, 65 31, 67 35 C 73 34, 75 40, 71 43 Z"
          fill="url(#rucGoldGrad)"
          opacity="0.9"
        />
        {/* Hat Band */}
        <rect x="49" y="44" width="22" height="3" rx="1.5" fill="url(#rucGoldGrad)" />

        {/* Central Monogram RUC */}
        <text
          x="60"
          y="73"
          textAnchor="middle"
          fill="url(#rucGoldGrad)"
          fontFamily="serif"
          fontWeight="900"
          fontSize="24"
          letterSpacing="2"
        >
          RUC
        </text>

        {/* Bottom Banner Ribbon Accent */}
        <path
          d="M38 88 Q 60 93 82 88 Q 78 95 60 96 Q 42 95 38 88 Z"
          fill="url(#rucGoldGrad)"
        />
      </svg>

      {/* Wordmark Lockup: Live text 'ROCK UC FOODS' and tagline (Playbook Section 4B) */}
      {showWordmark && (
        <div className="flex flex-col">
          <span className="font-serif font-black tracking-wider text-base md:text-lg text-[#F7EFD9] leading-tight uppercase">
            ROCK UC FOODS
          </span>
          <span className="text-[10px] md:text-xs text-[#D4AF37] tracking-widest uppercase font-semibold">
            Taste the Luxury
          </span>
        </div>
      )}
    </div>
  );
};
