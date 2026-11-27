import { X } from 'lucide-react';
import { DuelCard, TrapTrigger } from '../types/game';

interface CardInspectorModalProps {
  card: DuelCard | null;
  active: boolean;
  onClose: () => void;
}

const TRAP_TRIGGER_LABEL: Record<TrapTrigger, string> = {
  beforeDirectDamage: 'Al recibir un ataque directo al LP del paciente',
  beforeEnemySummon: 'Cuando el brote despliega un nuevo patógeno',
  beforeOutbreak: 'Cuando el brote activa una Carta de Brote',
  beforeAllyDamage: 'Cuando un efecto de brote daña a tus unidades',
};

export function CardInspectorModal({ card, active, onClose }: CardInspectorModalProps) {
  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#050a10]/84"
      role="dialog"
      aria-modal={active || undefined}
      aria-hidden={!active || undefined}
      aria-label={`Ficha médica de ${card.name}`}
      data-session-dialog="inspector"
      tabIndex={-1}
      inert={!active}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[88dvh] overflow-y-auto rounded-2xl bg-[#0c1724] border border-slate-700 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-mono-tabular text-sky-400 mb-1">
              {card.code} · {card.kind} · {card.medicalClass}
              {card.rarity && card.rarity !== 'Comun' ? ` · ${card.rarity}` : ''}
            </p>
            <h2 className="font-display text-xl font-bold text-slate-100">
              {card.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ficha médica"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 text-xs leading-relaxed">
          <div className="rounded-lg bg-[#08111a] border border-slate-800 p-3">
            <div className="font-semibold text-amber-300 mb-1">
              Función Estratégica en Juego
            </div>
            <p className="text-slate-200">{card.shortRule}</p>
            {card.kind === 'Unidad' && (
              <p className="font-mono-tabular text-slate-400 mt-1.5">
                Coste {card.cost} PA · ATK {card.atk} · PS {card.maxHp} · Habilidad: {card.abilityLabel}
              </p>
            )}
            {card.kind === 'Trampa' && card.trapTrigger && (
              <p className="font-mono-tabular text-violet-300 mt-1.5">
                Coste {card.cost} PA · Disparador: {TRAP_TRIGGER_LABEL[card.trapTrigger]}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-[#08111a] border border-slate-800 p-3">
            <div className="font-semibold text-emerald-400 mb-1">
              Fundamento Médico Real
            </div>
            <p className="text-slate-300">{card.medicalBasis}</p>
          </div>

          <div className="rounded-lg bg-[#08111a] border border-slate-800 p-3">
            <div className="font-semibold text-sky-400 mb-1">
              Simplificación de Diseño
            </div>
            <p className="text-slate-300">{card.gameSimplification}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#08111a] border border-slate-800 p-3">
              <div className="font-semibold text-cyan-300 mb-1">Sinergias</div>
              <p className="text-slate-300">{card.synergies}</p>
            </div>
            <div className="rounded-lg bg-[#08111a] border border-slate-800 p-3">
              <div className="font-semibold text-rose-400 mb-1">Contraefectos</div>
              <p className="text-slate-300">{card.counterEffects}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
