import type {
  AccordionSection,
  LessonItem,
  LessonKind,
  LessonPage,
  LessonStatus,
} from './types.js';

const GREEN_FILL = '#2fa33d';
const RED_FILL = '#cf1d56';
const ACTIVE_MODULE_CLASS = 'bg-platform-light-gray';
const ACCORDION_CLASS_MARKERS = [
  'bg-white',
  'text-base',
  'border',
  'font-sans',
  'font-semibold',
] as const;

const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim();

const textOf = (el: Element | null | undefined): string => normalize(el?.textContent ?? '');

const hasAllClasses = (el: Element, classes: readonly string[]): boolean =>
  classes.every((c) => el.classList.contains(c));

/**
 * Returns the lowercased `fill` attribute of the icon-badge svg, used to
 * differentiate green (done) from red (todo) rows.
 */
const iconFill = (row: Element): string | null => {
  const badge = row.querySelector('.rounded-lg.h-11.w-11');
  const path = badge?.querySelector('path[fill]') ?? row.querySelector('svg path[fill]');
  const fill = path?.getAttribute('fill');
  return fill ? fill.toLowerCase() : null;
};

/** True when the icon badge container uses the green/20 tint (completed video). */
const hasGreenBadge = (row: Element): boolean => {
  const badge = row.querySelector('.rounded-lg.h-11.w-11');
  return badge ? badge.className.includes('bg-platform-green') : false;
};

/** Percentage found in the trailing `w-1/12` text cell (videos only), or null. */
const extractPercentage = (row: Element): number | null => {
  const cells = row.querySelectorAll('div');
  for (const cell of Array.from(cells)) {
    if (cell.classList.contains('w-1/12') && cell.textContent?.includes('%')) {
      const m = /(\d{1,3})\s*%/.exec(cell.textContent);
      if (m) {
        const n = Number.parseInt(m[1]!, 10);
        if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
      }
    }
  }
  return null;
};

const extractTitle = (row: Element): string => {
  const titleEl = row.querySelector('.w-full .mb-2');
  if (titleEl) return textOf(titleEl);
  // Dispensa row: title is the direct text content of the left "flex items-center"
  // block, which contains only the icon svg + a trailing text node.
  const leftBlock = row.querySelector(':scope > .flex.items-center');
  if (leftBlock) return textOf(leftBlock);
  return textOf(row);
};

const isClickable = (row: Element): boolean => row.classList.contains('cursor-pointer');

/**
 * A row is "current" when its left-bar indicator is visible (not invisible).
 * Non-current rows use the `invisible` class on the same bar element.
 */
const isCurrentRow = (row: Element): boolean => {
  const bar = row.querySelector('.bg-platform-primary.rounded-r-lg');
  if (!bar) return false;
  return bar.classList.contains('visible') && !bar.classList.contains('invisible');
};

const classifyRow = (row: Element, title: string): LessonKind => {
  const lower = title.toLowerCase();
  if (lower === 'obiettivi') return 'obiettivi';
  if (lower.startsWith('test di fine')) return 'test';
  if (lower === 'dispensa') return 'dispensa';
  if (extractPercentage(row) !== null) return 'video';
  return 'unknown';
};

const deriveStatus = (
  kind: LessonKind,
  percentage: number | null,
  fill: string | null,
  green: boolean,
  current: boolean,
): LessonStatus => {
  if (current) return 'current';
  if (kind === 'video') {
    if (percentage === 100) return 'done';
    if (percentage !== null) return 'todo';
  }
  if (green || fill === GREEN_FILL) return 'done';
  if (fill === RED_FILL) return 'todo';
  return 'unknown';
};

/**
 * Match the row-content divs directly by shape so we avoid double-counting the
 * `.border-t.text-platform-text` wrapper element that groups all rows together.
 */
const ROW_CONTENT_SELECTOR = [
  '.pr-3.py-2.flex.items-center.font-normal',
  '.pr-3.py-3.flex.items-center.justify-between.font-normal',
].join(', ');

const findRowContents = (body: Element): Element[] =>
  Array.from(body.querySelectorAll(ROW_CONTENT_SELECTOR));

const parseRow = (row: Element, accordionTitle: string, index: number): LessonItem | null => {
  const title = extractTitle(row);
  if (!title) return null;
  const kind = classifyRow(row, title);
  const percentage = kind === 'video' ? extractPercentage(row) : null;
  const fill = iconFill(row);
  const green = hasGreenBadge(row);
  const current = isCurrentRow(row);
  const status = deriveStatus(kind, percentage, fill, green, current);
  const skip = kind === 'test' || kind === 'dispensa';
  const clickable = isClickable(row);
  return {
    title,
    kind,
    percentage,
    status,
    isCurrent: current,
    skip,
    clickable,
    accordionTitle: accordionTitle || null,
    index,
  };
};

const isAccordionRoot = (el: Element): boolean => hasAllClasses(el, ACCORDION_CLASS_MARKERS);

const accordionTitleOf = (root: Element): string => {
  const titleEl = root.querySelector(
    ':scope > .relative .align-left, :scope > .relative .leading-normal',
  );
  return textOf(titleEl);
};

const accordionIsExpanded = (root: Element): boolean => root.querySelector('.border-t') !== null;

const findActiveModule = (doc: Document | Element): Element | null => {
  const root = doc instanceof Document ? doc : doc;
  const candidates = root.querySelectorAll(`.${ACTIVE_MODULE_CLASS}`);
  for (const c of Array.from(candidates)) {
    if (c.querySelector('.border-t')) return c;
  }
  return null;
};

export interface ScanOptions {
  /**
   * When true (default) restrict scanning to accordions inside the currently-active
   * module wrapper — prevents interacting with grey modules that would close ours.
   */
  activeModuleOnly?: boolean;
}

export const scanPage = (doc: Document, options: ScanOptions = {}): LessonPage => {
  const activeModuleOnly = options.activeModuleOnly ?? true;
  const scope: ParentNode = activeModuleOnly ? (findActiveModule(doc) ?? doc) : doc;

  const accordions: AccordionSection[] = [];
  const items: LessonItem[] = [];
  let cursor = 0;

  const roots = Array.from(scope.querySelectorAll('div')).filter(isAccordionRoot);
  for (const root of roots) {
    const title = accordionTitleOf(root);
    const expanded = accordionIsExpanded(root);
    const rows: LessonItem[] = [];
    if (expanded) {
      for (const rowEl of findRowContents(root)) {
        const item = parseRow(rowEl, title, cursor);
        if (item) {
          rows.push(item);
          cursor += 1;
        }
      }
    }
    accordions.push({ title, expanded, grey: !expanded, items: rows });
    items.push(...rows);
  }

  return { accordions, items };
};

/**
 * Return the element that should receive the click to toggle an accordion.
 *
 * The observable DOM is:
 *   <div class="bg-white …">                                     ← accordion root
 *     <div class="relative text-platform-sub-text normal-case">
 *       <div class="cursor-pointer relative align-middle">
 *         <div class="flex align-middle leading-none px-4">      ← Vue click root
 *
 * Empirically only this inner flex row triggers the toggle — clicks on the
 * outer wrappers or the `.cursor-pointer` element do not bubble to Vue's
 * handler. Fall back to ancestors only if the preferred target is missing.
 */
export const getAccordionHeader = (root: Element): HTMLElement | null => {
  const preferred = root.querySelector<HTMLElement>(
    ':scope > .relative > .cursor-pointer > .flex.align-middle',
  );
  if (preferred) return preferred;
  const flex = root.querySelector<HTMLElement>('.cursor-pointer > .flex.align-middle');
  if (flex) return flex;
  const pointer = root.querySelector<HTMLElement>('.cursor-pointer');
  if (pointer) return pointer;
  return root.querySelector<HTMLElement>(':scope > .relative.text-platform-sub-text.normal-case');
};

/**
 * Locate the live row element in the DOM matching a parsed item so the caller
 * can dispatch a click. Matches by accordion title + row title to disambiguate.
 */
export const getRowElement = (
  doc: Document,
  item: LessonItem,
  options: ScanOptions = {},
): HTMLElement | null => {
  const activeModuleOnly = options.activeModuleOnly ?? true;
  const scope: ParentNode = activeModuleOnly ? (findActiveModule(doc) ?? doc) : doc;

  const roots = Array.from(scope.querySelectorAll('div')).filter(isAccordionRoot);
  for (const root of roots) {
    const title = accordionTitleOf(root);
    if (item.accordionTitle && title && title !== item.accordionTitle) continue;
    if (!accordionIsExpanded(root)) continue;
    for (const rowEl of findRowContents(root)) {
      if (extractTitle(rowEl) === item.title) return rowEl as HTMLElement;
    }
  }
  return null;
};

/**
 * Finds the next accordion to expand: the first collapsed accordion that
 * appears *after* the last currently-expanded one. This advances forward
 * through the module without ever reopening something the user has passed.
 */
export const findCollapsedLessonAccordions = (doc: Document): HTMLElement[] => {
  const activeModule = findActiveModule(doc);
  if (!activeModule) return [];
  const roots = Array.from(activeModule.querySelectorAll('div')).filter(isAccordionRoot);

  let lastExpandedIdx = -1;
  for (let i = 0; i < roots.length; i += 1) {
    if (accordionIsExpanded(roots[i]!)) lastExpandedIdx = i;
  }

  for (let i = lastExpandedIdx + 1; i < roots.length; i += 1) {
    const root = roots[i]!;
    if (accordionIsExpanded(root)) continue;
    const header = getAccordionHeader(root);
    if (header) return [header];
  }
  return [];
};
