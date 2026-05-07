import type { BackgroundConfig } from '../types/canvas';

export const BACKGROUND_PRESETS: { label: string; bg: BackgroundConfig }[] = [
  { label: 'Cream',     bg: { type: 'color', value: '#f6f1e6' } },
  { label: 'White',     bg: { type: 'color', value: '#ffffff' } },
  { label: 'Ink',       bg: { type: 'color', value: '#15171a' } },
  { label: 'UCI Blue',  bg: { type: 'color', value: '#0064a4' } },
  { label: 'UCI Gold',  bg: { type: 'color', value: '#ffd200' } },
  { label: 'Navy',      bg: { type: 'color', value: '#1a3a8c' } },
  { label: 'Orange',    bg: { type: 'color', value: '#f08a2a' } },
  { label: 'Teal',      bg: { type: 'color', value: '#2db5c0' } },
  { label: 'Brick',     bg: { type: 'color', value: '#a73a25' } },
  { label: 'Forest',    bg: { type: 'color', value: '#2c5e3f' } },
  { label: 'Red',       bg: { type: 'color', value: '#e63946' } },
  { label: 'Steel',     bg: { type: 'color', value: '#7a8fb8' } },
  { label: 'Mint',      bg: { type: 'color', value: '#3aaa6c' } },
  { label: 'Honey',     bg: { type: 'color', value: '#f1b32a' } },
  { label: 'Plum',      bg: { type: 'color', value: '#7a3aa9' } },
  { label: 'Sky',       bg: { type: 'color', value: '#3aa1ff' } },
];
