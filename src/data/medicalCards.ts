import {
  CardInstance,
  DuelCard,
  MedicalClass,
  PathogenSubtype,
  RivalDuelist,
} from '../types/game';

/**
 * Matriz de eficacia biológica fundamentada:
 * - Diagnóstico / Inmunología (Opsonización + Células efectoras) explotan vulnerabilidades de patógenos.
 * - Farmacología específica: Antiviral vs Viral, Antibiótico vs Bacteriano, Fibrinolítico vs Vascular.
 */
export function getEffectivenessMultiplier(
  sourceClass: MedicalClass,
  effectTag: string | undefined,
  targetSubtype: PathogenSubtype | undefined,
  targetOpsonized: boolean,
): { mult: number; reason: string | null } {
  let mult = 1.0;
  const reasons: string[] = [];

  if (effectTag === 'antiviral' && targetSubtype === 'Viral') {
    mult *= 1.75;
    reasons.push('Específico Antiviral');
  } else if (effectTag === 'antiviral' && targetSubtype && targetSubtype !== 'Viral') {
    mult *= 0.5;
    reasons.push('Sin diana viral');
  }

  if (effectTag === 'antibiotico' && targetSubtype === 'Bacteriano') {
    mult *= 1.65;
    reasons.push('Bactericida');
  } else if (effectTag === 'antibiotico' && targetSubtype === 'Viral') {
    mult *= 0.25;
    reasons.push('Ineficaz en virus');
  }

  if (effectTag === 'trombolisis' && targetSubtype === 'Vascular') {
    mult *= 2.0;
    reasons.push('Lisis de fibrina');
  }

  if (sourceClass === 'Inmunologia' && targetSubtype === 'Viral') {
    mult *= 1.25;
    reasons.push('Respuesta inmune antiviral');
  }

  if (targetOpsonized) {
    mult *= 1.5;
    reasons.push('Opsonizado x1.5');
  }

  return {
    mult,
    reason: reasons.length > 0 ? reasons.join(' · ') : null,
  };
}

export const PLAYER_DECK_CARDS: DuelCard[] = [
  {
    id: 'macrofago-alveolar',
    code: 'INM-01',
    name: 'Macrófago Alveolar',
    kind: 'Unidad',
    medicalClass: 'Inmunologia',
    archetype: 'macrofago',
    cost: 2,
    atk: 1000,
    maxHp: 1700,
    ability: 'fagocitosis',
    abilityLabel: 'Fagocitosis',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Fagocitosis: al destruir un patógeno en combate recupera +400 PS y gana +250 ATK.',
    medicalBasis: 'Célula fagocítica tisular que engloba microorganismos y detritos celulares en fagosomas, presentando antígenos tras la digestión.',
    gameSimplification: 'La digestión antigénica se modela como ganancia directa de ATK y recuperación de salud tras eliminar al enemigo.',
    synergies: 'Brilla frente a patógenos debilitados u opsonizados para activar fagocitosis en cadena.',
    counterEffects: 'ATK inicial moderado; vulnerable si recibe daño perforante antes de eliminar al objetivo.',
  },
  {
    id: 'anticuerpo-igg',
    code: 'INM-02',
    name: 'Anticuerpo IgG Específico',
    kind: 'Unidad',
    medicalClass: 'Inmunologia',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 800,
    maxHp: 1100,
    ability: 'opsonizacion',
    abilityLabel: 'Opsonización',
    activeSkillCost: 1,
    activeSkillLabel: 'Marcar Antígeno (1 PA)',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Opsonización: al entrar o activar habilidad, marca al patógeno opuesto como Opsonizado (+50% daño recibido).',
    medicalBasis: 'Las inmunoglobulinas IgG recubren epítopos del patógeno (opsonización), facilitando el reconocimiento por receptores Fc de macrófagos y células NK.',
    gameSimplification: 'La opsonización se representa como un multiplicador de daño recibido de 1.5x sobre el objetivo marcado.',
    synergies: 'Combinar con Linfocito T CD8+ o Macrófago para multiplicar su letalidad.',
    counterEffects: 'Baja resistencia física propia si se deja sin apoyo frente a patógenos pesados.',
  },
  {
    id: 'linfocito-cd8',
    code: 'INM-03',
    name: 'Linfocito T Citotóxico',
    kind: 'Unidad',
    medicalClass: 'Inmunologia',
    archetype: 'linfocito',
    cost: 2,
    atk: 1450,
    maxHp: 1050,
    ability: 'perforina',
    abilityLabel: 'Perforina/Granzima',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Perforina: ignora Biofilm rival y causa +350 daño extra si el patógeno está Opsonizado o Inhibido.',
    medicalBasis: 'Los linfocitos T CD8+ liberan perforinas que forman poros en células infectadas e introducen granzimas que inducen apoptosis dirigida.',
    gameSimplification: 'La formación de poros ignora escudos de biofilm y ejecuta daño adicional contra blancos marcados.',
    synergies: 'Letal en el mismo carril o tras aplicar PCR Diagnóstica / Anticuerpo IgG.',
    counterEffects: 'PS contenidos; conviene protegerlo con Sueroterapia o posicionarlo tras debilitar al rival.',
  },
  {
    id: 'celula-madre',
    code: 'INM-04',
    name: 'Célula Madre Tisular',
    kind: 'Unidad',
    medicalClass: 'Inmunologia',
    archetype: 'celula_madre',
    cost: 2,
    atk: 750,
    maxHp: 1500,
    ability: 'mitosis',
    abilityLabel: 'Reparación Celular',
    activeSkillCost: 1,
    activeSkillLabel: 'Regenerar Aliados (1 PA)',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Al final de tu combate cura +250 PS a tus unidades. Habilidad activa (1 PA): cura +450 PS a tus unidades.',
    medicalBasis: 'Las células progenitoras proliferan y secretan factores tróficos paracrinos que restauran el parénquima dañado.',
    gameSimplification: 'Se abstrae como curación periódica automática y una activación táctica de soporte tisular.',
    synergies: 'Sostiene Macrófagos y Unidades Quirúrgicas en duelos prolongados.',
    counterEffects: 'No es una unidad de choque; depende de otras entidades para limpiar brotes agresivos.',
  },
  {
    id: 'desfibrilador-qx',
    code: 'CIR-01',
    name: 'Unidad Desfibriladora',
    kind: 'Unidad',
    medicalClass: 'Cirugia',
    archetype: 'unidad_qx',
    cost: 3,
    atk: 1950,
    maxHp: 1750,
    ability: 'descarga_sincronizada',
    abilityLabel: 'Descarga 200J',
    activeSkillCost: 1,
    activeSkillLabel: 'Aturdir Rival (1 PA)',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Descarga 200J (1 PA): inflige 400 daño al enemigo opuesto y lo Aturde (no ataca este turno).',
    medicalBasis: 'La cardioversión/desfibrilación bifásica despolariza de golpe el miocardio crítico para restaurar el ritmo sinusal.',
    gameSimplification: 'El reinicio eléctrico aturde temporalmente al enemigo de su carril impidiendo su ofensiva en la fase de combate.',
    synergies: 'Frena SuperBacterias o Trombos de alto ATK mientras protege tus LP.',
    counterEffects: 'Coste elevado (3 PA); requiere planificación energética.',
  },
  {
    id: 'diagnostico-pcr',
    code: 'DX-01',
    name: 'Panel Diagnóstico PCR',
    kind: 'Diagnostico',
    medicalClass: 'Diagnostico',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Identificación',
    targetMode: 'none',
    effectTag: 'diagnostico_pcr',
    shortRule: 'Marca a TODOS los patógenos en campo como Opsonizados (+50% daño) y roba 1 carta.',
    medicalBasis: 'La reacción en cadena de la polimerasa (PCR) identifica el agente etiológico exacto permitiendo dirigir la inmunidad y farmacoterapia.',
    gameSimplification: 'Identificar al agente vuelve vulnerables a todos los patógenos presentes y aporta ventaja de mano.',
    synergies: 'Jugar al inicio de la Fase de Preparación antes de lanzar tratamientos o combatir.',
    counterEffects: 'No inflige daño directo por sí sola.',
  },
  {
    id: 'oseltamivir',
    code: 'FAR-01',
    name: 'Inhibidor Neuraminidasa',
    kind: 'Tratamiento',
    medicalClass: 'Farmacologia',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Bloqueo Viral',
    targetMode: 'enemy',
    effectTag: 'antiviral',
    shortRule: 'Antiviral: inflige 900 daño (x1.75 a Virus) y aplica Inhibido (-450 ATK, bloquea replicación).',
    medicalBasis: 'Los inhibidores de la neuraminidasa impiden la liberación de nuevos viriones desde la célula huésped, frenando la propagación viral.',
    gameSimplification: 'Reduce severamente el ataque del patógeno e inhibe su capacidad de multiplicarse.',
    synergies: 'Excelente contra cepas virales rápidas para anular su presión temprana.',
    counterEffects: 'Poco efectivo contra bacterias o trombos vasculares.',
  },
  {
    id: 'meropenem-iv',
    code: 'FAR-02',
    name: 'Meropenem Carbapenémico',
    kind: 'Tratamiento',
    medicalClass: 'Farmacologia',
    archetype: 'unidad_qx',
    cost: 2,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Lisis Bacteriana',
    targetMode: 'enemy',
    effectTag: 'antibiotico',
    shortRule: 'Antibiótico: elimina Biofilm, inflige 1050 daño (x1.65 a Bacterias; solo 25% a Virus).',
    medicalBasis: 'Betalactámico de amplio espectro que inhibe la síntesis de peptidoglicano de la pared bacteriana causando lisis osmótica.',
    gameSimplification: 'Destruye armaduras de biofilm bacteriano y causa gran daño a bacterias, pero es ineficaz ante virus.',
    synergies: 'Imprescindible en el Duelo 2 contra bacterias encapsuladas.',
    counterEffects: 'Usarlo contra un Virus desperdicia el efecto antibacteriano.',
  },
  {
    id: 'alteplasa-tpa',
    code: 'CIR-02',
    name: 'Alteplasa Fibrinolítico',
    kind: 'Tratamiento',
    medicalClass: 'Cirugia',
    archetype: 'unidad_qx',
    cost: 2,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Trombólisis',
    targetMode: 'enemy',
    effectTag: 'trombolisis',
    shortRule: 'Inflige 1000 daño (x2.0 a Trombos/Vasculares). Riesgo hemorrágico: pierdes 250 LP.',
    medicalBasis: 'Activador tisular del plasminógeno (r-tPA) que convierte plasminógeno en plasmina para disolver coágulos de fibrina intravasculares.',
    gameSimplification: 'Daño masivo a obstrucciones vasculares con un coste controlado de riesgo hemorrágico en LP.',
    synergies: 'Remueve Trombos Coronarios de alta resistencia en un solo turno.',
    counterEffects: 'Riesgo de sangrado (-250 LP propios); vigila tus LP antes de administrarlo.',
  },
  {
    id: 'adrenalina-bolo',
    code: 'FAR-03',
    name: 'Adrenalina IV en Bolo',
    kind: 'Tratamiento',
    medicalClass: 'Farmacologia',
    archetype: 'linfocito',
    cost: 0,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Inotrópico',
    targetMode: 'ally',
    effectTag: 'adrenalina',
    shortRule: 'Otorga +650 ATK a una unidad aliada y +1 PA este turno. Sobrecarga: -250 PS tras el combate.',
    medicalBasis: 'Agonista adrenérgico alfa y beta que eleva el gasto cardíaco y la respuesta inmediata, a costa de mayor consumo de oxígeno tisular.',
    gameSimplification: 'Impulso inmediato de poder ofensivo y energía con rebote fisiológico al final del turno.',
    synergies: 'Permite superar a un patógeno jefe en el choque frontal de carril.',
    counterEffects: 'La sobrecarga puede destruir a la unidad si queda con menos de 250 PS.',
  },
  {
    id: 'sueroterapia-ringer',
    code: 'FAR-04',
    name: 'Sueroterapia Ringer IV',
    kind: 'Tratamiento',
    medicalClass: 'Farmacologia',
    archetype: 'celula_madre',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Perfusión',
    targetMode: 'none',
    effectTag: 'suero',
    shortRule: 'Restaura +750 LP del paciente, cura +350 PS a todo tu campo y limpia Sobrecarga.',
    medicalBasis: 'Solución cristaloide isotónica que restaura la volemia circulante y optimiza la perfusión tisular en estados de shock.',
    gameSimplification: 'Recuperación integral de LP del paciente, salud de unidades y limpieza de efectos de estrés.',
    synergies: 'Contrarresta el desgaste de Adrenalina y Alteplasa.',
    counterEffects: 'No reduce la amenaza en el tablero rival.',
  },
];

export const REWARD_CARD_POOL: DuelCard[] = [
  {
    id: 'vacuna-arnm',
    code: 'INM-05',
    name: 'Inmunización Activa',
    kind: 'Diagnostico',
    medicalClass: 'Inmunologia',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Memoria Inmune',
    targetMode: 'none',
    effectTag: 'vacuna',
    shortRule: 'Otorga +350 ATK y +350 PS permanentes a todas tus unidades en campo y roba 1 carta.',
    medicalBasis: 'La vacunación entrena la memoria adaptativa de linfocitos B y T para responder con mayor potencia y afinidad.',
    gameSimplification: 'Mejora permanente de ataque y resistencia para tu línea inmune actual.',
    synergies: 'Multiplica el valor de tener 2 o 3 unidades desplegadas.',
    counterEffects: 'Menor impacto si tu tablero está vacío.',
  },
  {
    id: 'cirujano-vascular',
    code: 'CIR-03',
    name: 'Cirujano Endovascular',
    kind: 'Unidad',
    medicalClass: 'Cirugia',
    archetype: 'unidad_qx',
    cost: 2,
    atk: 1650,
    maxHp: 1450,
    ability: 'perforina',
    abilityLabel: 'Revascularización',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Ignora Biofilm y causa daño crítico contra obstrucciones vasculares y blancos opsonizados.',
    medicalBasis: 'Intervencionismo guiado por catéter capaz de restablecer el flujo arterial saltando placas o coágulos.',
    gameSimplification: 'Atacante versátil de coste medio que atraviesa defensas.',
    synergies: 'Ideal junto a Panel PCR y Macrófago.',
    counterEffects: 'Sin habilidad de curación propia.',
  },
  {
    id: 'fagocito-gigante',
    code: 'INM-06',
    name: 'Macrófago Activado IFN',
    kind: 'Unidad',
    medicalClass: 'Inmunologia',
    archetype: 'macrofago',
    cost: 3,
    atk: 1550,
    maxHp: 2200,
    ability: 'fagocitosis',
    abilityLabel: 'Fagocitosis Mayor',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Fagocitosis: al destruir un patógeno recupera +400 PS y gana +250 ATK.',
    medicalBasis: 'Macrófago estimulado por interferón gamma, con máxima capacidad oxidativa y fagocítica.',
    gameSimplification: 'Tanque de primera línea que escala cuanto más combate.',
    synergies: 'Imparable si recibe curación de Célula Madre.',
    counterEffects: 'Coste 3 PA; puede dejar pocos recursos el turno que se invoca.',
  },
];

// Enemy Pathogen Registry
export const ENEMY_PATHOGEN_CARDS: Record<string, DuelCard> = {
  rinovirus: {
    id: 'e-rino',
    code: 'VIR-01',
    name: 'Rinovirus Mutante',
    kind: 'Unidad',
    medicalClass: 'Patogeno',
    subtype: 'Viral',
    archetype: 'virus',
    cost: 1,
    atk: 850,
    maxHp: 950,
    ability: 'replicacion',
    abilityLabel: 'Replicación Rápida',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Patógeno Viral. Vulnerable a Antivirales (x1.75) e Inmunología.',
    medicalBasis: 'Virus ARN de rápida multiplicación en epitelio respiratorio.',
    gameSimplification: 'Unidad ligera que presiona carriles vacíos.',
    synergies: 'Presión temprana.',
    counterEffects: 'Cae rápido frente a Inhibidor Neuraminidasa o Linfocito T.',
  },
  adenovirus: {
    id: 'e-adeno',
    code: 'VIR-02',
    name: 'Adenovirus Respiratorio',
    kind: 'Unidad',
    medicalClass: 'Patogeno',
    subtype: 'Viral',
    archetype: 'virus',
    cost: 2,
    atk: 1200,
    maxHp: 1300,
    ability: 'replicacion',
    abilityLabel: 'Cápside Resistente',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Patógeno Viral de cápside estable. Inmune a antibióticos comunes.',
    medicalBasis: 'Virus ADN sin envoltura causante de infecciones respiratorias agudas.',
    gameSimplification: 'Resiste antibióticos (0.25x); requiere antivirales o respuesta inmune.',
    synergies: 'Cobertura de carril.',
    counterEffects: 'Vulnerable a Opsonización + Linfocito.',
  },
  estafilo: {
    id: 'e-staph',
    code: 'BAC-01',
    name: 'Estafilococo Dorado',
    kind: 'Unidad',
    medicalClass: 'Patogeno',
    subtype: 'Bacteriano',
    archetype: 'bacteria',
    cost: 2,
    atk: 1350,
    maxHp: 1450,
    ability: 'biofilm',
    abilityLabel: 'Biofilm Protector',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Patógeno Bacteriano con Biofilm (+400 escudo inicial). Vulnerable a Meropenem.',
    medicalBasis: 'Cocos Gram positivos formadores de matriz polimérica extracelular (biofilm) que dificulta la penetración inmune.',
    gameSimplification: 'Inicia con 400 puntos de Biofilm absorbente que Meropenem o Perforina eliminan.',
    synergies: 'Bloquea ataques físicos simples.',
    counterEffects: 'Meropenem destruye su biofilm y multiplica el daño.',
  },
  bacilo_sarm: {
    id: 'e-sarm',
    code: 'BAC-02',
    name: 'Bacilo SARM Crítico',
    kind: 'Unidad',
    medicalClass: 'Patogeno',
    subtype: 'Bacteriano',
    archetype: 'bacteria',
    cost: 3,
    atk: 1750,
    maxHp: 1850,
    ability: 'biofilm',
    abilityLabel: 'Multirresistencia',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Bacteria severa con Biofilm (+500 escudo). Requiere carbapenémicos o combos inmunes.',
    medicalBasis: 'Cepa bacteriana resistente a múltiples familias de antimicrobianos.',
    gameSimplification: 'Alta presencia de carril con armadura de biofilm.',
    synergies: 'Castiga carriles desprotegidos.',
    counterEffects: 'Meropenem + Linfocito T.',
  },
  trombo_coronario: {
    id: 'e-trombo',
    code: 'VAS-01',
    name: 'Trombo Coronario',
    kind: 'Unidad',
    medicalClass: 'Patogeno',
    subtype: 'Vascular',
    archetype: 'trombo',
    cost: 3,
    atk: 1650,
    maxHp: 2100,
    ability: 'ninguna',
    abilityLabel: 'Oclusión Arterial',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Obstrucción Vascular de fibrina. Extremadamente vulnerable a Alteplasa (x2.0) y Desfibrilador.',
    medicalBasis: 'Coágulo plaquetario y de fibrina que interrumpe el flujo sanguíneo coronario causando isquemia.',
    gameSimplification: 'Gran cantidad de PS, pero cae rápido ante fibrinolíticos específicos.',
    synergies: 'Frena carriles inmunes lentos.',
    counterEffects: 'Alteplasa Fibrinolítico inflige daño doble.',
  },
};

export const RIVAL_DUELISTS: RivalDuelist[] = [
  {
    id: 'brote-respiratorio',
    roundNumber: 1,
    name: 'Brote Viral Respiratorio',
    clinicalContext: 'Infección de vías aéreas · Duelo 1/3',
    startingLp: 3000,
    deck: [
      ENEMY_PATHOGENS_LIST('rinovirus'),
      ENEMY_PATHOGENS_LIST('adenovirus'),
      ENEMY_PATHOGENS_LIST('rinovirus'),
      ENEMY_PATHOGENS_LIST('estafilo'),
    ],
  },
  {
    id: 'sepsis-bacteriana',
    roundNumber: 2,
    name: 'Sepsis Multirresistente',
    clinicalContext: 'Bacteriemia con Biofilm · Duelo 2/3',
    startingLp: 4000,
    deck: [
      ENEMY_PATHOGENS_LIST('estafilo'),
      ENEMY_PATHOGENS_LIST('bacilo_sarm'),
      ENEMY_PATHOGENS_LIST('adenovirus'),
      ENEMY_PATHOGENS_LIST('trombo_coronario'),
    ],
  },
  {
    id: 'colapso-critico',
    roundNumber: 3,
    name: 'Crisis Sistémica Aguda',
    clinicalContext: 'Tromboembolia y Sepsis · Duelo 3/3',
    startingLp: 5000,
    deck: [
      ENEMY_PATHOGENS_LIST('trombo_coronario'),
      ENEMY_PATHOGENS_LIST('bacilo_sarm'),
      ENEMY_PATHOGENS_LIST('estafilo'),
      ENEMY_PATHOGENS_LIST('adenovirus'),
    ],
  },
];

function ENEMY_PATHOGENS_LIST(key: keyof typeof ENEMY_PATHOGEN_CARDS): DuelCard {
  return ENEMY_PATHOGEN_CARDS[key];
}

let uidCounter = 1;

export function createStarterDuelDeck(): CardInstance[] {
  const recipe: DuelCard[] = [
    PLAYER_DECK_CARDS[0], // Macrófago Alveolar
    PLAYER_DECK_CARDS[0],
    PLAYER_DECK_CARDS[1], // Anticuerpo IgG
    PLAYER_DECK_CARDS[1],
    PLAYER_DECK_CARDS[2], // Linfocito T CD8+
    PLAYER_DECK_CARDS[2],
    PLAYER_DECK_CARDS[3], // Célula Madre
    PLAYER_DECK_CARDS[4], // Unidad Desfibriladora
    PLAYER_DECK_CARDS[5], // Panel PCR
    PLAYER_DECK_CARDS[6], // Oseltamivir Antiviral
    PLAYER_DECK_CARDS[7], // Meropenem Antibiótico
    PLAYER_DECK_CARDS[8], // Alteplasa Trombolítico
    PLAYER_DECK_CARDS[9], // Adrenalina IV
    PLAYER_DECK_CARDS[10], // Sueroterapia Ringer
  ];

  return recipe.map((card) => ({
    ...card,
    uid: `card-${uidCounter++}`,
  }));
}

export function instantiateCard(card: DuelCard): CardInstance {
  return {
    ...card,
    uid: `card-${uidCounter++}`,
  };
}

export function nextUnitUid(prefix: string): string {
  return `${prefix}-${uidCounter++}`;
}

export function shuffleCards<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
