import assert from "node:assert/strict";
import { PLAYER_DECK_CARDS } from "../../../src/data/medicalCards";
import {
  buildEndTurnSteps,
  resolveActivateSkill,
  resolveManualAttack,
  resolveMoveUnit,
  resolvePlayCard,
  validateDuelCommand
} from "../../../src/engine/combatEngine";
import { checkDuelInvariants } from "../../../src/engine/invariants";
import { advanceToNextGuard, startNewRun, transitionRunOnVictory } from "../../../src/engine/runEngine";
export const seed = 12345;
export const classic = startNewRun("classic", seed);
export const unit = classic.duelState.hand.find((card) => card.kind === "Unidad");
const prep = classic.duelState;
const deployed = resolvePlayCard(prep, unit.uid, 0, classic.rival).nextState;
const skillCard = PLAYER_DECK_CARDS.find((card) => card.id === "celula-madre");
const skillState = resolvePlayCard({
  ...prep,
  hand: [{ ...skillCard, uid: "qa-stem" }]
}, "qa-stem", 0, classic.rival).nextState;
export function snapshot(run = classic, inRoundSummary = false, recoveredLp = 0) {
  return { schemaVersion: 3, savedAt: 1700000000000, inRoundSummary, recoveredLp, run };
}
export const defeat = { ...classic, playerLp: 1, duelState: { ...prep, playerLp: 1 } };
const last = advanceToNextGuard(advanceToNextGuard(classic, null), null);
export function nearVictory(run = classic) {
  const card = run.duelState.hand.find((entry) => entry.kind === "Unidad");
  const board = resolvePlayCard(run.duelState, card.uid, 0, run.rival).nextState;
  return {
    ...run,
    duelState: { ...board, rivalLp: 1, enemySlots: [null, null, null] }
  };
}
export const finale = nearVictory({ ...last, duelsWon: 2 });
export const organs = new Map;
for (let cursor = 1;organs.size < 5 && cursor <= 1024; cursor++) {
  const run = startNewRun("endless", cursor);
  if (!organs.has(run.rival.organId))
    organs.set(run.rival.organId, run);
}
assert.equal(organs.size, 5);
if (import.meta.main) {
  const wrong = { ...prep, phase: "TURNO_RIVAL" };
  const wrongBoard = { ...deployed, phase: "TURNO_RIVAL" };
  const wrongSkill = { ...skillState, phase: "TURNO_RIVAL" };
  const commands = [
    [wrong, { type: "PLAY_CARD", cardUid: unit.uid, targetLane: 0 }, () => resolvePlayCard(wrong, unit.uid, 0, classic.rival)],
    [wrongBoard, { type: "MOVE_UNIT", fromLane: 0, toLane: 2 }, () => resolveMoveUnit(wrongBoard, 0, 2)],
    [wrongBoard, { type: "ATTACK", attackerLane: 0, targetLane: 1 }, () => resolveManualAttack(wrongBoard, 0, 1)],
    [wrongSkill, { type: "ACTIVATE_SKILL", laneIndex: 0 }, () => resolveActivateSkill(wrongSkill, 0)]
  ];
  for (const [state, command, resolve] of commands) {
    const original = structuredClone(state);
    const validation = validateDuelCommand(state, command);
    const result = resolve();
    assert.equal(validation.valid, false);
    assert.equal(result.error, undefined);
    assert.notDeepEqual(result.nextState, state);
    assert.deepEqual(state, original);
    console.log(JSON.stringify({
      id: "UX-006",
      command: command.type,
      phase: state.phase,
      validator: validation.errorCode,
      resolverAccepted: !result.error,
      events: result.events.length,
      energy: [state.energy, result.nextState.energy],
      rng: [state.rngState, result.nextState.rngState],
      sequence: [state.idSequence, result.nextState.idSequence]
    }));
  }
  let state = prep;
  for (const [index, step] of buildEndTurnSteps(classic.rival).entries()) {
    const outcome = step.execute(state);
    state = outcome.nextState;
    assert.deepEqual(checkDuelInvariants(state), []);
    console.log(JSON.stringify({
      id: "PLAYBACK_BASELINE",
      index,
      phase: state.phase,
      turn: state.turn,
      events: outcome.events.length,
      lp: [state.playerLp, state.rivalLp],
      rng: state.rngState
    }));
  }
  const summary = transitionRunOnVictory(nearVictory()).nextRun;
  console.log(JSON.stringify({
    seed,
    unit: unit.id,
    rewards: summary.rewardChoices.map((card) => card.id),
    organs: [...organs].map(([id, run]) => [id, run.seed])
  }));
}
