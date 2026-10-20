import { get } from "svelte/store";
import { helper, refreshHelper, HELPER_URL, diagnose, networkPermission, checkReachability } from "../src/helper.js";

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

describe("blocked by the browser, or just not running", () => {
  const unreachable = async () => {
    throw new TypeError("Failed to fetch");
  };
  // a permissions API that knows only `known` names, reporting `state` for them
  const permissions = (state, known = ["local-network-access"]) => ({
    query: async ({ name }) => {
      if (!known.includes(name)) throw new TypeError(`'${name}' is not a valid permission name`);
      return { state };
    },
  });

  test("the permission denied: blocked", async () => {
    expect(await diagnose({ fetchFn: unreachable, permissions: permissions("denied") })).toEqual("blocked");
  });

  test("an older Chrome's name for the permission still works", async () => {
    const older = permissions("denied", ["loopback-network"]);
    expect(await networkPermission(older)).toEqual("denied");
    expect(await diagnose({ fetchFn: unreachable, permissions: older })).toEqual("blocked");
  });

  test("permission granted or not asked yet: offline (the helper isn't running)", async () => {
    expect(await diagnose({ fetchFn: unreachable, permissions: permissions("granted") })).toEqual("offline");
    expect(await diagnose({ fetchFn: unreachable, permissions: permissions("prompt") })).toEqual("offline");
  });

  test("a browser that can't say: offline, never a guess", async () => {
    expect(await diagnose({ fetchFn: unreachable, permissions: undefined })).toEqual("offline");
    expect(await diagnose({ fetchFn: unreachable, permissions: permissions("denied", []) })).toEqual("offline");
  });

  test("any other error: offline", async () => {
    const other = async () => {
      throw new Error("something else");
    };
    expect(await diagnose({ fetchFn: other, permissions: permissions("denied") })).toEqual("offline");
  });

  test("the helper answers after all: reachable", async () => {
    expect(await diagnose({ fetchFn: async () => ({ ok: true }), permissions: permissions("denied") })).toEqual("reachable");
  });

  test("the store shows blocked, but never overrides a live connection", async () => {
    helper.set({ status: "offline", data: null });
    await checkReachability({ fetchFn: unreachable, permissions: permissions("denied") });
    expect(get(helper).status).toEqual("blocked");

    helper.set({ status: "connected", data: { version: 3 } });
    await checkReachability({ fetchFn: unreachable, permissions: permissions("denied") });
    expect(get(helper).status).toEqual("connected");
  });
});
