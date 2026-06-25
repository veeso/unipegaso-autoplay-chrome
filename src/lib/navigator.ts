import type { LessonItem, LessonPage } from './types.js';

/** Decision returned by {@link decide}. */
export type Decision =
  | { action: 'wait'; reason: string }
  | { action: 'advance'; target: LessonItem; currentIndex: number }
  | { action: 'expand'; reason: string };

/** Pure selector: which item, if any, should we move to after the current one? */
export const findNextTarget = (page: LessonPage, fromIndex: number): LessonItem | null => {
  for (let i = fromIndex + 1; i < page.items.length; i += 1) {
    const item = page.items[i]!;
    if (item.skip) continue;
    if (item.status === 'done') continue;
    if (item.kind !== 'video' && item.kind !== 'obiettivi') continue;
    return item;
  }
  return null;
};

const findCurrentIndex = (page: LessonPage): number => page.items.findIndex((it) => it.isCurrent);

/**
 * Decide what the controller should do given the current page snapshot.
 *
 * The decision is pure — callers (content script) are responsible for timing
 * and DOM side effects.
 */
export const decide = (page: LessonPage): Decision => {
  const currentIndex = findCurrentIndex(page);
  if (currentIndex === -1) {
    // No row flagged as current yet — nothing to do until the UI settles.
    return { action: 'wait', reason: 'no-current-row' };
  }

  const current = page.items[currentIndex]!;
  const target = findNextTarget(page, currentIndex);
  const hasCollapsed = page.accordions.some((a) => !a.expanded);

  if (current.kind === 'video') {
    if (current.percentage === null) {
      return { action: 'wait', reason: 'video-no-percentage' };
    }
    if (current.percentage < 100) {
      // Pre-warm: if no next target exists in the already-expanded accordions
      // and a collapsed one is available, expand it now so the transition is
      // instant when the current video finishes.
      if (!target && hasCollapsed) {
        return { action: 'expand', reason: 'prefetch-no-target' };
      }
      return { action: 'wait', reason: 'video-in-progress' };
    }
  }

  // At this point the current row is either a completed video or an Obiettivi
  // row we've been sitting on long enough for the caller's dwell timer.
  if (target) {
    return { action: 'advance', target, currentIndex };
  }

  if (hasCollapsed) {
    return { action: 'expand', reason: 'no-target-in-expanded' };
  }

  return { action: 'wait', reason: 'no-target-available' };
};
