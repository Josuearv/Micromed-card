import {
  getEffectivenessMultiplier,
  nextUnitUid,
  shuffleCards,
} from '../data/medicalCards';
import {
  AttackPreview,
  BoardUnit,
  CardInstance,
  CombatEvent,
  DuelCard,
  MedicalClass,
  RivalDuelist,
  RivalIntent,
} from '../types/game';

export interface DuelEngineState {
  turn: number;
  playerLp: number;
  playerMaxLp: number;
  rivalLp: number;
  rivalMaxLp: number;
  energy: number;
  maxEnergy: number;
  freeMovesLeft: number;
  playerSlots: Array<BoardUnit | null>;
  enemySlots: Array<BoardUnit | null>;
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  rivalIntent: RivalIntent;
}

const CLASS_HEX: Record<MedicalClass, number> = {
  Inmunologia: 0x10b981,
  Farmacologia: 0x0ea5e9,
  Cirugia: 0xf59e0b,
  Diagnostico: 0x38bdf8,
  Patogeno: 0xef4444,
};

let eventNonce = 1;

function nextEvent(
  partial: Omit<CombatEvent, 'id' | 'nonce'>,
): CombatEvent {
  const n = eventNonce++;
  return {
    ...partial,
    id: `evt-${n}`,
    nonce: n,
  };
}

export function createBoardUnit(
  card: DuelCard,
  laneIndex: number,
  isEnemy: boolean,
): BoardUnit {
  const initialBiofilm =
    card.ability === 'biofilm' ? (card.id === 'e-sarm' ? 500 : 400) : 0;

  return {
    uid: nextUnitUid(isEnemy ? 'enm' : 'aly'),
    cardId: card.id,
    name: card.name,
    medicalClass: card.medicalClass,
    subtype: card.subtype,
    archetype: card.archetype,
    atk: card.atk,
    baseAtk: card.atk,
    hp: card.maxHp,
    maxHp: card.maxHp,
    ability: card.ability,
    abilityLabel: card.abilityLabel,
    activeSkillCost: card.activeSkillCost,
    activeSkillLabel: card.activeSkillLabel,
    usedActiveSkillThisTurn: false,
    hasAttackedThisTurn: false,
    statuses: initialBiofilm > 0 ? { biofilm: initialBiofilm } : {},
    laneIndex,
    isEnemy,
    shortRule: card.shortRule,
    medicalBasis: card.medicalBasis,
  };
}

export function drawCardsPure(
  count: number,
  drawPile: CardInstance[],
  discardPile: CardInstance[],
): { drawn: CardInstance[]; nextDraw: CardInstance[]; nextDiscard: CardInstance[] } {
  let draw = [...drawPile];
  let discard = [...discardPile];
  const drawn: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    if (draw.length === 0) {
      if (discard.length === 0) break;
      draw = shuffleCards(discard);
      discard = [];
    }
    const top = draw.shift();
    if (top) drawn.push(top);
  }
  return { drawn, nextDraw: draw, nextDiscard: discard };
}

export function planRivalIntent(
  rival: RivalDuelist,
  enemySlots: Array<BoardUnit | null>,
  playerSlots: Array<BoardUnit | null>,
): RivalIntent {
  // Prefer summoning on an open lane opposing an empty player lane or strongest threat
  const openLanes = [0, 1, 2].filter((idx) => enemySlots[idx] === null);
  if (openLanes.length > 0) {
    const preferred =
      openLanes.find((idx) => playerSlots[idx] === null) ?? openLanes[0];
    const card = rival.deck[Math.floor(Math.random() * rival.deck.length)];
    return {
      actionTitle: `Invasión en Carril ${preferred + 1}`,
      description: `Desplegará ${card.name} (${card.atk} ATK / ${card.maxHp} PS) en Carril ${preferred + 1}.`,
      plannedLane: preferred,
      plannedCardName: card.name,
    };
  }

  // If all 3 rival lanes are occupied, rival buffs its active pathogens
  return {
    actionTitle: 'Mutación Virulenta',
    description: 'Potenciará +250 ATK y +250 PS a todos sus patógenos activos.',
    plannedLane: -1,
  };
}

export function canPlayCard(
  state: DuelEngineState,
  cardUid: string,
): { valid: boolean; reason?: string } {
  const card = state.hand.find((c) => c.uid === cardUid);
  if (!card) return { valid: false, reason: 'Carta no encontrada en mano.' };

  if (card.cost > state.energy) {
    return {
      valid: false,
      reason: `Requiere ${card.cost} PA (tienes ${state.energy} PA).`,
    };
  }

  if (card.kind === 'Unidad') {
    const hasSpace = state.playerSlots.some((s) => s === null);
    if (!hasSpace) {
      return {
        valid: false,
        reason: 'Los 3 carriles aliados están ocupados.',
      };
    }
  }

  if (card.targetMode === 'ally' && !state.playerSlots.some(Boolean)) {
    return {
      valid: false,
      reason: 'Requiere al menos 1 unidad aliada en el campo.',
    };
  }

  if (card.targetMode === 'enemy' && !state.enemySlots.some(Boolean)) {
    return {
      valid: false,
      reason: 'No hay patógenos activos en el campo rival.',
    };
  }

  return { valid: true };
}

function getEffectiveUnitAtk(unit: BoardUnit): number {
  if (unit.statuses.aturdido) return 0;
  const penalty = unit.statuses.inhibido ? 450 : 0;
  return Math.max(150, unit.atk - penalty);
}

function computeUnitAttackDamage(
  attacker: BoardUnit,
  defender: BoardUnit | null,
): { rawDmg: number; finalDmg: number; biofilmBlocked: number; superEff: boolean } {
  const effectiveAtk = getEffectiveUnitAtk(attacker);
  if (effectiveAtk === 0) {
    return { rawDmg: 0, finalDmg: 0, biofilmBlocked: 0, superEff: false };
  }

  if (!defender) {
    return { rawDmg: effectiveAtk, finalDmg: effectiveAtk, biofilmBlocked: 0, superEff: false };
  }

  const { mult } = getEffectivenessMultiplier(
    attacker.medicalClass,
    undefined,
    defender.subtype,
    Boolean(defender.statuses.opsonizado),
  );

  let dmg = Math.round(effectiveAtk * mult);
  if (
    attacker.ability === 'perforina' &&
    (defender.statuses.opsonizado || defender.statuses.inhibido)
  ) {
    dmg += 350;
  }

  const biofilm = defender.statuses.biofilm ?? 0;
  const ignoreBiofilm = attacker.ability === 'perforina';
  const blocked = ignoreBiofilm ? 0 : Math.min(biofilm, dmg);

  return {
    rawDmg: dmg,
    finalDmg: Math.max(0, dmg - blocked),
    biofilmBlocked: blocked,
    superEff: mult > 1.05,
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
): AttackPreview {
  if (!defender) {
    const dmg = getEffectiveUnitAtk(attacker);
    return {
      damageOut: dmg,
      counterDamage: 0,
      outcomeText: `Ataque directo: -${dmg} LP rival`,
      tone: 'advantage',
      isSuperEffective: false,
    };
  }

  const atkInfo = computeUnitAttackDamage(attacker, defender);
  const counterDmg = defender.statuses.aturdido ? 0 : getEffectiveUnitAtk(defender);
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
  };
}

export function resolveManualAttack(
  state: DuelEngineState,
  attackerLane: number,
  targetLane: number | 'direct',
): { nextState: DuelEngineState; events: CombatEvent[]; error?: string } {
  const ally = state.playerSlots[attackerLane];
  if (!ally) {
    return { nextState: state, events: [], error: 'No hay unidad aliada en ese carril.' };
  }
  if (ally.statuses.aturdido) {
    return { nextState: state, events: [], error: `${ally.name} está aturdido este turno.` };
  }
  if (ally.hasAttackedThisTurn) {
    return { nextState: state, events: [], error: `${ally.name} ya atacó en este turno.` };
  }

  const nextState: DuelEngineState = {
    ...state,
    playerSlots: [...state.playerSlots],
    enemySlots: [...state.enemySlots],
  };

  if (targetLane === 'direct') {
    if (state.enemySlots.some(Boolean)) {
      return {
        nextState: state,
        events: [],
        error: 'Debes neutralizar primero a los patógenos activos antes del ataque directo.',
      };
    }
    const dmg = getEffectiveUnitAtk(ally);
    nextState.rivalLp = Math.max(0, nextState.rivalLp - dmg);
    nextState.playerSlots[attackerLane] = { ...ally, hasAttackedThisTurn: true };

    return {
      nextState,
      events: [
        nextEvent({
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
        }),
      ],
    };
  }

  const enemy = state.enemySlots[targetLane];
  if (!enemy) {
    return { nextState: state, events: [], error: 'No hay patógeno objetivo en ese carril.' };
  }

  const aUnit: BoardUnit = { ...ally, hasAttackedThisTurn: true };
  const eUnit: BoardUnit = { ...enemy };

  const atkInfo = computeUnitAttackDamage(aUnit, eUnit);
  const enemyCounter = eUnit.statuses.aturdido ? 0 : getEffectiveUnitAtk(eUnit);

  if (atkInfo.biofilmBlocked > 0 && eUnit.statuses.biofilm) {
    const remBio = eUnit.statuses.biofilm - atkInfo.biofilmBlocked;
    const nextSt = { ...eUnit.statuses };
    if (remBio > 0) nextSt.biofilm = remBio;
    else delete nextSt.biofilm;
    eUnit.statuses = nextSt;
  }

  eUnit.hp -= atkInfo.finalDmg;
  aUnit.hp -= enemyCounter;
  if (eUnit.statuses.aturdido) {
    eUnit.statuses = { ...eUnit.statuses, aturdido: false };
  }

  const enemyDestroyed = eUnit.hp <= 0;
  const allyDestroyed = aUnit.hp <= 0;

  if (enemyDestroyed && !allyDestroyed && aUnit.ability === 'fagocitosis') {
    aUnit.hp = Math.min(aUnit.maxHp, aUnit.hp + 400);
    aUnit.atk += 250;
  }

  nextState.enemySlots[targetLane] = enemyDestroyed ? null : eUnit;
  nextState.playerSlots[attackerLane] = allyDestroyed ? null : aUnit;

  const animKind =
    aUnit.ability === 'fagocitosis'
      ? 'phagocytosis'
      : aUnit.ability === 'opsonizacion'
        ? 'opsonize'
        : 'clash';

  return {
    nextState,
    events: [
      nextEvent({
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
        }, contraataque ${enemyCounter}).${
          enemyDestroyed ? ` ${eUnit.name} neutralizado.` : ''
        }${
          enemyDestroyed && !allyDestroyed && aUnit.ability === 'fagocitosis'
            ? ' Fagocitosis (+400 PS / +250 ATK).'
            : ''
        }${allyDestroyed ? ` ${aUnit.name} cae.` : ''}`,
        logCategory: 'combat',
      }),
    ],
  };
}

export function resolvePlayCard(
  state: DuelEngineState,
  cardUid: string,
  targetLane?: number,
): { nextState: DuelEngineState; events: CombatEvent[] } {
  const card = state.hand.find((c) => c.uid === cardUid);
  if (!card) return { nextState: state, events: [] };

  const events: CombatEvent[] = [];
  let nextState: DuelEngineState = {
    ...state,
    energy: state.energy - card.cost,
    hand: state.hand.filter((c) => c.uid !== cardUid),
    discardPile: [...state.discardPile, card],
    playerSlots: [...state.playerSlots],
    enemySlots: [...state.enemySlots],
  };

  // 1. UNIT SUMMON
  if (card.kind === 'Unidad') {
    const lane =
      typeof targetLane === 'number' && nextState.playerSlots[targetLane] === null
        ? targetLane
        : nextState.playerSlots.findIndex((s) => s === null);
    if (lane === -1) return { nextState: state, events: [] };

    const unit = createBoardUnit(card, lane, false);
    nextState.playerSlots[lane] = unit;

    events.push(
      nextEvent({
        animKind: 'summon',
        sourceSide: 'player',
        sourceLane: lane,
        targetSide: 'player',
        targetLane: lane,
        colorHex: CLASS_HEX[card.medicalClass],
        value: unit.atk,
        isCritical: false,
        label: `${unit.name} desplegado`,
        logText: `Despliegas ${unit.name} en Carril ${lane + 1} (${unit.atk} ATK / ${unit.hp} PS).`,
        logCategory: 'info',
      }),
    );

    // Entry effect: Anticuerpo IgG immediately opsonizes opposing pathogen
    const opposing = nextState.enemySlots[lane];
    if (card.ability === 'opsonizacion' && opposing) {
      nextState.enemySlots[lane] = {
        ...opposing,
        statuses: { ...opposing.statuses, opsonizado: 2 },
      };
      events.push(
        nextEvent({
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
        }),
      );
    }

    return { nextState, events };
  }

  // 2. DIAGNOSTICS & TREATMENTS
  if (card.effectTag === 'diagnostico_pcr') {
    let marked = 0;
    nextState.enemySlots = nextState.enemySlots.map((en) => {
      if (!en) return null;
      marked++;
      return { ...en, statuses: { ...en.statuses, opsonizado: 2 } };
    });
    const drawRes = drawCardsPure(1, nextState.drawPile, nextState.discardPile);
    nextState.hand = [...nextState.hand, ...drawRes.drawn];
    nextState.drawPile = drawRes.nextDraw;
    nextState.discardPile = drawRes.nextDiscard;

    events.push(
      nextEvent({
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
      }),
    );
    return { nextState, events };
  }

  if (card.effectTag === 'vacuna') {
    nextState.playerSlots = nextState.playerSlots.map((al) =>
      al
        ? {
            ...al,
            atk: al.atk + 350,
            hp: al.hp + 350,
            maxHp: al.maxHp + 350,
          }
        : null,
    );
    const drawRes = drawCardsPure(1, nextState.drawPile, nextState.discardPile);
    nextState.hand = [...nextState.hand, ...drawRes.drawn];
    nextState.drawPile = drawRes.nextDraw;
    nextState.discardPile = drawRes.nextDiscard;

    events.push(
      nextEvent({
        animKind: 'heal',
        sourceSide: 'player',
        sourceLane: -1,
        targetSide: 'player',
        targetLane: -1,
        colorHex: 0x10b981,
        value: 350,
        isCritical: false,
        label: 'Memoria Inmune +350',
        logText: 'Inmunización Activa otorga +350 ATK/+350 PS a tus unidades y robas 1 carta.',
        logCategory: 'heal',
      }),
    );
    return { nextState, events };
  }

  if (card.effectTag === 'suero') {
    nextState.playerLp = Math.min(nextState.playerMaxLp, nextState.playerLp + 750);
    nextState.playerSlots = nextState.playerSlots.map((al) => {
      if (!al) return null;
      const cleaned = { ...al.statuses };
      delete cleaned.sobrecarga;
      return {
        ...al,
        hp: Math.min(al.maxHp, al.hp + 350),
        statuses: cleaned,
      };
    });
    events.push(
      nextEvent({
        animKind: 'heal',
        sourceSide: 'player',
        sourceLane: -1,
        targetSide: 'player',
        targetLane: -1,
        colorHex: 0x10b981,
        value: 750,
        isCritical: false,
        label: '+750 LP · Perfusión',
        logText: 'Sueroterapia Ringer restaura +750 LP, cura +350 PS aliados y limpia Sobrecarga.',
        logCategory: 'heal',
      }),
    );
    return { nextState, events };
  }

  if (card.effectTag === 'adrenalina' && typeof targetLane === 'number') {
    const ally = nextState.playerSlots[targetLane];
    if (!ally) return { nextState: state, events: [] };
    nextState.playerSlots[targetLane] = {
      ...ally,
      atk: ally.atk + 650,
      statuses: {
        ...ally.statuses,
        sobrecarga: (ally.statuses.sobrecarga ?? 0) + 250,
      },
    };
    nextState.energy += 1;

    events.push(
      nextEvent({
        animKind: 'shock',
        sourceSide: 'player',
        sourceLane: -1,
        targetSide: 'player',
        targetLane,
        colorHex: 0xf59e0b,
        value: 650,
        isCritical: false,
        label: '+650 ATK · +1 PA',
        logText: `Adrenalina IV potencia a ${ally.name} (+650 ATK, +1 PA, sobrecarga -250 PS al cierre).`,
        logCategory: 'info',
      }),
    );
    return { nextState, events };
  }

  // Targeted Enemy Treatments (Antiviral, Antibiotico, Trombolisis)
  if (typeof targetLane === 'number') {
    const enemy = nextState.enemySlots[targetLane];
    if (!enemy) return { nextState: state, events: [] };

    const baseDmg =
      card.effectTag === 'antiviral'
        ? 900
        : card.effectTag === 'antibiotico'
          ? 1050
          : 1000;

    const { mult, reason } = getEffectivenessMultiplier(
      card.medicalClass,
      card.effectTag,
      enemy.subtype,
      Boolean(enemy.statuses.opsonizado),
    );
    const totalDmg = Math.round(baseDmg * mult);

    let updatedStatuses = { ...enemy.statuses };
    let biofilmRemoved = false;

    if (card.effectTag === 'antibiotico' && updatedStatuses.biofilm) {
      delete updatedStatuses.biofilm;
      biofilmRemoved = true;
    }
    if (card.effectTag === 'antiviral') {
      updatedStatuses.inhibido = 2;
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

    events.push(
      nextEvent({
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
      }),
    );
  }

  return { nextState, events };
}

export function resolveMoveUnit(
  state: DuelEngineState,
  fromLane: number,
  toLane: number,
): { nextState: DuelEngineState; events: CombatEvent[]; error?: string } {
  const unit = state.playerSlots[fromLane];
  if (!unit || state.playerSlots[toLane] !== null) {
    return { nextState: state, events: [], error: 'Movimiento inválido.' };
  }

  const moveCost = state.freeMovesLeft > 0 ? 0 : 1;
  if (moveCost > state.energy) {
    return {
      nextState: state,
      events: [],
      error: 'Sin PA para reposicionar (ya usaste tu movimiento táctico gratuito).',
    };
  }

  const nextSlots = [...state.playerSlots];
  nextSlots[toLane] = { ...unit, laneIndex: toLane };
  nextSlots[fromLane] = null;

  return {
    nextState: {
      ...state,
      energy: state.energy - moveCost,
      freeMovesLeft: Math.max(0, state.freeMovesLeft - 1),
      playerSlots: nextSlots,
    },
    events: [
      nextEvent({
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
      }),
    ],
  };
}

export function resolveActivateSkill(
  state: DuelEngineState,
  laneIndex: number,
): { nextState: DuelEngineState; events: CombatEvent[]; error?: string } {
  const unit = state.playerSlots[laneIndex];
  if (!unit || !unit.activeSkillCost) {
    return { nextState: state, events: [], error: 'Esta unidad no tiene habilidad manual.' };
  }
  if (unit.usedActiveSkillThisTurn) {
    return { nextState: state, events: [], error: 'Habilidad ya usada este turno.' };
  }
  if (unit.activeSkillCost > state.energy) {
    return { nextState: state, events: [], error: `Requiere ${unit.activeSkillCost} PA.` };
  }

  let nextState: DuelEngineState = {
    ...state,
    energy: state.energy - unit.activeSkillCost,
    playerSlots: [...state.playerSlots],
    enemySlots: [...state.enemySlots],
  };

  nextState.playerSlots[laneIndex] = { ...unit, usedActiveSkillThisTurn: true };
  const events: CombatEvent[] = [];

  if (unit.ability === 'opsonizacion') {
    const enemy = nextState.enemySlots[laneIndex];
    if (!enemy) {
      return {
        nextState: state,
        events: [],
        error: 'No hay un patógeno frente a este carril para marcar.',
      };
    }
    nextState.enemySlots[laneIndex] = {
      ...enemy,
      statuses: { ...enemy.statuses, opsonizado: 2 },
    };
    events.push(
      nextEvent({
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
      }),
    );
  } else if (unit.ability === 'mitosis') {
    nextState.playerSlots = nextState.playerSlots.map((al) =>
      al ? { ...al, hp: Math.min(al.maxHp, al.hp + 450) } : null,
    );
    events.push(
      nextEvent({
        animKind: 'mitosis',
        sourceSide: 'player',
        sourceLane: laneIndex,
        targetSide: 'player',
        targetLane: -1,
        colorHex: 0x10b981,
        value: 450,
        isCritical: false,
        label: 'Regeneración +450 PS',
        logText: `${unit.name} secreta factores tróficos (+450 PS a todo tu campo).`,
        logCategory: 'heal',
      }),
    );
  } else if (unit.ability === 'descarga_sincronizada') {
    const enemy = nextState.enemySlots[laneIndex];
    if (!enemy) {
      return {
        nextState: state,
        events: [],
        error: 'Requiere un patógeno frente al carril para descargar.',
      };
    }
    const remHp = enemy.hp - 400;
    nextState.enemySlots[laneIndex] =
      remHp > 0
        ? {
            ...enemy,
            hp: remHp,
            statuses: { ...enemy.statuses, aturdido: true },
          }
        : null;
    events.push(
      nextEvent({
        animKind: 'shock',
        sourceSide: 'player',
        sourceLane: laneIndex,
        targetSide: 'enemy',
        targetLane: laneIndex,
        colorHex: 0xf59e0b,
        value: 400,
        isCritical: true,
        label: 'Descarga 200J · Aturdido',
        logText: `${unit.name} aplica descarga de 200J sobre ${enemy.name} (-400 PS y Aturdido).`,
        logCategory: 'combat',
      }),
    );
  }

  return { nextState, events };
}

export interface CombatStep {
  phase: 'COMBATE' | 'TURNO_RIVAL';
  execute: (current: DuelEngineState) => {
    nextState: DuelEngineState;
    events: CombatEvent[];
  };
}

/**
 * Generates post-combat cleanup + rival pathogen pressure (unguarded lanes)
 * + rival telegraphed deployment steps.
 */
export function buildEndTurnSteps(rival: RivalDuelist): CombatStep[] {
  const steps: CombatStep[] = [];

  // 1. End-of-Combat Persistent Effects (Celula Madre repair, Adrenaline overload, Reset flags)
  steps.push({
    phase: 'COMBATE',
    execute: (state) => {
      const events: CombatEvent[] = [];
      let nextSlots = state.playerSlots.map((u) => (u ? { ...u } : null));

      const hasStemCell = nextSlots.some((u) => u?.ability === 'mitosis');
      if (hasStemCell) {
        nextSlots = nextSlots.map((u) =>
          u ? { ...u, hp: Math.min(u.maxHp, u.hp + 250) } : null,
        );
        events.push(
          nextEvent({
            animKind: 'heal',
            sourceSide: 'player',
            sourceLane: -1,
            targetSide: 'player',
            targetLane: -1,
            colorHex: 0x10b981,
            value: 250,
            isCritical: false,
            label: 'Reparación Celular +250 PS',
            logText: 'Célula Madre Tisular regenera +250 PS en tus unidades activas.',
            logCategory: 'heal',
          }),
        );
      }

      nextSlots = nextSlots.map((u, idx) => {
        if (!u) return null;
        let hp = u.hp;
        const overload = u.statuses.sobrecarga ?? 0;
        if (overload > 0) {
          hp -= overload;
          events.push(
            nextEvent({
              animKind: 'shock',
              sourceSide: 'player',
              sourceLane: idx,
              targetSide: 'player',
              targetLane: idx,
              colorHex: 0xf59e0b,
              value: overload,
              isCritical: false,
              label: `Sobrecarga -${overload} PS`,
              logText: `${u.name} sufre -${overload} PS por rebote adrenérgico${hp <= 0 ? ' y colapsa' : ''}.`,
              logCategory: 'alert',
            }),
          );
        }
        if (hp <= 0) return null;
        const cleaned = { ...u.statuses };
        delete cleaned.sobrecarga;
        return {
          ...u,
          hp,
          usedActiveSkillThisTurn: false,
          hasAttackedThisTurn: false,
          statuses: cleaned,
        };
      });

      const nextEnemies = state.enemySlots.map((en) => {
        if (!en) return null;
        const st = { ...en.statuses };
        if (st.opsonizado) {
          if (st.opsonizado <= 1) delete st.opsonizado;
          else st.opsonizado -= 1;
        }
        if (st.inhibido) {
          if (st.inhibido <= 1) delete st.inhibido;
          else st.inhibido -= 1;
        }
        return { ...en, statuses: st };
      });

      return {
        nextState: {
          ...state,
          playerSlots: nextSlots,
          enemySlots: nextEnemies,
        },
        events,
      };
    },
  });

  // 2. Rival Unguarded Lane Strikes (lanes 0, 1, 2)
  for (let lane = 0; lane < 3; lane++) {
    steps.push({
      phase: 'TURNO_RIVAL',
      execute: (state) => {
        if (state.rivalLp <= 0 || state.playerLp <= 0) {
          return { nextState: state, events: [] };
        }
        const enemy = state.enemySlots[lane];
        const ally = state.playerSlots[lane];
        if (!enemy) return { nextState: state, events: [] };

        if (enemy.statuses.aturdido) {
          const nextEnemies = [...state.enemySlots];
          nextEnemies[lane] = {
            ...enemy,
            statuses: { ...enemy.statuses, aturdido: false },
          };
          return {
            nextState: { ...state, enemySlots: nextEnemies },
            events: [
              nextEvent({
                animKind: 'shock',
                sourceSide: 'enemy',
                sourceLane: lane,
                targetSide: 'enemy',
                targetLane: lane,
                colorHex: 0xf59e0b,
                value: 0,
                isCritical: false,
                label: 'Aturdido (Sin avance)',
                logText: `${enemy.name} en Carril ${lane + 1} se recupera del aturdimiento sin atacar.`,
                logCategory: 'info',
              }),
            ],
          };
        }

        // Only unguarded lanes strike Player LP directly; guarded lanes are held by the defender
        if (ally) return { nextState: state, events: [] };

        const dmg = getEffectiveUnitAtk(enemy);
        return {
          nextState: {
            ...state,
            playerLp: Math.max(0, state.playerLp - dmg),
          },
          events: [
            nextEvent({
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
            }),
          ],
        };
      },
    });
  }

  // 3. Rival Pathogen Deployment / Mutation + Start Next Player Turn
  steps.push({
    phase: 'TURNO_RIVAL',
    execute: (state) => {
      if (state.rivalLp <= 0 || state.playerLp <= 0) {
        return { nextState: state, events: [] };
      }

      const events: CombatEvent[] = [];
      let nextEnemies = [...state.enemySlots];
      const intent = state.rivalIntent;

      if (intent.plannedLane >= 0 && nextEnemies[intent.plannedLane] === null) {
        const card =
          rival.deck.find((c) => c.name === intent.plannedCardName) ??
          rival.deck[0];
        const spawned = createBoardUnit(card, intent.plannedLane, true);
        nextEnemies[intent.plannedLane] = spawned;
        events.push(
          nextEvent({
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
          }),
        );
      } else {
        nextEnemies = nextEnemies.map((en) => {
          if (!en) return null;
          if (en.statuses.inhibido) return en;
          return {
            ...en,
            atk: en.atk + 250,
            hp: en.hp + 250,
            maxHp: en.maxHp + 250,
          };
        });
        events.push(
          nextEvent({
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
          }),
        );
      }

      const need = Math.max(1, 5 - state.hand.length);
      const drawCount = state.hand.length >= 6 ? 0 : Math.min(need, 2);
      const drawRes = drawCardsPure(drawCount, state.drawPile, state.discardPile);
      const nextMaxPa = Math.min(6, state.maxEnergy + 1);
      const nextIntent = planRivalIntent(rival, nextEnemies, state.playerSlots);

      return {
        nextState: {
          ...state,
          turn: state.turn + 1,
          maxEnergy: nextMaxPa,
          energy: nextMaxPa,
          freeMovesLeft: 1,
          enemySlots: nextEnemies,
          hand: [...state.hand, ...drawRes.drawn],
          drawPile: drawRes.nextDraw,
          discardPile: drawRes.nextDiscard,
          rivalIntent: nextIntent,
        },
        events,
      };
    },
  });

  return steps;
}
