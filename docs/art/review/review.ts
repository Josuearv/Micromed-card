import { ALL_PLAYER_CARDS_MAP, ENEMY_PATHOGEN_CARDS } from '../../../src/data/medicalCards';
import { CardDetails, CardFrame, type Frame, type PreviewState, type View } from './CardPreview';
import type { DuelCard } from '../../../src/types/game';

const ids = ['macrofago-alveolar', 'desfibrilador-qx', 'meropenem-iv', 'diagnostico-pcr', 'barrera-mucociliar', 'e-candida'];
const catalog = new Map(
  [...Object.values(ALL_PLAYER_CARDS_MAP), ...Object.values(ENEMY_PATHOGEN_CARDS)].map((card) => [card.id, card]),
);
const proposalList: { id: Frame; title: string; description: string }[] = [
  { id: 'archivo', title: 'Archivo clínico', description: 'Título arriba, ventana enmarcada y lectura de arriba abajo.' },
  { id: 'visor', title: 'Visor táctico', description: 'Ilustración al borde superior, con el coste en una placa superpuesta.' },
  { id: 'campo', title: 'Ficha de campo', description: 'Retrato en una ventana biselada y atributos en módulos gemelos.' },
];

const gallery = document.querySelector<HTMLDivElement>('#proposals')!;
const stateInput = document.querySelector<HTMLSelectElement>('#state')!;
const inspector = document.querySelector<HTMLDialogElement>('#inspector')!;
const content = document.querySelector<HTMLDivElement>('#inspect-content')!;
const title = document.querySelector<HTMLHeadingElement>('#inspect-title')!;
let opener: HTMLButtonElement | null = null;

function openInspector(card: DuelCard, frame: Frame, trigger: HTMLButtonElement) {
  opener = trigger;
  title.textContent = card.name;
  content.replaceChildren(CardFrame(card, frame, 'inspect', 'normal', false), CardDetails(card));
  inspector.showModal();
}

function render() {
  const view = document.querySelector<HTMLInputElement>('input[name="view"]:checked')!.value as View;
  const state = stateInput.value as PreviewState;
  const sections = proposalList.map((proposal) => {
    const section = document.createElement('section');
    section.className = 'proposal';
    section.setAttribute('aria-labelledby', `title-${proposal.id}`);
    const heading = document.createElement('h2');
    heading.id = `title-${proposal.id}`;
    heading.textContent = proposal.title;
    const description = document.createElement('p');
    description.textContent = proposal.description;
    const deck = document.createElement('div');
    deck.className = 'deck';
    deck.dataset.view = view;
    for (const id of ids) {
      const card = catalog.get(id);
      if (!card) throw new Error(`ID de revisión ausente del catálogo: ${id}`);
      const item = CardFrame(card, proposal.id, view, state);
      const trigger = item.querySelector<HTMLButtonElement>('button')!;
      trigger.addEventListener('click', () => openInspector(card, proposal.id, trigger));
      deck.append(item);
    }
    section.append(heading, description, deck);
    return section;
  });
  gallery.replaceChildren(...sections);
}

document.querySelector('.controls')!.addEventListener('change', render);
inspector.addEventListener('close', () => opener?.focus());
render();
