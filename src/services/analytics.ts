// Public GA4 measurement ID from the JMP Pingus web stream.
export const GA_MEASUREMENT_ID = 'G-ZKDSTJE4RD';
const PRODUCTION_HOSTS = new Set(['jmpingus.com', 'www.jmpingus.com']);
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};
let initialized = false;
let previousPage = '';

export function analyticsEnabled(production: boolean, hostname: string) {
  return production && PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

export function initializeAnalytics() {
  if (initialized || !analyticsEnabled(import.meta.env.PROD, window.location.hostname)) return;
  const target = window as AnalyticsWindow;
  target.dataLayer ??= [];
  // gtag expects an arguments object in dataLayer, rather than a plain array.
  target.gtag = function () { target.dataLayer!.push(arguments); };
  target.gtag('js', new Date());
  target.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: `${window.location.origin}/`,
    page_referrer: '',
    page_title: 'JMP Pingus',
  });
  const script = document.createElement('script');
  script.id = 'jmp-google-analytics';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  initialized = true;
}

// Only call with static section identifiers and titles, never user-entered data.
export function trackPage(view: string, title: string) {
  if (!initialized || !/^[a-z-]+$/.test(view)) return;
  const target = window as AnalyticsWindow;
  const page = `${window.location.origin}/app/${view}`;
  if (page === previousPage) return; // Includes React StrictMode effect replay.
  target.gtag?.('event', 'page_view', {
    send_to: GA_MEASUREMENT_ID,
    page_location: page,
    page_title: `${title} | JMP Pingus`,
    page_referrer: previousPage,
  });
  previousPage = page;
}
