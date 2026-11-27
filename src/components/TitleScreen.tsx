import { Grid2x2, Play, Sparkles, Trophy, Volume2, VolumeX } from 'lucide-react';
import { RunCheckpoint } from '../game/persistence';
import { GameMode, RunPreferences } from '../types/game';
import { SaveStatus, SaveStatusProps } from './SaveStatus';

interface TitleScreenProps {
  savedRun: RunCheckpoint | null;
  resumeUnsaved: boolean;
  canQuickStart: boolean;
  saveStatus: SaveStatusProps;
  bestGuardLevel: number;
  prefs: RunPreferences;
  onStartMode: (mode: GameMode) => void;
  onResumeSaved: () => void;
  onToggleMute: () => void;
  onToggleTactical2D: () => void;
  onToggleReducedMotion: () => void;
}

export function TitleScreen({
  savedRun,
  resumeUnsaved,
  canQuickStart,
  saveStatus,
  bestGuardLevel,
  prefs,
  onStartMode,
  onResumeSaved,
  onToggleMute,
  onToggleTactical2D,
  onToggleReducedMotion,
}: TitleScreenProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-center pointer-events-none overflow-y-auto">
      <div
        className="fixed inset-y-0 left-0 w-full md:w-[58%] bg-gradient-to-r from-[#070f17]/95 via-[#070f17]/84 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-xl px-6 md:px-14 py-8 pointer-events-auto my-auto">
        <div className="mb-4">
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

        <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-md mb-5">
          Defiende 5 órganos y tejidos vitales en 3 carriles vasculares frente a
          brotes procedurales, enfermedades raras y cartas de brote rivales.
        </p>

        <div className="space-y-2 mb-6 text-xs md:text-sm text-slate-300 border-t border-b border-slate-800/80 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="font-mono-tabular text-emerald-400 font-semibold">01.</span>
            <span>
              <strong className="text-slate-100 font-semibold">Órganos y Sinergias</strong>: Corazón, Pulmón, Hígado, Cerebro y Tejido Epitelial rotan con bonificaciones clínicas por clase.
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono-tabular text-violet-400 font-semibold">02.</span>
            <span>
              <strong className="text-slate-100 font-semibold">Trampas Reactivas y Brote</strong>: arma respuestas inmunes boca abajo para interceptar ataques directos y cartas del rival.
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono-tabular text-amber-400 font-semibold">03.</span>
            <span>
              <strong className="text-slate-100 font-semibold">Guardia Infinita</strong>: escala tu mazo eligiendo 1 de 3 cartas tras cada victoria mientras sube la dificultad.
            </span>
          </div>
        </div>

        {bestGuardLevel > 0 && (
          <div className="inline-flex items-center gap-2 text-xs font-mono-tabular text-amber-300 mb-4 px-3 py-1 rounded-lg bg-amber-950/35 border border-amber-500/35">
            <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Mejor Guardia Infinita: Nivel {bestGuardLevel}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-5">
          {savedRun && (
            <button
              type="button"
              onClick={onResumeSaved}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              <span>
                {savedRun.terminal ? 'Ver resultado' : resumeUnsaved ? 'Continuar sin guardar' : 'Continuar'} ({savedRun.run.mode === 'endless' ? `Guardia ${savedRun.run.guardLevel}` : `Clásico ${savedRun.run.guardLevel}/3`})
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onStartMode('endless')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:translate-y-px text-slate-950 font-display font-bold text-sm md:text-base tracking-wide transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>Guardia Infinita</span>
          </button>

          <button
            type="button"
            onClick={() => onStartMode('classic')}
            className="px-5 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-display font-semibold text-sm tracking-wide transition-colors cursor-pointer whitespace-nowrap"
          >
            Modo Clásico (3 Duelos)
          </button>
        </div>

        <SaveStatus {...saveStatus} />

        {/* Accessibility & View Preferences */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c1724] border border-slate-800 hover:border-slate-600 text-xs text-slate-300 cursor-pointer"
          >
            {prefs.muted ? (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            )}
            <span>{prefs.muted ? 'Audio silenciado' : 'Audio activo'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTactical2D}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
              prefs.tactical2D
                ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                : 'bg-[#0c1724] border-slate-800 hover:border-slate-600 text-slate-300'
            }`}
          >
            <Grid2x2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{prefs.tactical2D ? 'Tablero Táctico 2D' : 'Arena 3D'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleReducedMotion}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
              prefs.reducedMotion
                ? 'bg-sky-950/50 border-sky-500/50 text-sky-300'
                : 'bg-[#0c1724] border-slate-800 hover:border-slate-600 text-slate-300'
            }`}
          >
            <span>{prefs.reducedMotion ? 'Movimiento reducido' : 'Animación estándar'}</span>
          </button>
        </div>

        <p className="text-xs font-mono-tabular text-slate-400 tracking-wide">
          {canQuickStart && 'Enter Iniciar Guardia Infinita · '}
          1-6 Carta · Espacio Fase/Combate · H Vista · Esc Pausa
        </p>
      </div>
    </div>
  );
}
