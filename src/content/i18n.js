export function t(key, ...subs) {
  try {
    const msg = chrome.i18n.getMessage(key, subs.length ? subs.map(String) : undefined);
    return msg || key;
  } catch {
    return key;
  }
}
