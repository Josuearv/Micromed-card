interface TitleScreenProps {
  onStart: () => void;
}

export function TitleScreen({ onStart }: TitleScreenProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-center pointer-events-none">
      <div
        className="absolute inset-y-0 left-0 w-full md:w-[56%] bg-gradient-to-r from-[#070f17]/95 via-[#070f17]/82 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-xl px-8 md:px-14 py-10 pointer-events-auto">
        <div className="mb-5">
          <svg
            viewBox="0 0 380 86"
            className="w-full max-w-[360px] h-auto"
            role="img"
            aria-label="Código Vital: Duelo Clínico"
          >
            <rect
              x="2"
              y="14"
              width="52"
              height="52"
              rx="10"
              fill="#0c1c2a"
              stroke="#10b981"
              strokeWidth="2"
            />
            <path
              d="M28 26 V54 M14 40 H42"
              stroke="#10b981"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="66,46 84,46 92,35 99,55 108,21 116,60 123,41 132,46 372,46"
              opacity="0.7"
            />
            <text
              x="68"
              y="34"
              fill="#f8fafc"
              fontFamily="Outfit, sans-serif"
              fontWeight="700"
              fontSize="30"
              letterSpacing="-0.5"
            >
              CÓDIGO VITAL
            </text>
            <text
              x="68"
              y="68"
              fill="#94a3b8"
              fontFamily="IBM Plex Mono, monospace"
              fontWeight="500"
              fontSize="12"
              letterSpacing="1.4"
            >
              DUELO ESTRATÉGICO MÉDICO 3D
            </text>
          </svg>
        </div>

        <p className="text-base text-slate-300 leading-relaxed max-w-md mb-7">
          Dirige la respuesta inmune y farmacológica en 3 carriles vasculares
          frente a brotes virales, bacterianos y trombóticos. Despliega entidades,
          aplica tratamientos dirigidos y observa la resolución del combate en la
          arena biológica 3D.
        </p>

        <div className="space-y-2.5 mb-8 text-sm text-slate-300 border-t border-b border-slate-800/80 py-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono-tabular text-emerald-400 font-semibold">01.</span>
            <span>
              <strong className="text-slate-100 font-semibold">Fase Táctica</strong>: elige en qué carril desplegar células inmunes, reposiciona unidades o aplica diagnósticos y fármacos específicos.
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono-tabular text-sky-400 font-semibold">02.</span>
            <span>
              <strong className="text-slate-100 font-semibold">Coherencia Clínica</strong>: usa Antivirales contra Virus, Meropenem para disolver Biofilm bacteriano y Alteplasa contra Trombos.
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono-tabular text-amber-400 font-semibold">03.</span>
            <span>
              <strong className="text-slate-100 font-semibold">Combate Automático por Carriles</strong>: pulsa Resolver Combate para ejecutar fagocitosis, opsonización y ataques directos al LP rival.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-5">
          <button
            type="button"
            onClick={onStart}
            className="px-7 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:translate-y-px text-slate-950 font-display font-bold text-base tracking-wide transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            Iniciar Duelo
          </button>
          <span className="text-xs font-mono-tabular text-slate-400">
            Pulsa Enter o Espacio
          </span>
        </div>

        <p className="text-xs font-mono-tabular text-slate-400 tracking-wide">
          1-6 Seleccionar Carta · Espacio Resolver Combate · ? Ficha Médica · H Vista 3D · Esc Pausa
        </p>
      </div>
    </div>
  );
}
