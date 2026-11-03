export function launchBrowser(chromium) {
  const channel = process.env.QA_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
  return chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
}
