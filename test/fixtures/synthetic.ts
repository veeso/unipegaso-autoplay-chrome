import type { LessonItem, LessonPage } from '../../src/lib/types.js';

export const makeItem = (overrides: Partial<LessonItem> = {}): LessonItem => ({
  title: 'Lesson',
  kind: 'video',
  percentage: 0,
  status: 'todo',
  isCurrent: false,
  skip: false,
  clickable: true,
  accordionTitle: '1 - Demo',
  index: 0,
  ...overrides,
});

export const makePage = (items: LessonItem[]): LessonPage => ({
  items: items.map((it, i) => ({ ...it, index: i })),
  accordions: [
    {
      title: '1 - Demo',
      expanded: true,
      grey: false,
      items: items.map((it, i) => ({ ...it, index: i })),
    },
  ],
});
