import type { DuelCard } from '../../../src/types/game';

export type Frame = 'archivo' | 'visor' | 'campo';
export type View = 'hand' | 'reward' | 'inspect' | 'collection';

export const states = {
  normal: '',
  selected: 'Seleccionada',
  target: 'Objetivo requerido',
  locked: 'No jugable · PA insuficientes',
  synergy: 'Sinergia activa',
  drawn: 'Recién robada',
  resolving: 'Resolviendo',
};
export type PreviewState = keyof typeof states;

const categories = {
  Inmunologia: ['immune', 'Inmunología', 'M12 3v18m-8-4 16-10M4 7l16 10M5 4l2 5m10 6 2 5'],
  Cirugia: ['surgery', 'Cirugía', 'M13 3 5 14h6l-1 7 9-11h-6z'],
  Farmacologia: ['therapy', 'Farmacología', 'M9 3h6m-5 0v6l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 15h8'],
  Diagnostico: ['diagnosis', 'Diagnóstico', 'M8 4H4v4m12-4h4v4M4 16v4h4m8 0h4v-4M4 12h5l2-4 2 8 2-4h5'],
  Patogeno: ['pathogen', 'Patógeno', 'm12 3 8 4v10l-8 4-8-4V7zM4 7l8 5 8-5m-8 5v9'],
};
const trap = ['trap', 'Trampa', 'M12 3 4 7v5c0 4 3 7 8 9 5-2 8-5 8-9V7zM12 8v7m-3-3h6'];

const targets: Record<DuelCard['targetMode'], string> = {
  none: 'Sin objetivo',
  ally: 'Unidad aliada',
  enemy: 'Unidad enemiga',
  empty_lane: 'Carril vacío',
  trap_slot: 'Espacio de trampa',
};

const esc = (value: string | number) => String(value).replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

function Icon(path: string, className = '') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
}

function Artwork(card: DuelCard, state: PreviewState) {
  return `<div class="artwork"><img src="/assets/cards/${esc(card.id)}.webp" width="768" height="576" alt="">${State(state)}</div>`;
}

function CardMeta(card: DuelCard, label: string, icon: string) {
  return `<header class="card-meta">
    <span class="card-type">${Icon(icon)}${label}</span>
    <h3>${esc(card.name)}</h3>
  </header>`;
}

function Rule(card: DuelCard) {
  return `<div class="card-rule">
    <p class="rule-compact">${esc(card.abilityLabel)}</p>
    <p class="rule-full">${esc(card.shortRule)}</p>
  </div>`;
}

function Stats(card: DuelCard) {
  return card.kind === 'Unidad'
    ? `<dl class="card-stats"><div><dt>ATK</dt><dd>${card.atk}</dd></div><div><dt>PS</dt><dd>${card.maxHp}</dd></div></dl>`
    : `<div class="card-stats card-target"><span>Objetivo</span><strong>${targets[card.targetMode]}</strong></div>`;
}

function State(state: PreviewState) {
  return state === 'normal' ? '' : `<span class="card-state">${states[state]}</span>`;
}

export function CardFrame(card: DuelCard, frame: Frame, view: View, state: PreviewState, interactive = true) {
  const [category, classLabel, classIcon] = card.kind === 'Trampa' ? trap
    : card.kind === 'Diagnostico' ? categories.Diagnostico
    : categories[card.medicalClass];
  const label = card.kind === 'Tratamiento' ? card.kind : classLabel;
  const icon = card.kind === 'Tratamiento' ? categories.Farmacologia[2] : classIcon;
  const article = document.createElement('article');
  article.className = 'card';
  Object.assign(article.dataset, { frame, view, state, category, rarity: card.rarity ?? '', card: card.id });
  article.classList.toggle('interactive', interactive);
  article.innerHTML = `<div class="card-inner">
    ${Artwork(card, state)}
    ${CardMeta(card, label, icon)}
    <div class="card-cost"><strong>${card.cost}</strong><span>PA</span></div>
    ${Rule(card)}
    ${Stats(card)}
  </div>`;
  if (interactive) {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'inspect-trigger';
    trigger.setAttribute('aria-label', `Inspeccionar ${card.name}${state === 'normal' ? '' : `, ${states[state]}`}`);
    article.append(trigger);
  }
  return article;
}

export function CardDetails(card: DuelCard) {
  const section = document.createElement('section');
  section.className = 'card-details';
  const details = [
    ['Regla', card.shortRule],
    ['Tipo', card.kind === 'Diagnostico' ? 'Diagnóstico' : card.kind],
    ['Clase', categories[card.medicalClass][1]],
    ['Objetivo', targets[card.targetMode]],
    ['Rareza', card.rarity === 'Comun' ? 'Común' : card.rarity],
    ['Habilidad activa', card.activeSkillLabel && card.activeSkillCost !== undefined
      ? `${card.activeSkillLabel} · ${card.activeSkillCost} PA` : undefined],
    ['Sinergias', card.synergies],
    ['Contrajuego', card.counterEffects],
    ['Base científica', card.medicalBasis],
    ['Abstracción de juego', card.gameSimplification],
  ];
  section.innerHTML = details
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, description]) => `<section><h3>${esc(label)}</h3><p>${esc(description)}</p></section>`)
    .join('');
  return section;
}
