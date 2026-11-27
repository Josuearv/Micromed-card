import { DuelEngineState } from './combatEngine';

export interface InvariantViolation {
  code: string;
  message: string;
}

export function checkDuelInvariants(state: DuelEngineState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (state.playerLp < 0 || state.playerLp > state.playerMaxLp) {
    violations.push({
      code: 'INV_PLAYER_LP',
      message: `playerLp fuera de rango: ${state.playerLp}/${state.playerMaxLp}`,
    });
  }
  if (state.rivalLp < 0 || state.rivalLp > state.rivalMaxLp) {
    violations.push({
      code: 'INV_RIVAL_LP',
      message: `rivalLp fuera de rango: ${state.rivalLp}/${state.rivalMaxLp}`,
    });
  }
  if (state.energy < 0) {
    violations.push({
      code: 'INV_ENERGY',
      message: `energy negativa: ${state.energy}`,
    });
  }
  if (state.playerSlots.length !== 3 || state.enemySlots.length !== 3) {
    violations.push({
      code: 'INV_SLOTS',
      message: 'Longitud de carriles distinta de 3.',
    });
  }
  if (state.armedTraps.length > 2) {
    violations.push({
      code: 'INV_TRAPS_CAP',
      message: `Más de 2 trampas armadas: ${state.armedTraps.length}`,
    });
  }

  for (const unit of state.playerSlots) {
    if (unit && unit.hp <= 0) {
      violations.push({
        code: 'INV_DEAD_PLAYER_UNIT',
        message: `Unidad aliada muerta en campo: ${unit.name} (${unit.hp} PS)`,
      });
    }
  }
  for (const unit of state.enemySlots) {
    if (unit && unit.hp <= 0) {
      violations.push({
        code: 'INV_DEAD_ENEMY_UNIT',
        message: `Patógeno muerto en campo: ${unit.name} (${unit.hp} PS)`,
      });
    }
  }

  // Exclusive zone check: no card UID appears in multiple zones
  const seen = new Map<string, string>();
  const register = (uid: string, zone: string) => {
    const prev = seen.get(uid);
    if (prev) {
      violations.push({
        code: 'INV_DUPLICATE_CARD_ZONE',
        message: `Carta ${uid} duplicada en ${prev} y ${zone}`,
      });
    } else {
      seen.set(uid, zone);
    }
  };

  state.hand.forEach((c) => register(c.uid, 'hand'));
  state.drawPile.forEach((c) => register(c.uid, 'drawPile'));
  state.discardPile.forEach((c) => register(c.uid, 'discardPile'));
  state.armedTraps.forEach((t) => register(t.sourceCard.uid, 'armedTraps'));
  state.playerSlots.forEach((u) => {
    if (u) register(u.sourceCard.uid, `playerSlot:${u.laneIndex}`);
  });

  return violations;
}
