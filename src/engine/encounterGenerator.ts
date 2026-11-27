import { ENEMY_PATHOGEN_CARDS } from '../data/medicalCards';
import { ALL_ORGAN_IDS, ORGAN_PROFILES } from '../data/organs';
import {
  CASE_MUTATORS,
  RARE_DISEASE_TEMPLATES,
  RIVAL_OUTBREAK_CARDS,
} from '../data/outbreaks';
import {
  DuelCard,
  OrganId,
  PathogenSubtype,
  RareDiseaseMutator,
  RivalDuelist,
} from '../types/game';
import { rngPick, rngShuffle } from './rng';

function scaleEnemyCard(card: DuelCard, guardLevel: number, isBoss: boolean): DuelCard {
  if (guardLevel <= 1) return card;
  // Gentle, calibrated curve so early levels teach and later levels scale pressure without absurd spikes
  const tierSteps = Math.max(0, guardLevel - 1);
  const mult = 1 + Math.min(0.65, tierSteps * 0.065) + (isBoss ? 0.1 : 0);
  const round50 = (v: number) => Math.round((v * mult) / 50) * 50;

  return {
    ...card,
    atk: round50(card.atk),
    maxHp: round50(card.maxHp),
  };
}

/**
 * Generador procedural determinista para Modo Guardia Infinita.
 * Usa bolsa de órganos sin repetición consecutiva, enfermedades raras compatibles,
 * mutadores escalados por nivel y cartas de brote telegrafiadas.
 */
export function generateProceduralEncounter(
  guardLevel: number,
  rngState: number,
  previousOrganId?: OrganId,
): { rival: RivalDuelist; nextRngState: number } {
  let rng = rngState;
  const isBoss = guardLevel > 0 && guardLevel % 5 === 0;

  // 1. Organ rotation without immediate consecutive repeat
  const organCandidates = previousOrganId
    ? ALL_ORGAN_IDS.filter((id) => id !== previousOrganId)
    : ALL_ORGAN_IDS;
  const organPick = rngPick(rng, organCandidates);
  rng = organPick.nextState;
  const organId = organPick.item;
  const organProfile = ORGAN_PROFILES[organId];

  // 2. Pick a Rare Disease compatible with the active organ (fallback to full pool)
  const matchingTemplates = RARE_DISEASE_TEMPLATES.filter((t) =>
    t.preferredOrgans.includes(organId),
  );
  const templateCandidates =
    matchingTemplates.length > 0 ? matchingTemplates : RARE_DISEASE_TEMPLATES;
  const templatePick = rngPick(rng, templateCandidates);
  rng = templatePick.nextState;
  const disease = templatePick.item;

  // 3. Mutators: Guardias 1-2 introduce 0-1 gentle mutator; 3+ scale up to 2 mutators on boss/high tiers
  const mutatorCount =
    guardLevel === 1 ? 0 : guardLevel <= 4 ? 1 : isBoss || guardLevel >= 6 ? 2 : 1;
  const shuffledMutators = rngShuffle(rng, disease.mutatorPool);
  rng = shuffledMutators.nextState;
  const mutators: RareDiseaseMutator[] = shuffledMutators.items
    .slice(0, mutatorCount)
    .map((mId) => CASE_MUTATORS[mId])
    .filter(Boolean);

  // 4. Build balanced pathogen deck guided by preferred subtypes and threat budget
  const allEnemies = Object.values(ENEMY_PATHOGEN_CARDS);
  const preferredEnemies = allEnemies.filter(
    (e) => e.subtype && disease.preferredSubtypes.includes(e.subtype as PathogenSubtype),
  );
  const secondaryEnemies = allEnemies.filter(
    (e) => !e.subtype || !disease.preferredSubtypes.includes(e.subtype as PathogenSubtype),
  );

  // Guard 1 excludes heavy 3-cost threats in opening wave for clean onboarding
  const filterByLevel = (list: DuelCard[]) =>
    guardLevel === 1
      ? list.filter((e) => e.cost <= 2)
      : guardLevel === 2
        ? list.filter((e) => e.id !== 'e-sarm')
        : list;

  const prefPool = filterByLevel(preferredEnemies);
  const secPool = filterByLevel(secondaryEnemies);
  const validPref = prefPool.length > 0 ? prefPool : allEnemies.filter((e) => e.cost <= 2);
  const validSec = secPool.length > 0 ? secPool : validPref;

  const deck: DuelCard[] = [];
  for (let i = 0; i < 4; i++) {
    const source = i < 3 ? validPref : validSec;
    const pick = rngPick(rng, source);
    rng = pick.nextState;
    deck.push(scaleEnemyCard(pick.item, guardLevel, isBoss));
  }

  // Ensure opening unit (index 0) isn't overwhelming on Guard 1-2
  if (guardLevel <= 2 && deck[0].cost >= 3) {
    const light = validPref.find((e) => e.cost <= 2) ?? ENEMY_PATHOGEN_CARDS.rinovirus;
    deck[0] = scaleEnemyCard(light, guardLevel, isBoss);
  }

  // 5. Rival Outbreak Cards
  const outbreakDeck = disease.outbreakIds
    .map((key) => RIVAL_OUTBREAK_CARDS[key])
    .filter(Boolean);

  // 6. Calibrated LP curve (aligned with real baseline 3000/4000/5000)
  const baseLp = 2800 + Math.min(guardLevel, 12) * 450 + Math.max(0, guardLevel - 12) * 300;
  const startingLp = isBoss ? baseLp + 800 : baseLp;

  const rival: RivalDuelist = {
    id: `guard-${guardLevel}-${disease.id}`,
    roundNumber: guardLevel,
    isBoss,
    name: isBoss ? `[Jefe] ${disease.name}` : disease.name,
    diseaseName: disease.diseaseName,
    clinicalContext: `${organProfile.shortName} · ${disease.clinicalContext}`,
    organId,
    mutators,
    startingLp,
    threatBudget: guardLevel * 10 + (isBoss ? 15 : 0),
    deck,
    outbreakDeck,
  };

  return { rival, nextRngState: rng };
}
