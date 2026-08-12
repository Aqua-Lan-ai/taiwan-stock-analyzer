import { useRef, useState, useCallback } from 'react';

// Pointer Events unify mouse/touch/pen, so a single handle-driven drag
// gesture works for card reordering on both desktop and mobile — native
// HTML5 draggable does not fire on touch input at all.
//
// Native DnD also gives two things for free that this reimplements:
// - a floating drag-ghost that follows the cursor (dragOffsetY, applied
//   as a translateY + elevation on the dragged card)
// - the other rows sliding out of the way to open a gap at the drop
//   target (getShiftY, applied as a translateY on every other card)
export function useReorderDrag(ids: string[], onReorder: (fromId: string, toId: string) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const draggingIdRef = useRef<string | null>(null);
  const overIdRef = useRef<string | null>(null);
  const startYRef = useRef(0);
  const draggedSpanRef = useRef(0); // dragged row's height + gap to its neighbor

  const setRowRef = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const onHandlePointerDown = useCallback((id: string) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingIdRef.current = id;
    startYRef.current = e.clientY;
    const el = rowRefs.current.get(id);
    const rect = el?.getBoundingClientRect();
    draggedSpanRef.current = rect ? rect.height + 10 : 0; // 10 = list's flex gap
    setDraggingId(id);
    setDragOffsetY(0);
  }, []);

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingIdRef.current) return;
    setDragOffsetY(e.clientY - startYRef.current);
    let closestId: string | null = null;
    let closestDist = Infinity;
    for (const [id, el] of rowRefs.current) {
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - e.clientY);
      if (dist < closestDist) { closestDist = dist; closestId = id; }
    }
    overIdRef.current = closestId;
    setOverId(closestId);
  }, []);

  const onHandlePointerUp = useCallback(() => {
    const fromId = draggingIdRef.current;
    const toId = overIdRef.current;
    if (fromId && toId && fromId !== toId) onReorder(fromId, toId);
    draggingIdRef.current = null;
    overIdRef.current = null;
    setDraggingId(null);
    setOverId(null);
    setDragOffsetY(0);
  }, [onReorder]);

  // How far row `id` should slide to open a gap at the current drop target.
  const getShiftY = useCallback((id: string): number => {
    if (!draggingId || !overId || id === draggingId) return 0;
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(overId);
    const idx = ids.indexOf(id);
    if (fromIdx === -1 || toIdx === -1 || idx === -1) return 0;
    if (fromIdx < toIdx && idx > fromIdx && idx <= toIdx) return -draggedSpanRef.current;
    if (fromIdx > toIdx && idx >= toIdx && idx < fromIdx) return draggedSpanRef.current;
    return 0;
  }, [draggingId, overId, ids]);

  return { draggingId, dragOffsetY, setRowRef, getShiftY, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp };
}
