import {
  Camera,
  ChevronDown,
  ChevronUp,
  Gauge,
  Grid2x2,
  History,
  Layers,
  Pause,
  Shield,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MutableRefObject, useState } from 'react';
import { canPlayCard, DuelEngineState } from '../engine/combatEngine';
import {
  BoardUnit,
  CameraPreset,
  CardInstance,
  CombatLogEntry,
  DuelCard,
  GameMode,
  OrganProfile,
  RivalDuelist,
  SpeedMode,
  TurnPhase,
} from '../types/game';
import { ArenaBoard } from './ArenaBoard';
import { CardVisual } from './CardVisual';
import { SlotAnchorDomRefs } from './MedicalTableCanvas';

interface GameHUDProps {
  runMode: GameMode;
  guardLevel: number;
  bestGuardLevel: number;
  totalRivals: number;
  organProfile: OrganProfile;
  engineState: DuelEngineState;
  rival: RivalDuelist;
  phase: TurnPhase;
  selectedCard: CardInstance | null;
  movingFromLane: number | null;
  selectedAttackerLane: number | null;
  pendingAttackerLanes: number[];
  isResolvingTurn: boolean;
  lastFeedback: string;
  logs: CombatLogEntry[];
  tutorialStep: number | null;
  cameraPreset: CameraPreset;
  muted: boolean;
  tactical2D: boolean;
  speedMode: SpeedMode;
  slotAnchorRefs: MutableRefObject<SlotAnchorDomRefs>;
  onCardClick: (uid: string) => void;
  onInspectCard: (card: DuelCard) => void;
  onInspectUnit: (unit: BoardUnit) => void;
  onOpenDeck: () => void;
  onCancelSelection: () => void;
  onSelectPlayerLane: (lane: number) => void;
  onSelectEnemyLane: (lane: number) => void;
  onDirectAttack: () => void;
  onStartMoveUnit: (lane: number) => void;
  onActivateSkill: (lane: number) => void;
  onPhaseAction: () => void;
  onDismissTutorial: () => void;
  onChangeCamera: (preset: CameraPreset) => void;
  onToggleTactical2D: () => void;
  onCycleSpeedMode: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}

const TUTORIAL_TEXT: Record<number, string> = {
  1: 'Tutorial (1/3): Elige una Unidad, Diagnóstico o Trampa en tu mano inferior.',
  2: 'Tutorial (2/3): Toca un carril iluminado en la arena para desplegar o tratar.',
  3: 'Tutorial (3/3): Pulsa "Ir a Combate", elige a qué patógeno atacar con cada unidad y finaliza turno.',
};

const SPEED_LABEL: Record<SpeedMode, string> = {
  normal: '1x',
  fast: '2x',
  reduced: 'Instant',
};

export function GameHUD({
  runMode,
  guardLevel,
  bestGuardLevel,
  totalRivals,
  organProfile,
  engineState,
  rival,
  phase,
  selectedCard,
  movingFromLane,
  selectedAttackerLane,
  pendingAttackerLanes,
  isResolvingTurn,
  lastFeedback,
  logs,
  tutorialStep,
  cameraPreset,
  muted,
  tactical2D,
  speedMode,
  slotAnchorRefs,
  onCardClick,
  onInspectCard,
  onInspectUnit,
  onOpenDeck,
  onCancelSelection,
  onSelectPlayerLane,
  onSelectEnemyLane,
  onDirectAttack,
  onStartMoveUnit,
  onActivateSkill,
  onPhaseAction,
  onDismissTutorial,
  onChangeCamera,
  onToggleTactical2D,
  onCycleSpeedMode,
  onToggleMute,
  onPause,
}: GameHUDProps) {
  const [cameraDockOpen, setCameraDockOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const playerLpPct = Math.max(
    0,
    Math.min(100, (engineState.playerLp / engineState.playerMaxLp) * 100),
  );
  const rivalLpPct = Math.max(
    0,
    Math.min(100, (engineState.rivalLp / engineState.rivalMaxLp) * 100),
  );
  const playerDanger = engineState.playerLp <= 1200;
  const isPrep = phase === 'PREPARACION';
  const pendingCount = pendingAttackerLanes.length;

  return (
    <>
      <ArenaBoard
        phase={phase}
        organId={engineState.organId}
        tactical2D={tactical2D}
        playerSlots={engineState.playerSlots}
        enemySlots={engineState.enemySlots}
        armedTraps={engineState.armedTraps}
        selectedCard={selectedCard}
        movingFromLane={movingFromLane}
        selectedAttackerLane={selectedAttackerLane}
        pendingAttackerLanes={pendingAttackerLanes}
        freeMovesLeft={engineState.freeMovesLeft}
        energy={engineState.energy}
        slotAnchorRefs={slotAnchorRefs}
        onSelectEnemyLane={onSelectEnemyLane}
        onSelectPlayerLane={onSelectPlayerLane}
        onDirectAttack={onDirectAttack}
        onStartMoveUnit={onStartMoveUnit}
        onActivateSkill={onActivateSkill}
        onInspectUnit={onInspectUnit}
        onInspectCard={onInspectCard}
      />

      <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-2.5 md:p-3.5">
        {/* TOP CORNER-FRAMED HEADER */}
        <header className="flex items-start justify-between gap-2">
          {/* Top-Left: Phase Stepper, Organ Synergy, Mutators & Transparent Intent */}
          <div className="pointer-events-auto bg-[#08121d]/92 border border-slate-800 rounded-xl px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.5)] max-w-[330px] md:max-w-sm">
            <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular">
              <span
                className={
                  phase === 'PREPARACION'
                    ? 'text-emerald-400 font-bold'
                    : 'text-slate-500'
                }
              >
                1. Prep
              </span>
              <span className="text-slate-600">→</span>
              <span
                className={
                  phase === 'COMBATE'
                    ? 'text-amber-400 font-bold'
                    : 'text-slate-500'
                }
              >
                2. Combate
              </span>
              <span className="text-slate-600">→</span>
              <span
                className={
                  phase === 'TURNO_RIVAL'
                    ? 'text-rose-400 font-bold'
                    : 'text-slate-500'
                }
              >
                3. Brote
              </span>
              <span className="text-slate-600 ml-1" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-200 font-semibold">
                {runMode === 'endless'
                  ? `Guardia ${guardLevel}${bestGuardLevel > 0 ? ` (Réc ${bestGuardLevel})` : ''}`
                  : `D${rival.roundNumber}/${totalRivals}`}
                {` · T${engineState.turn}`}
              </span>
            </div>

            <div
              className="text-[10px] font-mono-tabular text-sky-300 truncate mt-1"
              title={`${organProfile.synergyTitle}: ${organProfile.synergyRule}`}
            >
              {organProfile.shortName}: <span className="text-slate-300">{organProfile.synergyTitle}</span>
            </div>

            {rival.mutators.length > 0 && (
              <div
                className="text-[10px] font-mono-tabular text-amber-300 truncate mt-0.5"
                title={rival.mutators.map((m) => `${m.name}: ${m.description}`).join(' | ')}
              >
                Mutación: {rival.mutators.map((m) => m.name).join(' · ')}
              </div>
            )}

            <div
              className="text-[11px] text-rose-300/95 truncate mt-0.5"
              title={engineState.rivalIntent.actions.map((a) => a.description).join(' | ')}
            >
              Rival:{' '}
              <span className="font-semibold">
                {engineState.rivalIntent.actions.map((a) => a.label).join(' · ')}
              </span>
            </div>
          </div>

          {/* Top-Center: Compact Rival LP Gauge */}
          <div className="pointer-events-auto hidden sm:block bg-[#08121d]/92 border border-rose-900/60 rounded-xl px-3.5 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.5)] min-w-[230px] max-w-[300px]">
            <div className="flex items-center justify-between gap-3 text-xs mb-0.5">
              <span className="font-display font-semibold text-slate-100 truncate">
                {rival.name}
              </span>
              <span className="font-mono-tabular text-sm font-bold text-rose-400 shrink-0">
                LP {engineState.rivalLp}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mb-1">
              {rival.diseaseName}
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-[width] duration-200"
                style={{ width: `${rivalLpPct}%` }}
              />
            </div>
          </div>

          {/* Top-Right: Utility Controls */}
          <div className="pointer-events-auto flex items-center gap-1 bg-[#08121d]/92 border border-slate-800 rounded-xl p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
            <button
              type="button"
              onClick={onOpenDeck}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[36px]"
              title="Ver mazo y pilas"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              <span className="hidden lg:inline">Mazo</span>
            </button>

            <button
              type="button"
              onClick={() => setHistoryOpen((p) => !p)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[36px] ${
                historyOpen
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Historial clínico"
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">Historial</span>
            </button>

            <button
              type="button"
              onClick={() => setCameraDockOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[36px]"
              title="Vistas 3D / 2D (H)"
              aria-expanded={cameraDockOpen}
            >
              <Camera className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">Vista</span>
              {cameraDockOpen ? (
                <ChevronUp className="w-3 h-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              title={muted ? 'Activar sonido (M)' : 'Silenciar (M)'}
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-slate-500" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={onPause}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer min-h-[36px]"
              title="Pausa (Esc)"
            >
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Pausa</span>
            </button>
          </div>
        </header>

        {/* Collapsible Camera / View / Speed Bar */}
        {cameraDockOpen && (
          <div className="self-end pointer-events-auto bg-[#08121d]/95 border border-slate-800 rounded-xl p-1.5 flex flex-wrap items-center gap-1 shadow-xl my-1">
            {(
              [
                { id: 'overview', label: 'Arena Vascular' },
                { id: 'organ', label: `${organProfile.shortName} 3D` },
                { id: 'instruments', label: 'Instrumental' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={tactical2D}
                onClick={() => onChangeCamera(preset.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  tactical2D
                    ? 'text-slate-600 cursor-not-allowed'
                    : cameraPreset === preset.id ||
                        (preset.id === 'organ' && cameraPreset === 'heart')
                      ? 'bg-sky-500 text-slate-950 font-semibold cursor-pointer'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer'
                }`}
              >
                {preset.label}
              </button>
            ))}

            <span className="w-px h-5 bg-slate-800 mx-0.5" aria-hidden="true" />

            <button
              type="button"
              onClick={onToggleTactical2D}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                tactical2D
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Alternar tablero táctico 2D accesible"
            >
              <Grid2x2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Vista 2D</span>
            </button>

            <button
              type="button"
              onClick={onCycleSpeedMode}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Velocidad de resolución"
            >
              <Gauge className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{SPEED_LABEL[speedMode]}</span>
            </button>
          </div>
        )}

        {/* Collapsible Combat History Drawer */}
        {historyOpen && (
          <aside className="self-end pointer-events-auto w-full max-w-sm bg-[#08121d]/95 border border-slate-800 rounded-xl p-3 shadow-2xl my-1 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-2">
              <span>Registro Clínico de Combate</span>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
                aria-label="Cerrar historial"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500">Sin eventos registrados aún.</p>
            ) : (
              <ul className="space-y-1.5 text-[11px] leading-snug">
                {logs.slice(0, 14).map((entry) => (
                  <li
                    key={entry.id}
                    className={
                      entry.category === 'alert'
                        ? 'text-rose-300'
                        : entry.category === 'heal'
                          ? 'text-emerald-300'
                          : entry.category === 'combat'
                            ? 'text-amber-300'
                            : 'text-slate-300'
                    }
                  >
                    <span className="font-mono-tabular text-slate-500 mr-1.5">
                      [T{entry.turn}]
                    </span>
                    {entry.text}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        {/* Slim Dismissible Tutorial Tip */}
        {tutorialStep !== null && TUTORIAL_TEXT[tutorialStep] && (
          <div className="pointer-events-auto self-center flex items-center gap-2.5 bg-[#0a1a29]/92 border border-sky-500/40 rounded-lg px-3 py-1 text-[11px] text-sky-200 shadow-lg max-w-xl mt-1">
            <span>{TUTORIAL_TEXT[tutorialStep]}</span>
            <button
              type="button"
              onClick={onDismissTutorial}
              className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
              aria-label="Ocultar tutorial"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* UNOBSTRUCTED 3D ARENA SPACE */}
        <div className="flex-1" />

        {/* BOTTOM CORNER DOCKS + LOW DOCKED HAND */}
        <section className="flex items-end justify-between gap-2.5">
          {/* Bottom-Left: Player LP, PA, Deck Trigger & Trap Slots */}
          <div className="pointer-events-auto bg-[#08121d]/92 border border-slate-800 rounded-xl px-3 py-2 shadow-[0_8px_22px_rgba(0,0,0,0.55)] w-[196px] md:w-[218px] shrink-0">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">LP Paciente</span>
              <span
                className={`font-mono-tabular text-sm font-bold ${
                  playerDanger ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {engineState.playerLp}/{engineState.playerMaxLp}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
              <div
                className={`h-full transition-[width] duration-200 ${
                  playerDanger ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${playerLpPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono-tabular gap-1.5">
              <span className="text-sky-400 font-bold shrink-0">
                {engineState.energy}/{engineState.maxEnergy} PA
              </span>
              <span className="inline-flex items-center gap-0.5 text-violet-300 shrink-0" title="Trampas armadas">
                <Shield className="w-3 h-3" aria-hidden="true" />
                {engineState.armedTraps.length}/2
              </span>
              <button
                type="button"
                onClick={onOpenDeck}
                className="text-slate-300 hover:text-sky-300 underline decoration-slate-600 cursor-pointer truncate"
                title="Abrir visor completo del mazo"
              >
                M:{engineState.drawPile.length} D:{engineState.discardPile.length}
              </button>
            </div>
          </div>

          {/* Bottom-Center: Compact Status Line + Docked Hand */}
          <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div className="pointer-events-none px-3 py-0.5 rounded bg-[#07111b]/88 border border-slate-800/80 text-[11px] text-slate-200 truncate max-w-xl">
              {lastFeedback}
            </div>

            <div
              className="pointer-events-none flex items-end justify-center gap-2 overflow-x-auto max-w-full pb-0.5 px-1"
              aria-label="Mano de cartas"
            >
              {engineState.hand.map((card: CardInstance, idx: number) => {
                const check = canPlayCard(engineState, card.uid);
                const playable = isPrep && check.valid;
                return (
                  <div
                    key={card.uid}
                    className="pointer-events-auto animate-card-enter shrink-0"
                  >
                    <CardVisual
                      card={card}
                      variant="hand"
                      playable={playable}
                      invalidReason={!isPrep ? 'En combate' : check.reason}
                      selected={selectedCard?.uid === card.uid}
                      indexHint={idx + 1}
                      onSelect={() => onCardClick(card.uid)}
                      onInspect={() => onInspectCard(card)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom-Right: Phase Action Button */}
          <div className="pointer-events-auto flex flex-col items-end gap-1.5 shrink-0">
            {(selectedCard !== null || movingFromLane !== null) && (
              <button
                type="button"
                onClick={onCancelSelection}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0a1623]/94 border border-slate-700 hover:bg-slate-800 text-xs text-slate-200 font-medium cursor-pointer shadow-lg"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Cancelar</span>
              </button>
            )}

            <button
              type="button"
              disabled={isResolvingTurn || phase === 'TURNO_RIVAL'}
              onClick={onPhaseAction}
              className={`px-4 py-2.5 rounded-xl text-xs font-display font-bold tracking-wide transition-colors whitespace-nowrap min-h-[44px] shadow-[0_8px_22px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                isResolvingTurn || phase === 'TURNO_RIVAL'
                  ? 'bg-slate-800 text-slate-400 cursor-wait border border-slate-700'
                  : phase === 'COMBATE' && pendingCount > 0
                    ? 'bg-[#121a24] border border-amber-500/70 text-amber-300 hover:bg-slate-800 cursor-pointer'
                    : phase === 'COMBATE'
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 cursor-pointer'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
              }`}
            >
              {isResolvingTurn || phase === 'TURNO_RIVAL'
                ? 'Respuesta Brote…'
                : phase === 'COMBATE'
                  ? pendingCount > 0
                    ? `Fin Turno (${pendingCount} pend.)`
                    : 'Finalizar Turno'
                  : pendingCount > 0
                    ? 'Ir a Combate'
                    : 'Finalizar Turno'}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
