export type GameMode = 'endless' | 'classic';

export type OrganId =
  | 'corazon'
  | 'pulmon'
  | 'higado'
  | 'cerebro'
  | 'epitelio';

export type CardKind = 'Unidad' | 'Tratamiento' | 'Diagnostico' | 'Trampa';

export type CardRarity = 'Comun' | 'Rara' | 'Especialista';

export type MedicalClass =
  | 'Inmunologia'
  | 'Farmacologia'
  | 'Cirugia'
  | 'Diagnostico'
  | 'Patogeno';

export type PathogenSubtype = 'Viral' | 'Bacteriano' | 'Vascular' | 'Fungico';

export type EntityVisualArchetype =
  | 'macrofago'
  | 'linfocito'
  | 'anticuerpo'
  | 'celula_madre'
  | 'unidad_qx'
  | 'plaqueta'
  | 'virus'
  | 'bacteria'
  | 'hongo'
  | 'trombo';

export type UnitAbilityId =
  | 'ninguna'
  | 'fagocitosis'
  | 'opsonizacion'
  | 'perforina'
  | 'mitosis'
  | 'descarga_sincronizada'
  | 'inflamacion_net'
  | 'escudo_plaquetario'
  | 'citotoxicidad_nk'
  | 'biofilm'
  | 'replicacion'
  | 'espora_toxica';

export type TrapTrigger =
  | 'beforeDirectDamage'
  | 'beforeEnemySummon'
  | 'beforeOutbreak'
  | 'beforeAllyDamage';

export type TrapEffectId =
  | 'barrera_mucociliar'
  | 'ig_m_neutralizante'
  | 'contramedida_citoquina'
  | 'hemostasia_urgencia';

export type OutbreakEffectId =
  | 'resistencia_plasmidica'
  | 'embolo_septico'
  | 'tormenta_citoquinas'
  | 'evasion_antigenica'
  | 'bloqueo_mucoso'
  | 'neurotoxina_sinaptica';

export type CaseMutatorId =
  | 'tormenta_citoquinica'
  | 'evasion_antigenica'
  | 'coagulopatia'
  | 'biofilm_persistente'
  | 'neurotoxicidad'
  | 'hipoxia_alveolar';

export type StatusEffectType =
  | 'opsonizado'
  | 'inhibido'
  | 'biofilm'
  | 'aturdido'
  | 'sobrecarga'
  | 'inflamado'
  | 'regenerando'
  | 'escudo'
  | 'inmunosuprimido';

export interface StatusState {
  opsonizado?: number;      // turns remaining (+50% dmg taken)
  inhibido?: number;        // turns remaining (-450 ATK & blocks mutation/replication)
  biofilm?: number;         // shield amount absorbing physical hits
  aturdido?: boolean;       // skips next attack / pressure
  sobrecarga?: number;      // end-of-turn recoil damage
  inflamado?: number;       // turns remaining (200 damage at end of turn)
  regenerando?: number;     // turns remaining (+200 PS at end of turn)
  escudo?: number;          // ally barrier absorbing incoming damage
  inmunosuprimido?: number; // turns remaining (-250 ally ATK)
  tempAtkBoost?: number;    // temporary ATK boost cleared at end of turn
  vacunaStacks?: number;    // cap permanent vaccine stacks cleanly
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

export type CameraPreset = 'overview' | 'organ' | 'heart' | 'instruments';

export type CardEffectTag =
  | 'summon'
  | 'adrenalina'
  | 'antiviral'
  | 'antibiotico'
  | 'antifungico'
  | 'trombolisis'
  | 'suero'
  | 'diagnostico_pcr'
  | 'hemocultivo'
  | 'desfibrilacion'
  | 'vacuna'
  | 'corticosteroide'
  | 'interferon'
  | 'hiperinmune'
  | 'trap';

export interface DuelCard {
  id: string;
  code: string;
  name: string;
  kind: CardKind;
  rarity?: CardRarity;
  medicalClass: MedicalClass;
  subtype?: PathogenSubtype;
  archetype: EntityVisualArchetype;
  cost: number;
  // Unit stats
  atk: number;
  maxHp: number;
  ability: UnitAbilityId;
  abilityLabel: string;
  activeSkillCost?: number;
  activeSkillLabel?: string;
  // Trap parameters (when kind === 'Trampa')
  trapTrigger?: TrapTrigger;
  trapEffectId?: TrapEffectId;
  // Treatment / Diagnostic parameters
  targetMode: 'none' | 'ally' | 'enemy' | 'empty_lane' | 'trap_slot';
  effectTag: CardEffectTag;
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
  sourceCard: CardInstance;
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
  laneIndex: number;
  isEnemy: boolean;
  shortRule: string;
  medicalBasis: string;
}

export interface ArmedTrap {
  uid: string;
  sourceCard: CardInstance;
  trigger: TrapTrigger;
  effectId: TrapEffectId;
  armedTurn: number;
}

export interface OrganProfile {
  id: OrganId;
  name: string;
  shortName: string;
  clinicalZone: string;
  favoredClass: MedicalClass;
  synergyTitle: string;
  synergyRule: string;
  counterplayHint: string;
  accentHex: number;
  accentCss: string;
  bpmBase: number;
  spo2Base: number;
}

export interface RareDiseaseMutator {
  id: CaseMutatorId;
  name: string;
  description: string;
}

export interface RivalOutbreakCard {
  id: string;
  name: string;
  effectId: OutbreakEffectId;
  description: string;
  medicalBasis: string;
}

export interface IntentAction {
  id: string;
  kind: 'direct_pressure' | 'summon' | 'outbreak_card' | 'mutation_buff';
  label: string;
  description: string;
  lane: number;
  estimatedDamage?: number;
  cardName?: string;
}

export interface RivalIntent {
  actionTitle: string;
  description: string;
  plannedLane: number;
  plannedCardName?: string;
  plannedOutbreakId?: string;
  actions: IntentAction[];
}

export interface RivalDuelist {
  id: string;
  roundNumber: number;
  isBoss?: boolean;
  name: string;
  diseaseName: string;
  clinicalContext: string;
  organId: OrganId;
  mutators: RareDiseaseMutator[];
  startingLp: number;
  threatBudget?: number;
  deck: DuelCard[];
  outbreakDeck: RivalOutbreakCard[];
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
  | 'infect'
  | 'trap'
  | 'outbreak';

export interface CombatEvent {
  id: string;
  nonce: number;
  animKind: AnimationKind;
  sourceSide: 'player' | 'enemy';
  sourceLane: number;
  targetSide: 'player' | 'enemy';
  targetLane: number;
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
  organBonusNote?: string | null;
}

export interface DuelTelemetry {
  playerLp: number;
  playerMaxLp: number;
  rivalLp: number;
  rivalMaxLp: number;
  rivalName: string;
  organId: OrganId;
  organAccentHex: number;
  phase: TurnPhase;
  playerSlots: Array<BoardUnit | null>;
  enemySlots: Array<BoardUnit | null>;
  armedTrapsCount: number;
  selectedAttackerLane: number | null;
  selectingSummonOrMove: boolean;
  selectingAllyTarget: boolean;
  selectingEnemyTarget: boolean;
  bpm: number;
  spo2: number;
  isCritical: boolean;
  gameState: GameState;
}

export type SpeedMode = 'normal' | 'fast' | 'reduced';

export interface RunPreferences {
  muted: boolean;
  speedMode: SpeedMode;
  reducedMotion: boolean;
  tactical2D: boolean;
}
