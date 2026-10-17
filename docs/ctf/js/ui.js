// Regras puras da interface do CTF (sem DOM) — testadas em tests/ui.test.js.

export const FONT_MIN = 11;
export const FONT_MAX = 22;

// Modo celular: respeita a escolha salva; sem escolha, liga em telas estreitas ou de toque.
export function shouldUseMobile({ saved, width, coarse }) {
  if (saved === true || saved === false) return saved;
  return width <= 760 || (!!coarse && width <= 1024);
}

export function clampFont(px) {
  const n = Math.round(Number(px) || 14);
  return Math.max(FONT_MIN, Math.min(FONT_MAX, n));
}

// Navegação no visualizador de dicas: índice (0-based) entre as dicas liberadas.
export function hintIndex(current, delta, unlocked) {
  if (unlocked <= 0) return 0;
  return Math.max(0, Math.min(unlocked - 1, current + delta));
}

// Estado exibido pelo visualizador de dicas.
export function hintView({ index, unlocked, total, solved }) {
  const i = hintIndex(index, 0, unlocked);
  return {
    index: i,
    canPrev: i > 0,
    canNext: i < unlocked - 1,
    canReveal: unlocked < total,
    revealFree: !!solved,
    dots: Array.from({ length: total }, (_, k) => (k === i && unlocked ? 'current' : k < unlocked ? 'unlocked' : 'locked')),
  };
}
