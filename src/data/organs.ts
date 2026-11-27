import { OrganId, OrganProfile } from '../types/game';

export const ORGAN_PROFILES: Record<OrganId, OrganProfile> = {
  corazon: {
    id: 'corazon',
    name: 'Corazón · Miocardio Ventricular',
    shortName: 'Corazón',
    clinicalZone: 'Perfusión Coronaria',
    favoredClass: 'Cirugia',
    synergyTitle: 'Perfusión Sistólica (Cirugía)',
    synergyRule:
      'Unidades y tratamientos de Cirugía ganan +20% eficacia ofensiva; al desplegar Cirugía obtiene +250 Escudo.',
    counterplayHint:
      'Las unidades de Inmunología y Tratamientos siguen siendo válidas; el Escudo absorbe golpes iniciales.',
    accentHex: 0xef4444,
    accentCss: 'text-rose-400 border-rose-500/40 bg-rose-950/35',
    bpmBase: 76,
    spo2Base: 98,
  },
  pulmon: {
    id: 'pulmon',
    name: 'Pulmón · Parénquima Alveolar',
    shortName: 'Pulmón',
    clinicalZone: 'Intercambio Alveolocapilar',
    favoredClass: 'Inmunologia',
    synergyTitle: 'Vigilancia Alveolar (Inmunología)',
    synergyRule:
      'Unidades de Inmunología infligen +20% daño; los Antivirales causan +150 daño adicional y tienes 2 movimientos tácticos gratis por turno.',
    counterplayHint:
      'Aprovecha la movilidad extra entre carriles para interceptar cepas respiratorias rápidas.',
    accentHex: 0x38bdf8,
    accentCss: 'text-sky-300 border-sky-500/40 bg-sky-950/35',
    bpmBase: 82,
    spo2Base: 95,
  },
  higado: {
    id: 'higado',
    name: 'Hígado · Lóbulo Hepático',
    shortName: 'Hígado',
    clinicalZone: 'Metabolismo y Claramiento',
    favoredClass: 'Farmacologia',
    synergyTitle: 'Biotransformación Hepática (Farmacología)',
    synergyRule:
      'Tratamientos de Farmacología ganan +20% potencia y reducen a la mitad el rebote de Sobrecarga en aliados.',
    counterplayHint:
      'Combina Sueroterapia y fármacos dirigidos sin depender exclusivamente de un solo subtipo.',
    accentHex: 0xf59e0b,
    accentCss: 'text-amber-300 border-amber-500/40 bg-amber-950/35',
    bpmBase: 74,
    spo2Base: 97,
  },
  cerebro: {
    id: 'cerebro',
    name: 'Cerebro · Corteza y Sinapsis',
    shortName: 'Cerebro',
    clinicalZone: 'Barrera Hematoencefálica',
    favoredClass: 'Diagnostico',
    synergyTitle: 'Precisión Sináptica (Diagnóstico)',
    synergyRule:
      'Cartas de Diagnóstico otorgan +200 Escudo a todas tus unidades; las unidades aliadas obtienen +150 ATK cuando hay un enemigo Opsonizado.',
    counterplayHint:
      'Alterna Diagnósticos tempranos y Trampas reactivas para frenar bloqueos sinápticos.',
    accentHex: 0xa855f7,
    accentCss: 'text-violet-300 border-violet-500/40 bg-violet-950/35',
    bpmBase: 70,
    spo2Base: 99,
  },
  epitelio: {
    id: 'epitelio',
    name: 'Tejido Epitelial · Barrera Mucosa',
    shortName: 'Tejido Epitelial',
    clinicalZone: 'Epitelio Estratificado',
    favoredClass: 'Inmunologia',
    synergyTitle: 'Integridad de Barrera (Reparación)',
    synergyRule:
      'Toda unidad aliada entra con +250 Escudo epitelial; efectos de curación y Mitosis recuperan +150 PS extra.',
    counterplayHint:
      'Mantén líneas protegidas con Escudo y Trampas mucociliares ante daño de brote continuo.',
    accentHex: 0x10b981,
    accentCss: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/35',
    bpmBase: 72,
    spo2Base: 99,
  },
};

export const ALL_ORGAN_IDS: OrganId[] = [
  'corazon',
  'pulmon',
  'higado',
  'cerebro',
  'epitelio',
];
