import { Layers } from 'lucide-react';
import {
  DuelCard,
  GameMode,
  GameState,
  OrganProfile,
  RivalDuelist,
} from '../types/game';
import { CardVisual } from './CardVisual';

interface EndModalsProps {
  gameState: GameState;
  runMode: GameMode;
  guardLevel: number;
  bestGuardLevel: number;
  recoveredLp: number;
  organProfile: OrganProfile;
  rival: RivalDuelist;
  totalRivals: number;
  rewardChoices: DuelCard[];
  duelsWon: number;
  cardsPlayedCount: number;
  turnsElapsed: number;
  onResume: () => void;
  onOpenDeck: () => void;
  onPickReward: (card: DuelCard) => void;
  onSkipReward: () => void;
  onInspectCard: (card: DuelCard) => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
}

export function EndModals({
  gameState,
  runMode,
  guardLevel,
  bestGuardLevel,
  recoveredLp,
  organProfile,
  rival,
  totalRivals,
  rewardChoices,
  duelsWon,
  cardsPlayedCount,
  turnsElapsed,
  onResume,
  onOpenDeck,
  onPickReward,
  onSkipReward,
  onInspectCard,
  onRestart,
  onReturnToMenu,
}: EndModalsProps) {
  if (gameState === 'PLAYING' || gameState === 'TITLE_MENU') {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 md:p-6 bg-[#050a10]/84 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {gameState === 'PAUSED' && (
        <div className="w-full max-w-md rounded-2xl bg-[#0c1724] border border-slate-800 p-7 shadow-2xl">
          <p className="text-xs font-mono-tabular text-sky-400 mb-1">
            {runMode === 'endless'
              ? `Guardia Infinita · Nivel ${guardLevel}`
              : `Modo Clásico · Duelo ${rival.roundNumber}/${totalRivals}`}{' '}
            · {organProfile.shortName}
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-100 mb-2">
            Duelo en Pausa
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            {rival.name} ({rival.diseaseName}). El progreso de la guardia se guarda automáticamente.
          </p>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-semibold text-sm cursor-pointer whitespace-nowrap"
            >
              Reanudar Duelo
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onOpenDeck}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>Ver Mazo</span>
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs cursor-pointer"
              >
                Reiniciar Guardia
              </button>
            </div>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="w-full px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors cursor-pointer"
            >
              Volver al Menú Principal
            </button>
          </div>
        </div>
      )}

      {gameState === 'ROUND_SUMMARY' && (
        <div className="w-full max-w-3xl rounded-2xl bg-[#0c1724] border border-emerald-500/35 p-6 md:p-7 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-xs font-mono-tabular text-emerald-400 mb-1">
                {runMode === 'endless'
                  ? `Guardia ${guardLevel} Controlada · ${organProfile.shortName} Estabilizado`
                  : `Brote Controlado · Duelo ${rival.roundNumber} de ${totalRivals}`}
                {recoveredLp > 0 ? ` · +${recoveredLp} LP recuperados` : ''}
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-100 mb-1">
                {rival.name} Neutralizado
              </h2>
              <p className="text-sm text-slate-300">
                Elige 1 de 3 recursos médicos para incorporar a tu mazo maestro antes de la siguiente guardia.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenDeck}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#08111a] border border-slate-700 hover:border-sky-400 text-xs font-medium text-slate-200 cursor-pointer shrink-0"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              <span>Ver Mazo</span>
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-6">
            {rewardChoices.map((card) => (
              <CardVisual
                key={card.id}
                card={card}
                playable={true}
                compact={true}
                onSelect={() => onPickReward(card)}
                onInspect={() => onInspectCard(card)}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSkipReward}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Continuar sin añadir carta
            </button>
          </div>
        </div>
      )}

      {(gameState === 'VICTORY' || gameState === 'GAME_OVER') && (
        <div className="w-full max-w-lg rounded-2xl bg-[#0c1724] border border-slate-800 p-7 shadow-2xl">
          <p
            className={`text-xs font-mono-tabular mb-1 ${
              gameState === 'VICTORY' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {gameState === 'VICTORY'
              ? `Campaña Clásica Completada · ${totalRivals}/${totalRivals} Brotes`
              : runMode === 'endless'
                ? `Colapso Crítico en Guardia Infinita · Nivel ${guardLevel}`
                : `Colapso Crítico en Duelo ${rival.roundNumber}/${totalRivals}`}
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-100 mb-2">
            {gameState === 'VICTORY'
              ? '¡Victoria Clínica Total!'
              : 'Estabilidad del Paciente Agotada'}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            {gameState === 'VICTORY'
              ? 'Coordinaste inmunidad celular, farmacología específica y soporte quirúrgico para neutralizar todos los brotes.'
              : `${rival.name} (${organProfile.shortName}) superó los LP del paciente. Aprovecha las sinergias de órgano, trampas reactivas y fármacos dirigidos.`}
          </p>

          <div className="grid grid-cols-3 gap-3 border-t border-b border-slate-800 py-4 mb-6 text-center">
            <div>
              <div className="text-xs text-slate-400 mb-1">
                {runMode === 'endless' ? 'Guardia / Récord' : 'Duelos Ganados'}
              </div>
              <div className="font-mono-tabular text-xl font-semibold text-emerald-400">
                {runMode === 'endless'
                  ? `${duelsWon} / ${bestGuardLevel}`
                  : `${duelsWon}/${totalRivals}`}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Cartas Usadas</div>
              <div className="font-mono-tabular text-xl font-semibold text-sky-400">
                {cardsPlayedCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Turnos</div>
              <div className="font-mono-tabular text-xl font-semibold text-amber-400">
                {turnsElapsed}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onRestart}
              className="flex-1 px-6 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm tracking-wide cursor-pointer whitespace-nowrap"
            >
              Jugar de Nuevo
            </button>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="px-5 py-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm cursor-pointer whitespace-nowrap"
            >
              Menú Principal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
