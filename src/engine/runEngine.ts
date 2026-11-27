import {
  createStarterDuelDeck,
  instantiateCard,
  RIVAL_DUELISTS,
  rollRewardChoices,
} from '../data/medicalCards';
import {
  BoardUnit,
  CardInstance,
  DuelCard,
  GameMode,
  OrganId,
  RivalDuelist,
} from '../types/game';
import {
  createBoardUnit,
  drawCardsPure,
  DuelEngineState,
  planRivalIntent,
} from './combatEngine';
import { generateProceduralEncounter } from './encounterGenerator';
import { rngShuffle } from './rng';

export const PLAYER_MAX_LP = 4000;
export const INITIAL_ENERGY = 4;
export const HAND_SIZE = 5;

export interface RunState {
  version: number;
  mode: GameMode;
  runId: string;
  seed: number;
  rngState: number;
  idSequence: number;
  guardLevel: number;
  duelsWon: number;
  playerLp: number;
  playerMaxLp: number;
  masterDeck: CardInstance[];
  rival: RivalDuelist;
  duelState: DuelEngineState;
  rewardChoices: DuelCard[];
  cardsPlayedCount: number;
  turnsElapsed: number;
}

/**
 * Fórmula de recuperación aprobada para Guardia Infinita (A04):
 * min(maxLP, LP + max(1000, floor((maxLP - LP) * 0.5))) una vez por victoria.
 */
export function computeVictoryRecovery(
  currentLp: number,
  maxLp: number,
): { nextLp: number; recoveredAmount: number } {
  const missing = Math.max(0, maxLp - currentLp);
  const recovery = Math.max(1000, Math.floor(missing * 0.5));
  const nextLp = Math.min(maxLp, currentLp + recovery);
  return {
    nextLp,
    recoveredAmount: Math.max(0, nextLp - currentLp),
  };
}

export function createDuelStateForEncounter(
  rival: RivalDuelist,
  masterDeck: CardInstance[],
  startingPlayerLp: number,
  playerMaxLp: number,
  rngState: number,
  idSequence: number,
): DuelEngineState {
  // Fresh combat instances cloned from masterDeck without mutating masterDeck
  const combatCards = masterDeck.map((c) => ({ ...c }));
  const shuffled = rngShuffle(rngState, combatCards);
  const drawRes = drawCardsPure(HAND_SIZE, shuffled.items, [], shuffled.nextState);

  let seq = idSequence;
  const createdOpening = createBoardUnit(
    rival.deck[0],
    1,
    true,
    seq,
    rival,
    true,
  );
  seq = createdOpening.nextIdSeq;

  const enemySlots: Array<BoardUnit | null> = [null, createdOpening.unit, null];
  const playerSlots: Array<BoardUnit | null> = [null, null, null];

  const intentRes = planRivalIntent(
    rival,
    enemySlots,
    playerSlots,
    drawRes.nextRngState,
    1,
  );

  return {
    turn: 1,
    phase: 'PREPARACION',
    playerLp: startingPlayerLp,
    playerMaxLp,
    rivalLp: rival.startingLp,
    rivalMaxLp: rival.startingLp,
    energy: INITIAL_ENERGY,
    maxEnergy: INITIAL_ENERGY,
    freeMovesLeft: rival.organId === 'pulmon' ? 2 : 1,
    nextTurnEnergyPenalty: 0,
    organId: rival.organId,
    playerSlots,
    enemySlots,
    armedTraps: [],
    hand: drawRes.drawn,
    drawPile: drawRes.nextDraw,
    discardPile: drawRes.nextDiscard,
    rivalIntent: intentRes.intent,
    rngState: intentRes.nextRngState,
    idSequence: seq,
  };
}

export function startNewRun(
  mode: GameMode,
  seed: number,
): RunState {
  const starter = createStarterDuelDeck(1);
  let rng = seed;
  let rival: RivalDuelist;

  if (mode === 'classic') {
    rival = RIVAL_DUELISTS[0];
  } else {
    const gen = generateProceduralEncounter(1, rng);
    rival = gen.rival;
    rng = gen.nextRngState;
  }

  const duelState = createDuelStateForEncounter(
    rival,
    starter.deck,
    PLAYER_MAX_LP,
    PLAYER_MAX_LP,
    rng,
    starter.nextSeq,
  );

  return {
    version: 3,
    mode,
    runId: `run-${seed}`,
    seed,
    rngState: duelState.rngState,
    idSequence: duelState.idSequence,
    guardLevel: 1,
    duelsWon: 0,
    playerLp: PLAYER_MAX_LP,
    playerMaxLp: PLAYER_MAX_LP,
    masterDeck: starter.deck,
    rival,
    duelState,
    rewardChoices: [],
    cardsPlayedCount: 0,
    turnsElapsed: 0,
  };
}

export function transitionRunOnVictory(run: RunState): {
  nextRun: RunState;
  isCampaignComplete: boolean;
  recoveredLp: number;
} {
  const nextWon = run.duelsWon + 1;
  const currentLp = run.duelState.playerLp;

  if (run.mode === 'classic' && nextWon >= RIVAL_DUELISTS.length) {
    return {
      nextRun: {
        ...run,
        duelsWon: nextWon,
        playerLp: currentLp,
        rewardChoices: [],
      },
      isCampaignComplete: true,
      recoveredLp: 0,
    };
  }

  let nextLp = PLAYER_MAX_LP;
  let recoveredLp = 0;
  if (run.mode === 'endless') {
    const rec = computeVictoryRecovery(currentLp, run.playerMaxLp);
    nextLp = rec.nextLp;
    recoveredLp = rec.recoveredAmount;
  }

  const rolled = rollRewardChoices(
    run.guardLevel,
    run.masterDeck,
    run.duelState.rngState,
  );

  return {
    nextRun: {
      ...run,
      duelsWon: nextWon,
      playerLp: nextLp,
      rngState: rolled.nextRngState,
      idSequence: run.duelState.idSequence,
      rewardChoices: rolled.choices,
    },
    isCampaignComplete: false,
    recoveredLp,
  };
}

export function advanceToNextGuard(
  run: RunState,
  chosenReward: DuelCard | null,
): RunState {
  let nextMasterDeck = run.masterDeck;
  let seq = run.idSequence;

  if (chosenReward) {
    const inst = instantiateCard(chosenReward, seq);
    nextMasterDeck = [...run.masterDeck, inst.instance];
    seq = inst.nextSeq;
  }

  const nextLevel = run.guardLevel + 1;
  let rng = run.rngState;
  let nextRival: RivalDuelist;

  if (run.mode === 'classic') {
    const idx = Math.min(RIVAL_DUELISTS.length - 1, nextLevel - 1);
    nextRival = RIVAL_DUELISTS[idx];
  } else {
    const prevOrgan: OrganId = run.rival.organId;
    const gen = generateProceduralEncounter(nextLevel, rng, prevOrgan);
    nextRival = gen.rival;
    rng = gen.nextRngState;
  }

  const nextDuelState = createDuelStateForEncounter(
    nextRival,
    nextMasterDeck,
    run.mode === 'classic' ? PLAYER_MAX_LP : run.playerLp,
    run.playerMaxLp,
    rng,
    seq,
  );

  return {
    ...run,
    guardLevel: nextLevel,
    masterDeck: nextMasterDeck,
    rival: nextRival,
    duelState: nextDuelState,
    rngState: nextDuelState.rngState,
    idSequence: nextDuelState.idSequence,
    rewardChoices: [],
  };
}
