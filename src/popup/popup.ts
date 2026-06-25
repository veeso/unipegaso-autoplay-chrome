import { loadSettings, saveSettings } from '../lib/storage.js';
import { LESSON_URL_PATTERN } from '../lib/types.js';
import type { ExtensionSettings } from '../lib/types.js';

type StatusState = 'disabled' | 'inactive' | 'listening';

const STATUS_LABELS: Readonly<Record<StatusState, string>> = {
  disabled: 'Disabilitato',
  inactive: 'Inattivo',
  listening: 'In ascolto',
};

const STATUS_DESCRIPTIONS: Readonly<Record<StatusState, string>> = {
  disabled: 'avanzamento automatico disattivato',
  inactive: 'apri una videolezione per attivare l’avanzamento',
  listening: 'avanzamento automatico attivo',
};

const STATUS_CLASSES: readonly string[] = ['state-disabled', 'state-inactive', 'state-listening'];

const requireElement = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Popup: missing element "${selector}"`);
  return el;
};

const getActiveTabUrl = async (): Promise<string | undefined> => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url;
  } catch {
    return undefined;
  }
};

const computeState = (enabled: boolean, url: string | undefined): StatusState => {
  if (!enabled) return 'disabled';
  if (!url || !LESSON_URL_PATTERN.test(url)) return 'inactive';
  return 'listening';
};

const renderStatus = (state: StatusState): void => {
  const statusSection = requireElement<HTMLElement>('.status');
  const label = requireElement<HTMLElement>('#status-label');
  const description = requireElement<HTMLElement>('#status-description');
  statusSection.classList.remove(...STATUS_CLASSES);
  statusSection.classList.add(`state-${state}`);
  label.textContent = STATUS_LABELS[state];
  description.textContent = STATUS_DESCRIPTIONS[state];
};

const init = async (): Promise<void> => {
  let settings: ExtensionSettings = await loadSettings();
  const activeUrl = await getActiveTabUrl();
  const toggle = requireElement<HTMLInputElement>('#toggle');
  const fast = requireElement<HTMLInputElement>('#fast');

  toggle.checked = settings.enabled;
  fast.checked = settings.fastAdvance;
  renderStatus(computeState(settings.enabled, activeUrl));

  const persist = (): void => {
    void saveSettings(settings);
  };

  toggle.addEventListener('change', () => {
    settings = { ...settings, enabled: toggle.checked };
    renderStatus(computeState(settings.enabled, activeUrl));
    persist();
  });

  fast.addEventListener('change', () => {
    settings = { ...settings, fastAdvance: fast.checked };
    persist();
  });
};

void init();
