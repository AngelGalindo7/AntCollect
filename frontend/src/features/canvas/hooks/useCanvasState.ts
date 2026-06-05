import { useCallback, useReducer, useRef } from 'react';
import type { CanvasNode, CanvasState, BackgroundConfig, NodeSource } from '../types/canvas';

export const CANVAS_WIDTH = 1440;
export const CANVAS_HEIGHT = 810;

const DEFAULT_BACKGROUND: BackgroundConfig = { type: 'color', value: '#f5f0e8' };

const DEFAULT_NODE_SIZE = 150;

// Cap retained history so a long editing session can't grow memory without bound.
const HISTORY_LIMIT = 100;

interface Snapshot {
  nodes: CanvasNode[];
  background: BackgroundConfig;
  width: number;
  height: number;
}

interface HistoryState {
  past: Snapshot[];
  present: Snapshot;
  future: Snapshot[];
  dirty: boolean;
}

type Action =
  | { type: 'mutate'; fn: (s: Snapshot) => Snapshot }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'markClean' };

// Pure reducer so undo/redo bookkeeping survives React StrictMode's double-invoke
// without recording phantom history entries. Mutators that need fresh ids/randomness
// generate them in the callback and pass deterministic fns in here.
function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'mutate': {
      const next = action.fn(state.present);
      if (next === state.present) return state; // no-op transform — skip history
      const past = [...state.past, state.present];
      const trimmed = past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past;
      return { past: trimmed, present: next, future: [], dirty: true };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        dirty: true,
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        dirty: true,
      };
    }
    case 'markClean':
      return { ...state, dirty: false };
    default:
      return state;
  }
}

function initState(initial: CanvasState | null): HistoryState {
  return {
    past: [],
    present: {
      nodes: initial?.nodes ?? [],
      background: initial?.background ?? DEFAULT_BACKGROUND,
      width: initial?.width ?? CANVAS_WIDTH,
      height: initial?.height ?? CANVAS_HEIGHT,
    },
    future: [],
    dirty: false,
  };
}

export function useCanvasState(initial: CanvasState | null) {
  const [state, dispatch] = useReducer(reducer, initial, initState);

  // Mirror of latest state for synchronous reads inside callbacks (e.g. returning a
  // freshly-created id) without making every callback depend on the render's state.
  const stateRef = useRef(state);
  stateRef.current = state;

  const { nodes, background, width, height } = state.present;

  const addNode = useCallback((imageUrl: string, source: NodeSource) => {
    const id = crypto.randomUUID();
    const isPreCut = source === 'library';
    dispatch({
      type: 'mutate',
      fn: (s) => ({
        ...s,
        nodes: [
          ...s.nodes,
          {
            id,
            image_url: imageUrl,
            source,
            x: s.width / 2 - DEFAULT_NODE_SIZE / 2,
            y: s.height / 2 - DEFAULT_NODE_SIZE / 2,
            width: DEFAULT_NODE_SIZE,
            height: DEFAULT_NODE_SIZE,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            bgRemoved: isPreCut,
            removedBgUrl: isPreCut ? imageUrl : undefined,
          },
        ],
      }),
    });
  }, []);

  const updateNode = useCallback((id: string, attrs: Partial<CanvasNode>) => {
    dispatch({
      type: 'mutate',
      fn: (s) => {
        if (!s.nodes.some((n) => n.id === id)) return s;
        return { ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...attrs } : n)) };
      },
    });
  }, []);

  const removeNode = useCallback((id: string) => {
    dispatch({
      type: 'mutate',
      fn: (s) => {
        if (!s.nodes.some((n) => n.id === id)) return s;
        return { ...s, nodes: s.nodes.filter((n) => n.id !== id) };
      },
    });
  }, []);

  const duplicateNode = useCallback((id: string): string | null => {
    const src = stateRef.current.present.nodes.find((n) => n.id === id);
    if (!src) return null;
    const newId = crypto.randomUUID();
    dispatch({
      type: 'mutate',
      fn: (s) => {
        const cur = s.nodes.find((n) => n.id === id);
        if (!cur) return s;
        const copy: CanvasNode = {
          ...cur,
          id: newId,
          x: Math.min(s.width - cur.width, cur.x + 24),
          y: Math.min(s.height - cur.height, cur.y + 24),
        };
        return { ...s, nodes: [...s.nodes, copy] };
      },
    });
    return newId;
  }, []);

  const changeBackground = useCallback((bg: BackgroundConfig) => {
    dispatch({ type: 'mutate', fn: (s) => ({ ...s, background: bg }) });
  }, []);

  const moveNodeUp = useCallback((id: string) => {
    dispatch({
      type: 'mutate',
      fn: (s) => {
        const idx = s.nodes.findIndex((n) => n.id === id);
        if (idx === -1 || idx === s.nodes.length - 1) return s;
        const next = [...s.nodes];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return { ...s, nodes: next };
      },
    });
  }, []);

  const moveNodeDown = useCallback((id: string) => {
    dispatch({
      type: 'mutate',
      fn: (s) => {
        const idx = s.nodes.findIndex((n) => n.id === id);
        if (idx <= 0) return s;
        const next = [...s.nodes];
        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
        return { ...s, nodes: next };
      },
    });
  }, []);

  const setCanvasSize = useCallback((w: number, h: number) => {
    dispatch({ type: 'mutate', fn: (s) => (s.width === w && s.height === h ? s : { ...s, width: w, height: h }) });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const markClean = useCallback(() => dispatch({ type: 'markClean' }), []);

  const getCanvasJson = useCallback((): CanvasState => {
    const p = stateRef.current.present;
    return { version: 1, width: p.width, height: p.height, background: p.background, nodes: p.nodes };
  }, []);

  return {
    nodes,
    background,
    width,
    height,
    isDirty: state.dirty,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    addNode,
    updateNode,
    removeNode,
    duplicateNode,
    moveNodeUp,
    moveNodeDown,
    changeBackground,
    setCanvasSize,
    undo,
    redo,
    markClean,
    getCanvasJson,
  };
}
