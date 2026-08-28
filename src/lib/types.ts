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
  /**
   * True when the row is finished (100% or green badge/fill), independent
   * of `status` — which reports 'current' for the selected row and thereby
   * hides doneness.
   */
  completed: boolean;
  /** True when the row is flagged as the currently selected one. */
  isCurrent: boolean;
  /**
   * Raw classification flag: true when `kind` is 'test' or 'dispensa'. Not an
   * unconditional "skip" directive — `autoTest` can still make a test row a
   * navigation target (see `navigator.ts`'s `findNextTarget`).
   */
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
  /**
   * When true, automatically open each lesson's "Test di fine lezione",
   * answer every question at random, submit it, and move on.
   */
  autoTest: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  fastAdvance: false,
  autoTest: false,
};

/** URL prefix guard for the video-lesson page. */
export const LESSON_URL_PATTERN =
  /^https:\/\/lms\.pegaso\.multiversity\.click\/videolezioni\/[^/]+\/[^/]+/;

/** Delay (ms) before clicking the next lesson after detecting completion. */
export const NAVIGATION_DELAY_MS = 3000;

/** Delay (ms) spent on an Obiettivi row before treating it as done. */
export const OBIETTIVI_DWELL_MS = 3000;

/** Delay (ms) between selecting the quiz answers and pressing "Invia". */
export const TEST_ANSWER_SETTLE_MS = 2000;

/** Delay (ms) after pressing "Invia" before advancing to the next row. */
export const TEST_SUBMIT_DELAY_MS = 3000;
