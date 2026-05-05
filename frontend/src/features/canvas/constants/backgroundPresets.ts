import type { BackgroundConfig } from '../types/canvas';

export const BACKGROUND_PRESETS: { label: string; bg: BackgroundConfig }[] = [
  { label: 'Cream',    bg: { type: 'color', value: '#f5f0e8' } },
  { label: 'White',    bg: { type: 'color', value: '#ffffff' } },
  { label: 'Black',    bg: { type: 'color', value: '#111111' } },
  { label: 'Navy',     bg: { type: 'color', value: '#003366' } },
  { label: 'UCI Gold', bg: { type: 'color', value: '#ffd200' } },
  { label: 'UCI Blue', bg: { type: 'color', value: '#0064a4' } },
  { label: 'Sunset',   bg: { type: 'gradient', value: '#ff6b35', gradientEnd: '#ffd200', angle: 135 } },
  { label: 'Ocean',    bg: { type: 'gradient', value: '#0064a4', gradientEnd: '#00b4d8', angle: 135 } },
  { label: 'Dusk',     bg: { type: 'gradient', value: '#4a1942', gradientEnd: '#ff6b35', angle: 135 } },
  { label: 'Forest',   bg: { type: 'gradient', value: '#1b4332', gradientEnd: '#40916c', angle: 135 } },
];
