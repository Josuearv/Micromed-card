import { RunState } from '../engine/runEngine';
import { RunPreferences } from '../types/game';

const SAVE_KEY = 'codigo_vital_save_v3';
const BACKUP_KEY = 'codigo_vital_backup_v3';
const PREFS_KEY = 'codigo_vital_prefs_v3';
const RECORD_KEY = 'codigo_vital_best_guard_v3';

export interface RunSavePayload {
  schemaVersion: 3;
  savedAt: number;
  inRoundSummary: boolean;
  recoveredLp: number;
  run: RunState;
}

const DEFAULT_PREFS: RunPreferences = {
  muted: false,
  speedMode: 'normal',
  reducedMotion: false,
  tactical2D: false,
};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage disabled
  }
}

export function loadPreferences(): RunPreferences {
  const raw = safeGetItem(PREFS_KEY);
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<RunPreferences>;
    return {
      muted: Boolean(parsed.muted),
      speedMode:
        parsed.speedMode === 'fast' || parsed.speedMode === 'reduced'
          ? parsed.speedMode
          : 'normal',
      reducedMotion: Boolean(parsed.reducedMotion),
      tactical2D: Boolean(parsed.tactical2D),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: RunPreferences) {
  safeSetItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadBestGuardRecord(): number {
  const raw = safeGetItem(RECORD_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function updateBestGuardRecord(guardLevel: number): number {
  const prev = loadBestGuardRecord();
  const next = Math.max(prev, guardLevel);
  if (next > prev) {
    safeSetItem(RECORD_KEY, String(next));
  }
  return next;
}

function isValidRunSave(data: unknown): data is RunSavePayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<RunSavePayload>;
  if (d.schemaVersion !== 3 || !d.run) return false;
  const r = d.run as Partial<RunState>;
  return (
    typeof r.guardLevel === 'number' &&
    typeof r.playerLp === 'number' &&
    Array.isArray(r.masterDeck) &&
    Boolean(r.rival) &&
    Boolean(r.duelState) &&
    Array.isArray(r.duelState?.playerSlots) &&
    Array.isArray(r.duelState?.enemySlots) &&
    Array.isArray(r.duelState?.hand)
  );
}

export function saveRunSnapshot(
  run: RunState,
  inRoundSummary: boolean,
  recoveredLp = 0,
) {
  const existing = safeGetItem(SAVE_KEY);
  if (existing) {
    safeSetItem(BACKUP_KEY, existing);
  }
  const payload: RunSavePayload = {
    schemaVersion: 3,
    savedAt: Date.now(),
    inRoundSummary,
    recoveredLp,
    run,
  };
  safeSetItem(SAVE_KEY, JSON.stringify(payload));
}

export function loadRunSnapshot(): RunSavePayload | null {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    const raw = safeGetItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (isValidRunSave(parsed)) {
        return parsed;
      }
    } catch {
      // try backup on corruption
    }
  }
  return null;
}

export function clearRunSnapshot() {
  safeRemoveItem(SAVE_KEY);
  safeRemoveItem(BACKUP_KEY);
}
