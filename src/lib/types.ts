export type LessonKind = 'video' | 'obiettivi' | 'test' | 'dispensa' | 'unknown';

export type LessonStatus = 'done' | 'todo' | 'current' | 'unknown';

export interface LessonItem {
  /** Human-readable title extracted from the row (e.g. "Introduzione ad Anaconda"). */
  title: string;
  /** Classification of the row type. */
  kind: LessonKind;
  /** Progress percentage (0-100) when applicable, or null for rows without progress. */
  percentage: number | null;
  /** Completion status derived from SVG fill color and percentage. */
  status: LessonStatus;
  /** True when the row is flagged as the currently selected one. */
  isCurrent: boolean;
  /** True when the row must be skipped (Test di fine lezione, Dispensa). */
  skip: boolean;
  /** True when the row is clickable (has the cursor-pointer marker). */
  clickable: boolean;
  /** Accordion (sub-lesson group) title this item belongs to, if any. */
  accordionTitle: string | null;
  /** Index of this item as it appears in the flat ordered list. */
  index: number;
}

export interface AccordionSection {
  title: string;
  expanded: boolean;
  /** True when opening this accordion would close another one (grey / not-in-progress). */
  grey: boolean;
  items: LessonItem[];
}

export interface LessonPage {
  accordions: AccordionSection[];
  items: LessonItem[];
}

export interface ExtensionSettings {
  /** Master on/off switch for the auto-advance behavior. */
  enabled: boolean;
  /**
   * When true, skip as soon as the sidebar reports 100% (even if the video
   * hasn't actually finished). When false, wait for the real `<video>.ended`
   * event before advancing — safer but keeps the last seconds playing.
   */
  fastAdvance: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  fastAdvance: false,
};

/** URL prefix guard for the video-lesson page. */
export const LESSON_URL_PATTERN =
  /^https:\/\/lms\.pegaso\.multiversity\.click\/videolezioni\/[^/]+\/[^/]+/;

/** Delay (ms) before clicking the next lesson after detecting completion. */
export const NAVIGATION_DELAY_MS = 3000;

/** Delay (ms) spent on an Obiettivi row before treating it as done. */
export const OBIETTIVI_DWELL_MS = 3000;
