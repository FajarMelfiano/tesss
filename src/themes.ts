export interface Theme {
  id: string;
  name: string;
  bgCanvas: string;
  gridLine: string;
  uiBgClass: string;
  uiTextClass: string;
  uiTextDimClass: string;
  uiBorderClass: string;
  uiAccentClass: string;
  playerColor: string;
  playerShadow: string;
  enemyColor: string;
  shieldColor: string;
  speedColor: string;
  mazeWallFill: string;
  mazeWallStroke: string;
  mazeGoalFill: string;
  mazeGoalStroke: string;
}

export const themes: Theme[] = [
  {
    id: 'midnight', name: 'Midnight',
    bgCanvas: '#0a0a0a', gridLine: 'rgba(255, 255, 255, 0.03)',
    uiBgClass: 'bg-slate-950', uiTextClass: 'text-slate-100', uiTextDimClass: 'text-slate-400', uiBorderClass: 'border-slate-800', uiAccentClass: 'bg-white text-black hover:bg-slate-200',
    playerColor: '#ffffff', playerShadow: '#ffffff',
    enemyColor: '#ff4d4d', shieldColor: '#3b82f6', speedColor: '#facc15',
    mazeWallFill: 'rgba(255, 255, 255, 0.15)', mazeWallStroke: 'rgba(255, 255, 255, 0.4)',
    mazeGoalFill: 'rgba(74, 222, 128, 0.2)', mazeGoalStroke: '#4ade80'
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk',
    bgCanvas: '#050117', gridLine: 'rgba(236, 72, 153, 0.1)',
    uiBgClass: 'bg-fuchsia-950', uiTextClass: 'text-fuchsia-100', uiTextDimClass: 'text-fuchsia-400', uiBorderClass: 'border-fuchsia-800', uiAccentClass: 'bg-pink-500 text-white hover:bg-pink-400 border-pink-400 border',
    playerColor: '#06b6d4', playerShadow: '#06b6d4',
    enemyColor: '#ec4899', shieldColor: '#8b5cf6', speedColor: '#eab308',
    mazeWallFill: 'rgba(236, 72, 153, 0.15)', mazeWallStroke: 'rgba(236, 72, 153, 0.5)',
    mazeGoalFill: 'rgba(6, 182, 212, 0.2)', mazeGoalStroke: '#06b6d4'
  },
  {
    id: 'matrix', name: 'Matrix',
    bgCanvas: '#000000', gridLine: 'rgba(34, 197, 94, 0.05)',
    uiBgClass: 'bg-black', uiTextClass: 'text-green-500', uiTextDimClass: 'text-green-700', uiBorderClass: 'border-green-800', uiAccentClass: 'bg-green-500 text-black hover:bg-green-400 border-green-500 border',
    playerColor: '#4ade80', playerShadow: '#4ade80',
    enemyColor: '#ef4444', shieldColor: '#10b981', speedColor: '#84cc16',
    mazeWallFill: 'rgba(34, 197, 94, 0.15)', mazeWallStroke: 'rgba(34, 197, 94, 0.5)',
    mazeGoalFill: 'rgba(16, 185, 129, 0.2)', mazeGoalStroke: '#10b981'
  },
  {
    id: 'ocean', name: 'Deep Ocean',
    bgCanvas: '#011c2b', gridLine: 'rgba(14, 165, 233, 0.05)',
    uiBgClass: 'bg-sky-950', uiTextClass: 'text-sky-100', uiTextDimClass: 'text-sky-400', uiBorderClass: 'border-sky-800', uiAccentClass: 'bg-sky-500 text-white hover:bg-sky-400 border-sky-400 border',
    playerColor: '#38bdf8', playerShadow: '#38bdf8',
    enemyColor: '#f43f5e', shieldColor: '#818cf8', speedColor: '#34d399',
    mazeWallFill: 'rgba(14, 165, 233, 0.15)', mazeWallStroke: 'rgba(14, 165, 233, 0.5)',
    mazeGoalFill: 'rgba(56, 189, 248, 0.2)', mazeGoalStroke: '#38bdf8'
  },
  {
    id: 'crimson', name: 'Crimson',
    bgCanvas: '#2a0a0a', gridLine: 'rgba(239, 68, 68, 0.05)',
    uiBgClass: 'bg-red-950', uiTextClass: 'text-red-100', uiTextDimClass: 'text-red-400', uiBorderClass: 'border-red-900', uiAccentClass: 'bg-red-600 text-white hover:bg-red-500 border-red-500 border',
    playerColor: '#fca5a5', playerShadow: '#fca5a5',
    enemyColor: '#991b1b', shieldColor: '#ca8a04', speedColor: '#fb923c',
    mazeWallFill: 'rgba(239, 68, 68, 0.15)', mazeWallStroke: 'rgba(239, 68, 68, 0.5)',
    mazeGoalFill: 'rgba(252, 165, 165, 0.2)', mazeGoalStroke: '#fca5a5'
  },
  {
    id: 'solar', name: 'Solar Flare',
    bgCanvas: '#291000', gridLine: 'rgba(249, 115, 22, 0.05)',
    uiBgClass: 'bg-orange-950', uiTextClass: 'text-orange-100', uiTextDimClass: 'text-orange-400', uiBorderClass: 'border-orange-800', uiAccentClass: 'bg-orange-500 text-white hover:bg-orange-400 border-orange-400 border',
    playerColor: '#fdba74', playerShadow: '#fdba74',
    enemyColor: '#b91c1c', shieldColor: '#38bdf8', speedColor: '#fde047',
    mazeWallFill: 'rgba(249, 115, 22, 0.15)', mazeWallStroke: 'rgba(249, 115, 22, 0.5)',
    mazeGoalFill: 'rgba(253, 186, 116, 0.2)', mazeGoalStroke: '#fdba74'
  },
  {
    id: 'toxic', name: 'Toxic Zone',
    bgCanvas: '#141c0b', gridLine: 'rgba(132, 204, 22, 0.05)',
    uiBgClass: 'bg-lime-950', uiTextClass: 'text-lime-100', uiTextDimClass: 'text-lime-400', uiBorderClass: 'border-lime-800', uiAccentClass: 'bg-lime-500 text-black hover:bg-lime-400 border-lime-500 border',
    playerColor: '#d9f99d', playerShadow: '#d9f99d',
    enemyColor: '#a21caf', shieldColor: '#0ea5e9', speedColor: '#facc15',
    mazeWallFill: 'rgba(132, 204, 22, 0.15)', mazeWallStroke: 'rgba(132, 204, 22, 0.5)',
    mazeGoalFill: 'rgba(217, 249, 157, 0.2)', mazeGoalStroke: '#d9f99d'
  },
  {
    id: 'royal', name: 'Royal Majesty',
    bgCanvas: '#1e1b4b', gridLine: 'rgba(139, 92, 246, 0.05)',
    uiBgClass: 'bg-indigo-950', uiTextClass: 'text-indigo-100', uiTextDimClass: 'text-indigo-400', uiBorderClass: 'border-indigo-800', uiAccentClass: 'bg-indigo-500 text-white hover:bg-indigo-400 border-indigo-400 border',
    playerColor: '#c4b5fd', playerShadow: '#c4b5fd',
    enemyColor: '#fb7185', shieldColor: '#2dd4bf', speedColor: '#fde047',
    mazeWallFill: 'rgba(139, 92, 246, 0.15)', mazeWallStroke: 'rgba(139, 92, 246, 0.5)',
    mazeGoalFill: 'rgba(196, 181, 253, 0.2)', mazeGoalStroke: '#c4b5fd'
  },
  {
    id: 'terminal', name: 'Terminal',
    bgCanvas: '#0f172a', gridLine: 'rgba(255, 255, 255, 0.02)',
    uiBgClass: 'bg-slate-900', uiTextClass: 'text-slate-300', uiTextDimClass: 'text-slate-500', uiBorderClass: 'border-slate-700', uiAccentClass: 'bg-slate-200 text-slate-900 hover:bg-white',
    playerColor: '#f8fafc', playerShadow: '#f8fafc',
    enemyColor: '#94a3b8', shieldColor: '#cbd5e1', speedColor: '#e2e8f0',
    mazeWallFill: 'rgba(255, 255, 255, 0.1)', mazeWallStroke: 'rgba(255, 255, 255, 0.3)',
    mazeGoalFill: 'rgba(248, 250, 252, 0.2)', mazeGoalStroke: '#f8fafc'
  },
  {
    id: 'gold', name: 'Golden Era',
    bgCanvas: '#1a1710', gridLine: 'rgba(234, 179, 8, 0.05)',
    uiBgClass: 'bg-yellow-950', uiTextClass: 'text-yellow-100', uiTextDimClass: 'text-yellow-400', uiBorderClass: 'border-yellow-800', uiAccentClass: 'bg-yellow-500 text-black hover:bg-yellow-400 border-yellow-500 border',
    playerColor: '#fef08a', playerShadow: '#fef08a',
    enemyColor: '#ef4444', shieldColor: '#38bdf8', speedColor: '#ffffff',
    mazeWallFill: 'rgba(234, 179, 8, 0.15)', mazeWallStroke: 'rgba(234, 179, 8, 0.5)',
    mazeGoalFill: 'rgba(254, 240, 138, 0.2)', mazeGoalStroke: '#fef08a'
  },
  {
    id: 'void', name: 'The Void',
    bgCanvas: '#050505', gridLine: 'rgba(255, 255, 255, 0.01)',
    uiBgClass: 'bg-zinc-950', uiTextClass: 'text-zinc-400', uiTextDimClass: 'text-zinc-600', uiBorderClass: 'border-zinc-800', uiAccentClass: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border-zinc-700 border',
    playerColor: '#a1a1aa', playerShadow: '#a1a1aa',
    enemyColor: '#52525b', shieldColor: '#71717a', speedColor: '#d4d4d8',
    mazeWallFill: 'rgba(255, 255, 255, 0.05)', mazeWallStroke: 'rgba(255, 255, 255, 0.2)',
    mazeGoalFill: 'rgba(161, 161, 170, 0.2)', mazeGoalStroke: '#a1a1aa'
  },
  {
    id: 'cherry', name: 'Cherry Blossom',
    bgCanvas: '#2e1026', gridLine: 'rgba(244, 114, 182, 0.05)',
    uiBgClass: 'bg-pink-950', uiTextClass: 'text-pink-100', uiTextDimClass: 'text-pink-400', uiBorderClass: 'border-pink-800', uiAccentClass: 'bg-pink-400 text-black hover:bg-pink-300 border-pink-400 border',
    playerColor: '#fbcfe8', playerShadow: '#fbcfe8',
    enemyColor: '#be123c', shieldColor: '#38bdf8', speedColor: '#fde047',
    mazeWallFill: 'rgba(244, 114, 182, 0.15)', mazeWallStroke: 'rgba(244, 114, 182, 0.5)',
    mazeGoalFill: 'rgba(251, 207, 232, 0.2)', mazeGoalStroke: '#fbcfe8'
  }
];
