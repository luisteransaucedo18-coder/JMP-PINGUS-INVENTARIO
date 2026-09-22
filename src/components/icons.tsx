/** Shared inline SVG icons — 16×16 unless noted */

export const CheckIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M2 7.5l3.5 3.5 7-7" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const XIcon = ({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const SendIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M1 1l13 6.5L1 14V9l8-1.5L1 6V1z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill="none" />
  </svg>
);

export const SaveIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M2 2h9l2 2v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M5 2v4h5V2" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="4" y="8.5" width="7" height="4.5" rx="0.5" stroke={color} strokeWidth="1.3" />
  </svg>
);

export const BoxIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1L13 4.5v6L7.5 14 2 10.5v-6L7.5 1z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M7.5 1v13M2 4.5l11 0" stroke={color} strokeWidth="1.3" />
  </svg>
);

export const CartIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M1 1.5h2l2 7.5h7l1.5-5H4.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="13" r="0.9" fill={color} />
    <circle cx="11" cy="13" r="0.9" fill={color} />
  </svg>
);

export const DocumentIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M3 2h6.5L12 4.5V13H3V2z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M9 2v3h3" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    <path d="M5 7h5M5 9.5h5M5 12h3" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export const ClipboardIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <rect x="2" y="3" width="11" height="11" rx="1.5" stroke={color} strokeWidth="1.3" />
    <path d="M5 3V2.5A1.5 1.5 0 016.5 1h2A1.5 1.5 0 0110 2.5V3" stroke={color} strokeWidth="1.3" />
    <path d="M4.5 8h6M4.5 10.5h4" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export const BellIcon = ({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1.5A4 4 0 0111.5 5.5V9l1.5 2H2L3.5 9V5.5A4 4 0 017.5 1.5z" stroke={color} strokeWidth="1.3" />
    <path d="M6 11a1.5 1.5 0 003 0" stroke={color} strokeWidth="1.3" />
  </svg>
);

export const EyeIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M1 7.5C2.5 4.5 5 2.5 7.5 2.5S12.5 4.5 14 7.5C12.5 10.5 10 12.5 7.5 12.5S2.5 10.5 1 7.5z" stroke={color} strokeWidth="1.3" />
    <circle cx="7.5" cy="7.5" r="2" stroke={color} strokeWidth="1.3" />
  </svg>
);

export const EyeOffIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M1 1l13 13M6.3 6.4A2 2 0 009.6 9.7M4 4.2C2.5 5.2 1.6 6.3 1 7.5c1.5 3 4 5 6.5 5 1.2 0 2.4-.4 3.4-1.1" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    <path d="M10.5 10.6C12 9.5 13 8.3 14 7.5c-1.5-3-4-5-6.5-5-.8 0-1.7.2-2.4.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export const AlertIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1L14 13H1L7.5 1z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M7.5 5.5V9M7.5 10.5v.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const InfoIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="6" stroke={color} strokeWidth="1.3" />
    <path d="M7.5 5v.5M7.5 7v3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const ArrowLeftIcon = ({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M9 3L4.5 7.5 9 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ArrowRightIcon = ({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <path d="M6 3l4.5 4.5L6 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PackageIcon = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L22 7.5V16.5L12 22L2 16.5V7.5L12 2z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M12 2v20M2 7.5l10 5 10-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7 4.5l10 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const ShoppingCartIcon = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M1 1h3.5l2.5 12h12L21 6H6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="20.5" r="1.5" fill={color} />
    <circle cx="18" cy="20.5" r="1.5" fill={color} />
  </svg>
);
