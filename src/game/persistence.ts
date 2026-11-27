import { ALL_PLAYER_CARDS_MAP, ENEMY_PATHOGEN_CARDS, RIVAL_DUELISTS } from '../data/medicalCards';
import { ALL_ORGAN_IDS } from '../data/organs';
import { checkDuelInvariants } from '../engine/invariants';
import type { RunState } from '../engine/runEngine';
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
  terminal?: 'VICTORY' | 'GAME_OVER';
}

export type RunLoadResult =
  | { status: 'primary' | 'backup'; snapshot: RunSavePayload }
  | { status: 'empty' | 'blocked' | 'unrecoverable'; snapshot?: never };

export type RunCheckpoint = Pick<RunSavePayload, 'run' | 'inRoundSummary' | 'recoveredLp' | 'terminal'>;

type WriteResult = { ok: true } | { ok: false; reason: 'blocked' | 'invalid' | 'backup' | 'primary' };

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

export function updateBestGuardRecord(guardLevel: number) {
  const prev = loadBestGuardRecord();
  const value = Math.max(prev, guardLevel);
  return { value, ok: value === prev || safeSetItem(RECORD_KEY, String(value)) };
}

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
const textFields = (value: JsonObject, keys: string[]) =>
  keys.every((key) => typeof value[key] === 'string');
const numberFields = (value: JsonObject, keys: string[]) =>
  keys.every((key) => integer(value[key]));
const enemyCards = new Map(Object.values(ENEMY_PATHOGEN_CARDS).map((card) => [card.id, card]));

function isCard(value: unknown, instance: boolean, enemy = false): value is JsonObject {
  if (!object(value) || typeof value.id !== 'string') return false;
  const template = enemy ? enemyCards.get(value.id) : Object.hasOwn(ALL_PLAYER_CARDS_MAP, value.id)
    ? ALL_PLAYER_CARDS_MAP[value.id] : undefined;
  return !!template && (!instance || (typeof value.uid === 'string' && value.uid.length > 0))
    && value.kind === template.kind && value.medicalClass === template.medicalClass
    && value.archetype === template.archetype && value.ability === template.ability
    && value.targetMode === template.targetMode && value.effectTag === template.effectTag
    && value.trapTrigger === template.trapTrigger && value.trapEffectId === template.trapEffectId
    && textFields(value, [
      'code', 'name', 'abilityLabel', 'shortRule', 'medicalBasis', 'gameSimplification', 'synergies', 'counterEffects',
    ])
    && numberFields(value, ['cost', 'atk', 'maxHp'])
    && (value.activeSkillCost === undefined || integer(value.activeSkillCost));
}

function isBoard(value: unknown, enemy: boolean): boolean {
  return Array.isArray(value) && value.length === 3 && value.every((unit, lane) =>
    unit === null || (object(unit) && isCard(unit.sourceCard, true, enemy)
      && unit.sourceCard.id === unit.cardId && unit.laneIndex === lane && unit.isEnemy === enemy
      && unit.medicalClass === unit.sourceCard.medicalClass && unit.archetype === unit.sourceCard.archetype
      && unit.ability === unit.sourceCard.ability
      && textFields(unit, ['uid', 'name', 'abilityLabel', 'shortRule', 'medicalBasis'])
      && numberFields(unit, ['atk', 'baseAtk']) && integer(unit.hp, 1) && integer(unit.maxHp, 1) && unit.hp <= unit.maxHp
      && object(unit.statuses) && Object.values(unit.statuses).every((entry) => typeof entry === 'boolean' || integer(entry))
      && typeof unit.usedActiveSkillThisTurn === 'boolean' && typeof unit.hasAttackedThisTurn === 'boolean'),
  );
}

function isValidRunSave(data: unknown): data is RunSavePayload {
  if (!object(data) || data.schemaVersion !== 3 || !integer(data.savedAt)
    || typeof data.inRoundSummary !== 'boolean' || !integer(data.recoveredLp) || !object(data.run)) return false;
  const run = data.run;
  const duel = run.duelState;
  const rival = run.rival;
  if (run.version !== 3 || (run.mode !== 'classic' && run.mode !== 'endless')
    || !integer(run.guardLevel, 1) || !integer(run.playerMaxLp, 1) || !integer(run.playerLp)
    || run.playerLp > run.playerMaxLp || !numberFields(run, ['cardsPlayedCount', 'turnsElapsed', 'duelsWon', 'seed', 'idSequence'])
    || !integer(run.rngState, -2147483648) || run.rngState > 4294967295
    || !textFields(run, ['runId'])
    || !Array.isArray(run.masterDeck) || run.masterDeck.length === 0 || !run.masterDeck.every((card) => isCard(card, true))
    || new Set(run.masterDeck.map((card) => card.uid)).size !== run.masterDeck.length
    || !Array.isArray(run.rewardChoices) || !run.rewardChoices.every((card) => isCard(card, false))
    || !object(rival) || !textFields(rival, ['id', 'name', 'diseaseName', 'clinicalContext'])
    || rival.roundNumber !== run.guardLevel || !integer(rival.startingLp, 1)
    || !ALL_ORGAN_IDS.some((id) => id === rival.organId)
    || !Array.isArray(rival.mutators) || !rival.mutators.every((entry) => object(entry) && textFields(entry, ['id', 'name', 'description']))
    || !Array.isArray(rival.deck) || rival.deck.length === 0 || !rival.deck.every((card) => isCard(card, false, true))
    || !Array.isArray(rival.outbreakDeck) || !rival.outbreakDeck.every((entry) => object(entry) && textFields(entry, ['id', 'name', 'description', 'effectId', 'medicalBasis']))
    || !object(duel) || duel.organId !== rival.organId
    || !['PREPARACION', 'COMBATE', 'TURNO_RIVAL'].some((phase) => phase === duel.phase)
    || !integer(duel.turn, 1) || !integer(duel.rivalMaxLp, 1) || duel.rivalMaxLp !== rival.startingLp
    || duel.playerMaxLp !== run.playerMaxLp || !integer(duel.playerLp) || !integer(duel.rivalLp)
    || !numberFields(duel, ['energy', 'maxEnergy', 'freeMovesLeft', 'nextTurnEnergyPenalty', 'idSequence'])
    || !integer(duel.rngState, -2147483648) || duel.rngState > 4294967295
    || run.idSequence !== duel.idSequence
    || !isBoard(duel.playerSlots, false) || !isBoard(duel.enemySlots, true)
    || !Array.isArray(duel.armedTraps) || !duel.armedTraps.every((trap) =>
      object(trap) && isCard(trap.sourceCard, true) && trap.sourceCard.kind === 'Trampa'
      && textFields(trap, ['uid', 'trigger', 'effectId']) && integer(trap.armedTurn, 1)
      && trap.trigger === trap.sourceCard.trapTrigger && trap.effectId === trap.sourceCard.trapEffectId)
    || ![duel.hand, duel.drawPile, duel.discardPile].every((zone) => Array.isArray(zone) && zone.every((card) => isCard(card, true)))
    || !object(duel.rivalIntent) || !textFields(duel.rivalIntent, ['actionTitle', 'description'])
    || !integer(duel.rivalIntent.plannedLane, -1) || duel.rivalIntent.plannedLane > 2
    || !Array.isArray(duel.rivalIntent.actions) || !duel.rivalIntent.actions.every((action) =>
      object(action) && textFields(action, ['id', 'kind', 'label', 'description']) && integer(action.lane, -1) && action.lane <= 2)
    || checkDuelInvariants(duel as unknown as RunState['duelState']).length > 0) return false;

  const completed = data.inRoundSummary || data.terminal === 'VICTORY';
  if (run.duelsWon !== run.guardLevel - (completed ? 0 : 1)
    || (run.mode === 'classic' && run.guardLevel > RIVAL_DUELISTS.length)) return false;
  if (data.inRoundSummary) {
    const validRecovery = run.mode === 'classic'
      ? data.recoveredLp === 0 && run.playerLp === run.playerMaxLp
      : run.playerLp > 0 && run.playerLp === duel.playerLp + data.recoveredLp;
    return validRecovery && duel.rivalLp === 0 && data.terminal === undefined && run.rewardChoices.length === 3;
  }
  if (data.recoveredLp !== 0 || run.rewardChoices.length !== 0
    || run.playerLp !== duel.playerLp || run.rngState !== duel.rngState) return false;
  if (data.terminal === 'VICTORY') {
    return run.mode === 'classic' && run.guardLevel === RIVAL_DUELISTS.length && duel.rivalLp === 0;
  }
  if (data.terminal === 'GAME_OVER') return duel.playerLp === 0 && duel.rivalLp > 0;
  return data.terminal === undefined && duel.playerLp > 0 && duel.rivalLp > 0;
}

function parse(raw: string | null): RunSavePayload | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isValidRunSave(value) ? value : null;
  } catch {
    return null;
  }
}

function isInterrupted(snapshot: RunSavePayload): boolean {
  return !snapshot.inRoundSummary && !snapshot.terminal && snapshot.run.duelState.phase === 'TURNO_RIVAL';
}

function sameRun(a: RunSavePayload, b: RunSavePayload): boolean {
  return a.run.runId === b.run.runId && a.run.mode === b.run.mode;
}

function repairLegacyTurnCount(snapshot: RunSavePayload, previous: RunSavePayload | null): RunSavePayload {
  const { run } = snapshot;
  if (!snapshot.inRoundSummary && !snapshot.terminal && previous && isInterrupted(previous) && sameRun(snapshot, previous)
    && run.guardLevel === previous.run.guardLevel
    && run.duelState.phase === 'PREPARACION' && run.duelState.turn === previous.run.duelState.turn + 1
    && run.turnsElapsed === previous.run.turnsElapsed) {
    // V3 briefly persisted the next preparation before incrementing the run counter.
    return { ...snapshot, run: { ...run, turnsElapsed: run.turnsElapsed + 1 } };
  }
  return snapshot;
}

export function saveRunSnapshot(
  run: RunState,
  inRoundSummary: boolean,
  recoveredLp = 0,
  terminal?: RunSavePayload['terminal'],
): WriteResult {
  const payload: RunSavePayload = {
    schemaVersion: 3,
    savedAt: Date.now(),
    inRoundSummary,
    recoveredLp,
    run,
    terminal,
  };
  if (!isValidRunSave(payload) || isInterrupted(payload)) return { ok: false, reason: 'invalid' };
  let existing: string | null;
  try {
    existing = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return { ok: false, reason: 'blocked' };
  }
  const serialized = JSON.stringify(payload);
  if (existing === serialized) return { ok: true };
  const previous = parse(existing);
  if (existing !== null && previous && !isInterrupted(previous) && !safeSetItem(BACKUP_KEY, existing)) {
    return { ok: false, reason: 'backup' };
  }
  return safeSetItem(SAVE_KEY, serialized) ? { ok: true } : { ok: false, reason: 'primary' };
}

export function loadRunSnapshot(): RunLoadResult {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    const backupRaw = window.localStorage.getItem(BACKUP_KEY);
    const primary = parse(raw);
    const backup = parse(backupRaw);
    if (primary && !isInterrupted(primary)) return { status: 'primary', snapshot: repairLegacyTurnCount(primary, backup) };
    if (backup && !isInterrupted(backup)) {
      if (!primary || (sameRun(backup, primary)
        && backup.savedAt <= primary.savedAt && backup.run.guardLevel <= primary.run.guardLevel
        && (backup.run.guardLevel < primary.run.guardLevel || backup.run.duelState.turn <= primary.run.duelState.turn))) {
        return { status: 'backup', snapshot: backup };
      }
    }
    return { status: raw === null && backupRaw === null ? 'empty' : 'unrecoverable' };
  } catch {
    return { status: 'blocked' };
  }
}

export function clearRunSnapshot(): WriteResult {
  const { status } = loadRunSnapshot();
  if (status === 'blocked') return { ok: false, reason: 'blocked' };
  const keys = { primary: SAVE_KEY, backup: BACKUP_KEY };
  const order = status === 'backup' ? ['primary', 'backup'] as const : ['backup', 'primary'] as const;
  for (const reason of order) {
    try {
      window.localStorage.removeItem(keys[reason]);
    } catch {
      return { ok: false, reason };
    }
  }
  return { ok: true };
}
