export interface CanvasHistory {
  snapshots: string[];
  index: number;
}

const maximumUndoSteps = 100;

export function createCanvasHistory(initialSnapshot: string): CanvasHistory {
  return { snapshots: [initialSnapshot], index: 0 };
}

export function pushSnapshot(history: CanvasHistory, snapshot: string): CanvasHistory {
  const snapshots = [...history.snapshots.slice(0, history.index + 1), snapshot].slice(-(maximumUndoSteps + 1));
  return { snapshots, index: snapshots.length - 1 };
}

export function undoSnapshot(history: CanvasHistory): CanvasHistory {
  return history.index === 0 ? history : { ...history, index: history.index - 1 };
}

export function redoSnapshot(history: CanvasHistory): CanvasHistory {
  return history.index >= history.snapshots.length - 1
    ? history
    : { ...history, index: history.index + 1 };
}
