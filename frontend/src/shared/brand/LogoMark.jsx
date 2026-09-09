import React from 'react';

// Simplified stand-in for the Ala Eh! Food Products seal (black circle, gold
// ring, salakot-hat silhouette, red banner with "Ala Eh!" in yellow) - not a
// pixel copy of the real artwork (no file available), just the same shapes
// and palette so it reads as the same mark at UI sizes. Swap for the real
// logo file (frontend/public/logo.png + reference it here) when available.
export default function LogoMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Ala Eh! Food Products">
      <circle cx="100" cy="100" r="97" fill="#0F1712" stroke="#C99A2E" strokeWidth="6" />
      <path d="M58 92 Q100 46 142 92 Z" fill="#C99A2E" />
      <ellipse cx="100" cy="92" rx="44" ry="7" fill="#9C7521" />
      <rect x="32" y="102" width="136" height="42" rx="21" fill="#C1272D" />
      <text
        x="100" y="131"
        textAnchor="middle"
        fontFamily="'IBM Plex Sans', Arial, sans-serif"
        fontWeight="800"
        fontStyle="italic"
        fontSize="30"
        fill="#FFD400"
        stroke="#16201B"
        strokeWidth="1.5"
        paintOrder="stroke"
      >
        Ala Eh!
      </text>
      <text
        x="100" y="160"
        textAnchor="middle"
        fontFamily="'IBM Plex Sans', Arial, sans-serif"
        fontWeight="600"
        letterSpacing="1.5"
        fontSize="12"
        fill="#EDE8D9"
      >
        FOOD PRODUCTS
      </text>
    </svg>
  );
}
