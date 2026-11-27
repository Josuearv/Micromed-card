/**
 * PRNG determinista (Mulberry32) y generador de IDs por corrida.
 * Garantiza reproducibilidad exacta entre replays y pruebas sin depender de Math.random().
 */

export function nextRng(state: number): { value: number; nextState: number } {
  let t = (state + 0x6d2b79f5) | 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState };
}

export function rngInt(
  state: number,
  maxExclusive: number,
): { value: number; nextState: number } {
  if (maxExclusive <= 1) {
    const res = nextRng(state);
    return { value: 0, nextState: res.nextState };
  }
  const { value, nextState } = nextRng(state);
  return {
    value: Math.floor(value * maxExclusive),
    nextState,
  };
}

export function rngPick<T>(
  state: number,
  items: readonly T[],
): { item: T; nextState: number } {
  const { value, nextState } = rngInt(state, items.length);
  return { item: items[value], nextState };
}

export function rngShuffle<T>(
  state: number,
  items: readonly T[],
): { items: T[]; nextState: number } {
  const copy = [...items];
  let s = state;
  for (let i = copy.length - 1; i > 0; i--) {
    const pick = rngInt(s, i + 1);
    s = pick.nextState;
    const j = pick.value;
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return { items: copy, nextState: s };
}

export function nextSeqId(
  prefix: string,
  seq: number,
): { id: string; nextSeq: number } {
  return {
    id: `${prefix}-${seq}`,
    nextSeq: seq + 1,
  };
}
