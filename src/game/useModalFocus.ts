import { useCallback, useLayoutEffect, useRef } from 'react';

export type ModalLayer = 'end' | 'deck' | 'inspector' | 'confirm';

function tabbable(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]',
  )).filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
}

export function useModalFocus(layer: ModalLayer | null) {
  const rootRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef(new Map<ModalLayer, HTMLElement>());
  const previousLayer = useRef<ModalLayer | null>(null);
  const getDialog = useCallback((name: ModalLayer) =>
    rootRef.current?.querySelector<HTMLElement>(`[data-session-dialog="${name}"]`) ?? null, []);

  const captureTrigger = useCallback((name: ModalLayer) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && rootRef.current?.contains(active)) {
      triggerRefs.current.set(name, active);
    } else {
      triggerRefs.current.delete(name);
    }
  }, []);

  useLayoutEffect(() => {
    const prior = previousLayer.current;
    if (prior === layer) return;
    previousLayer.current = layer;
    const dialog = layer ? getDialog(layer) : null;
    const trigger = prior ? triggerRefs.current.get(prior) : null;
    if (trigger?.isConnected && !trigger.closest('[inert]') && !trigger.matches(':disabled')
      && (!dialog || dialog.contains(trigger))) {
      trigger.focus();
    } else if (dialog) {
      const initial = dialog.querySelector<HTMLElement>('[data-modal-initial]') ?? tabbable(dialog)[0] ?? dialog;
      initial.focus();
    } else {
      const background = rootRef.current?.querySelector<HTMLElement>('[data-session-background]');
      if (background) (tabbable(background)[0] ?? background).focus();
    }
  }, [getDialog, layer]);

  const handleTab = useCallback((event: KeyboardEvent, name: ModalLayer) => {
    const dialog = getDialog(name);
    if (!dialog) return;
    const elements = tabbable(dialog);
    const index = elements.indexOf(document.activeElement as HTMLElement);
    if (index < 0 || (event.shiftKey ? index === 0 : index === elements.length - 1)) {
      event.preventDefault();
      (elements[event.shiftKey ? elements.length - 1 : 0] ?? dialog).focus();
    }
  }, [getDialog]);

  return { rootRef, captureTrigger, handleTab };
}
