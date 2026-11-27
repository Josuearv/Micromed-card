import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { CardInspectorModal } from './components/CardInspectorModal';
import { DeckModal } from './components/DeckModal';
import { EndModals } from './components/EndModals';
import { GameHUD } from './components/GameHUD';
import {
  MedicalTableCanvas,
  SlotAnchorDomRefs,
} from './components/MedicalTableCanvas';
import { TitleScreen } from './components/TitleScreen';
import { ALL_PLAYER_CARDS_MAP, RIVAL_DUELISTS } from './data/medicalCards';
import { ORGAN_PROFILES } from './data/organs';
import {
  canEndTurn,
  canPlayCard,
  DuelEngineState,
  getPendingAttackers,
  resolveActivateSkill,
  resolveEndTurn,
  resolveManualAttack,
  resolveMoveUnit,
  resolvePlayCard,
} from './engine/combatEngine';
import {
  advanceToNextGuard,
  RunState,
  startNewRun,
  transitionRunOnVictory,
} from './engine/runEngine';
import {
  loadBestGuardRecord,
  loadPreferences,
  loadRunSnapshot,
  RunCheckpoint,
  savePreferences,
  saveRunSnapshot,
  updateBestGuardRecord,
} from './game/persistence';
import { ModalLayer, useModalFocus } from './game/useModalFocus';
import {
  BoardUnit,
  CameraPreset,
  CardInstance,
  CombatEvent,
  CombatLogEntry,
  DuelCard,
  DuelTelemetry,
  GameMode,
  GameState,
  MedicalClass,
  RunPreferences,
  SpeedMode,
} from './types/game';

const SPEED_DELAY_MS: Record<SpeedMode, number> = {
  normal: 520,
  fast: 240,
  reduced: 60,
};

type TurnPlayback = {
  frames: NonNullable<ReturnType<typeof resolveEndTurn>>['frames'];
  cursor: number;
  checkpoint: RunCheckpoint;
};

function withDuel(run: RunState, duelState: DuelEngineState): RunState {
  return { ...run, duelState, rngState: duelState.rngState,
    idSequence: duelState.idSequence, playerLp: duelState.playerLp };
}

function duelCheckpoint(run: RunState): RunCheckpoint {
  if (run.duelState.rivalLp <= 0) {
    const outcome = transitionRunOnVictory(run);
    return {
      run: outcome.nextRun,
      inRoundSummary: !outcome.isCampaignComplete,
      recoveredLp: outcome.recoveredLp,
      terminal: outcome.isCampaignComplete ? 'VICTORY' : undefined,
    };
  }
  return {
    run,
    inRoundSummary: false,
    recoveredLp: 0,
    terminal: run.duelState.playerLp <= 0 ? 'GAME_OVER' : undefined,
  };
}

export default function App() {
  const [prefs, setPrefs] = useState<RunPreferences>(() => {
    const loaded = loadPreferences();
    soundEngine.setMuted(loaded.muted);
    return loaded;
  });
  const [bestGuardLevel, setBestGuardLevel] = useState<number>(() =>
    loadBestGuardRecord(),
  );
  const [savedRun, setSavedRun] = useState(loadRunSnapshot);
  const [pendingSave, setPendingSave] = useState<{ checkpoint: RunCheckpoint; recordOnly?: boolean } | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [runState, setRunState] = useState<RunState>(() =>
    startNewRun('endless', Date.now() >>> 0),
  );
  const runRef = useRef<RunState>(runState);
  const [recoveredLp, setRecoveredLp] = useState(0);

  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [movingFromLane, setMovingFromLane] = useState<number | null>(null);
  const [selectedAttackerLane, setSelectedAttackerLane] = useState<number | null>(
    null,
  );
  const [isResolvingTurn, setIsResolvingTurn] = useState(false);
  const [inspectedCard, setInspectedCard] = useState<DuelCard | null>(null);
  const [deckModalOpen, setDeckModalOpen] = useState(false);
  const [lastFeedback, setLastFeedback] = useState(
    'Fase de Preparación: elige cartas para desplegar o tratar.',
  );
  const [logs, setLogs] = useState<CombatLogEntry[]>([]);
  const [tutorialStep, setTutorialStep] = useState<number | null>(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const topModal: ModalLayer | null = inspectedCard ? 'inspector' : deckModalOpen ? 'deck'
    : gameState !== 'PLAYING' && gameState !== 'TITLE_MENU' ? 'end' : null;
  const { rootRef, captureTrigger, handleTab } = useModalFocus(topModal);

  const [eventBatch, setEventBatch] = useState<CombatEvent[]>([]);
  const [playedCardMeta, setPlayedCardMeta] = useState<{
    nonce: number;
    medicalClass: MedicalClass;
    name: string;
  } | null>(null);

  const timerRef = useRef<number | null>(null);
  const playbackGenRef = useRef(0);
  const playbackRef = useRef<TurnPlayback | null>(null);
  const metaNonceRef = useRef(1);
  const slotAnchorRefs = useRef<SlotAnchorDomRefs>({
    player: [null, null, null],
    enemy: [null, null, null],
  });

  const engineState = runState.duelState;
  const currentRival = runState.rival;
  const organProfile = ORGAN_PROFILES[currentRival.organId];

  const syncRun = useCallback((next: RunState) => {
    runRef.current = next;
    setRunState(next);
  }, []);

  const persistCheckpoint = useCallback((checkpoint: RunCheckpoint, recordOnly = false) => {
    const { run, inRoundSummary, recoveredLp, terminal } = checkpoint;
    const best = run.mode === 'endless' ? run.duelsWon : 0;
    if (best) setBestGuardLevel((old) => Math.max(old, best));
    if (!recordOnly && !saveRunSnapshot(run, inRoundSummary, recoveredLp, terminal).ok) {
      setPendingSave({ checkpoint });
      return;
    }
    setSavedRun(loadRunSnapshot());
    const record = best ? updateBestGuardRecord(best) : null;
    setPendingSave(record && !record.ok ? { checkpoint, recordOnly: true } : null);
  }, []);

  const updateDuelState = useCallback(
    (
      nextDuel: DuelEngineState,
      extra?: Pick<RunState, 'cardsPlayedCount'>,
    ) => {
      const updated = withDuel({ ...runRef.current, ...extra }, nextDuel);
      syncRun(updated);
      if (nextDuel.playerLp > 0 && nextDuel.rivalLp > 0) {
        persistCheckpoint(duelCheckpoint(updated));
      }
      return updated;
    },
    [persistCheckpoint, syncRun],
  );

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const cancelPlayback = useCallback(() => {
    playbackGenRef.current += 1;
    clearTimers();
  }, [clearTimers]);

  const openDeck = useCallback(() => {
    captureTrigger('deck');
    cancelPlayback();
    setDeckModalOpen(true);
  }, [captureTrigger, cancelPlayback]);

  const inspectCard = useCallback((card: DuelCard) => {
    captureTrigger('inspector');
    cancelPlayback();
    setInspectedCard(card);
  }, [captureTrigger, cancelPlayback]);

  useEffect(() => {
    return () => {
      playbackGenRef.current += 1;
      clearTimers();
    };
  }, [clearTimers]);

  const updatePrefs = useCallback(
    (updater: (prev: RunPreferences) => RunPreferences) => {
      setPrefs((prev) => {
        const next = updater(prev);
        soundEngine.setMuted(next.muted);
        savePreferences(next);
        return next;
      });
    },
    [],
  );

  const appendEventsToFeed = useCallback(
    (events: CombatEvent[], turnNum: number) => {
      if (events.length === 0) return;

      setEventBatch(events);
      const latest = events[events.length - 1];
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

  const showCheckpoint = useCallback((checkpoint: RunCheckpoint) => {
    syncRun(checkpoint.run);
    setRecoveredLp(checkpoint.recoveredLp);
    setGameState(checkpoint.terminal ?? (checkpoint.inRoundSummary ? 'ROUND_SUMMARY' : 'PLAYING'));
  }, [syncRun]);

  const showDuelOutcome = useCallback((checkpoint: RunCheckpoint) => {
    if (checkpoint.terminal === 'GAME_OVER') soundEngine.playInvalidAction();
    else soundEngine.playCaseStabilized();
    showCheckpoint(checkpoint);
  }, [showCheckpoint]);

  const handleVictoryOrDefeat = useCallback((latestRun: RunState) => {
    if (latestRun.duelState.rivalLp > 0 && latestRun.duelState.playerLp > 0) return false;
    const checkpoint = duelCheckpoint(latestRun);
    persistCheckpoint(checkpoint);
    showDuelOutcome(checkpoint);
    return true;
  }, [persistCheckpoint, showDuelOutcome]);

  const startMode = useCallback(
    (mode: GameMode) => {
      cancelPlayback();
      playbackRef.current = null;
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      const fresh = startNewRun(mode, seed || 1);
      syncRun(fresh);
      setRecoveredLp(0);
      setSelectedCardUid(null);
      setMovingFromLane(null);
      setSelectedAttackerLane(null);
      setIsResolvingTurn(false);
      setInspectedCard(null);
      setDeckModalOpen(false);
      setEventBatch([]);
      setLogs([]);
      setTutorialStep(1);
      setCameraPreset('overview');
      setLastFeedback(
        `${
          mode === 'endless' ? `Guardia 1 · ` : 'Duelo 1/3 · '
        }${fresh.rival.name} en ${ORGAN_PROFILES[fresh.rival.organId].shortName}.`,
      );
      persistCheckpoint(duelCheckpoint(fresh));
      soundEngine.playStartShift();
      setGameState('PLAYING');
    },
    [cancelPlayback, persistCheckpoint, syncRun],
  );

  const handleResumeSavedRun = useCallback(() => {
    const loaded = loadRunSnapshot();
    setSavedRun(loaded);
    const snap = pendingSave?.checkpoint ?? loaded.snapshot;
    if (!snap) return;
    cancelPlayback();
    playbackRef.current = null;
    showCheckpoint(snap);
    setSelectedCardUid(null);
    setMovingFromLane(null);
    setSelectedAttackerLane(null);
    setIsResolvingTurn(false);
    setInspectedCard(null);
    setDeckModalOpen(false);
    setEventBatch([]);
    setLogs([]);
    setTutorialStep(null);
    setCameraPreset('overview');
    setLastFeedback(
      `Guardia reanudada: ${snap.run.rival.name} · ${ORGAN_PROFILES[snap.run.rival.organId].shortName}.`,
    );
    soundEngine.playStartShift();
    if (!pendingSave && snap.run.mode === 'endless' && snap.run.duelsWon > 0) {
      persistCheckpoint(snap, true);
      // Keep the recovery notice until a fresh checkpoint is written.
      setSavedRun(loaded);
    }
  }, [cancelPlayback, pendingSave, persistCheckpoint, showCheckpoint]);

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
      const { nextState, events, error } = resolvePlayCard(
        runRef.current.duelState,
        card.uid,
        targetLane,
        runRef.current.rival,
      );
      if (error) {
        soundEngine.playInvalidAction();
        setLastFeedback(error);
        return;
      }

      const updatedRun = updateDuelState(nextState, {
        cardsPlayedCount: runRef.current.cardsPlayedCount + 1,
      });
      setSelectedCardUid(null);
      setMovingFromLane(null);
      setPlayedCardMeta({
        nonce: metaNonceRef.current++,
        medicalClass: card.medicalClass,
        name: card.name,
      });
      appendEventsToFeed(events, nextState.turn);
      if (tutorialStep === 1 || tutorialStep === 2) {
        setTutorialStep(3);
      }
      handleVictoryOrDefeat(updatedRun);
    },
    [updateDuelState, appendEventsToFeed, tutorialStep, handleVictoryOrDefeat],
  );

  const handleCardClick = useCallback(
    (uid: string) => {
      if (
        gameState !== 'PLAYING' ||
        runRef.current.duelState.phase !== 'PREPARACION' ||
        isResolvingTurn
      ) {
        return;
      }

      const duel = runRef.current.duelState;
      const check = canPlayCard(duel, uid);
      const card = duel.hand.find((c) => c.uid === uid);
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

      if (card.targetMode === 'none' || card.targetMode === 'trap_slot') {
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
    [gameState, isResolvingTurn, selectedCardUid, executeCardPlay, tutorialStep],
  );

  const advanceNextAttacker = useCallback((state: DuelEngineState) => {
    const nextPending = getPendingAttackers(state);
    if (nextPending.length > 0) {
      setSelectedAttackerLane(nextPending[0].laneIndex);
    } else {
      setSelectedAttackerLane(null);
    }
  }, []);

  const handleSelectPlayerLane = useCallback(
    (lane: number) => {
      if (gameState !== 'PLAYING' || isResolvingTurn) return;
      const duel = runRef.current.duelState;

      if (duel.phase === 'COMBATE') {
        const ally = duel.playerSlots[lane];
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

      if (duel.phase !== 'PREPARACION') return;

      if (movingFromLane !== null) {
        const res = resolveMoveUnit(duel, movingFromLane, lane);
        if (res.error) {
          soundEngine.playInvalidAction();
          setLastFeedback(res.error);
          return;
        }
        updateDuelState(res.nextState);
        setMovingFromLane(null);
        appendEventsToFeed(res.events, res.nextState.turn);
        return;
      }

      if (selectedCard) {
        if (
          selectedCard.kind === 'Unidad' &&
          duel.playerSlots[lane] === null
        ) {
          executeCardPlay(selectedCard, lane);
        } else if (
          selectedCard.targetMode === 'ally' &&
          duel.playerSlots[lane] !== null
        ) {
          executeCardPlay(selectedCard, lane);
        }
      }
    },
    [
      gameState,
      isResolvingTurn,
      movingFromLane,
      selectedCard,
      updateDuelState,
      appendEventsToFeed,
      executeCardPlay,
    ],
  );

  const handleSelectEnemyLane = useCallback(
    (lane: number) => {
      if (gameState !== 'PLAYING' || isResolvingTurn) return;
      const duel = runRef.current.duelState;

      if (duel.phase === 'COMBATE') {
        if (selectedAttackerLane === null) {
          soundEngine.playInvalidAction();
          setLastFeedback('Primero selecciona una unidad aliada lista para atacar.');
          return;
        }
        const res = resolveManualAttack(duel, selectedAttackerLane, lane);
        if (res.error) {
          soundEngine.playInvalidAction();
          setLastFeedback(res.error);
          return;
        }
        const updatedRun = updateDuelState(res.nextState);
        appendEventsToFeed(res.events, res.nextState.turn);
        if (handleVictoryOrDefeat(updatedRun)) return;
        advanceNextAttacker(res.nextState);
        return;
      }

      if (duel.phase !== 'PREPARACION') return;
      if (
        selectedCard &&
        selectedCard.targetMode === 'enemy' &&
        duel.enemySlots[lane] !== null
      ) {
        executeCardPlay(selectedCard, lane);
      }
    },
    [
      gameState,
      isResolvingTurn,
      selectedAttackerLane,
      selectedCard,
      updateDuelState,
      appendEventsToFeed,
      handleVictoryOrDefeat,
      advanceNextAttacker,
      executeCardPlay,
    ],
  );

  const handleDirectAttack = useCallback(() => {
    const duel = runRef.current.duelState;
    if (
      gameState !== 'PLAYING' ||
      duel.phase !== 'COMBATE' ||
      isResolvingTurn ||
      selectedAttackerLane === null
    ) {
      return;
    }
    const res = resolveManualAttack(duel, selectedAttackerLane, 'direct');
    if (res.error) {
      soundEngine.playInvalidAction();
      setLastFeedback(res.error);
      return;
    }
    const updatedRun = updateDuelState(res.nextState);
    appendEventsToFeed(res.events, res.nextState.turn);
    if (handleVictoryOrDefeat(updatedRun)) return;
    advanceNextAttacker(res.nextState);
  }, [
    gameState,
    isResolvingTurn,
    selectedAttackerLane,
    updateDuelState,
    appendEventsToFeed,
    handleVictoryOrDefeat,
    advanceNextAttacker,
  ]);

  const handleStartMoveUnit = useCallback(
    (lane: number) => {
      if (
        gameState !== 'PLAYING' ||
        runRef.current.duelState.phase !== 'PREPARACION' ||
        isResolvingTurn
      ) {
        return;
      }
      setSelectedCardUid(null);
      if (movingFromLane === lane) {
        setMovingFromLane(null);
        return;
      }
      setMovingFromLane(lane);
      setLastFeedback('Toca un carril iluminado en la arena para reposicionar.');
    },
    [gameState, isResolvingTurn, movingFromLane],
  );

  const handleActivateSkill = useCallback(
    (lane: number) => {
      const duel = runRef.current.duelState;
      if (
        gameState !== 'PLAYING' ||
        duel.phase !== 'PREPARACION' ||
        isResolvingTurn
      ) {
        return;
      }
      const res = resolveActivateSkill(duel, lane);
      if (res.error) {
        soundEngine.playInvalidAction();
        setLastFeedback(res.error);
        return;
      }
      const updatedRun = updateDuelState(res.nextState);
      appendEventsToFeed(res.events, res.nextState.turn);
      handleVictoryOrDefeat(updatedRun);
    },
    [
      gameState,
      isResolvingTurn,
      updateDuelState,
      appendEventsToFeed,
      handleVictoryOrDefeat,
    ],
  );

  const handleInspectUnit = useCallback((unit: BoardUnit) => {
    if (unit.sourceCard) {
      inspectCard(unit.sourceCard);
      return;
    }
    const template = ALL_PLAYER_CARDS_MAP[unit.cardId];
    if (template) {
      inspectCard(template);
    }
  }, [inspectCard]);

  const runPlayback = useCallback((playback: TurnPlayback) => {
    cancelPlayback();
    const generation = playbackGenRef.current;
    const stepDelay = prefs.reducedMotion || prefs.speedMode === 'reduced'
      ? 40
      : SPEED_DELAY_MS[prefs.speedMode];

    const runNextStep = () => {
      if (playbackGenRef.current !== generation) return;
      if (playback.cursor >= playback.frames.length) {
        timerRef.current = null;
        playbackRef.current = null;
        setIsResolvingTurn(false);
        const { checkpoint } = playback;
        if (checkpoint.terminal || checkpoint.inRoundSummary) {
          showDuelOutcome(checkpoint);
        } else {
          showCheckpoint(checkpoint);
          const duel = checkpoint.run.duelState;
          setLastFeedback(`Turno ${duel.turn}: ${duel.energy} PA disponibles.`);
        }
        return;
      }

      const { nextState, events } = playback.frames[playback.cursor++];
      // Intermediate frames only drive the board and effects.
      setRunState(withDuel(runRef.current, nextState));
      appendEventsToFeed(events, nextState.turn);
      timerRef.current = window.setTimeout(runNextStep, events.length ? stepDelay : 30);
    };

    runNextStep();
  }, [cancelPlayback, prefs.reducedMotion, prefs.speedMode, appendEventsToFeed, showCheckpoint, showDuelOutcome]);

  const executeEndTurnSequence = useCallback(() => {
    if (playbackRef.current) return;
    const run = runRef.current;
    const resolution = resolveEndTurn(run.duelState, run.rival);
    if (!resolution) return;
    const checkpoint = duelCheckpoint(withDuel({ ...run, turnsElapsed: run.turnsElapsed + 1 }, resolution.nextState));
    const playback = { frames: resolution.frames, cursor: 0, checkpoint };
    playbackRef.current = playback;
    persistCheckpoint(checkpoint);
    setIsResolvingTurn(true);
    setSelectedCardUid(null);
    setMovingFromLane(null);
    setSelectedAttackerLane(null);
    if (tutorialStep !== null) setTutorialStep(null);
    runPlayback(playback);
  }, [tutorialStep, persistCheckpoint, runPlayback]);

  const handlePhaseAction = useCallback(() => {
    const duel = runRef.current.duelState;
    if (
      gameState !== 'PLAYING' ||
      isResolvingTurn ||
      duel.phase === 'TURNO_RIVAL'
    ) {
      return;
    }

    if (duel.phase === 'PREPARACION') {
      const pending = getPendingAttackers(duel);
      if (pending.length > 0) {
        setSelectedCardUid(null);
        setMovingFromLane(null);
        setSelectedAttackerLane(pending[0].laneIndex);
        updateDuelState({ ...duel, phase: 'COMBATE' });
        soundEngine.playCardHover();
        setLastFeedback(
          `Fase de Combate: selecciona un patógeno rival para atacar con ${pending[0].name}.`,
        );
        return;
      }
      executeEndTurnSequence();
      return;
    }

    const guard = canEndTurn(duel);
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
  }, [gameState, isResolvingTurn, updateDuelState, executeEndTurnSequence]);

  const handlePause = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    captureTrigger('end');
    cancelPlayback();
    setGameState('PAUSED');
  }, [gameState, captureTrigger, cancelPlayback]);

  const handleResume = useCallback(() => {
    if (gameState !== 'PAUSED') return;
    setGameState('PLAYING');
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'PLAYING' && !topModal && playbackRef.current && timerRef.current === null) {
      runPlayback(playbackRef.current);
    }
  }, [gameState, topModal, runPlayback]);

  const proceedToNextGuard = useCallback(
    (chosenReward: DuelCard | null) => {
      if (!runRef.current.rewardChoices.length) return;
      cancelPlayback();
      playbackRef.current = null;
      const nextRun = advanceToNextGuard(runRef.current, chosenReward);
      syncRun(nextRun);
      setRecoveredLp(0);
      setSelectedCardUid(null);
      setMovingFromLane(null);
      setSelectedAttackerLane(null);
      setIsResolvingTurn(false);
      setEventBatch([]);
      setLogs([]);
      setLastFeedback(
        `${
          nextRun.mode === 'endless'
            ? `Guardia ${nextRun.guardLevel}`
            : `Duelo ${nextRun.guardLevel}/${RIVAL_DUELISTS.length}`
        } · ${nextRun.rival.name} en ${
          ORGAN_PROFILES[nextRun.rival.organId].shortName
        }.`,
      );
      persistCheckpoint(duelCheckpoint(nextRun));
      soundEngine.playStartShift();
      setGameState('PLAYING');
    },
    [cancelPlayback, persistCheckpoint, syncRun],
  );

  const handleReturnToMenu = useCallback(() => {
    cancelPlayback();
    playbackRef.current = null;
    setIsResolvingTurn(false);
    setDeckModalOpen(false);
    setInspectedCard(null);
    setSavedRun(loadRunSnapshot());
    setGameState('TITLE_MENU');
  }, [cancelPlayback]);

  const handleToggleMute = useCallback(() => {
    updatePrefs((p) => ({ ...p, muted: !p.muted }));
  }, [updatePrefs]);

  const handleToggleTactical2D = useCallback(() => {
    updatePrefs((p) => ({ ...p, tactical2D: !p.tactical2D }));
  }, [updatePrefs]);

  const handleToggleReducedMotion = useCallback(() => {
    updatePrefs((p) => ({ ...p, reducedMotion: !p.reducedMotion }));
  }, [updatePrefs]);

  const handleCycleSpeedMode = useCallback(() => {
    const order: SpeedMode[] = ['normal', 'fast', 'reduced'];
    updatePrefs((p) => ({
      ...p,
      speedMode: order[(order.indexOf(p.speedMode) + 1) % order.length],
    }));
  }, [updatePrefs]);

  const cycleCameraPreset = useCallback(() => {
    const order: CameraPreset[] = ['overview', 'organ', 'instruments'];
    setCameraPreset((prev) => {
      const normalized = prev === 'heart' ? 'organ' : prev;
      return order[(order.indexOf(normalized) + 1) % order.length];
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (topModal) {
        if (e.key === 'Tab') handleTab(e, topModal);
        if (e.key === 'Escape' && !e.repeat) {
          e.preventDefault();
          if (topModal === 'inspector') setInspectedCard(null);
          else if (topModal === 'deck') setDeckModalOpen(false);
          else if (gameState === 'PAUSED') handleResume();
          else handleReturnToMenu();
        }
        return;
      }
      if (e.repeat) return;

      const target = e.target;
      const isInteractiveTarget =
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement;

      if (gameState === 'TITLE_MENU') {
        if ((e.key === 'Enter' || e.key === ' ') && !isInteractiveTarget) {
          e.preventDefault();
          startMode('endless');
        }
        return;
      }

      if (e.key === 'Escape') {
        if (selectedCardUid || movingFromLane !== null) {
          setSelectedCardUid(null);
          setMovingFromLane(null);
          return;
        }
        if (gameState === 'PLAYING') handlePause();
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

      if (
        (e.key === ' ' && !isInteractiveTarget) ||
        e.key === 'e' ||
        e.key === 'E'
      ) {
        e.preventDefault();
        handlePhaseAction();
        return;
      }

      const num = Number(e.key);
      if (num >= 1 && num <= 6) {
        const card = runRef.current.duelState.hand[num - 1];
        if (card) handleCardClick(card.uid);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    topModal,
    handleTab,
    gameState,
    startMode,
    selectedCardUid,
    movingFromLane,
    handlePause,
    handleResume,
    handleReturnToMenu,
    handleToggleMute,
    cycleCameraPreset,
    handlePhaseAction,
    handleCardClick,
  ]);

  const liveTelemetry: DuelTelemetry = useMemo(() => {
    const lpRatio = engineState.playerLp / engineState.playerMaxLp;
    const bpm = Math.round(organProfile.bpmBase + (1 - lpRatio) * 62);
    const spo2 = Math.max(
      84,
      Math.round(organProfile.spo2Base - (1 - lpRatio) * 11),
    );
    const isPrep = engineState.phase === 'PREPARACION';

    return {
      playerLp: engineState.playerLp,
      playerMaxLp: engineState.playerMaxLp,
      rivalLp: engineState.rivalLp,
      rivalMaxLp: engineState.rivalMaxLp,
      rivalName: currentRival.name,
      organId: currentRival.organId,
      organAccentHex: organProfile.accentHex,
      phase: engineState.phase,
      playerSlots: engineState.playerSlots,
      enemySlots: engineState.enemySlots,
      armedTrapsCount: engineState.armedTraps.length,
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
    organProfile,
    currentRival.name,
    currentRival.organId,
    selectedAttackerLane,
    selectedCard,
    movingFromLane,
    gameState,
  ]);

  return (
    <main ref={rootRef} className="relative w-screen h-[100dvh] overflow-hidden bg-[#081018]">
      <div inert={topModal !== null} data-session-background tabIndex={-1}>
      {!prefs.tactical2D && (
        <MedicalTableCanvas
          telemetry={liveTelemetry}
          cameraPreset={cameraPreset}
          eventBatch={eventBatch}
          playedCardMeta={playedCardMeta}
          reducedMotion={prefs.reducedMotion || prefs.speedMode === 'reduced'}
          suspended={topModal !== null}
          slotAnchorRefs={slotAnchorRefs}
          onClickPlayerSlot={handleSelectPlayerLane}
          onClickEnemySlot={handleSelectEnemyLane}
          onInspectOrgan={() => {
            soundEngine.playCardHover();
            setCameraPreset((prev) =>
              prev === 'organ' || prev === 'heart' ? 'overview' : 'organ',
            );
            setLastFeedback(
              `${organProfile.name} · ${organProfile.synergyTitle} · FC ${liveTelemetry.bpm} lpm · SpO2 ${liveTelemetry.spo2}%.`,
            );
          }}
          onClickDeck={() => {
            soundEngine.playCardHover();
            openDeck();
          }}
          onWebGLUnavailable={() => {
            updatePrefs((p) => ({ ...p, tactical2D: true }));
            setLastFeedback(
              'WebGL no disponible: activado el tablero táctico 2D accesible.',
            );
          }}
        />
      )}

      {gameState === 'TITLE_MENU' && (
        <TitleScreen
          savedRun={savedRun.snapshot ?? null}
          bestGuardLevel={bestGuardLevel}
          prefs={prefs}
          onStartMode={startMode}
          onResumeSaved={handleResumeSavedRun}
          onToggleMute={handleToggleMute}
          onToggleTactical2D={handleToggleTactical2D}
          onToggleReducedMotion={handleToggleReducedMotion}
        />
      )}

      {gameState !== 'TITLE_MENU' && (
        <GameHUD
          runMode={runState.mode}
          guardLevel={runState.guardLevel}
          bestGuardLevel={bestGuardLevel}
          totalRivals={RIVAL_DUELISTS.length}
          organProfile={organProfile}
          engineState={engineState}
          rival={currentRival}
          phase={engineState.phase}
          selectedCard={selectedCard}
          movingFromLane={movingFromLane}
          selectedAttackerLane={selectedAttackerLane}
          pendingAttackerLanes={pendingAttackerLanes}
          isResolvingTurn={isResolvingTurn}
          lastFeedback={lastFeedback}
          logs={logs}
          tutorialStep={tutorialStep}
          cameraPreset={cameraPreset}
          muted={prefs.muted}
          tactical2D={prefs.tactical2D}
          speedMode={prefs.speedMode}
          slotAnchorRefs={slotAnchorRefs}
          onCardClick={handleCardClick}
          onInspectCard={inspectCard}
          onInspectUnit={handleInspectUnit}
          onOpenDeck={openDeck}
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
          onToggleTactical2D={handleToggleTactical2D}
          onCycleSpeedMode={handleCycleSpeedMode}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
        />
      )}
      </div>

      <EndModals
        gameState={gameState}
        active={topModal === 'end'}
        runMode={runState.mode}
        guardLevel={runState.guardLevel}
        bestGuardLevel={bestGuardLevel}
        recoveredLp={recoveredLp}
        organProfile={organProfile}
        rival={currentRival}
        totalRivals={RIVAL_DUELISTS.length}
        rewardChoices={runState.rewardChoices}
        duelsWon={runState.duelsWon}
        cardsPlayedCount={runState.cardsPlayedCount}
        turnsElapsed={runState.turnsElapsed}
        onResume={handleResume}
        onOpenDeck={openDeck}
        onPickReward={(card) => proceedToNextGuard(card)}
        onSkipReward={() => proceedToNextGuard(null)}
        onInspectCard={inspectCard}
        onRestart={() => startMode(runState.mode)}
        onReturnToMenu={handleReturnToMenu}
      />

      <DeckModal
        open={deckModalOpen}
        active={topModal === 'deck'}
        masterDeck={runState.masterDeck}
        duelState={engineState}
        onInspectCard={inspectCard}
        onClose={() => setDeckModalOpen(false)}
      />

      <CardInspectorModal
        card={inspectedCard}
        active={topModal === 'inspector'}
        onClose={() => setInspectedCard(null)}
      />
    </main>
  );
}
