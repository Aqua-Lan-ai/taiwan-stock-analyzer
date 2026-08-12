import { useRef, useState, useCallback } from 'react';

// Pointer Events unify mouse/touch/pen, so a single handle-driven drag
// gesture works for card reordering on both desktop and mobile — native
// HTML5 draggable does not fire on touch input at all.
export function useReorderDrag(onReorder: (fromId: string, toId: string) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  const setRowRef = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const onHandlePointerDown = useCallback((id: string) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(id);
  }, []);

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    setDraggingId((currentDraggingId) => {
      if (!currentDraggingId) return currentDraggingId;
      let closestId: string | null = null;
      let closestDist = Infinity;
      for (const [id, el] of rowRefs.current) {
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.top + rect.height / 2 - e.clientY);
        if (dist < closestDist) { closestDist = dist; closestId = id; }
      }
      setOverId(closestId);
      return currentDraggingId;
    });
  }, []);

  const onHandlePointerUp = useCallback(() => {
    setDraggingId((currentDraggingId) => {
      setOverId((currentOverId) => {
        if (currentDraggingId && currentOverId && currentDraggingId !== currentOverId) {
          onReorder(currentDraggingId, currentOverId);
        }
        return null;
      });
      return null;
    });
  }, [onReorder]);

  return { draggingId, overId, setRowRef, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp };
}
