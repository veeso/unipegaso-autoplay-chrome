import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  findInviaButton,
  getQuizAnswerElement,
  getTestRunButton,
  scanQuiz,
} from '../src/lib/quiz.js';

const fixture = readFileSync(join(__dirname, 'fixtures', 'quiz-page.html'), 'utf-8');

/** Sidebar test row, verbatim (trimmed) from the real snapshot. */
const SIDEBAR_TEST_ROW = `
  <div class="pr-3 py-2 flex items-center font-normal">
    <div><div class="invisible bg-platform-primary rounded-r-lg w-2 h-11 mr-2"></div></div>
    <div>
      <div class="flex items-center">
        <div class="flex justify-center items-center rounded-lg h-11 w-11 mr-5 bg-platform-primary-light">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 24" class="w-5"><path fill="#CF1D56" d="M0 0"></path></svg>
        </div>
      </div>
    </div>
    <div class="w-full">
      <div class="text-base flex justify-between items-end flex-wrap">
        <div class="mb-2"> Test di fine lezione </div>
        <div class="flex items-start">
          <button class="bg-white border-platform-primary text-platform-primary min-w-[90px] px-4 py-1.5 rounded-md border text-center w-30 text-sm">  Esegui </button>
        </div>
      </div>
    </div>
  </div>
`;

describe('scanQuiz', () => {
  beforeEach(() => {
    document.body.innerHTML = fixture;
  });

  it('parses every question with its answers', () => {
    const questions = scanQuiz(document);
    expect(questions).toHaveLength(2);
    expect(questions[0]!.title).toBe("1. L'acronimo ILO sta per:");
    expect(questions[0]!.answers).toHaveLength(4);
    expect(questions[0]!.answers[0]).toEqual({
      letter: 'A',
      text: 'International Labour Organization',
      selected: false,
    });
  });

  it('reports the selected answer index', () => {
    const questions = scanQuiz(document);
    expect(questions[0]!.selectedIndex).toBeNull();
    expect(questions[1]!.selectedIndex).toBe(1);
  });

  it('returns an empty list on a non-quiz page', () => {
    document.body.innerHTML = '<div class="mt-8 px-4"><p>not a quiz</p></div>';
    expect(scanQuiz(document)).toHaveLength(0);
  });
});

describe('getQuizAnswerElement', () => {
  beforeEach(() => {
    document.body.innerHTML = fixture;
  });

  it('returns the clickable answer row', () => {
    const el = getQuizAnswerElement(document, 0, 2);
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain('International Labour Optimization');
  });

  it('returns null when out of range', () => {
    expect(getQuizAnswerElement(document, 5, 0)).toBeNull();
    expect(getQuizAnswerElement(document, 0, 9)).toBeNull();
  });
});

describe('findInviaButton', () => {
  it('finds the button by its text', () => {
    document.body.innerHTML = fixture;
    const btn = findInviaButton(document);
    expect(btn).not.toBeNull();
    expect(btn!.tagName).toBe('BUTTON');
  });

  it('returns null before the button appears', () => {
    document.body.innerHTML = '<button> Esegui </button>';
    expect(findInviaButton(document)).toBeNull();
  });
});

describe('getTestRunButton', () => {
  it('finds the Esegui button inside a sidebar row', () => {
    document.body.innerHTML = SIDEBAR_TEST_ROW;
    const row = document.querySelector('.pr-3')!;
    const btn = getTestRunButton(row);
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('Esegui');
  });

  it('returns null on a row without the button', () => {
    document.body.innerHTML = '<div class="pr-3"><div class="mb-2">Video</div></div>';
    expect(getTestRunButton(document.querySelector('.pr-3')!)).toBeNull();
  });
});
