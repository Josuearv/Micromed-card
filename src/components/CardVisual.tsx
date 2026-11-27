import { HelpCircle } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { DuelCard, EntityVisualArchetype, MedicalClass } from '../types/game';

interface CardVisualProps {
  card: DuelCard;
  playable: boolean;
  invalidReason?: string;
  selected?: boolean;
  indexHint?: number;
  compact?: boolean;
  variant?: 'hand' | 'reward';
  onSelect: () => void;
  onInspect?: () => void;
}

const CLASS_STYLE: Record<
  MedicalClass,
  {
    label: string;
    accentText: string;
    accentBorder: string;
    costBg: string;
    stroke: string;
  }
> = {
  Inmunologia: {
    label: 'Inmunología',
    accentText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/45 hover:border-emerald-400',
    costBg: 'bg-emerald-500 text-slate-950',
    stroke: '#34d399',
  },
  Farmacologia: {
    label: 'Farmacología',
    accentText: 'text-sky-400',
    accentBorder: 'border-sky-500/45 hover:border-sky-400',
    costBg: 'bg-sky-500 text-slate-950',
    stroke: '#38bdf8',
  },
  Cirugia: {
    label: 'Cirugía',
    accentText: 'text-amber-400',
    accentBorder: 'border-amber-500/45 hover:border-amber-400',
    costBg: 'bg-amber-400 text-slate-950',
    stroke: '#fbbf24',
  },
  Diagnostico: {
    label: 'Diagnóstico',
    accentText: 'text-cyan-300',
    accentBorder: 'border-cyan-500/45 hover:border-cyan-400',
    costBg: 'bg-cyan-400 text-slate-950',
    stroke: '#22d3ee',
  },
  Patogeno: {
    label: 'Patógeno',
    accentText: 'text-rose-400',
    accentBorder: 'border-rose-500/45 hover:border-rose-400',
    costBg: 'bg-rose-500 text-white',
    stroke: '#fb7185',
  },
};

function CardArtwork({
  archetype,
  kind,
  stroke,
}: {
  archetype: EntityVisualArchetype;
  kind: DuelCard['kind'];
  stroke: string;
}) {
  if (kind === 'Trampa') {
    const trapStroke = '#c084fc';
    return (
      <svg viewBox="0 0 120 40" className="w-full h-9" aria-hidden="true">
        <path
          d="M60,5 L78,12 V21 C78,29 69,34 60,37 C51,34 42,29 42,21 V12 Z"
          fill={trapStroke}
          fillOpacity="0.16"
          stroke={trapStroke}
          strokeWidth="2"
        />
        <path
          d="M54,20 L58,24 L67,15"
          fill="none"
          stroke={trapStroke}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (kind === 'Diagnostico') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-9" aria-hidden="true">
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points="8,20 26,20 35,12 43,27 52,5 60,35 68,18 76,20 112,20"
        />
      </svg>
    );
  }

  if (archetype === 'macrofago') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-9" aria-hidden="true">
        <path
          d="M42,20 C42,10 54,6 64,10 C74,7 82,14 78,22 C83,30 70,35 58,32 C47,34 40,28 42,20 Z"
          fill={stroke}
          fillOpacity="0.2"
          stroke={stroke}
          strokeWidth="2"
        />
        <circle cx="58" cy="20" r="5" fill={stroke} />
      </svg>
    );
  }

  if (archetype === 'anticuerpo') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-9" aria-hidden="true">
        <path
          d="M60,34 V20 M60,20 L46,8 M60,20 L74,8"
          stroke={stroke}
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="46" cy="8" r="3" fill={stroke} />
        <circle cx="74" cy="8" r="3" fill={stroke} />
      </svg>
    );
  }

  if (archetype === 'linfocito') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-9" aria-hidden="true">
        <circle
          cx="60"
          cy="20"
          r="11"
          fill={stroke}
          fillOpacity="0.18"
          stroke={stroke}
          strokeWidth="2"
        />
        <path
          d="M60,4 V9 M60,31 V36 M44,20 H49 M71,20 H76 M48,9 L52,13 M68,27 L72,31"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (archetype === 'plaqueta') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-9" aria-hidden="true">
        <polygon
          points="60,6 75,15 71,31 49,31 45,15"
          fill={stroke}
          fillOpacity="0.2"
          stroke={stroke}
          strokeWidth="2"
        />
        <circle cx="60" cy="20" r="4" fill={stroke} />
      </svg>
    );
  }

  if (archetype === 'hongo') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-9" aria-hidden="true">
        <path
          d="M44,22 C44,12 76,12 76,22 Z"
          fill={stroke}
          fillOpacity="0.22"
          stroke={stroke}
          strokeWidth="2"
        />
        <rect
          x="56"
          y="22"
          width="8"
          height="12"
          rx="2"
          fill={stroke}
          fillOpacity="0.2"
          stroke={stroke}
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (archetype === 'unidad_qx') {
    return (
      <svg viewBox="0 0 120 40" className="w-full h-9" aria-hidden="true">
        <polygon
          points="64,4 48,22 59,22 56,36 73,17 61,17"
          fill={stroke}
          fillOpacity="0.24"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 40" className="w-full h-9" aria-hidden="true">
      <circle
        cx="54"
        cy="20"
        r="9"
        fill={stroke}
        fillOpacity="0.2"
        stroke={stroke}
        strokeWidth="2"
      />
      <circle
        cx="66"
        cy="20"
        r="9"
        fill={stroke}
        fillOpacity="0.2"
        stroke={stroke}
        strokeWidth="2"
      />
    </svg>
  );
}

export function CardVisual({
  card,
  playable,
  invalidReason,
  selected = false,
  indexHint,
  compact = false,
  variant = 'reward',
  onSelect,
  onInspect,
}: CardVisualProps) {
  const style = CLASS_STYLE[card.medicalClass];
  const isTrap = card.kind === 'Trampa';
  const accentText = isTrap ? 'text-violet-300' : style.accentText;
  const accentBorder = isTrap
    ? 'border-violet-500/50 hover:border-violet-400'
    : style.accentBorder;
  const costBg = isTrap ? 'bg-violet-500 text-white' : style.costBg;

  if (variant === 'hand') {
    return (
      <div
        className={[
          'group relative flex flex-col justify-between rounded-lg border p-2',
          'transition-[transform,opacity,border-color] duration-150 ease-out will-change-transform',
          'w-[126px] md:w-[138px] h-[120px]',
          'bg-[#0a1623]/94 shadow-[0_10px_22px_rgba(0,0,0,0.6)]',
          selected
            ? 'border-amber-400 -translate-y-3 ring-2 ring-amber-400/60'
            : playable
              ? `${accentBorder} hover:-translate-y-2 opacity-100`
              : 'border-slate-700/60 opacity-55',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onSelect}
          onMouseEnter={() => {
            if (playable) soundEngine.playCardHover();
          }}
          title={`${card.name}: ${card.shortRule}`}
          aria-label={`${card.name}. ${card.kind}. Coste ${card.cost} PA. ${card.shortRule}`}
          className="flex-1 flex flex-col justify-between text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
        >
          <div className="flex items-center justify-between gap-1">
            <span className={`text-[9px] font-mono-tabular font-semibold truncate ${accentText}`}>
              {card.kind}
            </span>
            <span
              className={`font-mono-tabular shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold ${costBg}`}
            >
              {card.cost}
            </span>
          </div>

          <h3 className="font-display text-[11px] font-semibold text-slate-100 leading-tight line-clamp-1 pr-4">
            {card.name}
          </h3>

          <div className="rounded bg-[#060e16] border border-slate-800/80 py-0.5 px-1">
            <CardArtwork archetype={card.archetype} kind={card.kind} stroke={style.stroke} />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono-tabular pt-0.5 border-t border-slate-800/80">
            {!playable && invalidReason ? (
              <span className="text-rose-300 truncate text-[9px]">{invalidReason}</span>
            ) : card.kind === 'Unidad' ? (
              <span className="font-semibold truncate">
                <span className="text-amber-400">{card.atk}</span>
                <span className="text-slate-600 mx-0.5">/</span>
                <span className="text-emerald-400">{card.maxHp}</span>
              </span>
            ) : isTrap ? (
              <span className="text-violet-300 truncate text-[9px]">
                Armar Trampa
              </span>
            ) : (
              <span className="text-slate-300 truncate text-[9px]">
                {selected ? 'Elige objetivo' : card.abilityLabel}
              </span>
            )}
            {typeof indexHint === 'number' && (
              <span className="text-slate-500 text-[9px] ml-1 shrink-0">[{indexHint}]</span>
            )}
          </div>
        </button>

        {onInspect && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
            aria-label={`Ver fundamento médico de ${card.name}`}
            title="Ver ficha médica y reglas"
            className="absolute top-7 right-1.5 w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3 h-3" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        'group relative flex flex-col justify-between rounded-xl border p-3',
        'transition-[transform,opacity,border-color] duration-150 ease-out will-change-transform',
        compact ? 'w-56 min-h-[252px]' : 'w-[186px] xl:w-[198px] min-h-[234px]',
        'bg-[#0c1826]/95 shadow-[0_14px_28px_rgba(0,0,0,0.52)]',
        selected
          ? 'border-amber-400 -translate-y-3 ring-2 ring-amber-400/50'
          : playable
            ? `${accentBorder} hover:-translate-y-2 opacity-100`
            : 'border-slate-700/60 opacity-55',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={() => {
          if (playable) soundEngine.playCardHover();
        }}
        aria-label={`${card.name}. Coste ${card.cost}. ${card.shortRule}`}
        className="flex-1 flex flex-col justify-between text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg"
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="text-[11px] font-medium tracking-wide text-slate-400 leading-tight">
              <span className={accentText}>{card.kind}</span>
              <span className="mx-1 text-slate-600" aria-hidden="true">
                ·
              </span>
              <span>{style.label}</span>
              {card.rarity && card.rarity !== 'Comun' && (
                <span className="block text-[10px] font-mono-tabular text-amber-300/90 mt-0.5">
                  {card.rarity}
                </span>
              )}
            </div>
            <span
              className={`font-mono-tabular shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-semibold ${costBg}`}
            >
              {card.cost}
            </span>
          </div>

          <h3 className="font-display text-sm font-semibold text-slate-100 leading-snug line-clamp-2 pr-5">
            {card.name}
          </h3>
        </div>

        <div className="my-1.5 rounded-lg bg-[#071018] border border-slate-800/90 py-1.5 px-2">
          <CardArtwork archetype={card.archetype} kind={card.kind} stroke={style.stroke} />
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
            {card.shortRule}
          </p>

          <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/90 text-[11px] font-mono-tabular">
            {!playable && invalidReason ? (
              <span className="text-rose-300 truncate">{invalidReason}</span>
            ) : card.kind === 'Unidad' ? (
              <div className="flex items-center gap-2 font-semibold">
                <span className="text-amber-400">ATK {card.atk}</span>
                <span className="text-slate-600" aria-hidden="true">
                  /
                </span>
                <span className="text-emerald-400">PS {card.maxHp}</span>
              </div>
            ) : isTrap ? (
              <span className="text-violet-300 truncate">Trampa Reactiva</span>
            ) : (
              <span className="text-slate-400 truncate">
                {selected ? 'Elige objetivo' : card.abilityLabel}
              </span>
            )}

            {typeof indexHint === 'number' && (
              <span className="ml-1 shrink-0 text-slate-500">[{indexHint}]</span>
            )}
          </div>
        </div>
      </button>

      {onInspect && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect();
          }}
          aria-label={`Ver fundamento médico de ${card.name}`}
          title="Ver fundamento médico y sinergias"
          className="absolute top-10 right-2.5 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
