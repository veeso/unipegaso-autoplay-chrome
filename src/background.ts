import { loadSettings } from './lib/storage.js';

type RuntimeMessage = { type: 'notify'; title: string; message: string } | { type: 'get-settings' };

const LMS_HOST = 'lms.pegaso.multiversity.click';

const showNotification = (title: string, message: string): void => {
  chrome.notifications.create(
    {
      type: 'basic',
      title,
      message,
      iconUrl: chrome.runtime.getURL('icons/icon-96.png'),
    },
    () => {
      if (chrome.runtime.lastError) {
        console.warn('[unipegaso-autoplay] notify failed', chrome.runtime.lastError.message);
      }
    },
  );
};

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse): boolean | undefined => {
    if (message.type === 'notify') {
      showNotification(message.title, message.message);
      return undefined;
    }
    if (message.type === 'get-settings') {
      // Chrome does not honor a Promise returned from an onMessage listener
      // (unlike Firefox). Reply via sendResponse and return true to keep the
      // message channel open until the async load resolves.
      loadSettings()
        .then(sendResponse)
        .catch((err: unknown) => {
          console.warn('[unipegaso-autoplay] get-settings failed', err);
          sendResponse(undefined);
        });
      return true;
    }
    return undefined;
  },
);

/**
 * The Pegaso LMS is a Vue SPA — in-app navigation calls `history.pushState`
 * without reloading the document. Content scripts run in an isolated world and
 * cannot observe the page's own `history.pushState` calls, so detect the change
 * from the service worker via `webNavigation.onHistoryStateUpdated` and notify
 * the content script.
 */
const notifyUrlChange = (tabId: number, url: string): void => {
  chrome.tabs.sendMessage(tabId, { type: 'url-changed', url }).catch(() => {
    // Content script may not be injected yet on the tab; it runs its own
    // bootstrap URL check on load, so a missed message is harmless.
  });
};

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    notifyUrlChange(details.tabId, details.url);
  },
  { url: [{ hostEquals: LMS_HOST }] },
);
