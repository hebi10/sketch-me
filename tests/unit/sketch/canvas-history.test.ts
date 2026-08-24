import { describe, expect, it } from 'vitest';

import {
  createCanvasHistory,
  pushSnapshot,
  redoSnapshot,
  undoSnapshot,
} from '@/components/sketch/canvas-history';

describe('canvas history', () => {
  it('moves backward and forward through drawing snapshots', () => {
    const initial = createCanvasHistory('blank');
    const withFirstStroke = pushSnapshot(initial, 'stroke-1');
    const withSecondStroke = pushSnapshot(withFirstStroke, 'stroke-2');

    expect(undoSnapshot(withSecondStroke)).toEqual({
      snapshots: ['blank', 'stroke-1', 'stroke-2'],
      index: 1,
    });
    expect(redoSnapshot(undoSnapshot(withSecondStroke))).toEqual(withSecondStroke);
  });

  it('drops redo snapshots when a new stroke follows undo', () => {
    const history = pushSnapshot(
      undoSnapshot(pushSnapshot(pushSnapshot(createCanvasHistory('blank'), 'stroke-1'), 'stroke-2')),
      'replacement-stroke',
    );

    expect(history).toEqual({
      snapshots: ['blank', 'stroke-1', 'replacement-stroke'],
      index: 2,
    });
    expect(redoSnapshot(history)).toEqual(history);
  });

  it('does not move outside history boundaries', () => {
    const initial = createCanvasHistory('blank');

    expect(undoSnapshot(initial)).toEqual(initial);
    expect(redoSnapshot(initial)).toEqual(initial);
  });
});
