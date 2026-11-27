import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { CardInspectorModal } from './components/CardInspectorModal';
import { EndModals } from './components/EndModals';
import { GameHUD } from './components/GameHUD';
import { MedicalTableCanvas, SlotAnchorDomRefs } from './components/MedicalTableCanvas';
import { TitleScreen } from './components/TitleScreen';
import {
  createStarterDuelDeck,
  instantiateCard,
  PLAYER_DECK_CARDS,
  REWARD_CARD_POOL,
  RIVAL_DUELISTS,
  shuffleCards,
} from './data/medicalCards';
import {
  buildEndTurnSteps,
  canEndTurn,
  canPlayCard,
  createBoardUnit,
  drawCardsPure,
  DuelEngineState,
  getPendingAttackers,
  planRivalIntent,
  resolveActivateSkill,
  resolveManualAttack,
  resolveMoveUnit,
  resolvePlayCard,
} from './engine/combatEngine';
import {
  BoardUnit,
  CameraPreset,
  CardInstance,
  CombatEvent,
  CombatLogEntry,
  DuelCard,
  DuelTelemetry,
  GameState,
  MedicalClass,
  TurnPhase,
} from './types/game';

const PLAYER_MAX_LP = 4000;
const INITIAL_ENERGY = 4;
const HAND_SIZE = 5;

function createInitialEngineState(
  rivalIdx: number,
  deck: CardInstance[],
): DuelEngineState {
  const rival = RIVAL_DUELISTS[rivalIdx];
  const shuffled = shuffleCards(deck);
  const { drawn, nextDraw, nextDiscard } = drawCardsPure(HAND_SIZE, shuffled, []);

  const openingUnit = createBoardUnit(rival.deck[0], 1, true);
  const enemySlots: Array<BoardUnit | null> = [null, openingUnit, null];
  const playerSlots: Array<BoardUnit | null> = [null, null, null];

  return {
    turn: 1,
    playerLp: PLAYER_MAX_LP,
    playerMaxLp: PLAYER_MAX_LP,
    rivalLp: rival.startingLp,
    rivalMaxLp: rival.startingLp,
    energy: INITIAL_ENERGY,
    maxEnergy: INITIAL_ENERGY,
    freeMovesLeft: 1,
    playerSlots,
    enemySlots,
    hand: drawn,
    drawPile: nextDraw,
    discardPile: nextDiscard,
    rivalIntent: planRivalIntent(rival, enemySlots, playerSlots),
  };
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [rivalIndex, setRivalIndex] = useState(0);
  const [phase, setPhase] = useState<TurnPhase>('PREPARACION');
  const [duelsWon, setDuelsWon] = useState(0);
  const [cardsPlayedCount, setCardsPlayedCount] = useState(0);
  const [turnsElapsed, setTurnsElapsed] = useState(0);

  const [masterDeck, setMasterDeck] = useState<CardInstance[]>(() =>
    createStarterDuelDeck(),
  );
  const [engineState, setEngineState] = useState<DuelEngineState>(() =>
    createInitialEngineState(0, createStarterDuelDeck()),
  );
  const engineRef = useRef<DuelEngineState>(engineState);

  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [movingFromLane, setMovingFromLane] = useState<number | null>(null);
  const [selectedAttackerLane, setSelectedAttackerLane] = useState<number | null>(
    null,
  );
  const [isResolvingTurn, setIsResolvingTurn] = useState(false);
  const [inspectedCard, setInspectedCard] = useState<DuelCard | null>(null);
  const [lastFeedback, setLastFeedback] = useState(
    'Fase de Preparación: elige cartas para desplegar o tratar.',
  );
  const [logs, setLogs] = useState<CombatLogEntry[]>([]);
  const [tutorialStep, setTutorialStep] = useState<number | null>(1);

  const [rewardChoices, setRewardChoices] = useState<DuelCard[]>([]);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [muted, setMuted] = useState(false);

  const [activeCombatEvent, setActiveCombatEvent] = useState<CombatEvent | null>(
    null,
  );
  const [playedCardMeta, setPlayedCardMeta] = useState<{
    nonce: number;
    medicalClass: MedicalClass;
    name: string;
  } | null>(null);

  const timersRef = useRef<number[]>([]);
  const metaNonceRef = useRef(1);
  const slotAnchorRefs = useRef<SlotAnchorDomRefs>({
    player: [null, null, null],
    enemy: [null, null, null],
  });

  const currentRival = RIVAL_DUELISTS[rivalIndex] ?? RIVAL_DUELISTS[0];

  const syncEngineState = useCallback((next: DuelEngineState) => {
    engineRef.current = next;
    setEngineState(next);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const appendEventsToFeed = useCallback(
    (events: CombatEvent[], turnNum: number) => {
      if (events.length === 0) return;

      const latest = events[events.length - 1];
      setActiveCombatEvent(latest);
      soundEngine.playAnimationEvent(latest.animKind, latest.isCritical);
      setLastFeedback(latest.logText);

      setLogs((prev) => [
        ...events
          .slice()
          .reverse()
          .map((e) => ({
            id: e.id,
            turn: turnNum,
            text: e.logText,
            category: e.logCategory,
          })),
        ...prev.slice(0, 40),
      ]);
    },
    [],
  );

  const checkDuelOutcome = useCallback(
    (state: DuelEngineState, activeRivalIdx: number): boolean => {
      if (state.rivalLp <= 0) {
        clearTimers();
        soundEngine.playCaseStabilized();
        const won = activeRivalIdx + 1;
        setDuelsWon(won);
        if (won >= RIVAL_DUELISTS.length) {
          setGameState('VICTORY');
        } else {
          setRewardChoices(shuffleCards(REWARD_CARD_POOL).slice(0, 3));
          setGameState('ROUND_SUMMARY');
        }
        return true;
      }
      if (state.playerLp <= 0) {
        clearTimers();
        soundEngine.playInvalidAction();
        setGameState('GAME_OVER');
        return true;
      }
      return false;
    },
    [clearTimers],
  );

  const startDuelRound = useCallback(
    (targetIdx: number, deck: CardInstance[], keepTutorial: boolean) => {
      clearTimers();
      const fresh = createInitialEngineState(targetIdx, deck);
      setRivalIndex(targetIdx);
      setPhase('PREPARACION');
      setSelectedCardUid(null);
      setMovingFromLane(null);
      setSelectedAttackerLane(null);
      setIsResolvingTurn(false);
      setInspectedCard(null);
      setLogs([]);
      syncEngineState(fresh);
      setLastFeedback(
        `Duelo contra ${RIVAL_DUELISTS[targetIdx].name}. Despliega en los 3 carriles.`,
      );
      if (!keepTutorial) setTutorialStep(null);
      setGameState('PLAYING');
    },
    [clearTimers, syncEngineState],
  );

  const startNewCampaign = useCallback(() => {
    const freshDeck = createStarterDuelDeck();
    setMasterDeck(freshDeck);
    setDuelsWon(0);
    setCardsPlayedCount(0);
    setTurnsElapsed(0);
    setTutorialStep(1);
    setCameraPreset('overview');
    soundEngine.playStartShift();
    startDuelRound(0, freshDeck, true);
  }, [startDuelRound]);

  const selectedCard = useMemo(
    () => engineState.hand.find((c) => c.uid === selectedCardUid) ?? null,
    [engineState.hand, selectedCardUid],
  );

  const pendingAttackerLanes = useMemo(
    () => canEndTurn(engineState).pendingLanes,
    [engineState],
  );

  const executeCardPlay = useCallback(
    (card: CardInstance, targetLane?: number) => {
      const { nextState, events } = resolvePlayCard(
        engineRef.current,
        card.uid,
        targetLane,
      );
      syncEngineState(nextState);
      setSelectedCardUid(null);
      setMovingFromLane(null);
      setCardsPlayedCount((c) => c + 1);
      setPlayedCardMeta({
        nonce: metaNonceRef.current++,
        medicalClass: card.medicalClass,
        name: card.name,
      });
      appendEventsToFeed(events, nextState.turn);
      if (tutorialStep === 1 || tutorialStep === 2) {
        setTutorialStep(3);
      }
      checkDuelOutcome(nextState, rivalIndex);
    },
    [
      syncEngineState,
      appendEventsToFeed,
      tutorialStep,
      checkDuelOutcome,
      rivalIndex,
    ],
  );

  const handleCardClick = useCallback(
    (uid: string) => {
      if (gameState !== 'PLAYING' || phase !== 'PREPARACION') return;

      const check = canPlayCard(engineRef.current, uid);
      const card = engineRef.current.hand.find((c) => c.uid === uid);
      if (!card) return;

      if (!check.valid) {
        soundEngine.playInvalidAction();
        setLastFeedback(check.reason ?? 'No puedes usar esta carta ahora.');
        return;
      }

      setMovingFromLane(null);

      if (selectedCardUid === uid) {
        setSelectedCardUid(null);
        return;
      }

      if (card.targetMode === 'none') {
        executeCardPlay(card);
        return;
      }

      setSelectedCardUid(uid);
      if (tutorialStep === 1) setTutorialStep(2);

      if (card.kind === 'Unidad') {
        setLastFeedback(
          `Elige un carril aliado vacío para desplegar ${card.name}.`,
        );
      } else if (card.targetMode === 'ally') {
        setLastFeedback(
          `Elige una unidad aliada en el campo para aplicar ${card.name}.`,
        );
      } else {
        setLastFeedback(
          `Elige un patógeno rival para aplicar ${card.name}.`,
        );
      }
    },
    [gameState, phase, selectedCardUid, executeCardPlay, tutorialStep],
  );

  const handleSelectPlayerLane = useCallback(
    (lane: number) => {
      if (gameState !== 'PLAYING' || isResolvingTurn) return;

      // In Combat phase: select an allied unit that hasn't attacked yet as attacker
      if (phase === 'COMBATE') {
        const ally = engineRef.current.playerSlots[lane];
        if (!ally) return;
        if (ally.statuses.aturdido) {
          soundEngine.playInvalidAction();
          setLastFeedback(`${ally.name} está aturdido y no puede atacar este turno.`);
          return;
        }
        if (ally.hasAttackedThisTurn) {
          soundEngine.playInvalidAction();
          setLastFeedback(`${ally.name} ya atacó en este turno.`);
          return;
        }
        soundEngine.playCardHover();
        setSelectedAttackerLane(lane);
        setLastFeedback(
          `Atacante: ${ally.name}. Toca un patógeno rival en la arena para atacar.`,
        );
        return;
      }

      if (phase !== 'PREPARACION') return;

      // 1. Repositioning unit
      if (movingFromLane !== null) {
        const res = resolveMoveUnit(engineRef.current, movingFromLane, lane);
        if (res.error) {
          soundEngine.playInvalidAction();
          setLastFeedback(res.error);
          return;
        }
        syncEngineState(res.nextState);
        setMovingFromLane(null);
        appendEventsToFeed(res.events, res.nextState.turn);
        return;
      }

      // 2. Summoning or Ally Buff Card
      if (selectedCard) {
        if (
          selectedCard.kind === 'Unidad' &&
          engineRef.current.playerSlots[lane] === null
        ) {
          executeCardPlay(selectedCard, lane);
        } else if (
          selectedCard.targetMode === 'ally' &&
          engineRef.current.playerSlots[lane] !== null
        ) {
          executeCardPlay(selectedCard, lane);
        }
      }
    },
    [
      gameState,
      isResolvingTurn,
      phase,
      movingFromLane,
      selectedCard,
      syncEngineState,
      appendEventsToFeed,
      executeCardPlay,
    ],
  );

  const advanceNextAttacker = useCallback((state: DuelEngineState) => {
    const nextPending = getPendingAttackers(state);
    if (nextPending.length > 0) {
      setSelectedAttackerLane(nextPending[0].laneIndex);
    } else {
      setSelectedAttackerLane(null);
    }
  }, []);

  const handleSelectEnemyLane = useCallback(
    (lane: number) => {
      if (gameState !== 'PLAYING' || isResolvingTurn) return;

      // In Combat phase: execute manual attack with selectedAttackerLane onto target enemy
      if (phase === 'COMBATE') {
        if (selectedAttackerLane === null) {
          soundEngine.playInvalidAction();
          setLastFeedback('Primero selecciona una unidad aliada lista para atacar.');
          return;
        }
        const res = resolveManualAttack(
          engineRef.current,
          selectedAttackerLane,
          lane,
        );
        if (res.error) {
          soundEngine.playInvalidAction();
          setLastFeedback(res.error);
          return;
        }
        syncEngineState(res.nextState);
        appendEventsToFeed(res.events, res.nextState.turn);
        if (checkDuelOutcome(res.nextState, rivalIndex)) return;
        advanceNextAttacker(res.nextState);
        return;
      }

      if (phase !== 'PREPARACION') return;
      if (
        selectedCard &&
        selectedCard.targetMode === 'enemy' &&
        engineRef.current.enemySlots[lane] !== null
      ) {
        executeCardPlay(selectedCard, lane);
      }
    },
    [
      gameState,
      isResolvingTurn,
      phase,
      selectedAttackerLane,
      selectedCard,
      syncEngineState,
      appendEventsToFeed,
      checkDuelOutcome,
      rivalIndex,
      advanceNextAttacker,
      executeCardPlay,
    ],
  );

  const handleDirectAttack = useCallback(() => {
    if (
      gameState !== 'PLAYING' ||
      phase !== 'COMBATE' ||
      isResolvingTurn ||
      selectedAttackerLane === null
    ) {
      return;
    }
    const res = resolveManualAttack(
      engineRef.current,
      selectedAttackerLane,
      'direct',
    );
    if (res.error) {
      soundEngine.playInvalidAction();
      setLastFeedback(res.error);
      return;
    }
    syncEngineState(res.nextState);
    appendEventsToFeed(res.events, res.nextState.turn);
    if (checkDuelOutcome(res.nextState, rivalIndex)) return;
    advanceNextAttacker(res.nextState);
  }, [
    gameState,
    phase,
    isResolvingTurn,
    selectedAttackerLane,
    syncEngineState,
    appendEventsToFeed,
    checkDuelOutcome,
    rivalIndex,
    advanceNextAttacker,
  ]);

  const handleStartMoveUnit = useCallback(
    (lane: number) => {
      if (gameState !== 'PLAYING' || phase !== 'PREPARACION' || isResolvingTurn) return;
      setSelectedCardUid(null);
      if (movingFromLane === lane) {
        setMovingFromLane(null);
        return;
      }
      setMovingFromLane(lane);
      setLastFeedback('Toca un carril iluminado en la arena para reposicionar.');
    },
    [gameState, phase, isResolvingTurn, movingFromLane],
  );

  const handleActivateSkill = useCallback(
    (lane: number) => {
      if (gameState !== 'PLAYING' || phase !== 'PREPARACION' || isResolvingTurn) return;
      const res = resolveActivateSkill(engineRef.current, lane);
      if (res.error) {
        soundEngine.playInvalidAction();
        setLastFeedback(res.error);
        return;
      }
      syncEngineState(res.nextState);
      appendEventsToFeed(res.events, res.nextState.turn);
      checkDuelOutcome(res.nextState, rivalIndex);
    },
    [
      gameState,
      phase,
      isResolvingTurn,
      syncEngineState,
      appendEventsToFeed,
      checkDuelOutcome,
      rivalIndex,
    ],
  );

  const handleInspectUnit = useCallback((unit: BoardUnit) => {
    const template =
      PLAYER_DECK_CARDS.find((c) => c.id === unit.cardId) ??
      REWARD_CARD_POOL.find((c) => c.id === unit.cardId);

    if (template) {
      setInspectedCard(template);
    } else {
      setInspectedCard({
        id: unit.cardId,
        code: 'PAT',
        name: unit.name,
        kind: 'Unidad',
        medicalClass: unit.medicalClass,
        subtype: unit.subtype,
        archetype: unit.archetype,
        cost: 0,
        atk: unit.atk,
        maxHp: unit.maxHp,
        ability: unit.ability,
        abilityLabel: unit.abilityLabel,
        targetMode: 'none',
        effectTag: 'summon',
        shortRule: unit.shortRule,
        medicalBasis: unit.medicalBasis,
        gameSimplification: 'Entidad patógena controlada por la IA del brote.',
        synergies: 'Exploitable mediante fármacos dirigidos y opsonización.',
        counterEffects: 'Ataca su carril si queda sin defensa.',
      });
    }
  }, []);

  const executeEndTurnSequence = useCallback(() => {
    clearTimers();
    setIsResolvingTurn(true);
    setSelectedCardUid(null);
    setMovingFromLane(null);
    setSelectedAttackerLane(null);
    if (tutorialStep !== null) setTutorialStep(null);

    const steps = buildEndTurnSteps(currentRival);
    let stepCursor = 0;

    const runNextStep = () => {
      if (stepCursor >= steps.length) {
        setTurnsElapsed((t) => t + 1);
        setIsResolvingTurn(false);
        setPhase('PREPARACION');
        setLastFeedback(
          `Turno ${engineRef.current.turn}: ${engineRef.current.energy} PA disponibles.`,
        );
        return;
      }

      const step = steps[stepCursor++];
      setPhase(step.phase);

      const { nextState, events } = step.execute(engineRef.current);
      syncEngineState(nextState);

      if (events.length > 0) {
        appendEventsToFeed(events, nextState.turn);
      }

      if (checkDuelOutcome(nextState, rivalIndex)) {
        setIsResolvingTurn(false);
        return;
      }

      const delay = events.length > 0 ? 520 : 40;
      const tid = window.setTimeout(runNextStep, delay);
      timersRef.current.push(tid);
    };

    runNextStep();
  }, [
    clearTimers,
    tutorialStep,
    currentRival,
    syncEngineState,
    appendEventsToFeed,
    checkDuelOutcome,
    rivalIndex,
  ]);

  const handlePhaseAction = useCallback(() => {
    if (gameState !== 'PLAYING' || isResolvingTurn || phase === 'TURNO_RIVAL') {
      return;
    }

    if (phase === 'PREPARACION') {
      const pending = getPendingAttackers(engineRef.current);
      if (pending.length > 0) {
        setSelectedCardUid(null);
        setMovingFromLane(null);
        setPhase('COMBATE');
        setSelectedAttackerLane(pending[0].laneIndex);
        soundEngine.playCardHover();
        setLastFeedback(
          `Fase de Combate: selecciona un patógeno rival para atacar con ${pending[0].name}.`,
        );
        return;
      }
      // No allied units on field -> go straight to end-turn sequence
      executeEndTurnSequence();
      return;
    }

    // In COMBATE phase: strictly block ending the turn if any unit hasn't attacked
    const guard = canEndTurn(engineRef.current);
    if (!guard.allowed) {
      soundEngine.playInvalidAction();
      setSelectedAttackerLane(guard.pendingLanes[0]);
      setLastFeedback(
        guard.reason ??
          'Debes atacar con tus unidades pendientes antes de finalizar el turno.',
      );
      return;
    }

    executeEndTurnSequence();
  }, [gameState, isResolvingTurn, phase, executeEndTurnSequence]);

  const handlePickReward = useCallback(
    (reward: DuelCard) => {
      const updated = [...masterDeck, instantiateCard(reward)];
      setMasterDeck(updated);
      startDuelRound(rivalIndex + 1, updated, false);
    },
    [masterDeck, startDuelRound, rivalIndex],
  );

  const handleSkipReward = useCallback(() => {
    startDuelRound(rivalIndex + 1, masterDeck, false);
  }, [startDuelRound, rivalIndex, masterDeck]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const cycleCameraPreset = useCallback(() => {
    const order: CameraPreset[] = ['overview', 'heart', 'instruments'];
    setCameraPreset((prev) => order[(order.indexOf(prev) + 1) % order.length]);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (inspectedCard) {
        if (e.key === 'Escape') setInspectedCard(null);
        return;
      }

      if (gameState === 'TITLE_MENU') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewCampaign();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (selectedCardUid || movingFromLane !== null) {
          setSelectedCardUid(null);
          setMovingFromLane(null);
          return;
        }
        if (gameState === 'PLAYING') setGameState('PAUSED');
        else if (gameState === 'PAUSED') setGameState('PLAYING');
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
        return;
      }

      if (gameState !== 'PLAYING') return;

      if (e.key === 'h' || e.key === 'H') {
        cycleCameraPreset();
        return;
      }

      if (e.key === ' ' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handlePhaseAction();
        return;
      }

      const num = Number(e.key);
      if (num >= 1 && num <= 6) {
        const card = engineRef.current.hand[num - 1];
        if (card) handleCardClick(card.uid);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    inspectedCard,
    gameState,
    startNewCampaign,
    selectedCardUid,
    movingFromLane,
    handleToggleMute,
    cycleCameraPreset,
    handlePhaseAction,
    handleCardClick,
  ]);

  const liveTelemetry: DuelTelemetry = useMemo(() => {
    const lpRatio = engineState.playerLp / engineState.playerMaxLp;
    const bpm = Math.round(74 + (1 - lpRatio) * 68);
    const spo2 = Math.max(85, Math.round(99 - (1 - lpRatio) * 11));
    const isPrep = phase === 'PREPARACION';

    return {
      playerLp: engineState.playerLp,
      playerMaxLp: engineState.playerMaxLp,
      rivalLp: engineState.rivalLp,
      rivalMaxLp: engineState.rivalMaxLp,
      rivalName: currentRival.name,
      phase,
      playerSlots: engineState.playerSlots,
      enemySlots: engineState.enemySlots,
      selectedAttackerLane,
      selectingSummonOrMove:
        isPrep && (selectedCard?.kind === 'Unidad' || movingFromLane !== null),
      selectingAllyTarget: isPrep && selectedCard?.targetMode === 'ally',
      selectingEnemyTarget: isPrep && selectedCard?.targetMode === 'enemy',
      bpm,
      spo2,
      isCritical: engineState.playerLp <= 1200,
      gameState,
    };
  }, [
    engineState,
    currentRival.name,
    phase,
    selectedAttackerLane,
    selectedCard,
    movingFromLane,
    gameState,
  ]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#081018]">
      <MedicalTableCanvas
        telemetry={liveTelemetry}
        cameraPreset={cameraPreset}
        activeCombatEvent={activeCombatEvent}
        playedCardMeta={playedCardMeta}
        slotAnchorRefs={slotAnchorRefs}
        onClickPlayerSlot={handleSelectPlayerLane}
        onClickEnemySlot={handleSelectEnemyLane}
        onInspectHeart={() => {
          soundEngine.playCardHover();
          setCameraPreset((prev) => (prev === 'heart' ? 'overview' : 'heart'));
          setLastFeedback(
            `Telemetría cardiaca · FC ${liveTelemetry.bpm} lpm · SpO2 ${liveTelemetry.spo2}%.`,
          );
        }}
        onClickDeck={() => {
          soundEngine.playCardHover();
          setLastFeedback(
            `Mazo: ${engineState.drawPile.length} cartas · Descarte: ${engineState.discardPile.length}.`,
          );
        }}
      />

      {gameState === 'TITLE_MENU' && (
        <TitleScreen onStart={startNewCampaign} />
      )}

      {gameState !== 'TITLE_MENU' && (
        <GameHUD
          engineState={engineState}
          rival={currentRival}
          totalRivals={RIVAL_DUELISTS.length}
          phase={phase}
          selectedCard={selectedCard}
          movingFromLane={movingFromLane}
          selectedAttackerLane={selectedAttackerLane}
          pendingAttackerLanes={pendingAttackerLanes}
          isResolvingTurn={isResolvingTurn}
          lastFeedback={lastFeedback}
          logs={logs}
          tutorialStep={tutorialStep}
          cameraPreset={cameraPreset}
          muted={muted}
          slotAnchorRefs={slotAnchorRefs}
          onCardClick={handleCardClick}
          onInspectCard={(card) => setInspectedCard(card)}
          onInspectUnit={handleInspectUnit}
          onCancelSelection={() => {
            setSelectedCardUid(null);
            setMovingFromLane(null);
          }}
          onSelectPlayerLane={handleSelectPlayerLane}
          onSelectEnemyLane={handleSelectEnemyLane}
          onDirectAttack={handleDirectAttack}
          onStartMoveUnit={handleStartMoveUnit}
          onActivateSkill={handleActivateSkill}
          onPhaseAction={handlePhaseAction}
          onDismissTutorial={() => setTutorialStep(null)}
          onChangeCamera={setCameraPreset}
          onToggleMute={handleToggleMute}
          onPause={() => setGameState('PAUSED')}
        />
      )}

      <EndModals
        gameState={gameState}
        rival={currentRival}
        totalRivals={RIVAL_DUELISTS.length}
        rewardChoices={rewardChoices}
        duelsWon={duelsWon}
        cardsPlayedCount={cardsPlayedCount}
        turnsElapsed={turnsElapsed}
        onResume={() => setGameState('PLAYING')}
        onPickReward={handlePickReward}
        onSkipReward={handleSkipReward}
        onInspectCard={(card) => setInspectedCard(card)}
        onRestart={startNewCampaign}
      />

      <CardInspectorModal
        card={inspectedCard}
        onClose={() => setInspectedCard(null)}
      />
    </main>
  );
}
