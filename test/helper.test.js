import { get } from "svelte/store";
import { helper, refreshHelper, HELPER_URL } from "../src/helper.js";

const store = {};
global.window = {
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => (store[k] = String(v)),
    removeItem: (k) => delete store[k],
  },
};

const enable = (on) => {
  if (on) store.RGG_HELPER_ENABLED = "true";
  else delete store.RGG_HELPER_ENABLED;
};

beforeEach(() => helper.set({ status: "connected", data: { version: 1 } }));

test("fetches fresh data from /results and updates the store", async () => {
  enable(true);
  const urls = [];
  const fetchFn = async (url) => {
    urls.push(url);
    return { ok: true, json: async () => ({ version: 2 }) };
  };
  expect(await refreshHelper(fetchFn)).toEqual({ version: 2 });
  expect(urls).toEqual([HELPER_URL + "/results"]);
  expect(get(helper)).toEqual({ status: "connected", data: { version: 2 } });
});

test("returns null and keeps the store when the helper can't be reached", async () => {
  enable(true);
  const fetchFn = async () => {
    throw new TypeError("Failed to fetch");
  };
  expect(await refreshHelper(fetchFn)).toBeNull();
  expect(get(helper).data).toEqual({ version: 1 });
});

test("returns null on an error response", async () => {
  enable(true);
  expect(await refreshHelper(async () => ({ ok: false }))).toBeNull();
  expect(get(helper).data).toEqual({ version: 1 });
});

test("does nothing when the helper isn't enabled", async () => {
  enable(false);
  let called = false;
  const fetchFn = async () => {
    called = true;
  };
  expect(await refreshHelper(fetchFn)).toBeNull();
  expect(called).toBe(false);
});
