import { nextSeqId, rngShuffle } from '../engine/rng';
import {
  CardInstance,
  DuelCard,
  MedicalClass,
  OrganId,
  PathogenSubtype,
  RivalDuelist,
} from '../types/game';
import { ORGAN_PROFILES } from './organs';
import { RIVAL_OUTBREAK_CARDS } from './outbreaks';

/**
 * Matriz de eficacia biológica + Sinergia del Órgano activo:
 * - Antivirales vs Viral, Antibióticos vs Bacteriano, Antifúngicos vs Fúngico, Fibrinolíticos vs Vascular.
 * - Opsonización (+50% daño recibido) + Sinergia de clase por órgano (+20%).
 */
export function getEffectivenessMultiplier(
  sourceClass: MedicalClass,
  effectTag: string | undefined,
  targetSubtype: PathogenSubtype | undefined,
  targetOpsonized: boolean,
  organId?: OrganId,
): { mult: number; reason: string | null; organBonus: boolean } {
  let mult = 1.0;
  const reasons: string[] = [];
  let organBonus = false;

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

  if (effectTag === 'antifungico' && targetSubtype === 'Fungico') {
    mult *= 1.75;
    reasons.push('Fungicida Dirigido');
  } else if (effectTag === 'antifungico' && targetSubtype === 'Bacteriano') {
    mult *= 1.15;
    reasons.push('Cobertura de pared');
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

  if (organId) {
    const profile = ORGAN_PROFILES[organId];
    if (profile && sourceClass === profile.favoredClass) {
      mult *= 1.2;
      organBonus = true;
      reasons.push(`Sinergia ${profile.shortName} +20%`);
    }
  }

  return {
    mult,
    reason: reasons.length > 0 ? reasons.join(' · ') : null,
    organBonus,
  };
}

export const PLAYER_DECK_CARDS: DuelCard[] = [
  {
    id: 'macrofago-alveolar',
    code: 'INM-01',
    name: 'Macrófago Alveolar',
    kind: 'Unidad',
    rarity: 'Comun',
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
    medicalBasis:
      'Célula fagocítica tisular que engloba microorganismos y detritos celulares en fagosomas, presentando antígenos tras la digestión.',
    gameSimplification:
      'La digestión antigénica se modela como ganancia directa de ATK y recuperación de salud tras eliminar al enemigo.',
    synergies: 'Brilla frente a patógenos debilitados u opsonizados y en el entorno Pulmón.',
    counterEffects: 'ATK inicial moderado; vulnerable si recibe daño perforante antes de eliminar al objetivo.',
  },
  {
    id: 'anticuerpo-igg',
    code: 'INM-02',
    name: 'Anticuerpo IgG Específico',
    kind: 'Unidad',
    rarity: 'Comun',
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
    shortRule:
      'Opsonización: al entrar o activar habilidad, marca al patógeno opuesto como Opsonizado (+50% daño recibido).',
    medicalBasis:
      'Las inmunoglobulinas IgG recubren epítopos del patógeno (opsonización), facilitando el reconocimiento por receptores Fc de macrófagos y células NK.',
    gameSimplification:
      'La opsonización se representa como un multiplicador de daño recibido de 1.5x sobre el objetivo marcado.',
    synergies: 'Combinar con Linfocito T CD8+, Macrófago o Célula NK para multiplicar su letalidad.',
    counterEffects: 'Baja resistencia física propia si se deja sin apoyo frente a patógenos pesados.',
  },
  {
    id: 'linfocito-cd8',
    code: 'INM-03',
    name: 'Linfocito T Citotóxico',
    kind: 'Unidad',
    rarity: 'Comun',
    medicalClass: 'Inmunologia',
    archetype: 'linfocito',
    cost: 2,
    atk: 1450,
    maxHp: 1050,
    ability: 'perforina',
    abilityLabel: 'Perforina/Granzima',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule:
      'Perforina: ignora Biofilm rival y causa +350 daño extra si el patógeno está Opsonizado o Inhibido.',
    medicalBasis:
      'Los linfocitos T CD8+ liberan perforinas que forman poros en células infectadas e introducen granzimas que inducen apoptosis dirigida.',
    gameSimplification:
      'La formación de poros ignora escudos de biofilm y ejecuta daño adicional contra blancos marcados.',
    synergies: 'Letal tras aplicar PCR Diagnóstica, Anticuerpo IgG o en Pulmón.',
    counterEffects: 'PS contenidos; conviene protegerlo con Escudo, Sueroterapia o posicionarlo tras debilitar al rival.',
  },
  {
    id: 'celula-madre',
    code: 'INM-04',
    name: 'Célula Madre Tisular',
    kind: 'Unidad',
    rarity: 'Comun',
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
    shortRule:
      'Al final de tu combate cura +250 PS a tus unidades. Habilidad activa (1 PA): cura +450 PS a tus unidades.',
    medicalBasis:
      'Las células progenitoras proliferan y secretan factores tróficos paracrinos que restauran el parénquima dañado.',
    gameSimplification:
      'Se abstrae como curación periódica automática y una activación táctica de soporte tisular.',
    synergies: 'Sostiene Macrófagos y Unidades Quirúrgicas en duelos prolongados y en Tejido Epitelial (+150 PS extra).',
    counterEffects: 'No es una unidad de choque; depende de otras entidades para limpiar brotes agresivos.',
  },
  {
    id: 'desfibrilador-qx',
    code: 'CIR-01',
    name: 'Unidad Desfibriladora',
    kind: 'Unidad',
    rarity: 'Comun',
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
    shortRule:
      'Descarga 200J (1 PA): inflige 400 daño al enemigo opuesto y lo Aturde (no ataca ni contraataca este turno).',
    medicalBasis:
      'La cardioversión/desfibrilación bifásica despolariza de golpe el miocardio crítico para restaurar el ritmo sinusal.',
    gameSimplification:
      'El reinicio eléctrico aturde temporalmente al enemigo de su carril impidiendo su ofensiva en la fase de combate.',
    synergies: 'Potenciada en Corazón (+20% daño y +250 Escudo). Frena patógenos o Trombos de alto ATK.',
    counterEffects: 'Coste elevado (3 PA); requiere planificación energética.',
  },
  {
    id: 'diagnostico-pcr',
    code: 'DX-01',
    name: 'Panel Diagnóstico PCR',
    kind: 'Diagnostico',
    rarity: 'Comun',
    medicalClass: 'Diagnostico',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Identificación',
    targetMode: 'none',
    effectTag: 'diagnostico_pcr',
    shortRule:
      'Marca a TODOS los patógenos en campo como Opsonizados (+50% daño) y roba 1 carta.',
    medicalBasis:
      'La reacción en cadena de la polimerasa (PCR) identifica el agente etiológico exacto permitiendo dirigir la inmunidad y farmacoterapia.',
    gameSimplification:
      'Ficción táctica: identificar al agente vuelve vulnerables a todos los patógenos presentes y aporta ventaja de mano.',
    synergies: 'Excelente en Cerebro (+200 Escudo a todo tu campo) y antes de lanzar tratamientos.',
    counterEffects: 'No inflige daño directo por sí sola.',
  },
  {
    id: 'oseltamivir',
    code: 'FAR-01',
    name: 'Inhibidor Neuraminidasa',
    kind: 'Tratamiento',
    rarity: 'Comun',
    medicalClass: 'Farmacologia',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Bloqueo Viral',
    targetMode: 'enemy',
    effectTag: 'antiviral',
    shortRule:
      'Antiviral: inflige 900 daño (x1.75 a Virus) y aplica Inhibido (-450 ATK, bloquea mutación 2 turnos).',
    medicalBasis:
      'Los inhibidores de la neuraminidasa impiden la liberación de nuevos viriones desde la célula huésped, frenando la propagación viral.',
    gameSimplification:
      'Reduce severamente el ataque del patógeno e inhibe su capacidad de multiplicarse o mutar.',
    synergies: 'Brilla en Hígado (+20% potencia) y Pulmón (+150 daño extra a antivirales).',
    counterEffects: 'Poco efectivo contra bacterias, hongos o trombos vasculares.',
  },
  {
    id: 'meropenem-iv',
    code: 'FAR-02',
    name: 'Meropenem Carbapenémico',
    kind: 'Tratamiento',
    rarity: 'Comun',
    medicalClass: 'Farmacologia',
    archetype: 'unidad_qx',
    cost: 2,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Lisis Bacteriana',
    targetMode: 'enemy',
    effectTag: 'antibiotico',
    shortRule:
      'Antibiótico: elimina Biofilm, inflige 1050 daño (x1.65 a Bacterias; solo 25% a Virus).',
    medicalBasis:
      'Betalactámico de amplio espectro que inhibe la síntesis de peptidoglicano de la pared bacteriana causando lisis osmótica.',
    gameSimplification:
      'Destruye armaduras de biofilm bacteriano y causa gran daño a bacterias, pero es ineficaz ante virus.',
    synergies: 'Imprescindible contra cocos SARM, Pseudomonas y patógenos encapsulados; potenciado en Hígado.',
    counterEffects: 'Usarlo contra un Virus desperdicia el efecto antibacteriano.',
  },
  {
    id: 'alteplasa-tpa',
    code: 'CIR-02',
    name: 'Alteplasa Fibrinolítico',
    kind: 'Tratamiento',
    rarity: 'Comun',
    medicalClass: 'Cirugia',
    archetype: 'unidad_qx',
    cost: 2,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Trombólisis',
    targetMode: 'enemy',
    effectTag: 'trombolisis',
    shortRule:
      'Inflige 1000 daño (x2.0 a Trombos/Vasculares). Riesgo hemorrágico: pierdes 250 LP.',
    medicalBasis:
      'Activador tisular del plasminógeno (r-tPA) que convierte plasminógeno en plasmina para disolver coágulos de fibrina intravasculares.',
    gameSimplification:
      'Daño masivo a obstrucciones vasculares con un coste controlado de riesgo hemorrágico en LP.',
    synergies: 'Remueve Trombos y Émbolos en un turno; potenciado en Corazón (+20% daño).',
    counterEffects: 'Riesgo de sangrado (-250 LP propios); vigila tus LP antes de administrarlo.',
  },
  {
    id: 'adrenalina-bolo',
    code: 'FAR-03',
    name: 'Adrenalina IV en Bolo',
    kind: 'Tratamiento',
    rarity: 'Comun',
    medicalClass: 'Farmacologia',
    archetype: 'linfocito',
    cost: 0,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Inotrópico',
    targetMode: 'ally',
    effectTag: 'adrenalina',
    shortRule:
      'Otorga +650 ATK temporal este turno a un aliado y +1 PA. Sobrecarga: -250 PS al cierre (se limpia ATK temporal).',
    medicalBasis:
      'Agonista adrenérgico alfa y beta que eleva el gasto cardíaco y la respuesta inmediata de corta vida media.',
    gameSimplification:
      'Impulso agudo de ataque durante el turno con rebote metabólico (-250 PS) al finalizar.',
    synergies: 'En Hígado el rebote se reduce a la mitad (-125 PS). Permite superar jefes en choque de carril.',
    counterEffects: 'La sobrecarga puede destruir a la unidad si queda con pocos PS.',
  },
  {
    id: 'sueroterapia-ringer',
    code: 'FAR-04',
    name: 'Sueroterapia Ringer IV',
    kind: 'Tratamiento',
    rarity: 'Comun',
    medicalClass: 'Farmacologia',
    archetype: 'celula_madre',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Perfusión',
    targetMode: 'none',
    effectTag: 'suero',
    shortRule:
      'Restaura +750 LP del paciente, cura +350 PS a todo tu campo y limpia Sobrecarga e Inmunosupresión.',
    medicalBasis:
      'Solución cristaloide isotónica que restaura la volemia circulante y optimiza la perfusión tisular en estados de shock.',
    gameSimplification:
      'Recuperación integral de LP del paciente, salud de unidades y limpieza de efectos de estrés.',
    synergies: 'Contrarresta el desgaste de Adrenalina, Alteplasa y Émbolo Séptico; extra eficaz en Hígado/Epitelio.',
    counterEffects: 'No reduce la amenaza directa del tablero rival.',
  },
];

export const EXPANDED_REWARD_POOL: DuelCard[] = [
  {
    id: 'vacuna-arnm',
    code: 'INM-05',
    name: 'Inmunización Activa',
    kind: 'Diagnostico',
    rarity: 'Rara',
    medicalClass: 'Inmunologia',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Memoria Inmune',
    targetMode: 'none',
    effectTag: 'vacuna',
    shortRule:
      'Otorga +300 ATK y +300 PS a tus unidades (máx. 2 acumulaciones por unidad) y roba 1 carta.',
    medicalBasis:
      'La vacunación entrena la memoria adaptativa de linfocitos B y T para responder con mayor potencia y afinidad.',
    gameSimplification:
      'Ficción táctica: refuerza de forma acotada tu línea inmune actual y cicla 1 carta del mazo.',
    synergies: 'Multiplica el valor de tener 2 o 3 unidades desplegadas en Pulmón o Epitelio.',
    counterEffects: 'Menor impacto si tu tablero está vacío.',
  },
  {
    id: 'cirujano-vascular',
    code: 'CIR-03',
    name: 'Cirujano Endovascular',
    kind: 'Unidad',
    rarity: 'Rara',
    medicalClass: 'Cirugia',
    archetype: 'unidad_qx',
    cost: 2,
    atk: 1650,
    maxHp: 1450,
    ability: 'perforina',
    abilityLabel: 'Revascularización',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule:
      'Ignora Biofilm y causa +350 daño extra contra blancos Opsonizados o Inhibidos.',
    medicalBasis:
      'Intervencionismo guiado por catéter capaz de restablecer el flujo arterial saltando placas o coágulos.',
    gameSimplification:
      'Atacante versátil de coste medio que atraviesa defensas de biopelícula.',
    synergies: 'Potenciado en Corazón (+20% daño y +250 Escudo). Ideal junto a Panel PCR.',
    counterEffects: 'Sin habilidad de curación propia.',
  },
  {
    id: 'fagocito-gigante',
    code: 'INM-06',
    name: 'Macrófago Activado IFN',
    kind: 'Unidad',
    rarity: 'Especialista',
    medicalClass: 'Inmunologia',
    archetype: 'macrofago',
    cost: 3,
    atk: 1550,
    maxHp: 2200,
    ability: 'fagocitosis',
    abilityLabel: 'Fagocitosis Mayor',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule:
      'Fagocitosis: al destruir un patógeno recupera +400 PS y gana +250 ATK.',
    medicalBasis:
      'Macrófago estimulado por interferón gamma, con máxima capacidad oxidativa y fagocítica.',
    gameSimplification:
      'Tanque de primera línea que escala cuanto más combate.',
    synergies: 'Imparable si recibe curación de Célula Madre o Escudo en Tejido Epitelial.',
    counterEffects: 'Coste 3 PA; puede dejar pocos recursos el turno que se invoca.',
  },
  // 4 REACTIVE TRAP CARDS (Yu-Gi-Oh! face-down slots)
  {
    id: 'barrera-mucociliar',
    code: 'TRP-01',
    name: 'Barrera Mucociliar',
    kind: 'Trampa',
    rarity: 'Comun',
    medicalClass: 'Inmunologia',
    archetype: 'celula_madre',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Trampa: Ataque Directo',
    trapTrigger: 'beforeDirectDamage',
    trapEffectId: 'barrera_mucociliar',
    targetMode: 'trap_slot',
    effectTag: 'trap',
    shortRule:
      'Trampa (al atacar un carril vacío): anula el golpe directo contra tus LP y devuelve 450 daño al patógeno.',
    medicalBasis:
      'Epitelio ciliado y moco con lisozima que atrapan e inactivan partículas invasoras antes de que alcancen el torrente.',
    gameSimplification:
      'Se arma boca abajo y intercepta automáticamente la primera invasión directa a tus LP.',
    synergies: 'Protege carriles descubiertos en guardias tempranas contra cepas veloces.',
    counterEffects: 'Solo se activa ante ataque directo a LP; máx. 2 trampas armadas.',
  },
  {
    id: 'igm-neutralizante',
    code: 'TRP-02',
    name: 'Complejo IgM Neutralizante',
    kind: 'Trampa',
    rarity: 'Rara',
    medicalClass: 'Diagnostico',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Trampa: Invocación Rival',
    trapTrigger: 'beforeEnemySummon',
    trapEffectId: 'ig_m_neutralizante',
    targetMode: 'trap_slot',
    effectTag: 'trap',
    shortRule:
      'Trampa (al invocar patógeno rival): le inflige 450 daño inmediato y lo marca Opsonizado (2 turnos).',
    medicalBasis:
      'Pentámero IgM de respuesta primaria temprana capaz de aglutinar antígenos y activar el complemento clásico.',
    gameSimplification:
      'Debilita y marca al instante al próximo patógeno que el brote despliegue.',
    synergies: 'Prepara el terreno para que tu siguiente turno remate al recién llegado.',
    counterEffects: 'Si el rival usa mutación en vez de invocar, espera al siguiente despliegue.',
  },
  {
    id: 'contramedida-citoquina',
    code: 'TRP-03',
    name: 'Antagonista IL-6',
    kind: 'Trampa',
    rarity: 'Especialista',
    medicalClass: 'Farmacologia',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Trampa: Carta de Brote',
    trapTrigger: 'beforeOutbreak',
    trapEffectId: 'contramedida_citoquina',
    targetMode: 'trap_slot',
    effectTag: 'trap',
    shortRule:
      'Trampa (al jugar Carta de Brote): anula por completo la Carta de Brote rival y restaura +350 LP.',
    medicalBasis:
      'Anticuerpo monoclonal anti-receptor de interleucina-6 que frena cascadas hiperinflamatorias sistémicas.',
    gameSimplification:
      'Contrahechizo clínico que cancela cartas de brote peligrosas como Tormenta o Émbolo.',
    synergies: 'Clave cuando la telemetría de Intenciones anuncia una Carta de Brote.',
    counterEffects: 'No interviene si el rival solo invoca una unidad.',
  },
  {
    id: 'hemostasia-urgencia',
    code: 'TRP-04',
    name: 'Sutura y Hemostasia',
    kind: 'Trampa',
    rarity: 'Rara',
    medicalClass: 'Cirugia',
    archetype: 'plaqueta',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Trampa: Daño a Aliado',
    trapTrigger: 'beforeAllyDamage',
    trapEffectId: 'hemostasia_urgencia',
    targetMode: 'trap_slot',
    effectTag: 'trap',
    shortRule:
      'Trampa (al dañar Carta de Brote a un aliado): bloquea el daño al aliado y otorga +350 Escudo.',
    medicalBasis:
      'Activación de la cascada de coagulación y hemostasia quirúrgica para sellar lesiones vasculares agudas.',
    gameSimplification:
      'Salva a tus unidades clave de efectos dañinos de brote y deja escudo residual.',
    synergies: 'Protege unidades frágiles como Linfocito T CD8+ o Célula Madre.',
    counterEffects: 'Solo reacciona ante daño de Carta de Brote o mutación sobre tus unidades.',
  },
  // NEW SPECIALIST UNITS, TREATMENTS & DIAGNOSTICS
  {
    id: 'neutrofilo-pmn',
    code: 'INM-07',
    name: 'Neutrófilo PMN (NETs)',
    kind: 'Unidad',
    rarity: 'Comun',
    medicalClass: 'Inmunologia',
    archetype: 'macrofago',
    cost: 1,
    atk: 950,
    maxHp: 1200,
    ability: 'inflamacion_net',
    abilityLabel: 'Trampas NET',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule:
      'Al atacar aplica Inflamado (2 turnos: -200 PS al cierre de cada turno rival) al patógeno.',
    medicalBasis:
      'Polimorfonuclear que libera redes extracelulares de cromatina y enzimas (NETosis) para atrapar y degradar microbios.',
    gameSimplification:
      'Inmoviliza metabólicamente al patógeno con daño inflamatorio sostenido por turnos.',
    synergies: 'Desgasta jefes con altos PS y combina con hongos y bacterias.',
    counterEffects: 'Daño base ligero; brilla en combates de varios turnos.',
  },
  {
    id: 'celula-nk',
    code: 'INM-08',
    name: 'Célula Natural Killer',
    kind: 'Unidad',
    rarity: 'Especialista',
    medicalClass: 'Inmunologia',
    archetype: 'linfocito',
    cost: 2,
    atk: 1350,
    maxHp: 1300,
    ability: 'citotoxicidad_nk',
    abilityLabel: 'Lisis Innata',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule:
      'Ignora Biofilm y causa +400 daño adicional contra patógenos Virales o con Biofilm activo.',
    medicalBasis:
      'Linfocito innato que destruye células infectadas con pérdida de MHC-I sin requerir sensibilización previa.',
    gameSimplification:
      'Especialista veloz contra virus y amenazas protegidas por biopelícula.',
    synergies: 'Letal en Pulmón (+20% daño) y combinada con Panel PCR.',
    counterEffects: 'Sin bonificación contra trombos vasculares.',
  },
  {
    id: 'plaqueta-hemostatica',
    code: 'CIR-04',
    name: 'Plaqueta Activada',
    kind: 'Unidad',
    rarity: 'Comun',
    medicalClass: 'Cirugia',
    archetype: 'plaqueta',
    cost: 1,
    atk: 750,
    maxHp: 1350,
    ability: 'escudo_plaquetario',
    abilityLabel: 'Tapón Plaquetario',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule:
      'Al entrar otorga +350 Escudo a todas tus unidades en campo y +250 Escudo propio.',
    medicalBasis:
      'Trombocito que se adhiere al subendotelio lesionado formando el tapón hemostático primario.',
    gameSimplification:
      'Aporta escudo protector inmediato a toda tu línea de combate.',
    synergies: 'Excelente en Corazón y Tejido Epitelial para amortiguar ataques de brote.',
    counterEffects: 'Bajo ataque ofensivo individual.',
  },
  {
    id: 'antifungico-anfo',
    code: 'FAR-05',
    name: 'Anfotericina Liposomal',
    kind: 'Tratamiento',
    rarity: 'Rara',
    medicalClass: 'Farmacologia',
    archetype: 'celula_madre',
    cost: 2,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Lisis Fúngica',
    targetMode: 'enemy',
    effectTag: 'antifungico',
    shortRule:
      'Antifúngico: inflige 950 daño (x1.75 a Hongos) y aplica Inflamado (2 turnos) al objetivo.',
    medicalBasis:
      'Polieno liposomal que se une al ergosterol de membranas fúngicas formando poros letales con menor nefrotoxicidad.',
    gameSimplification:
      'Causa daño severo a patógenos fúngicos y deja daño inflamatorio continuo.',
    synergies: 'Contrarresta cepas de Candida en Epitelio e Hígado (+20% potencia).',
    counterEffects: 'Coste 2 PA; eficacia estándar frente a virus.',
  },
  {
    id: 'corticosteroide-iv',
    code: 'FAR-06',
    name: 'Dexametasona IV',
    kind: 'Tratamiento',
    rarity: 'Rara',
    medicalClass: 'Farmacologia',
    archetype: 'celula_madre',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Inmunomodulación',
    targetMode: 'none',
    effectTag: 'corticosteroide',
    shortRule:
      'Cura +250 PS a tus unidades, limpia estados negativos aliados y reduce -300 ATK a patógenos activos.',
    medicalBasis:
      'Glucocorticoide sistémico que atenúa la cascada de citocinas proinflamatorias y el edema tisular.',
    gameSimplification:
      'Estabiliza tu tablero limpiando debuffs y rebajando la presión enemiga global.',
    synergies: 'Contrarresta Tormentas de Citoquinas y Émbolos Sépticos.',
    counterEffects: 'No elimina Biofilm ni inflige daño directo.',
  },
  {
    id: 'hemocultivo-rapido',
    code: 'DX-02',
    name: 'Hemocultivo Automatizado',
    kind: 'Diagnostico',
    rarity: 'Rara',
    medicalClass: 'Diagnostico',
    archetype: 'anticuerpo',
    cost: 1,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Triage Microbiano',
    targetMode: 'none',
    effectTag: 'hemocultivo',
    shortRule:
      'Roba 1 carta (+1 carta adicional si hay un patógeno Bacteriano o Fúngico) y otorga +200 Escudo a aliados.',
    medicalBasis:
      'Detección rápida de crecimiento microbiano en sangre con antibiograma orientativo temprano.',
    gameSimplification:
      'Genera ventaja de mano y protección defensiva al identificar cepas invasivas.',
    synergies: 'Potenciado en Cerebro (+200 Escudo extra) y mazos de combos.',
    counterEffects: 'Sin daño directo en turno de uso.',
  },
  {
    id: 'interferon-alfa',
    code: 'FAR-07',
    name: 'Interferón Pegilado',
    kind: 'Tratamiento',
    rarity: 'Especialista',
    medicalClass: 'Inmunologia',
    archetype: 'linfocito',
    cost: 2,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Estado Antiviral',
    targetMode: 'none',
    effectTag: 'interferon',
    shortRule:
      'Inflige 650 daño a TODOS los patógenos (1050 a Virales) y aplica Inhibido (1 turno) al campo rival.',
    medicalBasis:
      'Citocina señalizadora que induce genes estimulados por interferón, bloqueando la traducción viral en masa.',
    gameSimplification:
      'Daño en área y supresión simultánea de replicación en los 3 carriles enemigos.',
    synergies: 'Brilla en Pulmón y frente a oleadas múltiples.',
    counterEffects: 'Coste 2 PA; menor impacto frente a un único jefe resistente.',
  },
  {
    id: 'terapia-hiperinmune',
    code: 'DX-03',
    name: 'Suero Hiperinmune',
    kind: 'Diagnostico',
    rarity: 'Especialista',
    medicalClass: 'Inmunologia',
    archetype: 'anticuerpo',
    cost: 2,
    atk: 0,
    maxHp: 0,
    ability: 'ninguna',
    abilityLabel: 'Inmunidad Pasiva',
    targetMode: 'none',
    effectTag: 'hiperinmune',
    shortRule:
      'Restaura +550 LP, otorga +350 Escudo y Regeneración (2 turnos) a tus unidades, y roba 1 carta.',
    medicalBasis:
      'Infusión de inmunoglobulinas policlonales purificadas de alta afinidad para rescate agudo.',
    gameSimplification:
      'Rescate defensivo integral con curación sostenida y robo.',
    synergies: 'Ideal en Epitelio y en guardias altas contra brotes prolongados.',
    counterEffects: 'Coste 2 PA.',
  },
];

// Full combined reward pool (keeps existing 3 core rewards + all new traps/specialists)
export const REWARD_CARD_POOL: DuelCard[] = EXPANDED_REWARD_POOL;

export const ALL_PLAYER_CARDS_MAP: Record<string, DuelCard> = Object.fromEntries(
  [...PLAYER_DECK_CARDS, ...EXPANDED_REWARD_POOL].map((c) => [c.id, c]),
);

// Enemy Pathogen Registry (A17: SARM corrected to Coco Gram positivo)
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
    shortRule: 'Coco Gram positivo con Biofilm (+400 escudo inicial). Vulnerable a Meropenem.',
    medicalBasis:
      'Cocos Gram positivos formadores de matriz polimérica extracelular (biofilm) que dificulta la penetración inmune.',
    gameSimplification:
      'Inicia con 400 puntos de Biofilm absorbente que Meropenem o Perforina eliminan.',
    synergies: 'Bloquea ataques físicos simples.',
    counterEffects: 'Meropenem destruye su biofilm y multiplica el daño.',
  },
  bacilo_sarm: {
    id: 'e-sarm',
    code: 'BAC-02',
    name: 'Estafilococo SARM Crítico',
    kind: 'Unidad',
    medicalClass: 'Patogeno',
    subtype: 'Bacteriano',
    archetype: 'bacteria',
    cost: 3,
    atk: 1700,
    maxHp: 1800,
    ability: 'biofilm',
    abilityLabel: 'Multirresistencia',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule:
      'Coco SARM multirresistente con Biofilm (+500 escudo). Requiere carbapenémicos o combos inmunes.',
    medicalBasis:
      'Staphylococcus aureus resistente a meticilina (coco Gram positivo con proteína PBP2a alterada y biopelícula densa).',
    gameSimplification: 'Alta presencia de carril con armadura de biofilm.',
    synergies: 'Castiga carriles desprotegidos.',
    counterEffects: 'Meropenem + Linfocito T o Célula NK.',
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
    shortRule:
      'Obstrucción Vascular de fibrina. Extremadamente vulnerable a Alteplasa (x2.0) y Desfibrilador.',
    medicalBasis:
      'Coágulo plaquetario y de fibrina que interrumpe el flujo sanguíneo coronario causando isquemia.',
    gameSimplification: 'Gran cantidad de PS, pero cae rápido ante fibrinolíticos específicos.',
    synergies: 'Frena carriles inmunes lentos.',
    counterEffects: 'Alteplasa Fibrinolítico inflige daño doble.',
  },
  pseudomonas_mdr: {
    id: 'e-pseudo',
    code: 'BAC-03',
    name: 'Pseudomonas Alveolar',
    kind: 'Unidad',
    medicalClass: 'Patogeno',
    subtype: 'Bacteriano',
    archetype: 'bacteria',
    cost: 3,
    atk: 1500,
    maxHp: 1650,
    ability: 'biofilm',
    abilityLabel: 'Alginato Mucoso',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Bacilo oportunista con Biofilm (+450). Resistente sin carbapenémicos o Perforina.',
    medicalBasis:
      'Bacilo Gram negativo no fermentador productor de cápsula de alginato en vías aéreas crónicas.',
    gameSimplification: 'Escudo de biofilm robusto en infecciones respiratorias.',
    synergies: 'Presión sostenida.',
    counterEffects: 'Meropenem o Célula NK.',
  },
  candida_albicans: {
    id: 'e-candida',
    code: 'FUN-01',
    name: 'Candida Invasiva',
    kind: 'Unidad',
    medicalClass: 'Patogeno',
    subtype: 'Fungico',
    archetype: 'hongo',
    cost: 2,
    atk: 1250,
    maxHp: 1750,
    ability: 'espora_toxica',
    abilityLabel: 'Hifas Tisulares',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule:
      'Patógeno Fúngico resistente. Muy vulnerable a Anfotericina Liposomal (x1.75) y Neutrófilos.',
    medicalBasis:
      'Levadura dimórfica capaz de formar pseudohifas invasoras en mucosas inmunocomprometidas.',
    gameSimplification: 'PS elevados y desgaste si persiste en campo.',
    synergies: 'Aguante prolongado en Epitelio o Hígado.',
    counterEffects: 'Anfotericina Liposomal o Inflamación NET.',
  },
  embolo_pulmonar: {
    id: 'e-embolo',
    code: 'VAS-02',
    name: 'Émbolo Trombótico',
    kind: 'Unidad',
    medicalClass: 'Patogeno',
    subtype: 'Vascular',
    archetype: 'trombo',
    cost: 2,
    atk: 1400,
    maxHp: 1600,
    ability: 'ninguna',
    abilityLabel: 'Isquemia Aguda',
    targetMode: 'empty_lane',
    effectTag: 'summon',
    shortRule: 'Embolia vascular de alto impacto. Vulnerable a Alteplasa (x2.0).',
    medicalBasis: 'Coágulo migratorio que obstruye lechos vasculares distales.',
    gameSimplification: 'Presión agresiva de coste medio.',
    synergies: 'Acompaña brotes inflamatorios.',
    counterEffects: 'Alteplasa y Unidades de Cirugía.',
  },
};

export const RIVAL_DUELISTS: RivalDuelist[] = [
  {
    id: 'brote-respiratorio',
    roundNumber: 1,
    name: 'Brote Viral Respiratorio',
    diseaseName: 'Bronquiolitis Viral Aguda',
    clinicalContext: 'Infección de vías aéreas · Duelo Clásico 1/3',
    organId: 'pulmon',
    mutators: [],
    startingLp: 3000,
    deck: [
      ENEMY_PATHOGEN_CARDS.rinovirus,
      ENEMY_PATHOGEN_CARDS.adenovirus,
      ENEMY_PATHOGEN_CARDS.rinovirus,
      ENEMY_PATHOGEN_CARDS.estafilo,
    ],
    outbreakDeck: [RIVAL_OUTBREAK_CARDS.bloqueo_mucoso],
  },
  {
    id: 'sepsis-bacteriana',
    roundNumber: 2,
    name: 'Sepsis Multirresistente',
    diseaseName: 'Bacteriemia por Biofilm',
    clinicalContext: 'Bacteriemia con Biofilm · Duelo Clásico 2/3',
    organId: 'higado',
    mutators: [],
    startingLp: 4000,
    deck: [
      ENEMY_PATHOGEN_CARDS.estafilo,
      ENEMY_PATHOGEN_CARDS.bacilo_sarm,
      ENEMY_PATHOGEN_CARDS.adenovirus,
      ENEMY_PATHOGEN_CARDS.trombo_coronario,
    ],
    outbreakDeck: [RIVAL_OUTBREAK_CARDS.resistencia_plasmidica],
  },
  {
    id: 'colapso-critico',
    roundNumber: 3,
    name: 'Crisis Sistémica Aguda',
    diseaseName: 'Tromboembolia y Sepsis',
    clinicalContext: 'Tromboembolia y Sepsis · Duelo Clásico 3/3',
    organId: 'corazon',
    mutators: [],
    startingLp: 5000,
    deck: [
      ENEMY_PATHOGEN_CARDS.trombo_coronario,
      ENEMY_PATHOGEN_CARDS.bacilo_sarm,
      ENEMY_PATHOGEN_CARDS.estafilo,
      ENEMY_PATHOGEN_CARDS.adenovirus,
    ],
    outbreakDeck: [
      RIVAL_OUTBREAK_CARDS.embolo_septico,
      RIVAL_OUTBREAK_CARDS.resistencia_plasmidica,
    ],
  },
];

export function createStarterDuelDeck(
  startSeq = 1,
): { deck: CardInstance[]; nextSeq: number } {
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

  let seq = startSeq;
  const deck = recipe.map((card) => {
    const res = nextSeqId('card', seq);
    seq = res.nextSeq;
    return { ...card, uid: res.id };
  });

  return { deck, nextSeq: seq };
}

export function instantiateCard(
  card: DuelCard,
  idSeq: number,
): { instance: CardInstance; nextSeq: number } {
  const res = nextSeqId('card', idSeq);
  return {
    instance: { ...card, uid: res.id },
    nextSeq: res.nextSeq,
  };
}

/**
 * Genera 3 opciones únicas de recompensa ponderadas por nivel de guardia,
 * respetando un máximo de 3 copias por ID en el mazo maestro.
 */
export function rollRewardChoices(
  guardLevel: number,
  masterDeck: CardInstance[],
  rngState: number,
): { choices: DuelCard[]; nextRngState: number } {
  const copyCounts = new Map<string, number>();
  masterDeck.forEach((c) => {
    copyCounts.set(c.id, (copyCounts.get(c.id) ?? 0) + 1);
  });

  const eligible = EXPANDED_REWARD_POOL.filter(
    (card) => (copyCounts.get(card.id) ?? 0) < 3,
  );
  const pool = eligible.length >= 3 ? eligible : EXPANDED_REWARD_POOL;

  // Weight toward higher rarity on deeper guard levels while remaining fair
  const prioritized = pool.filter((c) => {
    if (guardLevel <= 1) return c.rarity !== 'Especialista';
    return true;
  });
  const sourcePool = prioritized.length >= 3 ? prioritized : pool;

  const shuffled = rngShuffle(rngState, sourcePool);
  return {
    choices: shuffled.items.slice(0, 3),
    nextRngState: shuffled.nextState,
  };
}
