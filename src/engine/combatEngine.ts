import { getEffectivenessMultiplier } from '../data/medicalCards';
import { ORGAN_PROFILES } from '../data/organs';
import {
  ArmedTrap,
  AttackPreview,
  BoardUnit,
  CardInstance,
  CombatEvent,
  DuelCard,
  IntentAction,
  MedicalClass,
  OrganId,
  RivalDuelist,
  RivalIntent,
  RivalOutbreakCard,
  TrapTrigger,
  TurnPhase,
} from '../types/game';
import { nextSeqId, rngPick, rngShuffle } from './rng';

export interface DuelEngineState {
  turn: number;
  phase: TurnPhase;
  playerLp: number;
  playerMaxLp: number;
  rivalLp: number;
  rivalMaxLp: number;
  energy: number;
  maxEnergy: number;
  freeMovesLeft: number;
  nextTurnEnergyPenalty: number;
  organId: OrganId;
  playerSlots: Array<BoardUnit | null>;
  enemySlots: Array<BoardUnit | null>;
  armedTraps: ArmedTrap[];
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  rivalIntent: RivalIntent;
  rngState: number;
  idSequence: number;
}

export type CommandErrorCode =
  | 'TERMINAL_STATE'
  | 'INVALID_PHASE'
  | 'INVALID_LANE'
  | 'CARD_NOT_IN_HAND'
  | 'INSUFFICIENT_PA'
  | 'SLOT_OCCUPIED'
  | 'NO_EMPTY_SLOT'
  | 'TRAP_ZONE_FULL'
  | 'INVALID_TARGET'
  | 'UNIT_NOT_FOUND'
  | 'UNIT_STUNNED'
  | 'ALREADY_ATTACKED'
  | 'SKILL_UNAVAILABLE'
  | 'SKILL_USED'
  | 'PENDING_ATTACKERS'
  | 'DIRECT_BLOCKED';

export interface CommandResult {
  ok: boolean;
  errorCode?: CommandErrorCode;
  reason?: string;
  nextState: DuelEngineState;
  events: CombatEvent[];
}

export type DuelCommand =
  | { type: 'PLAY_CARD'; cardUid: string; targetLane?: number }
  | { type: 'MOVE_UNIT'; fromLane: number; toLane: number }
  | { type: 'ACTIVATE_SKILL'; laneIndex: number }
  | { type: 'ATTACK'; attackerLane: number; targetLane: number | 'direct' };

const CLASS_HEX: Record<MedicalClass, number> = {
  Inmunologia: 0x10b981,
  Farmacologia: 0x0ea5e9,
  Cirugia: 0xf59e0b,
  Diagnostico: 0x38bdf8,
  Patogeno: 0xef4444,
};

function emitEvent(
  idSeq: number,
  partial: Omit<CombatEvent, 'id' | 'nonce'>,
): { event: CombatEvent; nextIdSeq: number } {
  const n = idSeq;
  return {
    event: {
      ...partial,
      id: `evt-${n}`,
      nonce: n,
    },
    nextIdSeq: idSeq + 1,
  };
}

export function isDuelTerminal(state: DuelEngineState): boolean {
  return state.playerLp <= 0 || state.rivalLp <= 0;
}

function hasMutator(rival: RivalDuelist, mutatorId: string): boolean {
  return rival.mutators.some((m) => m.id === mutatorId);
}

export function createBoardUnit(
  card: DuelCard | CardInstance,
  laneIndex: number,
  isEnemy: boolean,
  idSeq = 1,
  rival?: RivalDuelist,
  isOpeningEnemy = false,
): { unit: BoardUnit; nextIdSeq: number } {
  const res = nextSeqId(isEnemy ? 'enm' : 'aly', idSeq);
  const sourceCard: CardInstance =
    'uid' in card ? card : { ...card, uid: `src-${res.id}` };

  let initialBiofilm =
    card.ability === 'biofilm'
      ? card.id === 'e-sarm'
        ? 500
        : card.id === 'e-pseudo'
          ? 450
          : 400
      : 0;

  let maxHp = card.maxHp;
  let atk = card.atk;
  let initialShield = 0;

  if (isEnemy && rival) {
    if (hasMutator(rival, 'evasion_antigenica')) {
      maxHp += 200;
    }
    if (
      hasMutator(rival, 'biofilm_persistente') &&
      (card.subtype === 'Bacteriano' || card.subtype === 'Fungico')
    ) {
      initialBiofilm += 200;
    }
    if (isOpeningEnemy && hasMutator(rival, 'hipoxia_alveolar')) {
      atk += 150;
    }
  }

  if (!isEnemy && rival) {
    if (rival.organId === 'corazon' && card.medicalClass === 'Cirugia') {
      initialShield += 250;
    }
    if (rival.organId === 'epitelio') {
      initialShield += 250;
    }
    if (card.ability === 'escudo_plaquetario') {
      initialShield += 250;
    }
  }

  const statuses: BoardUnit['statuses'] = {};
  if (initialBiofilm > 0) statuses.biofilm = initialBiofilm;
  if (initialShield > 0) statuses.escudo = initialShield;

  return {
    unit: {
      uid: res.id,
      cardId: card.id,
      sourceCard,
      name: card.name,
      medicalClass: card.medicalClass,
      subtype: card.subtype,
      archetype: card.archetype,
      atk,
      baseAtk: atk,
      hp: maxHp,
      maxHp,
      ability: card.ability,
      abilityLabel: card.abilityLabel,
      activeSkillCost: card.activeSkillCost,
      activeSkillLabel: card.activeSkillLabel,
      usedActiveSkillThisTurn: false,
      hasAttackedThisTurn: false,
      statuses,
      laneIndex,
      isEnemy,
      shortRule: card.shortRule,
      medicalBasis: card.medicalBasis,
    },
    nextIdSeq: res.nextSeq,
  };
}

export function drawCardsPure(
  count: number,
  drawPile: CardInstance[],
  discardPile: CardInstance[],
  rngState: number,
): {
  drawn: CardInstance[];
  nextDraw: CardInstance[];
  nextDiscard: CardInstance[];
  nextRngState: number;
} {
  let draw = [...drawPile];
  let discard = [...discardPile];
  let rng = rngState;
  const drawn: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    if (draw.length === 0) {
      if (discard.length === 0) break;
      const sh = rngShuffle(rng, discard);
      draw = sh.items;
      rng = sh.nextState;
      discard = [];
    }
    const top = draw.shift();
    if (top) drawn.push(top);
  }
  return { drawn, nextDraw: draw, nextDiscard: discard, nextRngState: rng };
}

export function getEffectiveUnitAtk(
  unit: BoardUnit,
  organId?: OrganId,
  enemySlots?: Array<BoardUnit | null>,
): number {
  if (unit.statuses.aturdido) return 0;
  const inhibPenalty = unit.statuses.inhibido ? 450 : 0;
  const supPenalty = unit.statuses.inmunosuprimido ? 250 : 0;
  const tempBoost = unit.statuses.tempAtkBoost ?? 0;

  let brainBonus = 0;
  if (
    !unit.isEnemy &&
    organId === 'cerebro' &&
    enemySlots?.some((e) => Boolean(e?.statuses.opsonizado))
  ) {
    brainBonus = 150;
  }

  return Math.max(150, unit.atk + tempBoost + brainBonus - inhibPenalty - supPenalty);
}

/**
 * Planifica las intenciones rivales de manera transparente (A06):
 * enumera presión directa en carriles abiertos + invocación / carta de brote / mutación.
 */
export function planRivalIntent(
  rival: RivalDuelist,
  enemySlots: Array<BoardUnit | null>,
  playerSlots: Array<BoardUnit | null>,
  rngState: number,
  turnNumber = 1,
): { intent: RivalIntent; nextRngState: number } {
  let rng = rngState;
  const actions: IntentAction[] = [];

  // 1. Direct pressure from active pathogens facing open lanes
  for (let lane = 0; lane < 3; lane++) {
    const en = enemySlots[lane];
    const ally = playerSlots[lane];
    if (en && !ally && !en.statuses.aturdido) {
      const est =
        getEffectiveUnitAtk(en) + (hasMutator(rival, 'coagulopatia') ? 150 : 0);
      actions.push({
        id: `press-${lane}`,
        kind: 'direct_pressure',
        label: `Presión Carril ${lane + 1}: -${est} LP`,
        description: `${en.name} avanzará por Carril ${lane + 1} si sigue sin defensa (-${est} LP).`,
        lane,
        estimatedDamage: est,
        cardName: en.name,
      });
    }
  }

  // 2. Decide between Outbreak Card (every 2nd turn or when board has >=2 enemies) or Summon
  const openLanes = [0, 1, 2].filter((idx) => enemySlots[idx] === null);
  const occupiedCount = 3 - openLanes.length;
  const hasOutbreaks = rival.outbreakDeck.length > 0;
  const shouldPlayOutbreak =
    hasOutbreaks && (occupiedCount >= 2 || (turnNumber >= 2 && turnNumber % 2 === 0 && occupiedCount >= 1));

  if (shouldPlayOutbreak) {
    const obPick = rngPick(rng, rival.outbreakDeck);
    rng = obPick.nextState;
    const ob = obPick.item;
    actions.push({
      id: `outbreak-${ob.id}`,
      kind: 'outbreak_card',
      label: `Brote: ${ob.name}`,
      description: ob.description,
      lane: -1,
      cardName: ob.name,
    });
    return {
      intent: {
        actionTitle: `Carta de Brote: ${ob.name}`,
        description: `${ob.description}${
          actions.length > 1 ? ` Además ${actions.length - 1} presión(es) directa(s).` : ''
        }`,
        plannedLane: -1,
        plannedOutbreakId: ob.id,
        actions,
      },
      nextRngState: rng,
    };
  }

  if (openLanes.length > 0) {
    const preferred =
      openLanes.find((idx) => playerSlots[idx] === null) ?? openLanes[0];
    const cardPick = rngPick(rng, rival.deck);
    rng = cardPick.nextState;
    const card = cardPick.item;

    actions.push({
      id: `summon-${preferred}`,
      kind: 'summon',
      label: `Invasión C${preferred + 1}: ${card.name}`,
      description: `Desplegará ${card.name} (${card.atk} ATK / ${card.maxHp} PS) en Carril ${preferred + 1}.`,
      lane: preferred,
      cardName: card.name,
    });

    return {
      intent: {
        actionTitle: `Invasión en Carril ${preferred + 1}`,
        description: `Desplegará ${card.name} (${card.atk} ATK / ${card.maxHp} PS) en Carril ${preferred + 1}.`,
        plannedLane: preferred,
        plannedCardName: card.name,
        actions,
      },
      nextRngState: rng,
    };
  }

  actions.push({
    id: 'mutation-buff',
    kind: 'mutation_buff',
    label: 'Mutación Virulenta (+250/+250)',
    description: 'Potenciará +250 ATK y +250 PS a todos sus patógenos activos no inhibidos.',
    lane: -1,
  });

  return {
    intent: {
      actionTitle: 'Mutación Virulenta',
      description: 'Potenciará +250 ATK y +250 PS a todos sus patógenos activos.',
      plannedLane: -1,
      actions,
    },
    nextRngState: rng,
  };
}

export function canPlayCard(
  state: DuelEngineState,
  cardUid: string,
): { valid: boolean; errorCode?: CommandErrorCode; reason?: string } {
  if (isDuelTerminal(state)) {
    return {
      valid: false,
      errorCode: 'TERMINAL_STATE',
      reason: 'El duelo ya ha finalizado.',
    };
  }

  const card = state.hand.find((c) => c.uid === cardUid);
  if (!card) {
    return {
      valid: false,
      errorCode: 'CARD_NOT_IN_HAND',
      reason: 'Carta no encontrada en mano.',
    };
  }

  if (card.cost > state.energy) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_PA',
      reason: `Requiere ${card.cost} PA (tienes ${state.energy} PA).`,
    };
  }

  if (card.kind === 'Unidad') {
    const hasSpace = state.playerSlots.some((s) => s === null);
    if (!hasSpace) {
      return {
        valid: false,
        errorCode: 'NO_EMPTY_SLOT',
        reason: 'Los 3 carriles aliados están ocupados.',
      };
    }
  }

  if (card.kind === 'Trampa' && state.armedTraps.length >= 2) {
    return {
      valid: false,
      errorCode: 'TRAP_ZONE_FULL',
      reason: 'Máximo 2 Trampas armadas simultáneamente.',
    };
  }

  if (card.targetMode === 'ally' && !state.playerSlots.some(Boolean)) {
    return {
      valid: false,
      errorCode: 'INVALID_TARGET',
      reason: 'Requiere al menos 1 unidad aliada en el campo.',
    };
  }

  if (card.targetMode === 'enemy' && !state.enemySlots.some(Boolean)) {
    return {
      valid: false,
      errorCode: 'INVALID_TARGET',
      reason: 'No hay patógenos activos en el campo rival.',
    };
  }

  return { valid: true };
}

function computeUnitAttackDamage(
  attacker: BoardUnit,
  defender: BoardUnit | null,
  organId?: OrganId,
  enemySlots?: Array<BoardUnit | null>,
): {
  rawDmg: number;
  finalDmg: number;
  biofilmBlocked: number;
  superEff: boolean;
  organBonus: boolean;
} {
  const effectiveAtk = getEffectiveUnitAtk(attacker, organId, enemySlots);
  if (effectiveAtk === 0) {
    return {
      rawDmg: 0,
      finalDmg: 0,
      biofilmBlocked: 0,
      superEff: false,
      organBonus: false,
    };
  }

  if (!defender) {
    return {
      rawDmg: effectiveAtk,
      finalDmg: effectiveAtk,
      biofilmBlocked: 0,
      superEff: false,
      organBonus: false,
    };
  }

  const { mult, organBonus } = getEffectivenessMultiplier(
    attacker.medicalClass,
    undefined,
    defender.subtype,
    Boolean(defender.statuses.opsonizado),
    organId,
  );

  let dmg = Math.round(effectiveAtk * mult);
  if (
    attacker.ability === 'perforina' &&
    (defender.statuses.opsonizado || defender.statuses.inhibido)
  ) {
    dmg += 350;
  }
  if (
    attacker.ability === 'citotoxicidad_nk' &&
    (defender.subtype === 'Viral' || Boolean(defender.statuses.biofilm))
  ) {
    dmg += 400;
  }

  const biofilm = defender.statuses.biofilm ?? 0;
  const ignoreBiofilm =
    attacker.ability === 'perforina' || attacker.ability === 'citotoxicidad_nk';
  const blocked = ignoreBiofilm ? 0 : Math.min(biofilm, dmg);

  return {
    rawDmg: dmg,
    finalDmg: Math.max(0, dmg - blocked),
    biofilmBlocked: blocked,
    superEff: mult > 1.05,
    organBonus,
  };
}

export function getPendingAttackers(state: DuelEngineState): BoardUnit[] {
  return state.playerSlots.filter(
    (u): u is BoardUnit =>
      u !== null && !u.hasAttackedThisTurn && !u.statuses.aturdido,
  );
}

export function canEndTurn(state: DuelEngineState): {
  allowed: boolean;
  reason?: string;
  pendingLanes: number[];
} {
  const pending = getPendingAttackers(state);
  if (pending.length > 0) {
    const names = pending.map((u) => u.name).join(', ');
    return {
      allowed: false,
      reason: `No puedes finalizar el turno sin atacar. Unidades pendientes: ${names}.`,
      pendingLanes: pending.map((u) => u.laneIndex),
    };
  }
  return { allowed: true, pendingLanes: [] };
}

export function computeAttackPreview(
  attacker: BoardUnit,
  defender: BoardUnit | null,
  organId?: OrganId,
  enemySlots?: Array<BoardUnit | null>,
): AttackPreview {
  if (!defender) {
    const dmg = getEffectiveUnitAtk(attacker, organId, enemySlots);
    return {
      damageOut: dmg,
      counterDamage: 0,
      outcomeText: `Ataque directo: -${dmg} LP rival`,
      tone: 'advantage',
      isSuperEffective: false,
      organBonusNote: null,
    };
  }

  const atkInfo = computeUnitAttackDamage(attacker, defender, organId, enemySlots);
  const rawCounter = defender.statuses.aturdido ? 0 : getEffectiveUnitAtk(defender);
  const allyShield = attacker.statuses.escudo ?? 0;
  const counterDmg = Math.max(0, rawCounter - allyShield);

  const enemySurvives = defender.hp - atkInfo.finalDmg > 0;
  const allySurvives = attacker.hp - counterDmg > 0;

  let outcomeText = `Choque ${atkInfo.finalDmg} vs ${counterDmg}`;
  let tone: AttackPreview['tone'] =
    atkInfo.finalDmg >= counterDmg ? 'advantage' : 'danger';

  if (!enemySurvives && allySurvives) {
    outcomeText = `Neutraliza (-${atkInfo.finalDmg} PS)`;
    tone = 'advantage';
  } else if (enemySurvives && !allySurvives) {
    outcomeText = `Aliado cae (-${counterDmg} PS)`;
    tone = 'danger';
  } else if (!enemySurvives && !allySurvives) {
    outcomeText = 'Neutralización mutua';
    tone = 'even';
  }

  return {
    damageOut: atkInfo.finalDmg,
    counterDamage: counterDmg,
    outcomeText,
    tone,
    isSuperEffective: atkInfo.superEff,
    organBonusNote: atkInfo.organBonus
      ? `Sinergia ${ORGAN_PROFILES[organId!].shortName}`
      : null,
  };
}

function isValidLane(lane: unknown): lane is number {
  return typeof lane === 'number' && Number.isInteger(lane) && lane >= 0 && lane <= 2;
}

/**
 * Validación unificada en frontera de dominio (A02).
 */
export function validateDuelCommand(
  state: DuelEngineState,
  command: DuelCommand,
): { valid: boolean; errorCode?: CommandErrorCode; reason?: string } {
  if (isDuelTerminal(state)) {
    return {
      valid: false,
      errorCode: 'TERMINAL_STATE',
      reason: 'El duelo ya ha terminado.',
    };
  }

  if (command.type === 'PLAY_CARD') {
    if (state.phase !== 'PREPARACION') {
      return {
        valid: false,
        errorCode: 'INVALID_PHASE',
        reason: 'Solo puedes jugar cartas en Fase de Preparación.',
      };
    }
    const base = canPlayCard(state, command.cardUid);
    if (!base.valid) return base;

    const card = state.hand.find((c) => c.uid === command.cardUid)!;
    if (card.kind === 'Unidad') {
      if (command.targetLane !== undefined) {
        if (!isValidLane(command.targetLane)) {
          return {
            valid: false,
            errorCode: 'INVALID_LANE',
            reason: 'Índice de carril fuera de rango (0-2).',
          };
        }
        if (state.playerSlots[command.targetLane] !== null) {
          return {
            valid: false,
            errorCode: 'SLOT_OCCUPIED',
            reason: `El Carril ${command.targetLane + 1} ya está ocupado.`,
          };
        }
      }
    } else if (card.targetMode === 'ally') {
      if (!isValidLane(command.targetLane) || !state.playerSlots[command.targetLane]) {
        return {
          valid: false,
          errorCode: 'INVALID_TARGET',
          reason: 'Selecciona una unidad aliada válida en el campo.',
        };
      }
    } else if (card.targetMode === 'enemy') {
      if (!isValidLane(command.targetLane) || !state.enemySlots[command.targetLane]) {
        return {
          valid: false,
          errorCode: 'INVALID_TARGET',
          reason: 'Selecciona un patógeno rival válido en el campo.',
        };
      }
    }
    return { valid: true };
  }

  if (command.type === 'MOVE_UNIT') {
    if (state.phase !== 'PREPARACION') {
      return {
        valid: false,
        errorCode: 'INVALID_PHASE',
        reason: 'Solo puedes mover unidades en Fase de Preparación.',
      };
    }
    if (!isValidLane(command.fromLane) || !isValidLane(command.toLane)) {
      return {
        valid: false,
        errorCode: 'INVALID_LANE',
        reason: 'Carril fuera de rango.',
      };
    }
    if (!state.playerSlots[command.fromLane] || state.playerSlots[command.toLane] !== null) {
      return {
        valid: false,
        errorCode: 'INVALID_TARGET',
        reason: 'Movimiento inválido: origen vacío o destino ocupado.',
      };
    }
    const moveCost = state.freeMovesLeft > 0 ? 0 : 1;
    if (moveCost > state.energy) {
      return {
        valid: false,
        errorCode: 'INSUFFICIENT_PA',
        reason: 'Sin PA para reposicionar.',
      };
    }
    return { valid: true };
  }

  if (command.type === 'ACTIVATE_SKILL') {
    if (state.phase !== 'PREPARACION') {
      return {
        valid: false,
        errorCode: 'INVALID_PHASE',
        reason: 'Las habilidades activas se usan en Preparación.',
      };
    }
    if (!isValidLane(command.laneIndex)) {
      return { valid: false, errorCode: 'INVALID_LANE', reason: 'Carril inválido.' };
    }
    const unit = state.playerSlots[command.laneIndex];
    if (!unit || !unit.activeSkillCost) {
      return {
        valid: false,
        errorCode: 'SKILL_UNAVAILABLE',
        reason: 'Esta unidad no tiene habilidad manual.',
      };
    }
    if (unit.usedActiveSkillThisTurn) {
      return {
        valid: false,
        errorCode: 'SKILL_USED',
        reason: 'Habilidad ya usada este turno.',
      };
    }
    if (unit.activeSkillCost > state.energy) {
      return {
        valid: false,
        errorCode: 'INSUFFICIENT_PA',
        reason: `Requiere ${unit.activeSkillCost} PA.`,
      };
    }
    if (
      (unit.ability === 'opsonizacion' || unit.ability === 'descarga_sincronizada') &&
      !state.enemySlots[command.laneIndex]
    ) {
      return {
        valid: false,
        errorCode: 'INVALID_TARGET',
        reason: 'No hay un patógeno frente a este carril.',
      };
    }
    return { valid: true };
  }

  if (command.type === 'ATTACK') {
    if (state.phase !== 'COMBATE') {
      return {
        valid: false,
        errorCode: 'INVALID_PHASE',
        reason: 'Los ataques se realizan en Fase de Combate.',
      };
    }
    if (!isValidLane(command.attackerLane)) {
      return { valid: false, errorCode: 'INVALID_LANE', reason: 'Carril atacante inválido.' };
    }
    const ally = state.playerSlots[command.attackerLane];
    if (!ally) {
      return { valid: false, errorCode: 'UNIT_NOT_FOUND', reason: 'No hay unidad aliada en ese carril.' };
    }
    if (ally.statuses.aturdido) {
      return { valid: false, errorCode: 'UNIT_STUNNED', reason: `${ally.name} está aturdido este turno.` };
    }
    if (ally.hasAttackedThisTurn) {
      return { valid: false, errorCode: 'ALREADY_ATTACKED', reason: `${ally.name} ya atacó en este turno.` };
    }
    if (command.targetLane === 'direct') {
      if (state.enemySlots.some(Boolean)) {
        return {
          valid: false,
          errorCode: 'DIRECT_BLOCKED',
          reason: 'Debes neutralizar primero a los patógenos activos antes del ataque directo.',
        };
      }
      return { valid: true };
    }
    if (!isValidLane(command.targetLane) || !state.enemySlots[command.targetLane]) {
      return { valid: false, errorCode: 'INVALID_TARGET', reason: 'No hay patógeno objetivo en ese carril.' };
    }
    return { valid: true };
  }

  return { valid: false, errorCode: 'INVALID_TARGET', reason: 'Comando desconocido.' };
}

export function resolveManualAttack(
  state: DuelEngineState,
  attackerLane: number,
  targetLane: number | 'direct',
): { nextState: DuelEngineState; events: CombatEvent[]; error?: string } {
  const check = validateDuelCommand(
    { ...state, phase: 'COMBATE' },
    { type: 'ATTACK', attackerLane, targetLane },
  );
  if (!check.valid) {
    return { nextState: state, events: [], error: check.reason };
  }

  const ally = state.playerSlots[attackerLane]!;
  let idSeq = state.idSequence;
  const nextState: DuelEngineState = {
    ...state,
    playerSlots: [...state.playerSlots],
    enemySlots: [...state.enemySlots],
    discardPile: [...state.discardPile],
  };

  if (targetLane === 'direct') {
    const dmg = getEffectiveUnitAtk(ally, state.organId, state.enemySlots);
    nextState.rivalLp = Math.max(0, nextState.rivalLp - dmg);
    nextState.playerSlots[attackerLane] = { ...ally, hasAttackedThisTurn: true };

    const ev = emitEvent(idSeq, {
      animKind: 'direct_strike',
      sourceSide: 'player',
      sourceLane: attackerLane,
      targetSide: 'enemy',
      targetLane: -1,
      colorHex: CLASS_HEX[ally.medicalClass],
      value: dmg,
      isCritical: false,
      label: `-${dmg} LP Brote`,
      logText: `${ally.name} ejecuta ataque directo al brote (-${dmg} LP).`,
      logCategory: 'combat',
    });
    nextState.idSequence = ev.nextIdSeq;
    return { nextState, events: [ev.event] };
  }

  const enemy = state.enemySlots[targetLane]!;
  const aUnit: BoardUnit = { ...ally, hasAttackedThisTurn: true };
  const eUnit: BoardUnit = { ...enemy };

  const atkInfo = computeUnitAttackDamage(
    aUnit,
    eUnit,
    state.organId,
    state.enemySlots,
  );
  const rawCounter = eUnit.statuses.aturdido ? 0 : getEffectiveUnitAtk(eUnit);
  const shield = aUnit.statuses.escudo ?? 0;
  const blockedByShield = Math.min(shield, rawCounter);
  const enemyCounter = Math.max(0, rawCounter - blockedByShield);

  if (blockedByShield > 0) {
    const st = { ...aUnit.statuses };
    const rem = shield - blockedByShield;
    if (rem > 0) st.escudo = rem;
    else delete st.escudo;
    aUnit.statuses = st;
  }

  if (atkInfo.biofilmBlocked > 0 && eUnit.statuses.biofilm) {
    const remBio = eUnit.statuses.biofilm - atkInfo.biofilmBlocked;
    const nextSt = { ...eUnit.statuses };
    if (remBio > 0) nextSt.biofilm = remBio;
    else delete nextSt.biofilm;
    eUnit.statuses = nextSt;
  }

  eUnit.hp -= atkInfo.finalDmg;
  aUnit.hp -= enemyCounter;

  // Neutrófilo PMN applies Inflamado on hit
  if (eUnit.hp > 0 && aUnit.ability === 'inflamacion_net') {
    eUnit.statuses = { ...eUnit.statuses, inflamado: 2 };
  }

  const enemyDestroyed = eUnit.hp <= 0;
  const allyDestroyed = aUnit.hp <= 0;

  if (enemyDestroyed && !allyDestroyed && aUnit.ability === 'fagocitosis') {
    const bonusHeal = state.organId === 'epitelio' ? 550 : 400;
    aUnit.hp = Math.min(aUnit.maxHp, aUnit.hp + bonusHeal);
    aUnit.atk += 250;
  }

  // A01: Destroyed allied unit returns its sourceCard to discardPile cleanly
  if (allyDestroyed) {
    nextState.discardPile.push(aUnit.sourceCard);
  }

  nextState.enemySlots[targetLane] = enemyDestroyed ? null : eUnit;
  nextState.playerSlots[attackerLane] = allyDestroyed ? null : aUnit;

  const animKind =
    aUnit.ability === 'fagocitosis'
      ? 'phagocytosis'
      : aUnit.ability === 'opsonizacion'
        ? 'opsonize'
        : 'clash';

  const ev = emitEvent(idSeq, {
    animKind,
    sourceSide: 'player',
    sourceLane: attackerLane,
    targetSide: 'enemy',
    targetLane,
    colorHex: CLASS_HEX[aUnit.medicalClass],
    value: atkInfo.finalDmg,
    isCritical: atkInfo.superEff,
    label: `${atkInfo.finalDmg} vs ${enemyCounter}`,
    logText: `${aUnit.name} ataca a ${eUnit.name} (${atkInfo.finalDmg} daño${
      atkInfo.superEff ? ' ¡Crítico!' : ''
    }, contraataque ${enemyCounter}${
      blockedByShield > 0 ? `, Escudo -${blockedByShield}` : ''
    }).${enemyDestroyed ? ` ${eUnit.name} neutralizado.` : ''}${
      enemyDestroyed && !allyDestroyed && aUnit.ability === 'fagocitosis'
        ? ' Fagocitosis (+PS / +250 ATK).'
        : ''
    }${allyDestroyed ? ` ${aUnit.name} cae al descarte.` : ''}`,
    logCategory: 'combat',
  });
  nextState.idSequence = ev.nextIdSeq;

  return { nextState, events: [ev.event] };
}

export function resolvePlayCard(
  state: DuelEngineState,
  cardUid: string,
  targetLane?: number,
  rival?: RivalDuelist,
): { nextState: DuelEngineState; events: CombatEvent[]; error?: string } {
  const check = validateDuelCommand(
    { ...state, phase: 'PREPARACION' },
    { type: 'PLAY_CARD', cardUid, targetLane },
  );
  if (!check.valid) {
    return { nextState: state, events: [], error: check.reason };
  }

  const card = state.hand.find((c) => c.uid === cardUid)!;
  let idSeq = state.idSequence;
  let rng = state.rngState;
  const events: CombatEvent[] = [];

  const nextState: DuelEngineState = {
    ...state,
    energy: state.energy - card.cost,
    hand: state.hand.filter((c) => c.uid !== cardUid),
    discardPile: [...state.discardPile],
    playerSlots: [...state.playerSlots],
    enemySlots: [...state.enemySlots],
    armedTraps: [...state.armedTraps],
  };

  // 1. UNIT SUMMON (A01: sourceCard stays with BoardUnit until destroyed, NOT discarded immediately)
  if (card.kind === 'Unidad') {
    const lane =
      typeof targetLane === 'number'
        ? targetLane
        : nextState.playerSlots.findIndex((s) => s === null);
    if (lane === -1 || nextState.playerSlots[lane] !== null) {
      return { nextState: state, events: [], error: 'Carril ocupado o inválido.' };
    }

    const created = createBoardUnit(card, lane, false, idSeq, rival);
    idSeq = created.nextIdSeq;
    const unit = created.unit;
    nextState.playerSlots[lane] = unit;

    const ev1 = emitEvent(idSeq, {
      animKind: 'summon',
      sourceSide: 'player',
      sourceLane: lane,
      targetSide: 'player',
      targetLane: lane,
      colorHex: CLASS_HEX[card.medicalClass],
      value: unit.atk,
      isCritical: false,
      label: `${unit.name} desplegado`,
      logText: `Despliegas ${unit.name} en Carril ${lane + 1} (${unit.atk} ATK / ${unit.hp} PS${
        unit.statuses.escudo ? ` · Escudo +${unit.statuses.escudo}` : ''
      }).`,
      logCategory: 'info',
    });
    idSeq = ev1.nextIdSeq;
    events.push(ev1.event);

    // Entry effect: Plaqueta Activada grants +350 Escudo to other allies
    if (card.ability === 'escudo_plaquetario') {
      nextState.playerSlots = nextState.playerSlots.map((al, idx) => {
        if (!al || idx === lane) return al;
        return {
          ...al,
          statuses: {
            ...al.statuses,
            escudo: (al.statuses.escudo ?? 0) + 350,
          },
        };
      });
    }

    // Entry effect: Anticuerpo IgG opsonizes opposing pathogen
    const opposing = nextState.enemySlots[lane];
    if (card.ability === 'opsonizacion' && opposing) {
      nextState.enemySlots[lane] = {
        ...opposing,
        statuses: { ...opposing.statuses, opsonizado: 2 },
      };
      const ev2 = emitEvent(idSeq, {
        animKind: 'opsonize',
        sourceSide: 'player',
        sourceLane: lane,
        targetSide: 'enemy',
        targetLane: lane,
        colorHex: 0x38bdf8,
        value: 50,
        isCritical: false,
        label: 'Opsonizado (+50% daño)',
        logText: `${unit.name} opsoniza a ${opposing.name} en Carril ${lane + 1} (+50% daño recibido).`,
        logCategory: 'info',
      });
      idSeq = ev2.nextIdSeq;
      events.push(ev2.event);
    }

    nextState.idSequence = idSeq;
    nextState.rngState = rng;
    return { nextState, events };
  }

  // 2. TRAP ARMING (stays in armedTraps until triggered)
  if (card.kind === 'Trampa' && card.trapTrigger && card.trapEffectId) {
    const trapId = nextSeqId('trp', idSeq);
    idSeq = trapId.nextSeq;
    nextState.armedTraps.push({
      uid: trapId.id,
      sourceCard: card,
      trigger: card.trapTrigger,
      effectId: card.trapEffectId,
      armedTurn: state.turn,
    });
    const ev = emitEvent(idSeq, {
      animKind: 'trap',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'player',
      targetLane: -1,
      colorHex: 0xa855f7,
      value: 1,
      isCritical: false,
      label: `Trampa Armada (${nextState.armedTraps.length}/2)`,
      logText: `Armas boca abajo ${card.name} (${card.abilityLabel}).`,
      logCategory: 'info',
    });
    nextState.idSequence = ev.nextIdSeq;
    nextState.rngState = rng;
    return { nextState, events: [ev.event] };
  }

  // Non-unit / non-trap cards go to discardPile AFTER resolving
  nextState.discardPile.push(card);

  // Brain Organ Synergy for Diagnostics: +200 Escudo to all allies
  const applyBrainDiagShield = () => {
    if (state.organId === 'cerebro') {
      nextState.playerSlots = nextState.playerSlots.map((al) =>
        al
          ? {
              ...al,
              statuses: {
                ...al.statuses,
                escudo: (al.statuses.escudo ?? 0) + 200,
              },
            }
          : null,
      );
    }
  };

  // 3. DIAGNOSTICS & GLOBAL TREATMENTS
  if (card.effectTag === 'diagnostico_pcr') {
    let marked = 0;
    nextState.enemySlots = nextState.enemySlots.map((en) => {
      if (!en) return null;
      marked++;
      return { ...en, statuses: { ...en.statuses, opsonizado: 2 } };
    });
    applyBrainDiagShield();
    const drawRes = drawCardsPure(1, nextState.drawPile, nextState.discardPile, rng);
    rng = drawRes.nextRngState;
    nextState.hand = [...nextState.hand, ...drawRes.drawn];
    nextState.drawPile = drawRes.nextDraw;
    nextState.discardPile = drawRes.nextDiscard;

    const ev = emitEvent(idSeq, {
      animKind: 'opsonize',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'enemy',
      targetLane: -1,
      colorHex: 0x38bdf8,
      value: marked,
      isCritical: false,
      label: 'PCR: Opsonización Global',
      logText: `Panel PCR identifica ${marked} patógeno(s) (+50% daño recibido) y robas 1 carta.`,
      logCategory: 'info',
    });
    nextState.idSequence = ev.nextIdSeq;
    nextState.rngState = rng;
    return { nextState, events: [ev.event] };
  }

  if (card.effectTag === 'hemocultivo') {
    const hasBacOrFung = nextState.enemySlots.some(
      (e) => e?.subtype === 'Bacteriano' || e?.subtype === 'Fungico',
    );
    const drawCount = hasBacOrFung ? 2 : 1;
    const drawRes = drawCardsPure(drawCount, nextState.drawPile, nextState.discardPile, rng);
    rng = drawRes.nextRngState;
    nextState.hand = [...nextState.hand, ...drawRes.drawn];
    nextState.drawPile = drawRes.nextDraw;
    nextState.discardPile = drawRes.nextDiscard;
    nextState.playerSlots = nextState.playerSlots.map((al) =>
      al
        ? {
            ...al,
            statuses: {
              ...al.statuses,
              escudo: (al.statuses.escudo ?? 0) + 200,
            },
          }
        : null,
    );
    applyBrainDiagShield();
    const ev = emitEvent(idSeq, {
      animKind: 'opsonize',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'player',
      targetLane: -1,
      colorHex: 0x38bdf8,
      value: drawCount,
      isCritical: false,
      label: `Hemocultivo (+${drawCount} carta${drawCount > 1 ? 's' : ''})`,
      logText: `Hemocultivo aporta +200 Escudo a aliados y robas ${drawCount} carta(s).`,
      logCategory: 'info',
    });
    nextState.idSequence = ev.nextIdSeq;
    nextState.rngState = rng;
    return { nextState, events: [ev.event] };
  }

  if (card.effectTag === 'vacuna') {
    nextState.playerSlots = nextState.playerSlots.map((al) => {
      if (!al) return null;
      const stacks = al.statuses.vacunaStacks ?? 0;
      if (stacks >= 2) return al;
      return {
        ...al,
        atk: al.atk + 300,
        hp: al.hp + 300,
        maxHp: al.maxHp + 300,
        statuses: { ...al.statuses, vacunaStacks: stacks + 1 },
      };
    });
    applyBrainDiagShield();
    const drawRes = drawCardsPure(1, nextState.drawPile, nextState.discardPile, rng);
    rng = drawRes.nextRngState;
    nextState.hand = [...nextState.hand, ...drawRes.drawn];
    nextState.drawPile = drawRes.nextDraw;
    nextState.discardPile = drawRes.nextDiscard;

    const ev = emitEvent(idSeq, {
      animKind: 'heal',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'player',
      targetLane: -1,
      colorHex: 0x10b981,
      value: 300,
      isCritical: false,
      label: 'Memoria Inmune +300',
      logText: 'Inmunización Activa refuerza hasta +300 ATK/+300 PS y robas 1 carta.',
      logCategory: 'heal',
    });
    nextState.idSequence = ev.nextIdSeq;
    nextState.rngState = rng;
    return { nextState, events: [ev.event] };
  }

  if (card.effectTag === 'hiperinmune') {
    const epBonus = state.organId === 'epitelio' ? 150 : 0;
    nextState.playerLp = Math.min(nextState.playerMaxLp, nextState.playerLp + 550 + epBonus);
    nextState.playerSlots = nextState.playerSlots.map((al) =>
      al
        ? {
            ...al,
            statuses: {
              ...al.statuses,
              escudo: (al.statuses.escudo ?? 0) + 350,
              regenerando: 2,
            },
          }
        : null,
    );
    applyBrainDiagShield();
    const drawRes = drawCardsPure(1, nextState.drawPile, nextState.discardPile, rng);
    rng = drawRes.nextRngState;
    nextState.hand = [...nextState.hand, ...drawRes.drawn];
    nextState.drawPile = drawRes.nextDraw;
    nextState.discardPile = drawRes.nextDiscard;

    const ev = emitEvent(idSeq, {
      animKind: 'heal',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'player',
      targetLane: -1,
      colorHex: 0x10b981,
      value: 550 + epBonus,
      isCritical: false,
      label: 'Suero Hiperinmune',
      logText: `Suero Hiperinmune restaura +${550 + epBonus} LP, otorga +350 Escudo y Regeneración.`,
      logCategory: 'heal',
    });
    nextState.idSequence = ev.nextIdSeq;
    nextState.rngState = rng;
    return { nextState, events: [ev.event] };
  }

  if (card.effectTag === 'suero') {
    const liverBonus = state.organId === 'higado' ? 150 : 0;
    const epBonus = state.organId === 'epitelio' ? 150 : 0;
    const lpGain = 750 + liverBonus + epBonus;
    nextState.playerLp = Math.min(nextState.playerMaxLp, nextState.playerLp + lpGain);
    nextState.playerSlots = nextState.playerSlots.map((al) => {
      if (!al) return null;
      const cleaned = { ...al.statuses };
      delete cleaned.sobrecarga;
      delete cleaned.inmunosuprimido;
      return {
        ...al,
        hp: Math.min(al.maxHp, al.hp + 350 + epBonus),
        statuses: cleaned,
      };
    });
    const ev = emitEvent(idSeq, {
      animKind: 'heal',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'player',
      targetLane: -1,
      colorHex: 0x10b981,
      value: lpGain,
      isCritical: false,
      label: `+${lpGain} LP · Perfusión`,
      logText: `Sueroterapia Ringer restaura +${lpGain} LP, cura aliados y limpia Sobrecarga.`,
      logCategory: 'heal',
    });
    nextState.idSequence = ev.nextIdSeq;
    nextState.rngState = rng;
    return { nextState, events: [ev.event] };
  }

  if (card.effectTag === 'corticosteroide') {
    nextState.playerSlots = nextState.playerSlots.map((al) => {
      if (!al) return null;
      const cleaned = { ...al.statuses };
      delete cleaned.inmunosuprimido;
      delete cleaned.sobrecarga;
      delete cleaned.aturdido;
      return {
        ...al,
        hp: Math.min(al.maxHp, al.hp + 250),
        statuses: cleaned,
      };
    });
    nextState.enemySlots = nextState.enemySlots.map((en) =>
      en ? { ...en, atk: Math.max(250, en.atk - 300) } : null,
    );
    const ev = emitEvent(idSeq, {
      animKind: 'heal',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'player',
      targetLane: -1,
      colorHex: 0x0ea5e9,
      value: 250,
      isCritical: false,
      label: 'Dexametasona (-300 ATK rival)',
      logText: 'Dexametasona IV limpia estados negativos aliados, cura +250 PS y atenúa patógenos.',
      logCategory: 'heal',
    });
    nextState.idSequence = ev.nextIdSeq;
    nextState.rngState = rng;
    return { nextState, events: [ev.event] };
  }

  if (card.effectTag === 'interferon') {
    let killed = 0;
    nextState.enemySlots = nextState.enemySlots.map((en) => {
      if (!en) return null;
      const base = en.subtype === 'Viral' ? 1050 : 650;
      const mult = state.organId === 'pulmon' ? 1.2 : 1.0;
      const dmg = Math.round(base * mult);
      const rem = en.hp - dmg;
      if (rem <= 0) {
        killed++;
        return null;
      }
      return {
        ...en,
        hp: rem,
        statuses: { ...en.statuses, inhibido: 1 },
      };
    });
    const ev = emitEvent(idSeq, {
      animKind: 'lysis',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'enemy',
      targetLane: -1,
      colorHex: 0x10b981,
      value: 1050,
      isCritical: true,
      label: 'Interferón Pegilado',
      logText: `Interferón Pegilado golpea todo el campo rival e inhibe replicación (${killed} eliminado(s)).`,
      logCategory: 'combat',
    });
    nextState.idSequence = ev.nextIdSeq;
    nextState.rngState = rng;
    return { nextState, events: [ev.event] };
  }

  // A16: Adrenalina applies temporary ATK boost for this turn + overload recoil
  if (card.effectTag === 'adrenalina' && typeof targetLane === 'number') {
    const ally = nextState.playerSlots[targetLane]!;
    const overloadVal = state.organId === 'higado' ? 125 : 250;
    nextState.playerSlots[targetLane] = {
      ...ally,
      statuses: {
        ...ally.statuses,
        tempAtkBoost: (ally.statuses.tempAtkBoost ?? 0) + 650,
        sobrecarga: (ally.statuses.sobrecarga ?? 0) + overloadVal,
      },
    };
    nextState.energy += 1;

    const ev = emitEvent(idSeq, {
      animKind: 'shock',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'player',
      targetLane,
      colorHex: 0xf59e0b,
      value: 650,
      isCritical: false,
      label: '+650 ATK (turno) · +1 PA',
      logText: `Adrenalina IV potencia a ${ally.name} (+650 ATK este turno, +1 PA, sobrecarga -${overloadVal} PS al cierre).`,
      logCategory: 'info',
    });
    nextState.idSequence = ev.nextIdSeq;
    nextState.rngState = rng;
    return { nextState, events: [ev.event] };
  }

  // Targeted Enemy Treatments (Antiviral, Antibiotico, Antifungico, Trombolisis)
  if (typeof targetLane === 'number') {
    const enemy = nextState.enemySlots[targetLane]!;
    const baseDmg =
      card.effectTag === 'antiviral'
        ? 900 + (state.organId === 'pulmon' ? 150 : 0)
        : card.effectTag === 'antibiotico'
          ? 1050
          : card.effectTag === 'antifungico'
            ? 950
            : 1000;

    const { mult, reason } = getEffectivenessMultiplier(
      card.medicalClass,
      card.effectTag,
      enemy.subtype,
      Boolean(enemy.statuses.opsonizado),
      state.organId,
    );
    const totalDmg = Math.round(baseDmg * mult);

    const updatedStatuses = { ...enemy.statuses };
    let biofilmRemoved = false;

    if (card.effectTag === 'antibiotico' && updatedStatuses.biofilm) {
      delete updatedStatuses.biofilm;
      biofilmRemoved = true;
    }
    if (card.effectTag === 'antiviral') {
      updatedStatuses.inhibido = 2;
    }
    if (card.effectTag === 'antifungico') {
      updatedStatuses.inflamado = 2;
    }

    const biofilm = updatedStatuses.biofilm ?? 0;
    const blocked = Math.min(biofilm, totalDmg);
    if (biofilm > 0) {
      const remBio = biofilm - blocked;
      if (remBio > 0) updatedStatuses.biofilm = remBio;
      else delete updatedStatuses.biofilm;
    }

    const netDmg = Math.max(0, totalDmg - blocked);
    const remHp = enemy.hp - netDmg;
    nextState.enemySlots[targetLane] =
      remHp > 0 ? { ...enemy, hp: remHp, statuses: updatedStatuses } : null;

    if (card.effectTag === 'trombolisis') {
      nextState.playerLp = Math.max(0, nextState.playerLp - 250);
    }

    const ev = emitEvent(idSeq, {
      animKind: 'lysis',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'enemy',
      targetLane,
      colorHex: CLASS_HEX[card.medicalClass],
      value: netDmg,
      isCritical: mult > 1.2,
      label: reason ? `${netDmg} daño (${reason})` : `${netDmg} daño`,
      logText: `${card.name} sobre ${enemy.name}: ${netDmg} daño${
        reason ? ` [${reason}]` : ''
      }${biofilmRemoved ? ' · Biofilm disuelto' : ''}${
        remHp <= 0 ? ' · ¡Eliminado!' : ''
      }.`,
      logCategory: 'combat',
    });
    idSeq = ev.nextIdSeq;
    events.push(ev.event);
  }

  nextState.idSequence = idSeq;
  nextState.rngState = rng;
  return { nextState, events };
}

export function resolveMoveUnit(
  state: DuelEngineState,
  fromLane: number,
  toLane: number,
): { nextState: DuelEngineState; events: CombatEvent[]; error?: string } {
  const check = validateDuelCommand(
    { ...state, phase: 'PREPARACION' },
    { type: 'MOVE_UNIT', fromLane, toLane },
  );
  if (!check.valid) {
    return { nextState: state, events: [], error: check.reason };
  }

  const unit = state.playerSlots[fromLane]!;
  const moveCost = state.freeMovesLeft > 0 ? 0 : 1;
  const nextSlots = [...state.playerSlots];
  nextSlots[toLane] = { ...unit, laneIndex: toLane };
  nextSlots[fromLane] = null;

  const ev = emitEvent(state.idSequence, {
    animKind: 'summon',
    sourceSide: 'player',
    sourceLane: fromLane,
    targetSide: 'player',
    targetLane: toLane,
    colorHex: CLASS_HEX[unit.medicalClass],
    value: 0,
    isCritical: false,
    label: `Movido a Carril ${toLane + 1}`,
    logText: `Reposicionas ${unit.name} del Carril ${fromLane + 1} al Carril ${toLane + 1}.`,
    logCategory: 'info',
  });

  return {
    nextState: {
      ...state,
      energy: state.energy - moveCost,
      freeMovesLeft: Math.max(0, state.freeMovesLeft - 1),
      playerSlots: nextSlots,
      idSequence: ev.nextIdSeq,
    },
    events: [ev.event],
  };
}

export function resolveActivateSkill(
  state: DuelEngineState,
  laneIndex: number,
): { nextState: DuelEngineState; events: CombatEvent[]; error?: string } {
  const check = validateDuelCommand(
    { ...state, phase: 'PREPARACION' },
    { type: 'ACTIVATE_SKILL', laneIndex },
  );
  if (!check.valid) {
    return { nextState: state, events: [], error: check.reason };
  }

  const unit = state.playerSlots[laneIndex]!;
  let idSeq = state.idSequence;
  const nextState: DuelEngineState = {
    ...state,
    energy: state.energy - (unit.activeSkillCost ?? 0),
    playerSlots: [...state.playerSlots],
    enemySlots: [...state.enemySlots],
  };
  nextState.playerSlots[laneIndex] = { ...unit, usedActiveSkillThisTurn: true };
  const events: CombatEvent[] = [];

  if (unit.ability === 'opsonizacion') {
    const enemy = nextState.enemySlots[laneIndex]!;
    nextState.enemySlots[laneIndex] = {
      ...enemy,
      statuses: { ...enemy.statuses, opsonizado: 2 },
    };
    const ev = emitEvent(idSeq, {
      animKind: 'opsonize',
      sourceSide: 'player',
      sourceLane: laneIndex,
      targetSide: 'enemy',
      targetLane: laneIndex,
      colorHex: 0x38bdf8,
      value: 50,
      isCritical: false,
      label: 'Opsonizado x1.5',
      logText: `${unit.name} marca a ${enemy.name} con IgG (+50% daño recibido).`,
      logCategory: 'info',
    });
    idSeq = ev.nextIdSeq;
    events.push(ev.event);
  } else if (unit.ability === 'mitosis') {
    const healAmt = 450 + (state.organId === 'epitelio' ? 150 : 0);
    nextState.playerSlots = nextState.playerSlots.map((al) =>
      al ? { ...al, hp: Math.min(al.maxHp, al.hp + healAmt) } : null,
    );
    const ev = emitEvent(idSeq, {
      animKind: 'mitosis',
      sourceSide: 'player',
      sourceLane: laneIndex,
      targetSide: 'player',
      targetLane: -1,
      colorHex: 0x10b981,
      value: healAmt,
      isCritical: false,
      label: `Regeneración +${healAmt} PS`,
      logText: `${unit.name} secreta factores tróficos (+${healAmt} PS a todo tu campo).`,
      logCategory: 'heal',
    });
    idSeq = ev.nextIdSeq;
    events.push(ev.event);
  } else if (unit.ability === 'descarga_sincronizada') {
    const enemy = nextState.enemySlots[laneIndex]!;
    const dmg = state.organId === 'corazon' ? 480 : 400;
    const remHp = enemy.hp - dmg;
    nextState.enemySlots[laneIndex] =
      remHp > 0
        ? {
            ...enemy,
            hp: remHp,
            statuses: { ...enemy.statuses, aturdido: true },
          }
        : null;
    const ev = emitEvent(idSeq, {
      animKind: 'shock',
      sourceSide: 'player',
      sourceLane: laneIndex,
      targetSide: 'enemy',
      targetLane: laneIndex,
      colorHex: 0xf59e0b,
      value: dmg,
      isCritical: true,
      label: `Descarga 200J · Aturdido`,
      logText: `${unit.name} aplica descarga de 200J sobre ${enemy.name} (-${dmg} PS y Aturdido).`,
      logCategory: 'combat',
    });
    idSeq = ev.nextIdSeq;
    events.push(ev.event);
  }

  nextState.idSequence = idSeq;
  return { nextState, events };
}

/**
 * Consume la primera trampa armada cuyo trigger coincida.
 * Revalida en el llamador para evitar doble gasto si el primer evento fue anulado.
 */
function triggerMatchingTrap(
  state: DuelEngineState,
  trigger: TrapTrigger,
): { trap: ArmedTrap; nextState: DuelEngineState } | null {
  const idx = state.armedTraps.findIndex((t) => t.trigger === trigger);
  if (idx === -1) return null;
  const trap = state.armedTraps[idx];
  const nextTraps = state.armedTraps.filter((_, i) => i !== idx);
  return {
    trap,
    nextState: {
      ...state,
      armedTraps: nextTraps,
      discardPile: [...state.discardPile, trap.sourceCard],
    },
  };
}

function executeRivalOutbreakCard(
  state: DuelEngineState,
  ob: RivalOutbreakCard,
): { nextState: DuelEngineState; events: CombatEvent[] } {
  let current = { ...state };
  let idSeq = current.idSequence;
  const events: CombatEvent[] = [];

  // Trap check: beforeOutbreak (Antagonista IL-6)
  const trapHit = triggerMatchingTrap(current, 'beforeOutbreak');
  if (trapHit && trapHit.trap.effectId === 'contramedida_citoquina') {
    current = trapHit.nextState;
    current.playerLp = Math.min(current.playerMaxLp, current.playerLp + 350);
    const ev = emitEvent(idSeq, {
      animKind: 'trap',
      sourceSide: 'player',
      sourceLane: -1,
      targetSide: 'enemy',
      targetLane: -1,
      colorHex: 0xa855f7,
      value: 350,
      isCritical: true,
      label: `Trampa: ${trapHit.trap.sourceCard.name}`,
      logText: `¡Trampa activada! ${trapHit.trap.sourceCard.name} anula ${ob.name} y restaura +350 LP.`,
      logCategory: 'heal',
    });
    current.idSequence = ev.nextIdSeq;
    return { nextState: current, events: [ev.event] };
  }

  if (ob.effectId === 'resistencia_plasmidica') {
    const targetIdx = current.enemySlots.findIndex((e) => e !== null);
    if (targetIdx >= 0) {
      const en = current.enemySlots[targetIdx]!;
      const nextEn = [...current.enemySlots];
      nextEn[targetIdx] = {
        ...en,
        statuses: {
          ...en.statuses,
          biofilm: (en.statuses.biofilm ?? 0) + 350,
        },
      };
      current.enemySlots = nextEn;
    }
  } else if (ob.effectId === 'embolo_septico') {
    current.playerLp = Math.max(0, current.playerLp - 300);
    const allyIdx = current.playerSlots.findIndex((a) => a !== null);
    if (allyIdx >= 0) {
      const al = current.playerSlots[allyIdx]!;
      const nextAl = [...current.playerSlots];
      nextAl[allyIdx] = {
        ...al,
        statuses: { ...al.statuses, inmunosuprimido: 1 },
      };
      current.playerSlots = nextAl;
    }
  } else if (ob.effectId === 'tormenta_citoquinas') {
    // Trap check: beforeAllyDamage (Sutura y Hemostasia)
    let damageNegated = false;
    const allyDmgTrap = triggerMatchingTrap(current, 'beforeAllyDamage');
    if (allyDmgTrap && allyDmgTrap.trap.effectId === 'hemostasia_urgencia') {
      current = allyDmgTrap.nextState;
      damageNegated = true;
      current.playerSlots = current.playerSlots.map((al) =>
        al
          ? {
              ...al,
              statuses: { ...al.statuses, escudo: (al.statuses.escudo ?? 0) + 350 },
            }
          : null,
      );
      const tEv = emitEvent(idSeq, {
        animKind: 'trap',
        sourceSide: 'player',
        sourceLane: -1,
        targetSide: 'player',
        targetLane: -1,
        colorHex: 0xa855f7,
        value: 350,
        isCritical: false,
        label: `Trampa: ${allyDmgTrap.trap.sourceCard.name}`,
        logText: `¡Trampa! ${allyDmgTrap.trap.sourceCard.name} bloquea el daño de la tormenta y otorga +350 Escudo.`,
        logCategory: 'heal',
      });
      idSeq = tEv.nextIdSeq;
      events.push(tEv.event);
    }

    current.enemySlots = current.enemySlots.map((en) =>
      en && !en.statuses.inhibido
        ? { ...en, atk: en.atk + 200 }
        : en,
    );

    if (!damageNegated) {
      const nextDiscard = [...current.discardPile];
      current.playerSlots = current.playerSlots.map((al) => {
        if (!al) return null;
        const shield = al.statuses.escudo ?? 0;
        const blocked = Math.min(shield, 200);
        const net = 200 - blocked;
        const nextHp = al.hp - net;
        if (nextHp <= 0) {
          nextDiscard.push(al.sourceCard);
          return null;
        }
        const st = { ...al.statuses };
        if (blocked > 0) {
          const rem = shield - blocked;
          if (rem > 0) st.escudo = rem;
          else delete st.escudo;
        }
        return { ...al, hp: nextHp, statuses: st };
      });
      current.discardPile = nextDiscard;
    }
  } else if (ob.effectId === 'evasion_antigenica') {
    const idx = current.enemySlots.findIndex((e) => e !== null);
    if (idx >= 0) {
      const en = current.enemySlots[idx]!;
      const st = { ...en.statuses };
      delete st.opsonizado;
      const nextEn = [...current.enemySlots];
      nextEn[idx] = {
        ...en,
        hp: Math.min(en.maxHp, en.hp + 300),
        statuses: st,
      };
      current.enemySlots = nextEn;
    }
  } else if (ob.effectId === 'bloqueo_mucoso') {
    let bestIdx = -1;
    let bestAtk = -1;
    current.playerSlots.forEach((al, idx) => {
      if (al && al.atk > bestAtk) {
        bestAtk = al.atk;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) {
      const al = current.playerSlots[bestIdx]!;
      const shield = al.statuses.escudo ?? 0;
      const nextAl = [...current.playerSlots];
      if (shield >= 200) {
        nextAl[bestIdx] = {
          ...al,
          statuses: { ...al.statuses, escudo: shield - 200 },
        };
      } else {
        nextAl[bestIdx] = {
          ...al,
          statuses: { ...al.statuses, aturdido: true },
        };
      }
      current.playerSlots = nextAl;
    }
  } else if (ob.effectId === 'neurotoxina_sinaptica') {
    const allyIdx = current.playerSlots.findIndex((a) => a !== null);
    if (allyIdx >= 0) {
      const al = current.playerSlots[allyIdx]!;
      const remHp = al.hp - 250;
      const nextAl = [...current.playerSlots];
      if (remHp <= 0) {
        nextAl[allyIdx] = null;
        current.discardPile = [...current.discardPile, al.sourceCard];
      } else {
        nextAl[allyIdx] = { ...al, hp: remHp };
      }
      current.playerSlots = nextAl;
    }
    current.nextTurnEnergyPenalty = Math.min(1, current.nextTurnEnergyPenalty + 1);
  }

  const obEv = emitEvent(idSeq, {
    animKind: 'outbreak',
    sourceSide: 'enemy',
    sourceLane: -1,
    targetSide: 'player',
    targetLane: -1,
    colorHex: 0xef4444,
    value: 1,
    isCritical: true,
    label: `Brote: ${ob.name}`,
    logText: `Carta de Brote rival: ${ob.name}. ${ob.description}`,
    logCategory: 'alert',
  });
  current.idSequence = obEv.nextIdSeq;
  events.push(obEv.event);
  return { nextState: current, events };
}

export interface CombatStep {
  phase: 'COMBATE' | 'TURNO_RIVAL';
  execute: (current: DuelEngineState) => {
    nextState: DuelEngineState;
    events: CombatEvent[];
  };
}

/**
 * Pasos deterministas de cierre de combate, presión por carriles, trampas reactivas
 * y ejecución de intención rival (A03, A06, A08, A10).
 */
export function buildEndTurnSteps(rival: RivalDuelist): CombatStep[] {
  const steps: CombatStep[] = [];

  // 1. End-of-Combat Persistent Effects & Status Decay
  steps.push({
    phase: 'COMBATE',
    execute: (state) => {
      let idSeq = state.idSequence;
      const events: CombatEvent[] = [];
      const nextDiscard = [...state.discardPile];
      let nextSlots = state.playerSlots.map((u) => (u ? { ...u } : null));

      const hasStemCell = nextSlots.some((u) => u?.ability === 'mitosis');
      if (hasStemCell) {
        const healAmt = 250 + (state.organId === 'epitelio' ? 150 : 0);
        nextSlots = nextSlots.map((u) =>
          u ? { ...u, hp: Math.min(u.maxHp, u.hp + healAmt) } : null,
        );
        const ev = emitEvent(idSeq, {
          animKind: 'heal',
          sourceSide: 'player',
          sourceLane: -1,
          targetSide: 'player',
          targetLane: -1,
          colorHex: 0x10b981,
          value: healAmt,
          isCritical: false,
          label: `Reparación Celular +${healAmt} PS`,
          logText: `Célula Madre Tisular regenera +${healAmt} PS en tus unidades activas.`,
          logCategory: 'heal',
        });
        idSeq = ev.nextIdSeq;
        events.push(ev.event);
      }

      // Regenerando + Overload recoil + Temp ATK cleanup
      nextSlots = nextSlots.map((u, idx) => {
        if (!u) return null;
        let hp = u.hp;
        const st = { ...u.statuses };

        if (st.regenerando) {
          const rAmt = state.organId === 'epitelio' ? 350 : 200;
          hp = Math.min(u.maxHp, hp + rAmt);
          if (st.regenerando <= 1) delete st.regenerando;
          else st.regenerando -= 1;
        }

        const overload = st.sobrecarga ?? 0;
        if (overload > 0) {
          hp -= overload;
          const ev = emitEvent(idSeq, {
            animKind: 'shock',
            sourceSide: 'player',
            sourceLane: idx,
            targetSide: 'player',
            targetLane: idx,
            colorHex: 0xf59e0b,
            value: overload,
            isCritical: false,
            label: `Sobrecarga -${overload} PS`,
            logText: `${u.name} sufre -${overload} PS por rebote adrenérgico${
              hp <= 0 ? ' y cae al descarte' : ''
            }.`,
            logCategory: 'alert',
          });
          idSeq = ev.nextIdSeq;
          events.push(ev.event);
        }

        delete st.sobrecarga;
        delete st.tempAtkBoost;
        delete st.aturdido;
        if (st.inmunosuprimido) {
          if (st.inmunosuprimido <= 1) delete st.inmunosuprimido;
          else st.inmunosuprimido -= 1;
        }

        if (hp <= 0) {
          nextDiscard.push(u.sourceCard);
          return null;
        }

        return {
          ...u,
          hp,
          usedActiveSkillThisTurn: false,
          hasAttackedThisTurn: false,
          statuses: st,
        };
      });

      // Enemy status tick (Inflamado DoT) & decay
      const nextEnemies = state.enemySlots.map((en, idx) => {
        if (!en) return null;
        let hp = en.hp;
        const st = { ...en.statuses };

        if (st.inflamado) {
          hp -= 200;
          const ev = emitEvent(idSeq, {
            animKind: 'lysis',
            sourceSide: 'player',
            sourceLane: -1,
            targetSide: 'enemy',
            targetLane: idx,
            colorHex: 0xf59e0b,
            value: 200,
            isCritical: false,
            label: 'Inflamación -200 PS',
            logText: `${en.name} sufre -200 PS por inflamación persistente${
              hp <= 0 ? ' y cae' : ''
            }.`,
            logCategory: 'combat',
          });
          idSeq = ev.nextIdSeq;
          events.push(ev.event);
          if (st.inflamado <= 1) delete st.inflamado;
          else st.inflamado -= 1;
        }

        if (hp <= 0) return null;

        if (st.opsonizado) {
          if (st.opsonizado <= 1) delete st.opsonizado;
          else st.opsonizado -= 1;
        }
        if (st.inhibido) {
          if (st.inhibido <= 1) delete st.inhibido;
          else st.inhibido -= 1;
        }
        return { ...en, hp, statuses: st };
      });

      return {
        nextState: {
          ...state,
          phase: 'TURNO_RIVAL',
          playerSlots: nextSlots,
          enemySlots: nextEnemies,
          discardPile: nextDiscard,
          idSequence: idSeq,
        },
        events,
      };
    },
  });

  // 2. Rival Unguarded Lane Strikes + Reactive Trap Interception (lanes 0, 1, 2)
  for (let lane = 0; lane < 3; lane++) {
    steps.push({
      phase: 'TURNO_RIVAL',
      execute: (state) => {
        if (isDuelTerminal(state)) {
          return { nextState: state, events: [] };
        }
        const enemy = state.enemySlots[lane];
        const ally = state.playerSlots[lane];
        if (!enemy) return { nextState: state, events: [] };

        let idSeq = state.idSequence;

        // A08: Stunned enemy skips its strike cleanly and recovers afterward
        if (enemy.statuses.aturdido) {
          const nextEnemies = [...state.enemySlots];
          nextEnemies[lane] = {
            ...enemy,
            statuses: { ...enemy.statuses, aturdido: false },
          };
          const ev = emitEvent(idSeq, {
            animKind: 'shock',
            sourceSide: 'enemy',
            sourceLane: lane,
            targetSide: 'enemy',
            targetLane: lane,
            colorHex: 0xf59e0b,
            value: 0,
            isCritical: false,
            label: 'Aturdido (Sin avance)',
            logText: `${enemy.name} en Carril ${lane + 1} pierde su avance por aturdimiento.`,
            logCategory: 'info',
          });
          return {
            nextState: { ...state, enemySlots: nextEnemies, idSequence: ev.nextIdSeq },
            events: [ev.event],
          };
        }

        // Guarded lane prevents direct LP strike
        if (ally) return { nextState: state, events: [] };

        // Trap check: beforeDirectDamage (Barrera Mucociliar)
        const trapHit = triggerMatchingTrap(state, 'beforeDirectDamage');
        if (trapHit && trapHit.trap.effectId === 'barrera_mucociliar') {
          const curState = trapHit.nextState;
          const nextEnemies = [...curState.enemySlots];
          const remHp = enemy.hp - 450;
          nextEnemies[lane] = remHp > 0 ? { ...enemy, hp: remHp } : null;
          const ev = emitEvent(idSeq, {
            animKind: 'trap',
            sourceSide: 'player',
            sourceLane: lane,
            targetSide: 'enemy',
            targetLane: lane,
            colorHex: 0xa855f7,
            value: 450,
            isCritical: true,
            label: `Trampa: ${trapHit.trap.sourceCard.name}`,
            logText: `¡Trampa! ${trapHit.trap.sourceCard.name} bloquea el ataque directo de ${enemy.name} y le inflige 450 daño${
              remHp <= 0 ? ' (neutralizado)' : ''
            }.`,
            logCategory: 'combat',
          });
          return {
            nextState: {
              ...curState,
              enemySlots: nextEnemies,
              idSequence: ev.nextIdSeq,
            },
            events: [ev.event],
          };
        }

        const dmg =
          getEffectiveUnitAtk(enemy) + (hasMutator(rival, 'coagulopatia') ? 150 : 0);
        const ev = emitEvent(idSeq, {
          animKind: 'direct_strike',
          sourceSide: 'enemy',
          sourceLane: lane,
          targetSide: 'player',
          targetLane: -1,
          colorHex: 0xef4444,
          value: dmg,
          isCritical: false,
          label: `-${dmg} LP Paciente`,
          logText: `${enemy.name} avanza por Carril ${lane + 1} sin defensa (-${dmg} LP).`,
          logCategory: 'alert',
        });

        return {
          nextState: {
            ...state,
            playerLp: Math.max(0, state.playerLp - dmg),
            idSequence: ev.nextIdSeq,
          },
          events: [ev.event],
        };
      },
    });
  }

  // 3. Rival Telegraphed Action (Outbreak Card / Summon + Trap / Mutation) + Mutators + Next Turn Prep
  steps.push({
    phase: 'TURNO_RIVAL',
    execute: (state) => {
      if (isDuelTerminal(state)) {
        return { nextState: state, events: [] };
      }

      let curState: DuelEngineState = { ...state };
      const events: CombatEvent[] = [];
      const intent = curState.rivalIntent;

      if (intent.plannedOutbreakId) {
        const ob =
          rival.outbreakDeck.find((o) => o.id === intent.plannedOutbreakId) ??
          rival.outbreakDeck[0];
        if (ob) {
          const obRes = executeRivalOutbreakCard(curState, ob);
          curState = obRes.nextState;
          events.push(...obRes.events);
        }
      } else if (
        intent.plannedLane >= 0 &&
        curState.enemySlots[intent.plannedLane] === null
      ) {
        const card =
          rival.deck.find((c) => c.name === intent.plannedCardName) ??
          rival.deck[0];
        const created = createBoardUnit(
          card,
          intent.plannedLane,
          true,
          curState.idSequence,
          rival,
        );
        curState.idSequence = created.nextIdSeq;
        let spawned: BoardUnit | null = created.unit;

        const nextEnemies = [...curState.enemySlots];
        nextEnemies[intent.plannedLane] = spawned;
        curState.enemySlots = nextEnemies;

        const summonEv = emitEvent(curState.idSequence, {
          animKind: 'infect',
          sourceSide: 'enemy',
          sourceLane: intent.plannedLane,
          targetSide: 'enemy',
          targetLane: intent.plannedLane,
          colorHex: 0xef4444,
          value: spawned.atk,
          isCritical: false,
          label: `${spawned.name} invade`,
          logText: `${rival.name} despliega ${spawned.name} en Carril ${intent.plannedLane + 1}.`,
          logCategory: 'alert',
        });
        curState.idSequence = summonEv.nextIdSeq;
        events.push(summonEv.event);

        // Trap check: beforeEnemySummon (Complejo IgM Neutralizante)
        const summonTrap = triggerMatchingTrap(curState, 'beforeEnemySummon');
        if (summonTrap && summonTrap.trap.effectId === 'ig_m_neutralizante') {
          curState = summonTrap.nextState;
          const rem = spawned.hp - 450;
          const updatedEnemies = [...curState.enemySlots];
          updatedEnemies[intent.plannedLane] =
            rem > 0
              ? {
                  ...spawned,
                  hp: rem,
                  statuses: { ...spawned.statuses, opsonizado: 2 },
                }
              : null;
          curState.enemySlots = updatedEnemies;
          const tEv = emitEvent(curState.idSequence, {
            animKind: 'trap',
            sourceSide: 'player',
            sourceLane: -1,
            targetSide: 'enemy',
            targetLane: intent.plannedLane,
            colorHex: 0xa855f7,
            value: 450,
            isCritical: true,
            label: `Trampa: ${summonTrap.trap.sourceCard.name}`,
            logText: `¡Trampa! ${summonTrap.trap.sourceCard.name} daña (-450 PS) y Opsoniza al recién llegado ${spawned.name}.`,
            logCategory: 'combat',
          });
          curState.idSequence = tEv.nextIdSeq;
          events.push(tEv.event);
        }
      } else {
        curState.enemySlots = curState.enemySlots.map((en) => {
          if (!en || en.statuses.inhibido) return en;
          return {
            ...en,
            atk: en.atk + 250,
            hp: en.hp + 250,
            maxHp: en.maxHp + 250,
          };
        });
        const ev = emitEvent(curState.idSequence, {
          animKind: 'infect',
          sourceSide: 'enemy',
          sourceLane: -1,
          targetSide: 'enemy',
          targetLane: -1,
          colorHex: 0xef4444,
          value: 250,
          isCritical: false,
          label: 'Mutación +250 ATK/PS',
          logText: 'Los patógenos no inhibidos mutan (+250 ATK / +250 PS).',
          logCategory: 'alert',
        });
        curState.idSequence = ev.nextIdSeq;
        events.push(ev.event);
      }

      // Case Mutators at turn boundary
      if (hasMutator(rival, 'tormenta_citoquinica')) {
        let topIdx = -1;
        let topHp = -1;
        curState.enemySlots.forEach((en, idx) => {
          if (en && !en.statuses.inhibido && en.hp > topHp) {
            topHp = en.hp;
            topIdx = idx;
          }
        });
        if (topIdx >= 0) {
          const en = curState.enemySlots[topIdx]!;
          const nextEnemies = [...curState.enemySlots];
          nextEnemies[topIdx] = { ...en, atk: en.atk + 150 };
          curState.enemySlots = nextEnemies;
        }
      }

      if (
        hasMutator(rival, 'neurotoxicidad') &&
        curState.turn >= 2 &&
        curState.enemySlots.every(Boolean)
      ) {
        let lowIdx = -1;
        let lowHp = 99999;
        curState.playerSlots.forEach((al, idx) => {
          if (al && al.hp < lowHp) {
            lowHp = al.hp;
            lowIdx = idx;
          }
        });
        if (lowIdx >= 0) {
          const al = curState.playerSlots[lowIdx]!;
          const nextAl = [...curState.playerSlots];
          const rem = al.hp - 150;
          if (rem <= 0) {
            nextAl[lowIdx] = null;
            curState.discardPile = [...curState.discardPile, al.sourceCard];
          } else {
            nextAl[lowIdx] = { ...al, hp: rem };
          }
          curState.playerSlots = nextAl;
        }
      }

      // Check terminal before drawing
      if (isDuelTerminal(curState)) {
        return { nextState: curState, events };
      }

      const need = Math.max(1, 5 - curState.hand.length);
      const drawCount = curState.hand.length >= 6 ? 0 : Math.min(need, 2);
      const drawRes = drawCardsPure(
        drawCount,
        curState.drawPile,
        curState.discardPile,
        curState.rngState,
      );

      const nextTurnNum = curState.turn + 1;
      const nextMaxPa = Math.min(6, curState.maxEnergy + 1);
      const effectivePa = Math.max(3, nextMaxPa - curState.nextTurnEnergyPenalty);

      const planned = planRivalIntent(
        rival,
        curState.enemySlots,
        curState.playerSlots,
        drawRes.nextRngState,
        nextTurnNum,
      );

      return {
        nextState: {
          ...curState,
          turn: nextTurnNum,
          phase: 'PREPARACION',
          maxEnergy: nextMaxPa,
          energy: effectivePa,
          nextTurnEnergyPenalty: 0,
          freeMovesLeft: curState.organId === 'pulmon' ? 2 : 1,
          hand: [...curState.hand, ...drawRes.drawn],
          drawPile: drawRes.nextDraw,
          discardPile: drawRes.nextDiscard,
          rivalIntent: planned.intent,
          rngState: planned.nextRngState,
        },
        events,
      };
    },
  });

  return steps;
}
