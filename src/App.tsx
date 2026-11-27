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
  buildEndTurnSteps,
  canEndTurn,
  canPlayCard,
  CombatStep,
  DuelEngineState,
  getPendingAttackers,
  resolveActivateSkill,
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
  clearRunSnapshot,
  loadBestGuardRecord,
  loadPreferences,
  loadRunSnapshot,
  RunSavePayload,
  savePreferences,
  saveRunSnapshot,
  updateBestGuardRecord,
} from './game/persistence';
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
  RivalDuelist,
  RunPreferences,
  SpeedMode,
} from './types/game';

const SPEED_DELAY_MS: Record<SpeedMode, number> = {
  normal: 520,
  fast: 240,
  reduced: 60,
};

export default function App() {
  const [prefs, setPrefs] = useState<RunPreferences>(() => {
    const loaded = loadPreferences();
    soundEngine.setMuted(loaded.muted);
    return loaded;
  });
  const [bestGuardLevel, setBestGuardLevel] = useState<number>(() =>
    loadBestGuardRecord(),
  );
  const [savedRun, setSavedRun] = useState<RunSavePayload | null>(() =>
    loadRunSnapshot(),
  );

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

  const [eventBatch, setEventBatch] = useState<CombatEvent[]>([]);
  const [playedCardMeta, setPlayedCardMeta] = useState<{
    nonce: number;
    medicalClass: MedicalClass;
    name: string;
  } | null>(null);

  const timersRef = useRef<number[]>([]);
  const playbackGenRef = useRef(0);
  const pausedStepRef = useRef<{
    steps: CombatStep[];
    cursor: number;
    rival: RivalDuelist;
  } | null>(null);
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

  const updateDuelState = useCallback(
    (
      nextDuel: DuelEngineState,
      extra?: Partial<Pick<RunState, 'cardsPlayedCount' | 'turnsElapsed'>>,
      persist = true,
    ) => {
      const updated: RunState = {
        ...runRef.current,
        ...extra,
        duelState: nextDuel,
        rngState: nextDuel.rngState,
        idSequence: nextDuel.idSequence,
        playerLp: nextDuel.playerLp,
      };
      runRef.current = updated;
      setRunState(updated);
      if (persist && nextDuel.playerLp > 0 && nextDuel.rivalLp > 0) {
        saveRunSnapshot(updated, false, 0);
      }
      return updated;
    },
    [],
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const cancelPlayback = useCallback(() => {
    playbackGenRef.current += 1;
    clearTimers();
  }, [clearTimers]);

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

  const handleVictoryOrDefeat = useCallback(
    (latestRun: RunState): boolean => {
      const d = latestRun.duelState;
      if (d.rivalLp <= 0) {
        cancelPlayback();
        pausedStepRef.current = null;
        setIsResolvingTurn(false);
        soundEngine.playCaseStabilized();

        const outcome = transitionRunOnVictory(latestRun);
        syncRun(outcome.nextRun);
        setRecoveredLp(outcome.recoveredLp);

        if (latestRun.mode === 'endless') {
          const updatedBest = updateBestGuardRecord(latestRun.guardLevel);
          setBestGuardLevel(updatedBest);
        }

        if (outcome.isCampaignComplete) {
          clearRunSnapshot();
          setSavedRun(null);
          setGameState('VICTORY');
        } else {
          saveRunSnapshot(outcome.nextRun, true, outcome.recoveredLp);
          setSavedRun(loadRunSnapshot());
          setGameState('ROUND_SUMMARY');
        }
        return true;
      }

      if (d.playerLp <= 0) {
        cancelPlayback();
        pausedStepRef.current = null;
        setIsResolvingTurn(false);
        soundEngine.playInvalidAction();
        if (latestRun.mode === 'endless' && latestRun.duelsWon > 0) {
          const updatedBest = updateBestGuardRecord(latestRun.duelsWon);
          setBestGuardLevel(updatedBest);
        }
        clearRunSnapshot();
        setSavedRun(null);
        setGameState('GAME_OVER');
        return true;
      }

      return false;
    },
    [cancelPlayback, syncRun],
  );

  const startMode = useCallback(
    (mode: GameMode) => {
      cancelPlayback();
      pausedStepRef.current = null;
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
      saveRunSnapshot(fresh, false, 0);
      setSavedRun(loadRunSnapshot());
      soundEngine.playStartShift();
      setGameState('PLAYING');
    },
    [cancelPlayback, syncRun],
  );

  const handleResumeSavedRun = useCallback(() => {
    const snap = loadRunSnapshot();
    if (!snap) return;
    cancelPlayback();
    pausedStepRef.current = null;
    syncRun(snap.run);
    setRecoveredLp(snap.recoveredLp);
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
    setGameState(snap.inRoundSummary ? 'ROUND_SUMMARY' : 'PLAYING');
  }, [cancelPlayback, syncRun]);

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
      setInspectedCard(unit.sourceCard);
      return;
    }
    const template = ALL_PLAYER_CARDS_MAP[unit.cardId];
    if (template) {
      setInspectedCard(template);
    }
  }, []);

  const runPlaybackFrom = useCallback(
    (steps: CombatStep[], startCursor: number, rival: RivalDuelist) => {
      cancelPlayback();
      const myGen = playbackGenRef.current;
      let cursor = startCursor;
      setIsResolvingTurn(true);

      const stepDelay =
        prefs.reducedMotion || prefs.speedMode === 'reduced'
          ? 40
          : SPEED_DELAY_MS[prefs.speedMode];

      const runNextStep = () => {
        if (playbackGenRef.current !== myGen) return;

        if (cursor >= steps.length) {
          pausedStepRef.current = null;
          setIsResolvingTurn(false);
          const finishedRun = updateDuelState(runRef.current.duelState, {
            turnsElapsed: runRef.current.turnsElapsed + 1,
          });
          setLastFeedback(
            `Turno ${finishedRun.duelState.turn}: ${finishedRun.duelState.energy} PA disponibles.`,
          );
          return;
        }

        const step = steps[cursor++];
        pausedStepRef.current = { steps, cursor, rival };

        const { nextState, events } = step.execute(runRef.current.duelState);
        const updatedRun = updateDuelState(nextState);

        if (events.length > 0) {
          appendEventsToFeed(events, nextState.turn);
        }

        if (handleVictoryOrDefeat(updatedRun)) {
          return;
        }

        const delay = events.length > 0 ? stepDelay : 30;
        const tid = window.setTimeout(runNextStep, delay);
        timersRef.current.push(tid);
      };

      runNextStep();
    },
    [
      cancelPlayback,
      prefs.reducedMotion,
      prefs.speedMode,
      updateDuelState,
      appendEventsToFeed,
      handleVictoryOrDefeat,
    ],
  );

  const executeEndTurnSequence = useCallback(() => {
    setSelectedCardUid(null);
    setMovingFromLane(null);
    setSelectedAttackerLane(null);
    if (tutorialStep !== null) setTutorialStep(null);

    const rival = runRef.current.rival;
    const steps = buildEndTurnSteps(rival);
    runPlaybackFrom(steps, 0, rival);
  }, [tutorialStep, runPlaybackFrom]);

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
    cancelPlayback();
    setGameState('PAUSED');
  }, [gameState, cancelPlayback]);

  const handleResume = useCallback(() => {
    if (gameState !== 'PAUSED') return;
    setGameState('PLAYING');
    if (pausedStepRef.current) {
      const { steps, cursor, rival } = pausedStepRef.current;
      runPlaybackFrom(steps, cursor, rival);
    }
  }, [gameState, runPlaybackFrom]);

  const proceedToNextGuard = useCallback(
    (chosenReward: DuelCard | null) => {
      cancelPlayback();
      pausedStepRef.current = null;
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
      saveRunSnapshot(nextRun, false, 0);
      setSavedRun(loadRunSnapshot());
      soundEngine.playStartShift();
      setGameState('PLAYING');
    },
    [cancelPlayback, syncRun],
  );

  const handleReturnToMenu = useCallback(() => {
    cancelPlayback();
    pausedStepRef.current = null;
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
      if (e.repeat) return;
      if (inspectedCard || deckModalOpen) return;

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
        else if (gameState === 'PAUSED') handleResume();
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
    inspectedCard,
    deckModalOpen,
    gameState,
    startMode,
    selectedCardUid,
    movingFromLane,
    handlePause,
    handleResume,
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
    <main className="relative w-screen h-[100dvh] overflow-hidden bg-[#081018]">
      {!prefs.tactical2D && (
        <MedicalTableCanvas
          telemetry={liveTelemetry}
          cameraPreset={cameraPreset}
          eventBatch={eventBatch}
          playedCardMeta={playedCardMeta}
          reducedMotion={prefs.reducedMotion || prefs.speedMode === 'reduced'}
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
            setDeckModalOpen(true);
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
          savedRun={savedRun}
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
          onInspectCard={(card) => setInspectedCard(card)}
          onInspectUnit={handleInspectUnit}
          onOpenDeck={() => setDeckModalOpen(true)}
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

      <EndModals
        gameState={gameState}
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
        onOpenDeck={() => setDeckModalOpen(true)}
        onPickReward={(card) => proceedToNextGuard(card)}
        onSkipReward={() => proceedToNextGuard(null)}
        onInspectCard={(card) => setInspectedCard(card)}
        onRestart={() => startMode(runState.mode)}
        onReturnToMenu={handleReturnToMenu}
      />

      <DeckModal
        open={deckModalOpen}
        masterDeck={runState.masterDeck}
        duelState={engineState}
        onInspectCard={(card) => setInspectedCard(card)}
        onClose={() => setDeckModalOpen(false)}
      />

      <CardInspectorModal
        card={inspectedCard}
        onClose={() => setInspectedCard(null)}
      />
    </main>
  );
}
