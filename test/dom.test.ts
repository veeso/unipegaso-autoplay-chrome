import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { scanPage, findCollapsedLessonAccordions, getRowElement } from '../src/lib/dom.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, 'fixtures/lesson-tree.html');
const fixtureHtml = readFileSync(fixturePath, 'utf-8');

const loadFixture = (): Document => new JSDOM(fixtureHtml).window.document;

describe('scanPage', () => {
  it('parses the full lesson tree into a structured snapshot', () => {
    const doc = loadFixture();
    const page = scanPage(doc);

    // Summary shape — stable and resistant to small row-count tweaks.
    const summary = {
      accordions: page.accordions.map((a) => ({
        title: a.title,
        expanded: a.expanded,
        grey: a.grey,
        itemCount: a.items.length,
      })),
      items: page.items.map((i) => ({
        title: i.title,
        kind: i.kind,
        percentage: i.percentage,
        status: i.status,
        isCurrent: i.isCurrent,
        skip: i.skip,
        clickable: i.clickable,
        accordionTitle: i.accordionTitle,
      })),
    };
    expect(summary).toMatchSnapshot();
  });

  it('identifies exactly one current row', () => {
    const doc = loadFixture();
    const page = scanPage(doc);
    const currents = page.items.filter((i) => i.isCurrent);
    expect(currents).toHaveLength(1);
    expect(currents[0]?.status).toBe('current');
  });

  it('marks Test and Dispensa rows with skip=true when present', () => {
    const doc = loadFixture();
    const page = scanPage(doc, { activeModuleOnly: false });
    const classified = page.items.filter((i) => i.kind === 'test' || i.kind === 'dispensa');
    for (const row of classified) expect(row.skip).toBe(true);
  });

  it('never flags an Obiettivi row as skip', () => {
    const doc = loadFixture();
    const page = scanPage(doc);
    const obiettivi = page.items.filter((i) => i.kind === 'obiettivi');
    expect(obiettivi.length).toBeGreaterThan(0);
    for (const row of obiettivi) expect(row.skip).toBe(false);
  });

  it('derives done status for videos at 100%', () => {
    const doc = loadFixture();
    const page = scanPage(doc);
    const completed = page.items.filter((i) => i.kind === 'video' && i.percentage === 100);
    for (const row of completed) expect(['done', 'current']).toContain(row.status);
  });
});

describe('findCollapsedLessonAccordions', () => {
  it('returns header elements only for collapsed accordions inside the active module', () => {
    const doc = loadFixture();
    const headers = findCollapsedLessonAccordions(doc);
    for (const h of headers) {
      expect(h).toBeInstanceOf(doc.defaultView!.HTMLElement);
    }
  });
});

describe('getRowElement', () => {
  it('locates a known row by title', () => {
    const doc = loadFixture();
    const page = scanPage(doc);
    const video = page.items.find((i) => i.kind === 'video' && i.status === 'todo');
    expect(video).toBeDefined();
    if (!video) return;
    const el = getRowElement(doc, video);
    expect(el).not.toBeNull();
    expect(el?.textContent ?? '').toContain(video.title);
  });
});
