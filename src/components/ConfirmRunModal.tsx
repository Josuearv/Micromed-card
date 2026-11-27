interface ConfirmRunModalProps {
  restart: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmRunModal({ restart, onCancel, onConfirm }: ConfirmRunModalProps) {
  const title = restart ? 'Reiniciar guardia' : 'Nueva partida';
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050a10]/84 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-run-title"
      aria-describedby="confirm-run-message"
      data-session-dialog="confirm"
      tabIndex={-1}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c1724] p-6 shadow-2xl">
        <h2 id="confirm-run-title" className="mb-2 text-xl font-display font-bold text-slate-100">{title}</h2>
        <p id="confirm-run-message" className="mb-5 text-sm text-slate-300">
          {restart ? 'Volverás al inicio del modo actual.' : 'Empezarás una partida en el modo seleccionado.'}
          {' '}Si se guarda, reemplazará la partida principal.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" data-modal-initial onClick={onCancel} className="rounded-lg bg-slate-800 px-4 py-2 text-slate-100">Cancelar</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950">Confirmar</button>
        </div>
      </div>
    </div>
  );
}
