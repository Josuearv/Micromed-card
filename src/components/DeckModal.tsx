import { HelpCircle, Layers, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DuelEngineState } from '../engine/combatEngine';
import { CardInstance, CardKind, DuelCard } from '../types/game';

interface DeckModalProps {
  open: boolean;
  masterDeck: CardInstance[];
  duelState: DuelEngineState | null;
  onInspectCard: (card: DuelCard) => void;
  onClose: () => void;
}

type DeckTab = 'master' | 'draw' | 'hand' | 'discard' | 'field';
type KindFilter = 'Todas' | CardKind;

const KIND_BADGE: Record<CardKind, string> = {
  Unidad: 'text-emerald-300 border-emerald-500/35 bg-emerald-950/40',
  Tratamiento: 'text-sky-300 border-sky-500/35 bg-sky-950/40',
  Diagnostico: 'text-cyan-300 border-cyan-500/35 bg-cyan-950/40',
  Trampa: 'text-violet-300 border-violet-500/35 bg-violet-950/40',
};

export function DeckModal({
  open,
  masterDeck,
  duelState,
  onInspectCard,
  onClose,
}: DeckModalProps) {
  const [tab, setTab] = useState<DeckTab>('master');
  const [kindFilter, setKindFilter] = useState<KindFilter>('Todas');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const groupedMaster = useMemo(() => {
    const map = new Map<string, { card: CardInstance; count: number }>();
    for (const c of masterDeck) {
      const existing = map.get(c.id);
      if (existing) existing.count += 1;
      else map.set(c.id, { card: c, count: 1 });
    }
    return Array.from(map.values()).filter(
      (g) => kindFilter === 'Todas' || g.card.kind === kindFilter,
    );
  }, [masterDeck, kindFilter]);

  const listItems = useMemo(() => {
    if (!duelState) return [];
    let raw: DuelCard[] = [];
    if (tab === 'draw') raw = duelState.drawPile;
    else if (tab === 'hand') raw = duelState.hand;
    else if (tab === 'discard') raw = duelState.discardPile;
    else if (tab === 'field') {
      const units = duelState.playerSlots
        .filter((u): u is NonNullable<typeof u> => u !== null)
        .map((u) => u.sourceCard);
      const traps = duelState.armedTraps.map((t) => t.sourceCard);
      raw = [...units, ...traps];
    }
    return raw.filter((c) => kindFilter === 'Todas' || c.kind === kindFilter);
  }, [duelState, tab, kindFilter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 md:p-6 bg-[#050a10]/84"
      role="dialog"
      aria-modal="true"
      aria-label="Visor de mazo y pilas clínicas"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[86dvh] flex flex-col rounded-2xl bg-[#0c1724] border border-slate-700 p-5 md:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
          <div>
            <p className="text-xs font-mono-tabular text-sky-400 mb-0.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Archivo Clínico del Mazo ({masterDeck.length} cartas totales)</span>
            </p>
            <h2 className="font-display text-xl font-bold text-slate-100">
              Inspección de Mazo y Pilas
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar visor de mazo"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3 mb-3 shrink-0">
          {(
            [
              { id: 'master', label: `Mazo Maestro (${masterDeck.length})` },
              ...(duelState
                ? [
                    { id: 'draw', label: `Robo (${duelState.drawPile.length})` },
                    { id: 'hand', label: `Mano (${duelState.hand.length})` },
                    { id: 'discard', label: `Descarte (${duelState.discardPile.length})` },
                    {
                      id: 'field',
                      label: `Campo y Trampas (${
                        duelState.playerSlots.filter(Boolean).length +
                        duelState.armedTraps.length
                      })`,
                    },
                  ]
                : []),
            ] as { id: DeckTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono-tabular transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'bg-[#08111a] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Kind Filter */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3 shrink-0">
          {(['Todas', 'Unidad', 'Tratamiento', 'Diagnostico', 'Trampa'] as KindFilter[]).map(
            (k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  kindFilter === k
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                    : 'bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {k}
              </button>
            ),
          )}
        </div>

        {/* Cards List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {tab === 'master' ? (
            groupedMaster.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                No hay cartas en esta categoría.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {groupedMaster.map(({ card, count }) => (
                  <div
                    key={card.id}
                    className="flex items-start justify-between gap-2.5 rounded-xl bg-[#08111a] border border-slate-800 hover:border-slate-600 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => onInspectCard(card)}
                      className="flex-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-mono-tabular px-1.5 py-0.5 rounded border ${KIND_BADGE[card.kind]}`}
                        >
                          {card.kind}
                        </span>
                        <span className="text-[11px] font-mono-tabular text-sky-400 font-semibold">
                          {card.cost} PA
                        </span>
                        <span className="text-[11px] font-mono-tabular text-amber-300 font-bold">
                          x{count}
                        </span>
                      </div>
                      <div className="font-display text-sm font-semibold text-slate-100">
                        {card.name}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                        {card.shortRule}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onInspectCard(card)}
                      aria-label={`Inspeccionar ${card.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 cursor-pointer shrink-0"
                    >
                      <HelpCircle className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : listItems.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Esta pila está vacía actualmente.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {listItems.map((card, i) => (
                <div
                  key={`${card.id}-${i}`}
                  className="flex items-start justify-between gap-2.5 rounded-xl bg-[#08111a] border border-slate-800 hover:border-slate-600 p-3"
                >
                  <button
                    type="button"
                    onClick={() => onInspectCard(card)}
                    className="flex-1 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-mono-tabular px-1.5 py-0.5 rounded border ${KIND_BADGE[card.kind]}`}
                      >
                        {card.kind}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-sky-400 font-semibold">
                        {card.cost} PA
                      </span>
                    </div>
                    <div className="font-display text-sm font-semibold text-slate-100">
                      {card.name}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                      {card.shortRule}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onInspectCard(card)}
                    aria-label={`Inspeccionar ${card.name}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    <HelpCircle className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
