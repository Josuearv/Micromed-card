import { DuelCard, GameState, RivalDuelist } from '../types/game';
import { CardVisual } from './CardVisual';

interface EndModalsProps {
  gameState: GameState;
  rival: RivalDuelist;
  totalRivals: number;
  rewardChoices: DuelCard[];
  duelsWon: number;
  cardsPlayedCount: number;
  turnsElapsed: number;
  onResume: () => void;
  onPickReward: (card: DuelCard) => void;
  onSkipReward: () => void;
  onInspectCard: (card: DuelCard) => void;
  onRestart: () => void;
}

export function EndModals({
  gameState,
  rival,
  totalRivals,
  rewardChoices,
  duelsWon,
  cardsPlayedCount,
  turnsElapsed,
  onResume,
  onPickReward,
  onSkipReward,
  onInspectCard,
  onRestart,
}: EndModalsProps) {
  if (gameState === 'PLAYING' || gameState === 'TITLE_MENU') {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#050a10]/84"
      role="dialog"
      aria-modal="true"
    >
      {gameState === 'PAUSED' && (
        <div className="w-full max-w-md rounded-2xl bg-[#0c1724] border border-slate-800 p-7 shadow-2xl">
          <p className="text-xs font-mono-tabular text-sky-400 mb-1">
            Duelo {rival.roundNumber}/{totalRivals} · {rival.name}
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-100 mb-3">
            Duelo en Pausa
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Reanuda la fase táctica actual o reinicia la guardia desde el primer
            brote clínico.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onResume}
              className="flex-1 px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-semibold text-sm cursor-pointer whitespace-nowrap"
            >
              Reanudar
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="px-5 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm cursor-pointer whitespace-nowrap"
            >
              Reiniciar
            </button>
          </div>
        </div>
      )}

      {gameState === 'ROUND_SUMMARY' && (
        <div className="w-full max-w-3xl rounded-2xl bg-[#0c1724] border border-emerald-500/35 p-7 shadow-2xl">
          <div className="mb-5">
            <p className="text-xs font-mono-tabular text-emerald-400 mb-1">
              Brote Controlado · Duelo {rival.roundNumber} de {totalRivals}
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-100 mb-1.5">
              {rival.name} Neutralizado
            </h2>
            <p className="text-sm text-slate-300">
              Incorpora 1 recurso médico especializado a tu mazo antes del
              siguiente escenario clínico.
            </p>
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
              ? 'Guardia Completada · 3/3 Brotes Controlados'
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
              : `El cuadro de ${rival.name} superó los LP del paciente. Usa el reposicionamiento de carriles y tratamientos específicos según el subtipo del patógeno.`}
          </p>

          <div className="grid grid-cols-3 gap-3 border-t border-b border-slate-800 py-4 mb-6 text-center">
            <div>
              <div className="text-xs text-slate-400 mb-1">Duelos Ganados</div>
              <div className="font-mono-tabular text-xl font-semibold text-emerald-400">
                {duelsWon}/{totalRivals}
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

          <button
            type="button"
            onClick={onRestart}
            className="w-full px-6 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm tracking-wide cursor-pointer whitespace-nowrap"
          >
            Jugar de Nuevo
          </button>
        </div>
      )}
    </div>
  );
}
