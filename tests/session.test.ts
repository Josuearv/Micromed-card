import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { PLAYER_DECK_CARDS } from '../src/data/medicalCards';
import {
  resolveActivateSkill, resolveManualAttack, resolveMoveUnit, resolvePlayCard,
  validateDuelCommand,
} from '../src/engine/combatEngine';
import { startNewRun } from '../src/engine/runEngine';
import { clearRunSnapshot, loadRunSnapshot, saveRunSnapshot } from '../src/game/persistence';

const primary = 'codigo_vital_save_v3';
const backup = 'codigo_vital_backup_v3';
const run = startNewRun('classic', 12345);
const other = startNewRun('endless', 51);
const raw = (value = run) => JSON.stringify({
  schemaVersion: 3, savedAt: 1700000000000, inRoundSummary: false, recoveredLp: 0, run: value,
});

let values: Map<string, string>;
let denied: Set<string>;
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
beforeEach(() => {
  values = new Map();
  denied = new Set();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem(key: string) {
        if (denied.has('read')) throw new DOMException('blocked', 'SecurityError');
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (denied.has(key)) throw new DOMException('full', 'QuotaExceededError');
        values.set(key, value);
      },
      removeItem(key: string) {
        if (denied.has(key)) throw new DOMException('blocked', 'SecurityError');
        values.delete(key);
      },
    },
  } });
});
afterEach(() => {
  if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

test('UX-006: four resolvers reject real phase atomically', () => {
  const prep = run.duelState;
  const card = prep.hand.find((item) => item.kind === 'Unidad')!;
  const deployed = resolvePlayCard(prep, card.uid, 0, run.rival).nextState;
  const stem = { ...PLAYER_DECK_CARDS.find(({ id }) => id === 'celula-madre')!, uid: 'p0-stem' };
  const withSkill = resolvePlayCard({ ...prep, hand: [stem] }, stem.uid, 0, run.rival).nextState;
  for (const phase of ['PREPARACION', 'COMBATE', 'TURNO_RIVAL'] as const) {
    const playState = { ...prep, phase };
    const board = { ...deployed, phase };
    const skillState = { ...withSkill, phase };
    const commands = [
      [playState, { type: 'PLAY_CARD', cardUid: card.uid, targetLane: 0 }, () => resolvePlayCard(playState, card.uid, 0, run.rival)],
      [board, { type: 'MOVE_UNIT', fromLane: 0, toLane: 2 }, () => resolveMoveUnit(board, 0, 2)],
      [board, { type: 'ATTACK', attackerLane: 0, targetLane: 1 }, () => resolveManualAttack(board, 0, 1)],
      [skillState, { type: 'ACTIVATE_SKILL', laneIndex: 0 }, () => resolveActivateSkill(skillState, 0)],
    ] as const;
    for (const [state, command, resolve] of commands) {
      const before = structuredClone(state);
      const check = validateDuelCommand(state, command);
      const result = resolve();
      if (phase === (command.type === 'ATTACK' ? 'COMBATE' : 'PREPARACION')) {
        assert.ok(check.valid);
        assert.equal(result.error, undefined);
        assert.notStrictEqual(result.nextState, state);
      } else {
        assert.equal(check.errorCode, 'INVALID_PHASE');
        assert.ok(result.error, command.type);
        assert.strictEqual(result.nextState, state);
        assert.deepEqual(result.events, []);
      }
      assert.deepEqual(state, before);
    }
  }
});

test('UX-011: reports absent, blocked and valid V3 reads separately', () => {
  assert.equal(loadRunSnapshot()?.status, 'empty');
  denied.add('read');
  assert.equal(loadRunSnapshot()?.status, 'blocked');
  denied.clear();
  values.set(primary, raw());
  assert.equal(loadRunSnapshot()?.status, 'primary');
});

test('UX-001: legacy rival-phase save only recovers an earlier checkpoint from the same run', () => {
  values.set(primary, raw({ ...run, duelState: { ...run.duelState, phase: 'TURNO_RIVAL' } }));
  values.set(backup, raw(other));
  assert.equal(loadRunSnapshot()?.status, 'unrecoverable');
  values.set(backup, raw());
  const recovered = loadRunSnapshot();
  assert.equal(recovered?.status, 'backup');
  assert.deepEqual(loadRunSnapshot(), recovered);
  assert.equal(JSON.parse(values.get(primary)!).run.duelState.phase, 'TURNO_RIVAL');
});

test('UX-011: invalid primary never displaces a valid backup', () => {
  values.set(primary, raw({ ...run, duelState: { ...run.duelState, playerSlots: [] } }));
  values.set(backup, raw());
  assert.equal(loadRunSnapshot()?.status, 'backup');
  saveRunSnapshot(other, false);
  assert.equal(values.get(backup), raw());
  assert.equal(loadRunSnapshot()?.status, 'primary');
  values.set(primary, '{');
  assert.equal(loadRunSnapshot()?.status, 'backup');
});

test('UX-011: a partial write preserves the last valid checkpoint and reports failure', () => {
  values.set(primary, raw());
  denied.add(backup);
  assert.equal(saveRunSnapshot(other, false)?.ok, false);
  assert.equal(values.get(primary), raw());
  denied.clear();
  denied.add(primary);
  assert.equal(saveRunSnapshot(other, false)?.ok, false);
  assert.equal(values.get(primary), raw());
  assert.equal(values.get(backup), raw());
  denied.clear();
  assert.equal(saveRunSnapshot(other, false)?.ok, true);
  assert.equal(values.get(backup), raw());
});

test('UX-011: removing a run fails visibly and can be retried', () => {
  values.set(primary, raw());
  values.set(backup, raw(other));
  denied.add(backup);
  assert.equal(clearRunSnapshot()?.ok, false);
  assert.equal(values.get(primary), raw());
  denied.clear();
  assert.equal(clearRunSnapshot()?.ok, true);
  assert.equal(loadRunSnapshot()?.status, 'empty');
});
