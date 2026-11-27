import {
  CaseMutatorId,
  OrganId,
  PathogenSubtype,
  RareDiseaseMutator,
  RivalOutbreakCard,
} from '../types/game';

export const CASE_MUTATORS: Record<CaseMutatorId, RareDiseaseMutator> = {
  tormenta_citoquinica: {
    id: 'tormenta_citoquinica',
    name: 'Tormenta Citoquínica',
    description:
      'Al cierre de cada turno, el patógeno rival con más PS gana +150 ATK (si no está Inhibido).',
  },
  evasion_antigenica: {
    id: 'evasion_antigenica',
    name: 'Evasión Antigénica',
    description:
      'Los patógenos desplegados entran con +200 PS máximos adicionales.',
  },
  coagulopatia: {
    id: 'coagulopatia',
    name: 'Coagulopatía Microvascular',
    description:
      'Cada vez que un patógeno golpea directo tus LP, inflige +150 LP extra.',
  },
  biofilm_persistente: {
    id: 'biofilm_persistente',
    name: 'Matriz de Biofilm Persistente',
    description:
      'Los patógenos bacterianos y fúngicos obtienen +200 Biofilm inicial adicional.',
  },
  neurotoxicidad: {
    id: 'neurotoxicidad',
    name: 'Neurotoxicidad Progresiva',
    description:
      'Al inicio del turno 3+, si el rival controla 3 patógenos, el aliado con menos PS sufre -150 PS.',
  },
  hipoxia_alveolar: {
    id: 'hipoxia_alveolar',
    name: 'Hipoxia Tisular',
    description:
      'El primer patógeno que entra en cada guardia obtiene +150 ATK base.',
  },
};

export const RIVAL_OUTBREAK_CARDS: Record<string, RivalOutbreakCard> = {
  resistencia_plasmidica: {
    id: 'ob-plasmido',
    name: 'Resistencia Plasmídica',
    effectId: 'resistencia_plasmidica',
    description: 'Carta de Brote: otorga +350 Biofilm al patógeno activo en campo.',
    medicalBasis:
      'Transferencia horizontal de plásmidos que confieren resistencia antimicrobiana y refuerzo parietal.',
  },
  embolo_septico: {
    id: 'ob-embolo',
    name: 'Émbolo Séptico',
    effectId: 'embolo_septico',
    description:
      'Carta de Brote: inflige -300 LP al Paciente y aplica Inmunosuprimido (-250 ATK, 1 turno) a un aliado.',
    medicalBasis:
      'Diseminación hematógena de fragmentos infecciosos que comprometen perfusión y respuesta inmune.',
  },
  tormenta_citoquinas: {
    id: 'ob-tormenta',
    name: 'Oleada Inflamatoria IL-1',
    effectId: 'tormenta_citoquinas',
    description:
      'Carta de Brote: otorga +200 ATK a sus patógenos y causa 200 daño a tus unidades en campo.',
    medicalBasis:
      'Liberación desregulada de interleucinas proinflamatorias que daña el parénquima sano.',
  },
  evasion_antigenica: {
    id: 'ob-evasion',
    name: 'Deriva Antigénica',
    effectId: 'evasion_antigenica',
    description:
      'Carta de Brote: limpia Opsonizado de un patógeno y restaura +300 PS.',
    medicalBasis:
      'Variación de epítopos superficiales que reduce temporalmente la afinidad de anticuerpos previos.',
  },
  bloqueo_mucoso: {
    id: 'ob-mucoso',
    name: 'Tapón Mucoso Denso',
    effectId: 'bloqueo_mucoso',
    description:
      'Carta de Brote: aturde 1 turno a la unidad aliada con mayor ATK (bloqueado si tiene Escudo >= 200).',
    medicalBasis:
      'Secreción hiperviscosa que dificulta la migración efectora local hasta ser aclarada.',
  },
  neurotoxina_sinaptica: {
    id: 'ob-neurotox',
    name: 'Toxina Presináptica',
    effectId: 'neurotoxina_sinaptica',
    description:
      'Carta de Brote: inflige 250 daño a un aliado y reduce 1 PA disponible en tu siguiente turno (mín. 3 PA).',
    medicalBasis:
      'Bloqueo reversible de liberación sináptica que enlentece la coordinación fisiológica.',
  },
};

export interface RareDiseaseTemplate {
  id: string;
  name: string;
  diseaseName: string;
  clinicalContext: string;
  preferredOrgans: OrganId[];
  preferredSubtypes: PathogenSubtype[];
  mutatorPool: CaseMutatorId[];
  outbreakIds: Array<keyof typeof RIVAL_OUTBREAK_CARDS>;
}

export const RARE_DISEASE_TEMPLATES: RareDiseaseTemplate[] = [
  {
    id: 'rd-endocarditis-sarm',
    name: 'Brote Endocárdico SARM',
    diseaseName: 'Endocarditis Infecciosa por SARM',
    clinicalContext: 'Vegetaciones valvulares con cocos Gram positivos resistentes',
    preferredOrgans: ['corazon'],
    preferredSubtypes: ['Bacteriano', 'Vascular'],
    mutatorPool: ['biofilm_persistente', 'coagulopatia'],
    outbreakIds: ['resistencia_plasmidica', 'embolo_septico'],
  },
  {
    id: 'rd-fibrosis-quistica',
    name: 'Exacerbación en Fibrosis Quística',
    diseaseName: 'Fibrosis Quística Colonizada por Pseudomonas',
    clinicalContext: 'Moco hiperviscoso alveolar con biopelículas persistentes',
    preferredOrgans: ['pulmon', 'epitelio'],
    preferredSubtypes: ['Bacteriano', 'Viral'],
    mutatorPool: ['hipoxia_alveolar', 'biofilm_persistente'],
    outbreakIds: ['bloqueo_mucoso', 'resistencia_plasmidica'],
  },
  {
    id: 'rd-hepatitis-fulminante',
    name: 'Colapso Hepático Autoinmune',
    diseaseName: 'Hepatitis Hiperinflamatoria Fulminante',
    clinicalContext: 'Necrosis hepatocelular aguda y tormenta inflamatoria',
    preferredOrgans: ['higado'],
    preferredSubtypes: ['Viral', 'Fungico'],
    mutatorPool: ['tormenta_citoquinica', 'evasion_antigenica'],
    outbreakIds: ['tormenta_citoquinas', 'evasion_antigenica'],
  },
  {
    id: 'rd-encefalitis-viral',
    name: 'Encefalitis Neuroinvasiva',
    diseaseName: 'Encefalitis Límbica Viral Atípica',
    clinicalContext: 'Inflamación del parénquima cortical y disfunción sináptica',
    preferredOrgans: ['cerebro'],
    preferredSubtypes: ['Viral', 'Bacteriano'],
    mutatorPool: ['neurotoxicidad', 'evasion_antigenica'],
    outbreakIds: ['neurotoxina_sinaptica', 'evasion_antigenica'],
  },
  {
    id: 'rd-penfigo-micotico',
    name: 'Ruptura Epitelial Invasiva',
    diseaseName: 'Pénfigo Vulgar Sobreinfectado',
    clinicalContext: 'Acantólisis mucocutánea con invasión fúngica oportunista',
    preferredOrgans: ['epitelio', 'pulmon'],
    preferredSubtypes: ['Fungico', 'Bacteriano'],
    mutatorPool: ['biofilm_persistente', 'tormenta_citoquinica'],
    outbreakIds: ['tormenta_citoquinas', 'resistencia_plasmidica'],
  },
  {
    id: 'rd-saf-catastrofico',
    name: 'Microangiopatía Trombótica SAF',
    diseaseName: 'Síndrome Antifosfolípido Catastrófico',
    clinicalContext: 'Oclusión trombótica multiorgánica de rápida progresión',
    preferredOrgans: ['corazon', 'higado', 'cerebro'],
    preferredSubtypes: ['Vascular', 'Viral'],
    mutatorPool: ['coagulopatia', 'hipoxia_alveolar'],
    outbreakIds: ['embolo_septico', 'tormenta_citoquinas'],
  },
];
