import assert from 'node:assert/strict';
import { ENEMY_PATHOGEN_CARDS, PLAYER_DECK_CARDS } from '../src/data/medicalCards';
import {
  buildEndTurnSteps,
  computeAttackPreview,
  createBoardUnit,
  DuelEngineState,
  resolveActivateSkill,
  resolveManualAttack,
  resolveMoveUnit,
  resolvePlayCard,
  validateDuelCommand,
} from '../src/engine/combatEngine';
import { generateProceduralEncounter } from '../src/engine/encounterGenerator';
import { checkDuelInvariants } from '../src/engine/invariants';
import {
  advanceToNextGuard,
  computeVictoryRecovery,
  startNewRun,
  transitionRunOnVictory,
} from '../src/engine/runEngine';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
}

// 1. A01: Unit cards live on board until destroyed and never duplicate in discard
runTest('A01 - Zonas exclusivas: Unidad invocada vive en campo y va al descarte al morir', () => {
  const run = startNewRun('classic', 12345);
  let state = run.duelState;
  const totalCardsStart =
    state.hand.length + state.drawPile.length + state.discardPile.length;

  const unitCard = state.hand.find((c) => c.kind === 'Unidad');
  assert.ok(unitCard, 'Debe haber una carta de Unidad en mano inicial');

  const res = resolvePlayCard(state, unitCard.uid, 0, run.rival);
  state = res.nextState;

  assert.equal(state.playerSlots[0]?.sourceCard.uid, unitCard.uid);
  assert.equal(
    state.discardPile.some((c) => c.uid === unitCard.uid),
    false,
    'La carta de unidad invocada NO debe estar en el descarte mientras sigue viva',
  );
  assert.equal(checkDuelInvariants(state).length, 0, 'Sin violaciones de invariantes');

  // Verify total cardinality matches masterDeck
  const onBoard = state.playerSlots.filter(Boolean).length;
  assert.equal(
    state.hand.length +
      state.drawPile.length +
      state.discardPile.length +
      state.armedTraps.length +
      onBoard,
    totalCardsStart,
  );
});

// 2. A02: Invalid commands do not mutate state, RNG, or counters
runTest('A02 - Validación unificada rechaza sin mutar estado ni RNG', () => {
  const run = startNewRun('endless', 777);
  const state = run.duelState;

  const badLane = validateDuelCommand(state, {
    type: 'PLAY_CARD',
    cardUid: state.hand[0].uid,
    targetLane: 9,
  });
  assert.equal(badLane.valid, false);
  assert.equal(badLane.errorCode, 'INVALID_LANE');

  const noPaState = { ...state, energy: 0 };
  const costlyCard = noPaState.hand.find((c) => c.cost > 0);
  if (costlyCard) {
    const res = resolvePlayCard(noPaState, costlyCard.uid, 0, run.rival);
    assert.ok(res.error);
    assert.strictEqual(res.nextState, noPaState, 'Estado rechazado permanece idéntico');
  }
});

// 3. A04: LP recovery in Endless Guard Mode
runTest('A04 - Recuperación parcial de LP en Guardia Infinita', () => {
  const recLow = computeVictoryRecovery(1000, 4000);
  assert.equal(recLow.nextLp, 2500);
  assert.equal(recLow.recoveredAmount, 1500);

  const recHigh = computeVictoryRecovery(3600, 4000);
  assert.equal(recHigh.nextLp, 4000);
  assert.equal(recHigh.recoveredAmount, 400);
});

// 4. A05: Deterministic replay with same seed produces identical state & encounter
runTest('A05 - Reproducibilidad determinista por semilla', () => {
  const runA = startNewRun('endless', 987654);
  const runB = startNewRun('endless', 987654);

  assert.equal(runA.rival.id, runB.rival.id);
  assert.equal(runA.rival.organId, runB.rival.organId);
  assert.deepEqual(
    runA.duelState.hand.map((c) => c.id),
    runB.duelState.hand.map((c) => c.id),
  );
  assert.equal(runA.duelState.rngState, runB.duelState.rngState);
});

// 5. Preview exact match with manual attack resolution (including stun & biofilm)
runTest('Preview coincide exactamente con resolución de ataque y aturdimiento', () => {
  const run = startNewRun('classic', 42);
  let state = run.duelState;

  const allyDef = PLAYER_DECK_CARDS.find((c) => c.id === 'linfocito-cd8')!;
  const enemyDef = ENEMY_PATHOGEN_CARDS.estafilo;

  const ally = createBoardUnit(allyDef, 0, false, 100);
  const enemy = createBoardUnit(enemyDef, 1, true, 101);
  state = {
    ...state,
    phase: 'COMBATE',
    playerSlots: [ally.unit, null, null],
    enemySlots: [null, enemy.unit, null],
  };

  const preview = computeAttackPreview(
    state.playerSlots[0]!,
    state.enemySlots[1]!,
    state.organId,
    state.enemySlots,
  );
  const atkRes = resolveManualAttack(state, 0, 1);
  assert.equal(atkRes.error, undefined);

  const expectedEnemyHp = enemy.unit.hp - preview.damageOut;
  if (expectedEnemyHp <= 0) {
    assert.equal(atkRes.nextState.enemySlots[1], null);
  } else {
    assert.equal(atkRes.nextState.enemySlots[1]?.hp, expectedEnemyHp);
  }
  assert.equal(checkDuelInvariants(atkRes.nextState).length, 0);
});

// 6. Two armed traps do not double-spend on a single blocked event
runTest('Trampas múltiples en orden de armado sin doble consumo', () => {
  const run = startNewRun('endless', 555);
  const trapCard = {
    id: 'barrera-mucociliar',
    code: 'TRP-01',
    name: 'Barrera Mucociliar',
    kind: 'Trampa' as const,
    medicalClass: 'Inmunologia' as const,
    archetype: 'celula_madre' as const,
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna' as const,
    abilityLabel: 'Trampa',
    trapTrigger: 'beforeDirectDamage' as const,
    trapEffectId: 'barrera_mucociliar' as const,
    targetMode: 'trap_slot' as const,
    effectTag: 'trap' as const,
    shortRule: 'Trampa',
    medicalBasis: 'Base',
    gameSimplification: 'Simp',
    synergies: 'Sin',
    counterEffects: 'Cont',
  };

  const t1 = { ...trapCard, uid: 'trp-1' };
  const t2 = { ...trapCard, uid: 'trp-2' };
  let state: DuelEngineState = {
    ...run.duelState,
    energy: 4,
    hand: [t1, t2, ...run.duelState.hand],
    playerSlots: [null, null, null],
    enemySlots: [
      null,
      createBoardUnit(ENEMY_PATHOGEN_CARDS.rinovirus, 1, true, 500).unit,
      null,
    ],
  };

  state = resolvePlayCard(state, 'trp-1', undefined, run.rival).nextState;
  state = resolvePlayCard(state, 'trp-2', undefined, run.rival).nextState;
  assert.equal(state.armedTraps.length, 2);

  // Execute end turn steps; lane 1 has 1 unguarded enemy -> only trap 1 triggers!
  const steps = buildEndTurnSteps(run.rival);
  for (const step of steps) {
    state = step.execute(state).nextState;
  }

  assert.equal(state.armedTraps.length, 1, 'Solo debe dispararse 1 trampa, conservando la 2da');
  assert.equal(state.playerLp, 4000, 'El ataque directo fue anulado por completo');
  assert.equal(checkDuelInvariants(state).length, 0);
});

// 7. 1000-seed procedural generator stability & non-repeating organ check
runTest('Generador procedural estable durante 1000 semillas y niveles', () => {
  let rng = 10293847;
  let prevOrgan = undefined;
  const organsSeen = new Set<string>();

  for (let i = 1; i <= 1000; i++) {
    const level = ((i - 1) % 25) + 1;
    const res = generateProceduralEncounter(level, rng, prevOrgan);
    rng = res.nextRngState;
    assert.ok(res.rival.deck.length === 4);
    assert.ok(res.rival.startingLp > 0);
    if (prevOrgan) {
      assert.notEqual(res.rival.organId, prevOrgan, 'No debe repetir órgano consecutivo');
    }
    prevOrgan = res.rival.organId;
    organsSeen.add(res.rival.organId);
  }
  assert.equal(organsSeen.size, 5, 'Deben rotar los 5 órganos y tejidos');
});

// 8. Full Endless Guard multi-level transition + Heuristic Bot run
runTest('Bot heurístico completa transiciones de Guardia Infinita sin violar invariantes', () => {
  let run = startNewRun('endless', 2026);
  for (let round = 0; round < 3; round++) {
    let state = run.duelState;
    for (let turn = 0; turn < 12 && state.rivalLp > 0 && state.playerLp > 0; turn++) {
      // Play affordable cards greedily
      for (const card of [...state.hand]) {
        const check = validateDuelCommand(state, {
          type: 'PLAY_CARD',
          cardUid: card.uid,
          targetLane:
            card.kind === 'Unidad'
              ? state.playerSlots.findIndex((s) => s === null)
              : card.targetMode === 'enemy'
                ? state.enemySlots.findIndex(Boolean)
                : card.targetMode === 'ally'
                  ? state.playerSlots.findIndex(Boolean)
                  : undefined,
        });
        if (check.valid) {
          state = resolvePlayCard(
            state,
            card.uid,
            card.kind === 'Unidad'
              ? state.playerSlots.findIndex((s) => s === null)
              : card.targetMode === 'enemy'
                ? state.enemySlots.findIndex(Boolean)
                : card.targetMode === 'ally'
                  ? state.playerSlots.findIndex(Boolean)
                  : undefined,
            run.rival,
          ).nextState;
        }
      }

      // Move / skill check coverage
      if (state.playerSlots[0] && state.playerSlots[1] === null && state.freeMovesLeft > 0) {
        const mv = resolveMoveUnit(state, 0, 1);
        if (!mv.error) state = mv.nextState;
      }
      state.playerSlots.forEach((u, lane) => {
        if (u?.activeSkillCost && state.energy >= u.activeSkillCost) {
          const sk = resolveActivateSkill(state, lane);
          if (!sk.error) state = sk.nextState;
        }
      });

      // Combat phase
      state = { ...state, phase: 'COMBATE' };
      for (let lane = 0; lane < 3; lane++) {
        const ally = state.playerSlots[lane];
        if (!ally || ally.hasAttackedThisTurn || ally.statuses.aturdido) continue;
        const targetEnemy = state.enemySlots.findIndex(Boolean);
        state = resolveManualAttack(
          state,
          lane,
          targetEnemy >= 0 ? targetEnemy : 'direct',
        ).nextState;
        if (state.rivalLp <= 0) break;
      }
      if (state.rivalLp <= 0) break;

      const steps = buildEndTurnSteps(run.rival);
      for (const step of steps) {
        state = step.execute(state).nextState;
      }
      assert.equal(checkDuelInvariants(state).length, 0);
    }

    // Advance guard via victory transition test
    const vic = transitionRunOnVictory({ ...run, duelState: { ...state, rivalLp: 0 } });
    assert.equal(vic.isCampaignComplete, false);
    assert.equal(vic.nextRun.rewardChoices.length, 3);
    run = advanceToNextGuard(vic.nextRun, vic.nextRun.rewardChoices[0]);
    assert.equal(run.guardLevel, round + 2);
  }
});

console.log('ALL DOMAIN & ENDLESS GUARD TESTS PASSED');
