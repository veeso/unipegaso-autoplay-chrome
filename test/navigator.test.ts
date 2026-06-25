import { describe, expect, it } from 'vitest';
import { decide, findNextTarget } from '../src/lib/navigator.js';
import { makeItem, makePage } from './fixtures/synthetic.js';

describe('findNextTarget', () => {
  it('returns the first todo video after current, skipping done rows', () => {
    const page = makePage([
      makeItem({ title: 'v1', percentage: 100, status: 'done' }),
      makeItem({ title: 'v2', percentage: 100, status: 'current', isCurrent: true }),
      makeItem({ title: 'v3', percentage: 100, status: 'done' }),
      makeItem({ title: 'v4', percentage: 0, status: 'todo' }),
    ]);
    const next = findNextTarget(page, 1);
    expect(next?.title).toBe('v4');
  });

  it('ignores test and dispensa rows', () => {
    const page = makePage([
      makeItem({ title: 'v1', percentage: 100, status: 'current', isCurrent: true }),
      makeItem({ title: 'Test di fine lezione', kind: 'test', skip: true, percentage: null }),
      makeItem({
        title: 'Dispensa',
        kind: 'dispensa',
        skip: true,
        percentage: null,
        clickable: false,
      }),
      makeItem({ title: 'v2', percentage: 0, status: 'todo' }),
    ]);
    const next = findNextTarget(page, 0);
    expect(next?.title).toBe('v2');
  });

  it('picks up an Obiettivi row when it is the next todo', () => {
    const page = makePage([
      makeItem({ title: 'v1', percentage: 100, status: 'current', isCurrent: true }),
      makeItem({
        title: 'Obiettivi',
        kind: 'obiettivi',
        percentage: null,
        status: 'todo',
      }),
      makeItem({ title: 'v2', percentage: 0, status: 'todo' }),
    ]);
    const next = findNextTarget(page, 0);
    expect(next?.title).toBe('Obiettivi');
  });

  it('returns null when nothing remains to do', () => {
    const page = makePage([
      makeItem({ title: 'v1', percentage: 100, status: 'done' }),
      makeItem({ title: 'v2', percentage: 100, status: 'current', isCurrent: true }),
    ]);
    const next = findNextTarget(page, 1);
    expect(next).toBeNull();
  });
});

describe('decide', () => {
  it('waits when the current video is not yet at 100%', () => {
    const page = makePage([
      makeItem({ title: 'v1', percentage: 45, status: 'current', isCurrent: true }),
      makeItem({ title: 'v2', percentage: 0, status: 'todo' }),
    ]);
    const d = decide(page);
    expect(d.action).toBe('wait');
    if (d.action === 'wait') expect(d.reason).toBe('video-in-progress');
  });

  it('advances to the next todo video when current hits 100%', () => {
    const page = makePage([
      makeItem({ title: 'v1', percentage: 100, status: 'current', isCurrent: true }),
      makeItem({ title: 'v2', percentage: 0, status: 'todo' }),
    ]);
    const d = decide(page);
    expect(d.action).toBe('advance');
    if (d.action === 'advance') expect(d.target.title).toBe('v2');
  });

  it('advances away from a current Obiettivi row (caller applies dwell)', () => {
    const page = makePage([
      makeItem({
        title: 'Obiettivi',
        kind: 'obiettivi',
        percentage: null,
        status: 'current',
        isCurrent: true,
      }),
      makeItem({ title: 'v1', percentage: 0, status: 'todo' }),
    ]);
    const d = decide(page);
    expect(d.action).toBe('advance');
    if (d.action === 'advance') expect(d.target.title).toBe('v1');
  });

  it('pre-warms a collapsed accordion while current video is still playing', () => {
    const page = makePage([
      makeItem({ title: 'v1', percentage: 45, status: 'current', isCurrent: true }),
    ]);
    page.accordions.push({ title: '2 - Next', expanded: false, grey: true, items: [] });
    const d = decide(page);
    expect(d.action).toBe('expand');
    if (d.action === 'expand') expect(d.reason).toBe('prefetch-no-target');
  });

  it('still waits when current is in progress and a next target already exists', () => {
    const page = makePage([
      makeItem({ title: 'v1', percentage: 45, status: 'current', isCurrent: true }),
      makeItem({ title: 'v2', percentage: 0, status: 'todo' }),
    ]);
    const d = decide(page);
    expect(d.action).toBe('wait');
    if (d.action === 'wait') expect(d.reason).toBe('video-in-progress');
  });

  it('requests accordion expansion when nothing is left in expanded ones', () => {
    const page = makePage([
      makeItem({ title: 'v1', percentage: 100, status: 'done' }),
      makeItem({ title: 'v2', percentage: 100, status: 'current', isCurrent: true }),
    ]);
    // Add a collapsed accordion.
    page.accordions.push({ title: '2 - Next', expanded: false, grey: true, items: [] });
    const d = decide(page);
    expect(d.action).toBe('expand');
  });

  it('waits when no current row is identified', () => {
    const page = makePage([makeItem({ title: 'v1', percentage: 0, status: 'todo' })]);
    const d = decide(page);
    expect(d.action).toBe('wait');
    if (d.action === 'wait') expect(d.reason).toBe('no-current-row');
  });
});
