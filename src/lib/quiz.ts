/**
 * Pure DOM parsing for the "Test di fine lezione" quiz page.
 *
 * Same contract as dom.ts: no network, storage, timers, or clicks — the
 * caller (content.ts) owns all side effects and timing.
 */

const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim();

const textOf = (el: Element | null | undefined): string => normalize(el?.textContent ?? '');

export interface QuizAnswer {
  /** Letter shown next to the answer (A, B, C, D). */
  letter: string;
  /** Answer text. */
  text: string;
  /** True when the radio circle appears filled (answer picked). */
  selected: boolean;
}

export interface QuizQuestion {
  /** Question text, including the leading "N." numbering. */
  title: string;
  answers: QuizAnswer[];
  /** Index of the selected answer, or null when none is picked yet. */
  selectedIndex: number | null;
}

const QUESTION_BLOCK_SELECTOR = '.mt-8.px-4';
const ANSWER_CONTAINER_SELECTOR = '.divide-y-2';
const INVIA_LABEL = 'Invia';
const ESEGUI_LABEL = 'Esegui';

/**
 * Question wrappers share the generic `.mt-8.px-4` utility pair, so require
 * the question header and the answers container to avoid false positives on
 * other page sections.
 */
const questionBlocks = (doc: Document): Element[] =>
  Array.from(doc.querySelectorAll(QUESTION_BLOCK_SELECTOR)).filter(
    (block) =>
      block.querySelector('.font-semibold') !== null &&
      block.querySelector(ANSWER_CONTAINER_SELECTOR) !== null,
  );

const answerRows = (block: Element): Element[] => {
  const container = block.querySelector(ANSWER_CONTAINER_SELECTOR);
  if (!container) return [];
  return Array.from(container.children).filter((c) => c.classList.contains('cursor-pointer'));
};

/**
 * An unpicked answer keeps the plain grey circle
 * `.rounded-full.h-5.w-5.border.border-gray-400`. Picking an answer replaces
 * that circle with a checkmark SVG and adds `bg-platform-active-color` to
 * the answer row itself, so selection is read off the row's own class list
 * rather than the (now absent) circle. The authoritative "all answered"
 * signal remains {@link findInviaButton} returning non-null.
 */
const isAnswerSelected = (row: Element): boolean =>
  row.classList.contains('bg-platform-active-color');

const parseAnswer = (row: Element): QuizAnswer => ({
  letter: textOf(row.querySelector('.w-2')),
  text: textOf(row.querySelector('.text-lg > div')),
  selected: isAnswerSelected(row),
});

export const scanQuiz = (doc: Document): QuizQuestion[] =>
  questionBlocks(doc).map((block) => {
    const answers = answerRows(block).map(parseAnswer);
    const selectedIndex = answers.findIndex((a) => a.selected);
    return {
      title: textOf(block.querySelector('.font-semibold > div')),
      answers,
      selectedIndex: selectedIndex === -1 ? null : selectedIndex,
    };
  });

/** Live answer-row element for a click, or null when out of range. */
export const getQuizAnswerElement = (
  doc: Document,
  questionIndex: number,
  answerIndex: number,
): HTMLElement | null => {
  const block = questionBlocks(doc)[questionIndex];
  if (!block) return null;
  return (answerRows(block)[answerIndex] as HTMLElement | undefined) ?? null;
};

/**
 * The submit button only exists once every question has a selected answer.
 * Located by text because its wrapper markup is unknown (it is not present
 * in the reference snapshot).
 */
export const findInviaButton = (doc: Document): HTMLElement | null =>
  Array.from(doc.querySelectorAll<HTMLElement>('button')).find((b) => textOf(b) === INVIA_LABEL) ??
  null;

/**
 * Sidebar test rows are not clickable themselves — the "Esegui" button
 * inside the row opens the quiz.
 */
export const getTestRunButton = (row: Element): HTMLElement | null =>
  Array.from(row.querySelectorAll<HTMLElement>('button')).find((b) => textOf(b) === ESEGUI_LABEL) ??
  null;
