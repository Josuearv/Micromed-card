import { MutableRefObject } from 'react';
import {
  ArrowLeftRight,
  Crosshair,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import { getEffectivenessMultiplier } from '../data/medicalCards';
import { computeAttackPreview } from '../engine/combatEngine';
import {
  BoardUnit,
  CardInstance,
  TurnPhase,
} from '../types/game';
import { SlotAnchorDomRefs } from './MedicalTableCanvas';

interface ArenaBoardProps {
  phase: TurnPhase;
  playerSlots: Array<BoardUnit | null>;
  enemySlots: Array<BoardUnit | null>;
  selectedCard: CardInstance | null;
  movingFromLane: number | null;
  selectedAttackerLane: number | null;
  pendingAttackerLanes: number[];
  freeMovesLeft: number;
  energy: number;
  slotAnchorRefs: MutableRefObject<SlotAnchorDomRefs>;
  onSelectEnemyLane: (lane: number) => void;
  onSelectPlayerLane: (lane: number) => void;
  onDirectAttack: () => void;
  onStartMoveUnit: (lane: number) => void;
  onActivateSkill: (lane: number) => void;
  onInspectUnit: (unit: BoardUnit) => void;
}

function CompactStatuses({ unit }: { unit: BoardUnit }) {
  const tags: { text: string; cls: string }[] = [];
  if (unit.statuses.opsonizado) tags.push({ text: 'Ops x1.5', cls: 'text-sky-300' });
  if (unit.statuses.biofilm) tags.push({ text: `Bio +${unit.statuses.biofilm}`, cls: 'text-amber-300' });
  if (unit.statuses.inhibido) tags.push({ text: 'Inhibido', cls: 'text-violet-300' });
  if (unit.statuses.aturdido) tags.push({ text: 'Aturdido', cls: 'text-amber-400' });
  if (unit.statuses.sobrecarga) tags.push({ text: 'Sobrecarga', cls: 'text-rose-300' });
  if (tags.length === 0) return null;

  return (
    <div className="text-[9px] font-mono-tabular truncate leading-tight">
      {tags.map((t, idx) => (
        <span key={t.text}>
          {idx > 0 && <span className="text-slate-600 mx-0.5">·</span>}
          <span className={t.cls}>{t.text}</span>
        </span>
      ))}
    </div>
  );
}

export function ArenaBoard({
  phase,
  playerSlots,
  enemySlots,
  selectedCard,
  movingFromLane,
  selectedAttackerLane,
  pendingAttackerLanes,
  freeMovesLeft,
  energy,
  slotAnchorRefs,
  onSelectEnemyLane,
  onSelectPlayerLane,
  onDirectAttack,
  onStartMoveUnit,
  onActivateSkill,
  onInspectUnit,
}: ArenaBoardProps) {
  const isPrep = phase === 'PREPARACION';
  const isCombat = phase === 'COMBATE';
  const selectingSummonLane = isPrep && selectedCard?.kind === 'Unidad';
  const selectingEnemyCard = isPrep && selectedCard?.targetMode === 'enemy';
  const selectingAllyCard = isPrep && selectedCard?.targetMode === 'ally';

  const selectedAttacker =
    isCombat && selectedAttackerLane !== null
      ? playerSlots[selectedAttackerLane]
      : null;
  const hasAnyEnemy = enemySlots.some(Boolean);
  const canDirectAttack = isCombat && selectedAttacker !== null && !hasAnyEnemy;

  return (
    <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden">
      {/* Direct Attack Pill when Rival Field is Empty in Combate */}
      {canDirectAttack && selectedAttacker && (
        <div className="absolute top-[118px] left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onDirectAttack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-xs font-bold shadow-[0_8px_24px_rgba(251,191,36,0.35)] cursor-pointer transition-transform hover:-translate-y-0.5"
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
            <span>
              Atacar Directo al Brote con {selectedAttacker.name} (-
              {Math.max(
                150,
                selectedAttacker.atk -
                  (selectedAttacker.statuses.inhibido ? 450 : 0),
              )}{' '}
              LP)
            </span>
          </button>
        </div>
      )}

      {/* PROJECTED ENEMY SLOT ANCHORS */}
      {[0, 1, 2].map((lane) => {
        const unit = enemySlots[lane];
        const canTargetEnemy =
          Boolean(unit) &&
          (selectingEnemyCard || (isCombat && selectedAttacker !== null));

        const combatPreview =
          isCombat && selectedAttacker && unit
            ? computeAttackPreview(selectedAttacker, unit)
            : null;

        const effHint =
          selectingEnemyCard && selectedCard && unit
            ? getEffectivenessMultiplier(
                selectedCard.medicalClass,
                selectedCard.effectTag,
                unit.subtype,
                Boolean(unit.statuses.opsonizado),
              )
            : null;

        return (
          <div
            key={`enemy-anchor-${lane}`}
            ref={(el) => {
              slotAnchorRefs.current.enemy[lane] = el;
            }}
            className="fixed top-0 left-0 will-change-transform"
          >
            {unit && (
              <button
                type="button"
                onClick={() => {
                  if (canTargetEnemy) onSelectEnemyLane(lane);
                  else onInspectUnit(unit);
                }}
                className={[
                  'pointer-events-auto w-[142px] rounded-lg border px-2 py-1.5 text-left transition-colors cursor-pointer bg-[#09131e]/90 shadow-[0_6px_16px_rgba(0,0,0,0.55)]',
                  canTargetEnemy
                    ? 'border-rose-400 ring-2 ring-rose-500/45 hover:bg-[#1a1019]'
                    : 'border-rose-900/75 hover:border-rose-500/70',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-1 text-[9px] font-mono-tabular">
                  <span className="text-rose-400 truncate">
                    {unit.subtype ?? 'Patógeno'}
                  </span>
                  {canTargetEnemy && (
                    <span className="text-amber-300 font-semibold inline-flex items-center gap-0.5 shrink-0">
                      <Crosshair className="w-2.5 h-2.5" aria-hidden="true" />
                      {isCombat ? 'Atacar' : 'Aplicar'}
                    </span>
                  )}
                </div>

                <div className="font-display text-[11px] font-semibold text-slate-100 truncate">
                  {unit.name}
                </div>

                <CompactStatuses unit={unit} />

                {combatPreview && (
                  <div
                    className={`text-[9px] font-mono-tabular truncate mt-0.5 ${
                      combatPreview.tone === 'advantage'
                        ? 'text-emerald-300'
                        : combatPreview.tone === 'danger'
                          ? 'text-rose-300'
                          : 'text-amber-300'
                    }`}
                  >
                    {combatPreview.outcomeText}
                  </div>
                )}

                {effHint && (
                  <div className="text-[9px] font-mono-tabular text-sky-300 truncate mt-0.5">
                    {effHint.reason ?? `Eficacia x${effHint.mult}`}
                  </div>
                )}

                <div className="h-1 rounded-full bg-slate-800 overflow-hidden my-1">
                  <div
                    className="h-full bg-rose-500 transition-[width] duration-150"
                    style={{
                      width: `${Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono-tabular font-semibold">
                  <span className="text-amber-400 inline-flex items-center gap-0.5">
                    <Swords className="w-2.5 h-2.5" aria-hidden="true" />
                    {unit.statuses.aturdido
                      ? 0
                      : Math.max(150, unit.atk - (unit.statuses.inhibido ? 450 : 0))}
                  </span>
                  <span className="text-rose-300">
                    {unit.hp}/{unit.maxHp}
                  </span>
                </div>
              </button>
            )}
          </div>
        );
      })}

      {/* PROJECTED ALLIED SLOT ANCHORS */}
      {[0, 1, 2].map((lane) => {
        const unit = playerSlots[lane];
        const isMoveDest = isPrep && movingFromLane !== null && !unit;
        const canSummonHere = selectingSummonLane && !unit;
        const isPendingAttack =
          isCombat && pendingAttackerLanes.includes(lane);
        const isSelectedAttacker =
          isCombat && selectedAttackerLane === lane;

        const hasSkill = Boolean(unit?.activeSkillCost);
        const skillReady =
          isPrep &&
          unit !== null &&
          hasSkill &&
          !unit.usedActiveSkillThisTurn &&
          energy >= (unit.activeSkillCost ?? 99);
        const canMove =
          isPrep &&
          unit !== null &&
          playerSlots.some((s) => s === null) &&
          (freeMovesLeft > 0 || energy >= 1);

        return (
          <div
            key={`player-anchor-${lane}`}
            ref={(el) => {
              slotAnchorRefs.current.player[lane] = el;
            }}
            className="fixed top-0 left-0 will-change-transform"
          >
            {/* Empty lane ONLY appears as a compact deploy/move prompt when placing/moving */}
            {!unit && (canSummonHere || isMoveDest) && (
              <button
                type="button"
                onClick={() => onSelectPlayerLane(lane)}
                className="pointer-events-auto px-3 py-1.5 rounded-lg border border-emerald-400 bg-[#08241d]/92 hover:bg-emerald-500/30 text-emerald-300 font-mono-tabular text-[11px] font-semibold shadow-lg cursor-pointer whitespace-nowrap"
              >
                {canSummonHere ? `+ Desplegar Carril ${lane + 1}` : `Mover a Carril ${lane + 1}`}
              </button>
            )}

            {/* Occupied unit compact plaque */}
            {unit && (
              <div
                className={[
                  'pointer-events-auto w-[144px] rounded-lg border px-2 py-1.5 text-left bg-[#091520]/90 shadow-[0_6px_16px_rgba(0,0,0,0.55)] transition-colors',
                  isSelectedAttacker
                    ? 'border-amber-400 ring-2 ring-amber-400/50'
                    : isPendingAttack
                      ? 'border-amber-500/80 ring-1 ring-amber-400/35'
                      : movingFromLane === lane
                        ? 'border-sky-400 ring-2 ring-sky-400/45'
                        : selectingAllyCard
                          ? 'border-sky-400 ring-2 ring-sky-400/45'
                          : 'border-emerald-700/75',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isCombat || selectingAllyCard) {
                      onSelectPlayerLane(lane);
                    } else {
                      onInspectUnit(unit);
                    }
                  }}
                  className="w-full text-left cursor-pointer focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between gap-1 text-[9px] font-mono-tabular">
                    <span className="text-emerald-400 truncate">{unit.medicalClass}</span>
                    {isCombat && (
                      <span
                        className={
                          isSelectedAttacker
                            ? 'text-amber-300 font-bold'
                            : isPendingAttack
                              ? 'text-amber-400 font-semibold'
                              : 'text-slate-500'
                        }
                      >
                        {unit.statuses.aturdido
                          ? 'Aturdido'
                          : unit.hasAttackedThisTurn
                            ? 'Atacó'
                            : isSelectedAttacker
                              ? 'Atacante'
                              : 'Sin atacar'}
                      </span>
                    )}
                  </div>

                  <div className="font-display text-[11px] font-semibold text-slate-100 truncate">
                    {unit.name}
                  </div>

                  <CompactStatuses unit={unit} />

                  <div className="h-1 rounded-full bg-slate-800 overflow-hidden my-1">
                    <div
                      className="h-full bg-emerald-500 transition-[width] duration-150"
                      style={{
                        width: `${Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono-tabular font-semibold">
                    <span className="text-amber-400 inline-flex items-center gap-0.5">
                      <Swords className="w-2.5 h-2.5" aria-hidden="true" />
                      {unit.atk}
                    </span>
                    <span className="text-emerald-300">
                      {unit.hp}/{unit.maxHp}
                    </span>
                  </div>
                </button>

                {isPrep && !selectingAllyCard && !selectingSummonLane && (
                  <div className="flex items-center gap-1 pt-1 mt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={!canMove}
                      onClick={() => onStartMoveUnit(lane)}
                      title={
                        freeMovesLeft > 0
                          ? 'Mover a otro carril (Gratis 1/turno)'
                          : 'Mover a otro carril (1 PA)'
                      }
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono-tabular ${
                        canMove
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
                          : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>{freeMovesLeft > 0 ? 'Mover' : '1PA'}</span>
                    </button>

                    {hasSkill && (
                      <button
                        type="button"
                        disabled={!skillReady}
                        onClick={() => onActivateSkill(lane)}
                        title={unit.shortRule}
                        className={`flex-1 inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono-tabular truncate ${
                          skillReady
                            ? 'bg-sky-500/20 border border-sky-500/40 hover:bg-sky-500/35 text-sky-300 cursor-pointer'
                            : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <Sparkles className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {unit.usedActiveSkillThisTurn
                            ? 'Usada'
                            : unit.activeSkillLabel?.split(' (')[0]}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
