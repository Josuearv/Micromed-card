export interface SaveStatusProps {
  message?: string;
  onRetry?: () => void;
}

export function SaveStatus({ message, onRetry }: SaveStatusProps) {
  if (!message) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
      <span role="status">{message}</span>
      {onRetry && (
        <button
          type="button"
          className="pointer-events-auto rounded border border-sky-700 px-2 py-1 text-sky-200"
          onClick={onRetry}
        >
          Reintentar guardado
        </button>
      )}
    </div>
  );
}
