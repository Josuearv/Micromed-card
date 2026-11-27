export type CardKind = 'Unidad' | 'Tratamiento' | 'Diagnostico';

export type MedicalClass =
  | 'Inmunologia'
  | 'Farmacologia'
  | 'Cirugia'
  | 'Diagnostico'
  | 'Patogeno';

export type PathogenSubtype = 'Viral' | 'Bacteriano' | 'Vascular';

export type EntityVisualArchetype =
  | 'macrofago'
  | 'linfocito'
  | 'anticuerpo'
  | 'celula_madre'
  | 'unidad_qx'
  | 'virus'
  | 'bacteria'
  | 'trombo';

export type UnitAbilityId =
  | 'ninguna'
  | 'fagocitosis'
  | 'opsonizacion'
  | 'perforina'
  | 'mitosis'
  | 'descarga_sincronizada'
  | 'biofilm'
  | 'replicacion';

export type StatusEffectType =
  | 'opsonizado' // +50% damage taken from all sources
  | 'inhibido'   // -450 ATK & disables replication
  | 'biofilm'    // Absorbs first 400 damage / reduces antibiotic non-carbapenem impact
  | 'aturdido'   // Skips next attack in combat phase
  | 'sobrecarga'; // Loses 200 PS at end of combat (e.g. adrenaline rebound)

export interface StatusState {
  opsonizado?: number; // turns remaining
  inhibido?: number;   // turns remaining
  biofilm?: number;    // shield amount remaining
  aturdido?: boolean;
  sobrecarga?: number; // recoil damage at end of turn
}

export type TurnPhase =
  | 'PREPARACION'
  | 'COMBATE'
  | 'TURNO_RIVAL';

export type GameState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'ROUND_SUMMARY'
  | 'VICTORY'
  | 'GAME_OVER';

export type CameraPreset = 'overview' | 'heart' | 'instruments';

export interface DuelCard {
  id: string;
  code: string;
  name: string;
  kind: CardKind;
  medicalClass: MedicalClass;
  subtype?: PathogenSubtype;
  archetype: EntityVisualArchetype;
  cost: number;
  // Unit stats
  atk: number;
  maxHp: number;
  ability: UnitAbilityId;
  abilityLabel: string;
  activeSkillCost?: number; // If > 0, player can manually trigger special skill during Preparation
  activeSkillLabel?: string;
  // Treatment / Diagnostic parameters
  targetMode: 'none' | 'ally' | 'enemy' | 'empty_lane';
  effectTag:
    | 'summon'
    | 'adrenalina'
    | 'antiviral'
    | 'antibiotico'
    | 'trombolisis'
    | 'suero'
    | 'diagnostico_pcr'
    | 'desfibrilacion'
    | 'vacuna';
  // Medical & Game Design Documentation
  shortRule: string;
  medicalBasis: string;
  gameSimplification: string;
  synergies: string;
  counterEffects: string;
}

export interface CardInstance extends DuelCard {
  uid: string;
}

export interface BoardUnit {
  uid: string;
  cardId: string;
  name: string;
  medicalClass: MedicalClass;
  subtype?: PathogenSubtype;
  archetype: EntityVisualArchetype;
  atk: number;
  baseAtk: number;
  hp: number;
  maxHp: number;
  ability: UnitAbilityId;
  abilityLabel: string;
  activeSkillCost?: number;
  activeSkillLabel?: string;
  usedActiveSkillThisTurn: boolean;
  hasAttackedThisTurn: boolean;
  statuses: StatusState;
  laneIndex: number; // 0, 1, 2
  isEnemy: boolean;
  shortRule: string;
  medicalBasis: string;
}

export interface RivalIntent {
  actionTitle: string;
  description: string;
  plannedLane: number;
  plannedCardName?: string;
}

export interface RivalDuelist {
  id: string;
  roundNumber: number;
  name: string;
  clinicalContext: string;
  startingLp: number;
  deck: DuelCard[];
}

export type AnimationKind =
  | 'summon'
  | 'phagocytosis'
  | 'opsonize'
  | 'lysis'
  | 'shock'
  | 'heal'
  | 'mitosis'
  | 'clash'
  | 'direct_strike'
  | 'infect';

export interface CombatEvent {
  id: string;
  nonce: number;
  animKind: AnimationKind;
  sourceSide: 'player' | 'enemy';
  sourceLane: number; // 0-2, or -1 for global card
  targetSide: 'player' | 'enemy';
  targetLane: number; // 0-2, or -1 for direct LP / global
  colorHex: number;
  value: number;
  isCritical: boolean;
  label: string;
  logText: string;
  logCategory: 'info' | 'combat' | 'heal' | 'alert';
}

export interface CombatLogEntry {
  id: string;
  turn: number;
  text: string;
  category: 'info' | 'combat' | 'heal' | 'alert';
}

export interface AttackPreview {
  damageOut: number;
  counterDamage: number;
  outcomeText: string;
  tone: 'advantage' | 'even' | 'danger';
  isSuperEffective: boolean;
}

export interface DuelTelemetry {
  playerLp: number;
  playerMaxLp: number;
  rivalLp: number;
  rivalMaxLp: number;
  rivalName: string;
  phase: TurnPhase;
  playerSlots: Array<BoardUnit | null>;
  enemySlots: Array<BoardUnit | null>;
  selectedAttackerLane: number | null;
  selectingSummonOrMove: boolean;
  selectingAllyTarget: boolean;
  selectingEnemyTarget: boolean;
  bpm: number;
  spo2: number;
  isCritical: boolean;
  gameState: GameState;
}
