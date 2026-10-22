"use client";

import { useCallback, useRef, useState } from "react";

type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

const DEFAULT_LIMIT = 60;

/**
 * Undo/redo for a single mutable document object.
 *
 * Two ways to mutate:
 *   - `commit(draft => { ... })` — one discrete change (one undo step).
 *   - `beginStroke()` → `paint(...)*` → `endStroke()` — many rapid changes
 *     (drag-painting hexes) collapse into a single undo step.
 *
 * The document is deep-cloned before every mutation, so callers can mutate the
 * draft however they like without touching history snapshots.
 */
export function useEditorHistory<T>(initial: T, limit: number = DEFAULT_LIMIT) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initial,
    future: [],
  });

  // Snapshot taken at the start of a drag stroke, committed on endStroke().
  const strokeRef = useRef<T | null>(null);
  // Always-current document, so beginStroke() doesn't have to depend on state
  // updater timing.
  const presentRef = useRef<T>(state.present);
  presentRef.current = state.present;

  const commit = useCallback(
    (mutator: (draft: T) => void) => {
      setState(h => {
        const draft = structuredClone(h.present);
        mutator(draft);
        // Nothing changed — don't pollute the undo stack with a no-op.
        if (JSON.stringify(draft) === JSON.stringify(h.present)) return h;
        return {
          past: [...h.past, h.present].slice(-limit),
          present: draft,
          future: [],
        };
      });
    },
    [limit]
  );

  /** Start a drag stroke: remember the pre-drag document. */
  const beginStroke = useCallback(() => {
    if (strokeRef.current !== null) return;
    strokeRef.current = presentRef.current;
  }, []);

  /** Apply a change without creating a history entry (used during a stroke). */
  const paint = useCallback((mutator: (draft: T) => void) => {
    setState(h => {
      const draft = structuredClone(h.present);
      mutator(draft);
      return { ...h, present: draft };
    });
  }, []);

  /** Finish a stroke: one history entry for the whole drag. */
  const endStroke = useCallback(() => {
    const snapshot = strokeRef.current;
    strokeRef.current = null;
    if (snapshot === null) return;
    setState(h => {
      if (JSON.stringify(snapshot) === JSON.stringify(h.present)) return h;
      return {
        past: [...h.past, snapshot].slice(-limit),
        present: h.present,
        future: [],
      };
    });
  }, [limit]);

  const undo = useCallback(() => {
    setState(h => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future].slice(0, limit),
      };
    });
  }, [limit]);

  const redo = useCallback(() => {
    setState(h => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      return {
        past: [...h.past, h.present].slice(-limit),
        present: next,
        future: h.future.slice(1),
      };
    });
  }, [limit]);

  return {
    scenario: state.present,
    commit,
    beginStroke,
    paint,
    endStroke,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undoCount: state.past.length,
    redoCount: state.future.length,
  };
}

export type EditorHistoryApi<T> = ReturnType<typeof useEditorHistory<T>>;
