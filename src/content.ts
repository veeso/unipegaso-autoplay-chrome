import { findCollapsedLessonAccordions, getRowElement, scanPage } from './lib/dom.js';
import { decide, findNextTarget } from './lib/navigator.js';
import { loadSettings, watchSettings } from './lib/storage.js';
import {
  LESSON_URL_PATTERN,
  NAVIGATION_DELAY_MS,
  OBIETTIVI_DWELL_MS,
  type ExtensionSettings,
} from './lib/types.js';

const LOG_PREFIX = '[unipegaso-autoplay]';

interface TickLog {
  ts: number;
  reason: string;
  currentTitle: string | null;
  currentKind: string | null;
  currentPercentage: number | null;
  itemCount: number;
  accordions: number;
  nextTarget?: string;
}

const lastLog: { payload: TickLog | null } = { payload: null };

const logOnChange = (payload: TickLog): void => {
  const prev = lastLog.payload;
  const same =
    prev?.reason === payload.reason &&
    prev.currentTitle === payload.currentTitle &&
    prev.currentPercentage === payload.currentPercentage &&
    prev.nextTarget === payload.nextTarget;
  if (same) return;
  lastLog.payload = payload;
  console.info(LOG_PREFIX, 'tick', payload);
};

interface ControllerState {
  settings: ExtensionSettings;
  pendingTimer: number | null;
  lastTargetIndex: number | null;
  lastObiettiviTitle: string | null;
  obiettiviFirstSeenAt: number | null;
  lastExpandAt: number;
}

const state: ControllerState = {
  settings: { enabled: true, fastAdvance: false },
  pendingTimer: null,
  lastTargetIndex: null,
  lastObiettiviTitle: null,
  obiettiviFirstSeenAt: null,
  lastExpandAt: 0,
};

/** Minimum time between accordion-expand clicks so we don't toggle them. */
const EXPAND_COOLDOWN_MS = 15000;
/** Poll interval while waiting for an expanded accordion to populate. */
const EXPAND_POLL_INTERVAL_MS = 300;
/** Hard cap on how long we keep polling before giving up. */
const EXPAND_POLL_TIMEOUT_MS = 15000;
/** Window after a sidebar click during which we retry calling video.play(). */
const AUTOPLAY_ATTEMPT_WINDOW_MS = 8000;
const AUTOPLAY_ATTEMPT_INTERVAL_MS = 500;

const notify = (title: string, message: string): void => {
  chrome.runtime
    .sendMessage({ type: 'notify', title, message })
    .catch((err: unknown) => console.warn(LOG_PREFIX, 'notify failed', err));
};

const clearPending = (): void => {
  if (state.pendingTimer !== null) {
    window.clearTimeout(state.pendingTimer);
    state.pendingTimer = null;
  }
};

const schedule = (fn: () => void, delay: number): void => {
  clearPending();
  state.pendingTimer = window.setTimeout(fn, delay);
};

const urlMatches = (): boolean => LESSON_URL_PATTERN.test(window.location.href);

/**
 * True when the lesson video has actually finished. Pegaso flips the sidebar
 * progress indicator to 100% slightly before the end, so we check the
 * <video> element directly and treat it as done when either `ended` is set
 * or playback is within 1s of the reported duration.
 */
const videoHasEnded = (): boolean => {
  const video = document.querySelector<HTMLVideoElement>('video');
  if (!video) {
    // No video element exposed (custom player / iframe) — fall back to trusting
    // the sidebar percentage that already triggered the advance decision.
    return true;
  }
  if (video.ended) return true;
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return video.currentTime >= duration - 1;
};

const describeElement = (el: Element): string => {
  const tag = el.tagName.toLowerCase();
  const cls = (el.getAttribute('class') ?? '').slice(0, 120);
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return `<${tag} class="${cls}"> "${text}"`;
};

const clickElement = (el: HTMLElement): void => {
  // Prefer the synthetic HTMLElement.click() path — Vue's @click listeners
  // reliably fire from it, whereas dispatched MouseEvents sometimes slip past
  // framework handlers. Fall back to dispatchEvent if .click() is missing.
  if (typeof el.click === 'function') {
    el.click();
    return;
  }
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
};

/**
 * Pegaso usually autoplays the next lesson after a sidebar click, but every
 * so often it stalls waiting for a manual press. Poll for a short window and
 * nudge the first paused <video> into play().
 */
const ensureVideoPlaying = (): void => {
  const deadline = Date.now() + AUTOPLAY_ATTEMPT_WINDOW_MS;
  const attempt = (): void => {
    if (!state.settings.enabled) return;
    const video = document.querySelector('video');
    if (video && video.paused && video.readyState >= 2) {
      video.play().catch((err: unknown) => {
        console.warn(LOG_PREFIX, 'video.play() rejected', err);
      });
      console.info(LOG_PREFIX, 'nudged video.play()');
      return;
    }
    if (Date.now() < deadline) {
      window.setTimeout(attempt, AUTOPLAY_ATTEMPT_INTERVAL_MS);
    }
  };
  window.setTimeout(attempt, AUTOPLAY_ATTEMPT_INTERVAL_MS);
};

/**
 * After clicking an accordion header the rows are inserted asynchronously.
 * Poll the DOM in short intervals until we see more items than before (meaning
 * the accordion actually populated), then run a tick so the advance logic can
 * pick the next target.
 */
const pollUntilExpanded = (itemCountBefore: number): void => {
  const deadline = Date.now() + EXPAND_POLL_TIMEOUT_MS;
  let pollCount = 0;
  const tickIfPopulated = (): void => {
    if (!state.settings.enabled) return;
    pollCount += 1;
    const page = scanPage(document);
    const currentCount = page.items.length;
    if (currentCount > itemCountBefore) {
      console.info(LOG_PREFIX, `accordion populated (${itemCountBefore} → ${currentCount})`);
      tick();
      return;
    }
    if (Date.now() >= deadline) {
      // Diagnostic: log everything we know about the current active module
      // so we can tell whether the accordion opened but scanner can't see it.
      const accordionSummary = page.accordions.map((a) => ({
        title: a.title,
        expanded: a.expanded,
        items: a.items.length,
      }));
      console.warn(LOG_PREFIX, 'accordion expand timed out', {
        polls: pollCount,
        itemCountBefore,
        currentCount,
        accordions: accordionSummary,
      });
      return;
    }
    window.setTimeout(tickIfPopulated, EXPAND_POLL_INTERVAL_MS);
  };
  window.setTimeout(tickIfPopulated, EXPAND_POLL_INTERVAL_MS);
};

const tick = (): void => {
  if (!state.settings.enabled) return;
  if (!urlMatches()) return;

  const page = scanPage(document);
  const decision = decide(page);
  const current = page.items.find((i) => i.isCurrent) ?? null;
  const currentIndex = page.items.findIndex((i) => i.isCurrent);
  const peekTarget = currentIndex >= 0 ? (findNextTarget(page, currentIndex)?.title ?? null) : null;

  logOnChange({
    ts: Date.now(),
    reason: decision.action === 'wait' ? decision.reason : decision.action,
    currentTitle: current?.title ?? null,
    currentKind: current?.kind ?? null,
    currentPercentage: current?.percentage ?? null,
    itemCount: page.items.length,
    accordions: page.accordions.length,
    nextTarget: decision.action === 'advance' ? decision.target.title : (peekTarget ?? undefined),
  });

  if (decision.action === 'wait') {
    if (decision.reason === 'video-in-progress' || decision.reason === 'video-no-percentage') {
      state.lastObiettiviTitle = null;
      state.obiettiviFirstSeenAt = null;
    }
    return;
  }

  if (decision.action === 'expand') {
    const now = Date.now();
    if (now - state.lastExpandAt < EXPAND_COOLDOWN_MS) return;
    const [header] = findCollapsedLessonAccordions(document);
    if (!header) {
      console.warn(LOG_PREFIX, 'expand decision but no collapsed accordion found');
      return;
    }
    state.lastExpandAt = now;
    const itemCountBefore = page.items.length;
    console.info(LOG_PREFIX, 'expanding next accordion →', describeElement(header), header);
    clickElement(header);
    pollUntilExpanded(itemCountBefore);
    return;
  }

  // decision.action === 'advance'
  const currentItem = page.items[decision.currentIndex];
  if (!currentItem) return;

  // Pegaso sometimes flips the sidebar progress bar to 100% before the video
  // actually reaches its end. Gate the advance on the real `<video>` state so
  // we don't cut the user off mid-lecture — unless the user opted into fast
  // mode, in which case we trust the sidebar percentage.
  if (currentItem.kind === 'video' && !state.settings.fastAdvance && !videoHasEnded()) {
    return;
  }

  if (currentItem.kind === 'obiettivi') {
    const now = Date.now();
    if (state.lastObiettiviTitle !== currentItem.title) {
      state.lastObiettiviTitle = currentItem.title;
      state.obiettiviFirstSeenAt = now;
      return;
    }
    const firstSeen = state.obiettiviFirstSeenAt ?? now;
    if (now - firstSeen < OBIETTIVI_DWELL_MS) return;
  } else {
    state.lastObiettiviTitle = null;
    state.obiettiviFirstSeenAt = null;
  }

  if (state.pendingTimer !== null && state.lastTargetIndex === decision.target.index) return;
  state.lastTargetIndex = decision.target.index;

  console.info(LOG_PREFIX, `advancing in ${NAVIGATION_DELAY_MS}ms → ${decision.target.title}`);

  schedule(() => {
    state.pendingTimer = null;
    const row = getRowElement(document, decision.target);
    if (!row) {
      console.warn(LOG_PREFIX, 'target row not found:', decision.target.title);
      return;
    }
    clickElement(row);
    ensureVideoPlaying();
    notify('Unipegaso AutoPlay', `Prossima lezione: ${decision.target.title}`);
  }, NAVIGATION_DELAY_MS);
};

let observer: MutationObserver | null = null;
let intervalId: number | null = null;

const start = (): void => {
  if (observer) return;
  observer = new MutationObserver(() => tick());
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  intervalId = window.setInterval(tick, 1500);
  tick();
  notify(
    'Unipegaso AutoPlay',
    'In ascolto: l’estensione avanzerà automaticamente alle lezioni successive.',
  );
};

const stop = (): void => {
  clearPending();
  observer?.disconnect();
  observer = null;
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
  state.lastTargetIndex = null;
  state.lastObiettiviTitle = null;
  state.obiettiviFirstSeenAt = null;
  notify('Unipegaso AutoPlay', 'In pausa: avanzamento automatico disattivato.');
};

const applySettings = (settings: ExtensionSettings): void => {
  const wasEnabled = state.settings.enabled;
  state.settings = settings;
  if (!urlMatches()) return;
  if (settings.enabled && !wasEnabled) start();
  else if (!settings.enabled && wasEnabled) stop();
  else if (settings.enabled && !observer) start();
};

/**
 * The Pegaso LMS is a Vue SPA, so entering a lesson URL via in-app navigation
 * never triggers a fresh document load. Content scripts only inject on real
 * loads, so without a URL watcher the controller would stay dormant until the
 * user hit refresh. Content scripts run in an isolated world and cannot observe
 * the page's own `history.pushState` calls, so the service worker watches
 * `webNavigation` and pushes a message here on every history-state update.
 * `popstate` still handles back/forward directly in this world.
 */
const handleUrlChange = (): void => {
  if (urlMatches()) {
    if (state.settings.enabled && !observer) start();
  } else if (observer) {
    stop();
  }
};

interface UrlChangedMessage {
  type: 'url-changed';
  url: string;
}

const isUrlChangedMessage = (value: unknown): value is UrlChangedMessage =>
  typeof value === 'object' &&
  value !== null &&
  (value as { type?: unknown }).type === 'url-changed';

const installUrlWatcher = (): void => {
  window.addEventListener('popstate', handleUrlChange);
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (isUrlChangedMessage(message)) handleUrlChange();
    return undefined;
  });
};

const bootstrap = async (): Promise<void> => {
  const settings = await loadSettings();
  state.settings = settings;
  installUrlWatcher();
  watchSettings(applySettings);
  handleUrlChange();
};

void bootstrap();

// Expose a diagnostic hook so you can poke the scanner from DevTools:
//   > __unipegasoAutoplay.scan()
//   > __unipegasoAutoplay.decide()
//   > __unipegasoAutoplay.state()
interface DebugHook {
  scan: () => ReturnType<typeof scanPage>;
  decide: () => ReturnType<typeof decide>;
  state: () => ControllerState;
  tick: () => void;
}
const debugHook: DebugHook = {
  scan: () => scanPage(document),
  decide: () => decide(scanPage(document)),
  state: () => state,
  tick,
};
(window as unknown as { __unipegasoAutoplay: DebugHook }).__unipegasoAutoplay = debugHook;
