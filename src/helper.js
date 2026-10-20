// Connection to rgg_server.py, the helper the students run next to Visual Studio.
// It pushes test results, build status and source files over Server-Sent Events.
//
// Connecting is opt-in: talking to 127.0.0.1 makes Chrome/Edge ask the visitor for
// local-network permission, which we only want for people actually running the helper.
// The helper opens the game with ?helper=1, which turns it on (and is remembered).
import { writable } from "svelte/store";

export const HELPER_URL = "http://127.0.0.1:8000";
const ENABLED_KEY = "RGG_HELPER_ENABLED";
const RETRY_MS = 5000;

// status: "off" (not opted in) | "connecting" | "connected" | "offline" (not
// running, as far as we can tell) | "blocked" (the browser refused to let this
// page reach 127.0.0.1: Chrome's Local Network Access permission was denied)
// data: latest message from the helper, kept while offline so the UI doesn't flicker
export const helper = writable({ status: "off", data: null });

// The helper also serves the game itself here, which Chrome doesn't block
// (the page and the helper are the same origin).
export const HELPER_PAGE = HELPER_URL + "/";

// This page is the GitHub Pages copy of the game, which Chrome may stop from
// reaching the helper; the helper's own page doesn't have that problem.
export const onGithubPages = (location = globalThis.window?.location) => !!location?.hostname?.endsWith("github.io");
const onHelperPage = (location = globalThis.window?.location) => location?.origin === HELPER_URL;

// Where to download rgg_server.py: from the helper itself on its own page
// (same origin, so the download works despite the page's <base href> to
// GitHub Pages), else the copy next to the bundle.
export const helperDownloadUrl = (location = globalThis.window?.location) =>
  onHelperPage(location) ? HELPER_URL + "/rgg_server.py" : "build/rgg_server.py";

// What to tell the pair when the browser blocks the helper.
export const BLOCKED_HELP = `Chrome blocked this page from reaching the helper on your computer. Open ${HELPER_PAGE} (the helper prints it) instead of the GitHub page.`;
// ...and when it just can't be reached (it may be blocked, or not running)
export const OFFLINE_HELP = `Running it but still not connecting? Open ${HELPER_PAGE} (the helper prints it) instead of the GitHub page.`;

let source = null;
let retryTimer = null;
let diagnosing = false;

// Chrome's name for the Local Network Access permission has changed between
// versions; an unknown name makes query() throw.
const PERMISSION_NAMES = ["local-network-access", "loopback-network", "local-network"];

// The Local Network Access permission's state ("granted" | "denied" | "prompt"),
// or null when this browser can't say.
export async function networkPermission(permissions = globalThis.navigator?.permissions) {
  if (!permissions?.query) return null;
  for (const name of PERMISSION_NAMES) {
    try {
      const status = await permissions.query({ name });
      if (status?.state) return status.state;
    } catch {
      // not this browser's name for it
    }
  }
  return null;
}

// Why the helper can't be reached. A blocked request and a helper that isn't
// running look the same to the page (fetch rejects with a TypeError), so
// "blocked" needs the permission itself to say "denied"; anything else is
// "offline". "reachable" when the helper answered after all.
export async function diagnose({ fetchFn = fetch, permissions } = {}) {
  try {
    await fetchFn(HELPER_URL + "/results");
    return "reachable";
  } catch (e) {
    if (!(e instanceof TypeError)) return "offline";
    return (await networkPermission(permissions)) === "denied" ? "blocked" : "offline";
  }
}

// After a failed connection: work out whether it's blocked or offline and say
// so in the store (unless a message arrived meanwhile). One check at a time.
export async function checkReachability(options) {
  if (diagnosing) return null;
  diagnosing = true;
  try {
    const why = await diagnose(options);
    if (why !== "reachable") helper.update((h) => (h.status === "connected" ? h : { ...h, status: why }));
    return why;
  } finally {
    diagnosing = false;
  }
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function helperEnabled() {
  return storage()?.getItem(ENABLED_KEY) === "true";
}

function connect() {
  if (source || typeof EventSource === "undefined") return;
  helper.update((h) => ({ ...h, status: h.data ? "offline" : "connecting" }));

  source = new EventSource(HELPER_URL + "/events");
  source.onmessage = (e) => helper.set({ status: "connected", data: JSON.parse(e.data) });
  source.onerror = () => {
    helper.update((h) => ({ ...h, status: h.status === "blocked" ? "blocked" : "offline" }));
    checkReachability(); // blocked by the browser, or just not running?
    // EventSource retries by itself while CONNECTING; once CLOSED (e.g. a 403) it gives up.
    if (source.readyState === EventSource.CLOSED) {
      source = null;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, RETRY_MS);
    }
  };
}

// Call once on startup: connects if this browser opted in, or the URL has ?helper=1.
export function startHelper(location = window.location) {
  // the helper's own page, or a ?helper=1 link: the visitor runs the helper
  if (onHelperPage(location) || new URLSearchParams(location.search).has("helper")) {
    storage()?.setItem(ENABLED_KEY, "true");
  }
  if (helperEnabled()) connect();
}

export function enableHelper() {
  storage()?.setItem(ENABLED_KEY, "true");
  connect();
}

export function disableHelper() {
  storage()?.removeItem(ENABLED_KEY);
  clearTimeout(retryTimer);
  source?.close();
  source = null;
  helper.set({ status: "off", data: null });
}

// Asks the helper to re-read results, build and sources from disk now (the
// SSE push only follows test runs and builds, not plain saves). Updates the
// store and returns the fresh data, or null if the helper can't be reached.
export async function refreshHelper(fetchFn = fetch) {
  if (!helperEnabled()) return null;
  try {
    const response = await fetchFn(HELPER_URL + "/results");
    if (!response.ok) return null;
    const data = await response.json();
    helper.set({ status: "connected", data });
    return data;
  } catch {
    return null; // helper not running
  }
}

// Forget results from the previous game; the helper then re-reads the results already
// on disk. Fetch them straight away rather than waiting for the SSE push.
// Harmless if the helper isn't running.
export async function resetHelper() {
  if (!helperEnabled()) return;
  try {
    await fetch(HELPER_URL + "/reset", { method: "POST" });
  } catch {
    return; // helper not running
  }
  await refreshHelper();
}
