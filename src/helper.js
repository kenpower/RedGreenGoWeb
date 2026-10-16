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

// status: "off" (not opted in) | "connecting" | "connected" | "offline"
// data: latest message from the helper, kept while offline so the UI doesn't flicker
export const helper = writable({ status: "off", data: null });

let source = null;
let retryTimer = null;

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
    helper.update((h) => ({ ...h, status: "offline" }));
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
  if (new URLSearchParams(location.search).has("helper")) {
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

// Forget results from the previous game. Harmless if the helper isn't running.
export async function resetHelper() {
  if (!helperEnabled()) return;
  try {
    await fetch(HELPER_URL + "/reset", { method: "POST" });
  } catch {
    // helper not running
  }
}
