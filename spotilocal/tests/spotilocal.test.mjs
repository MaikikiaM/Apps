import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const DB_JS = fs.readFileSync(path.join(ROOT_DIR, "db.js"), "utf8");
const ID3_JS = fs.readFileSync(path.join(ROOT_DIR, "id3-parser.js"), "utf8");
const AUDIO_JS = fs.readFileSync(path.join(ROOT_DIR, "audio-engine.js"), "utf8");
const APP_JS = fs.readFileSync(path.join(ROOT_DIR, "app.js"), "utf8");

function cloneIdbRecord(val) {
  if (val === null || typeof val !== "object") return val;
  if (val instanceof Uint8Array) return new Uint8Array(val);
  if (typeof Blob !== "undefined" && val instanceof Blob) return val;
  if (Array.isArray(val)) return val.map(cloneIdbRecord);
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    out[k] = cloneIdbRecord(v);
  }
  return out;
}

function createFakeIndexedDB({ jitterMaxMs = 3 } = {}) {
  const stores = new Map();
  const keyPaths = new Map();
  let dbVersion = 0;
  let deleteDatabaseCalls = 0;

  const scheduleAsync = (fn) => {
    const delay = jitterMaxMs > 0 ? Math.floor(Math.random() * jitterMaxMs) + 1 : 0;
    const t = setTimeout(fn, delay);
    if (typeof t.unref === "function") t.unref();
  };

  function makeDatabaseHandle() {
    const db = {
      objectStoreNames: {
        contains: (name) => stores.has(name),
      },
      createObjectStore: (name, options = {}) => {
        if (!stores.has(name)) stores.set(name, new Map());
        keyPaths.set(name, options.keyPath || "id");
        return {
          createIndex: () => ({}),
        };
      },
      transaction: (_storeNames, _mode) => {
        let pending = 0;
        let finished = false;
        const tx = {
          oncomplete: null,
          onerror: null,
          onabort: null,
          error: null,
          objectStore: (name) => {
            if (!stores.has(name)) stores.set(name, new Map());
            const map = stores.get(name);
            const kp = keyPaths.get(name) || "id";

            const runOp = (executor) => {
              const req = { result: undefined, error: null, onsuccess: null, onerror: null };
              pending++;
              scheduleAsync(() => {
                let failed = false;
                try {
                  req.result = executor();
                  if (typeof req.onsuccess === "function") {
                    req.onsuccess({ target: req });
                  }
                } catch (err) {
                  failed = true;
                  finished = true;
                  req.error = err;
                  tx.error = err;
                  if (typeof req.onerror === "function") {
                    req.onerror({ target: req });
                  }
                  if (typeof tx.onerror === "function") {
                    tx.onerror({ target: tx });
                  }
                } finally {
                  pending--;
                  queueMicrotask(() => {
                    if (!failed && !finished && pending === 0) {
                      finished = true;
                      if (typeof tx.oncomplete === "function") {
                        tx.oncomplete({ target: tx });
                      }
                    }
                  });
                }
              });
              return req;
            };

            return {
              get: (key) => runOp(() => {
                const v = map.get(key);
                return v === undefined ? undefined : cloneIdbRecord(v);
              }),
              put: (val, explicitKey) => runOp(() => {
                const cloned = cloneIdbRecord(val);
                const key = explicitKey !== undefined ? explicitKey : cloned?.[kp];
                if (key === undefined) throw new Error(`Missing keyPath "${kp}" in store "${name}"`);
                map.set(key, cloned);
                return key;
              }),
              delete: (key) => runOp(() => {
                map.delete(key);
                return undefined;
              }),
              clear: () => runOp(() => {
                map.clear();
                return undefined;
              }),
              getAllKeys: () => runOp(() => Array.from(map.keys())),
              getAll: () => runOp(() => Array.from(map.values()).map(cloneIdbRecord)),
            };
          },
        };
        return tx;
      },
      close: () => {},
    };
    return db;
  }

  return {
    _stores: stores,
    get deleteDatabaseCalls() { return deleteDatabaseCalls; },
    deleteDatabase: (_name) => {
      deleteDatabaseCalls++;
      const req = { onsuccess: null, onerror: null, onblocked: null };
      scheduleAsync(() => {
        stores.clear();
        dbVersion = 0;
        if (typeof req.onsuccess === "function") req.onsuccess({ target: req });
      });
      return req;
    },
    open: (_name, version = 1) => {
      const req = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      scheduleAsync(() => {
        const db = makeDatabaseHandle();
        req.result = db;
        if (version > dbVersion) {
          dbVersion = version;
          if (typeof req.onupgradeneeded === "function") {
            req.onupgradeneeded({ target: req });
          }
        }
        if (typeof req.onsuccess === "function") {
          req.onsuccess({ target: req });
        }
      });
      return req;
    },
  };
}

function createFakeLocalStorage() {
  const map = new Map();
  const api = {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => { map.clear(); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
  return new Proxy(api, {
    ownKeys: () => Array.from(map.keys()),
    getOwnPropertyDescriptor: (_t, prop) => {
      if (map.has(String(prop))) {
        return { enumerable: true, configurable: true, value: map.get(String(prop)) };
      }
      return undefined;
    },
    get: (target, prop) => {
      if (prop in target) return Reflect.get(target, prop, target);
      if (typeof prop === "string" && map.has(prop)) return map.get(prop);
      return undefined;
    },
    set: (_target, prop, value) => {
      map.set(String(prop), String(value));
      return true;
    },
    deleteProperty: (_target, prop) => {
      map.delete(String(prop));
      return true;
    },
  });
}

function makeFakeElement(tagName = "div", id = "") {
  const listeners = new Map();
  const classes = new Set();
  const styleProps = {};
  const style = new Proxy(styleProps, {
    get: (t, p) => (p === "setProperty" ? ((k, v) => { t[k] = v; }) : (t[p] || "")),
    set: (t, p, v) => { t[p] = v; return true; },
  });
  const el = {
    tagName: tagName.toUpperCase(),
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    files: [],
    src: "",
    currentTime: 0,
    duration: 0,
    volume: 1,
    playbackRate: 1,
    paused: true,
    dataset: {},
    style,
    children: [],
    clientWidth: 300,
    clientHeight: 150,
    parentElement: {
      clientWidth: 300,
      clientHeight: 150,
      getBoundingClientRect: () => ({ width: 300, height: 150 }),
    },
    getBoundingClientRect: () => ({ width: 300, height: 150 }),
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (x, force) => {
        if (force === true) { classes.add(x); return true; }
        if (force === false) { classes.delete(x); return false; }
        if (classes.has(x)) { classes.delete(x); return false; }
        classes.add(x); return true;
      },
      contains: (x) => classes.has(x),
    },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      if (!listeners.has(type)) return;
      listeners.set(type, listeners.get(type).filter(x => x !== fn));
    },
    dispatchEvent: (evt = {}) => {
      const type = evt.type || evt;
      const list = listeners.get(type) || [];
      return list.map(fn => fn(typeof evt === "object" ? evt : { type }));
    },
    trigger: async (type, evt = {}) => {
      const list = listeners.get(type) || [];
      for (const fn of list) {
        await fn({ target: el, preventDefault: () => {}, stopPropagation: () => {}, ...evt });
      }
    },
    querySelector: () => makeFakeElement("div"),
    querySelectorAll: () => [],
    appendChild: (c) => { el.children.push(c); return c; },
    insertBefore: (c) => { el.children.unshift(c); return c; },
    removeChild: () => {},
    remove: () => {},
    get firstChild() { return el.children[0] || null; },
    nextSibling: null,
    contains: () => false,
    scrollTo: () => {},
    scrollIntoView: () => {},
    click: () => {},
    focus: () => {},
    select: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    hasAttribute: () => false,
    closest: () => null,
    canPlayType: () => "probably",
    play: () => Promise.resolve(),
    pause: () => {},
    load: () => {},
    getContext: () => ({
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillText: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
    }),
  };
  return el;
}

function buildId3v23Tag({ title, artist, album }) {
  const enc = (str) => Buffer.from(str, "utf8");
  const makeFrame = (id, text) => {
    const textBytes = enc(text);
    const body = Buffer.concat([Buffer.from([0x03]), textBytes]); // 0x03 = UTF-8
    const header = Buffer.alloc(10);
    header.write(id, 0, 4, "ascii");
    header.writeUInt32BE(body.length, 4);
    return Buffer.concat([header, body]);
  };
  const frames = [];
  if (title) frames.push(makeFrame("TIT2", title));
  if (artist) frames.push(makeFrame("TPE1", artist));
  if (album) frames.push(makeFrame("TALB", album));
  const payload = Buffer.concat(frames);
  const size = payload.length;
  const header = Buffer.from([
    0x49, 0x44, 0x33, // "ID3"
    0x03, 0x00,       // v2.3
    0x00,             // flags
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f,
  ]);
  const audioTail = Buffer.alloc(64, 0xff);
  return Buffer.concat([header, payload, audioTail]);
}

async function createAppHarness({
  fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 }),
  localStorage = createFakeLocalStorage(),
  nativePlayer = undefined,
  fetchImpl = null,
  confirmResult = true,
} = {}) {
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) {
      const tag = id.includes("audio") ? "audio" : (id.includes("canvas") ? "canvas" : "div");
      elements.set(id, makeFakeElement(tag, id));
    }
    return elements.get(id);
  };

  const docListeners = new Map();
  const winListeners = new Map();
  const activeTimers = new Set();

  const windowObj = {
    indexedDB: fakeIDB,
    localStorage,
    SpotiLocalNativePlayer: nativePlayer,
    matchMedia: () => ({
      matches: false,
      media: "",
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    innerWidth: 1280,
    innerHeight: 800,
    location: { origin: "http://localhost", href: "http://localhost/", protocol: "http:", hostname: "localhost", port: "3000", reload: () => {} },
    addEventListener: (t, fn) => {
      if (!winListeners.has(t)) winListeners.set(t, []);
      winListeners.get(t).push(fn);
    },
    removeEventListener: () => {},
    confirm: () => confirmResult,
    alert: () => {},
    URL: {
      createObjectURL: () => "blob:mock/" + Math.random().toString(36).slice(2),
      revokeObjectURL: () => {},
    },
    navigator: {
      onLine: true,
      storage: { persist: async () => true, persisted: async () => true },
      mediaSession: { setActionHandler: () => {}, setPositionState: () => {} },
    },
  };

  const documentObj = {
    readyState: "complete",
    visibilityState: "visible",
    head: makeFakeElement("head"),
    body: makeFakeElement("body"),
    getElementById: getEl,
    querySelector: (sel) => makeFakeElement("div", sel),
    querySelectorAll: () => [],
    createElement: (tag) => makeFakeElement(tag),
    addEventListener: (t, fn) => {
      if (!docListeners.has(t)) docListeners.set(t, []);
      docListeners.get(t).push(fn);
    },
    removeEventListener: () => {},
  };

  const trackedSetInterval = (fn, ms, ...args) => {
    const handle = setInterval(fn, ms, ...args);
    if (typeof handle.unref === "function") handle.unref();
    activeTimers.add({ type: "interval", handle });
    return handle;
  };
  const trackedSetTimeout = (fn, ms, ...args) => {
    const handle = setTimeout(fn, ms, ...args);
    if (typeof handle.unref === "function") handle.unref();
    activeTimers.add({ type: "timeout", handle });
    return handle;
  };

  const defaultFetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
    text: async () => "",
    blob: async () => new Blob([]),
  });

  const ctx = vm.createContext({
    console,
    Math,
    Date,
    JSON,
    Object,
    Array,
    Map,
    Set,
    Promise,
    Error,
    Number,
    String,
    Boolean,
    RegExp,
    Uint8Array,
    ArrayBuffer,
    DataView,
    TextDecoder,
    TextEncoder,
    Blob,
    File,
    FileReader: class FakeFileReader {
      readAsDataURL(blob) {
        queueMicrotask(async () => {
          this.result = "data:application/octet-stream;base64,AA==";
          if (typeof this.onload === "function") this.onload({ target: this });
          if (typeof this.onloadend === "function") this.onloadend({ target: this });
        });
      }
      readAsArrayBuffer(blob) {
        queueMicrotask(async () => {
          this.result = await blob.arrayBuffer();
          if (typeof this.onload === "function") this.onload({ target: this });
        });
      }
    },
    AbortController,
    URL: windowObj.URL,
    indexedDB: fakeIDB,
    localStorage,
    navigator: windowObj.navigator,
    confirm: windowObj.confirm,
    alert: windowObj.alert,
    matchMedia: windowObj.matchMedia,
    location: windowObj.location,
    fetch: fetchImpl || defaultFetch,
    Image: class FakeImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.crossOrigin = "";
      }
      set src(_v) {}
    },
    MediaMetadata: function MediaMetadata(meta) { Object.assign(this, meta); },
    setInterval: trackedSetInterval,
    clearInterval: (h) => clearInterval(h),
    setTimeout: trackedSetTimeout,
    clearTimeout: (h) => clearTimeout(h),
    queueMicrotask,
    requestAnimationFrame: (fn) => trackedSetTimeout(fn, 0),
    window: windowObj,
    document: documentObj,
  });
  ctx.globalThis = ctx;
  ctx.self = ctx;
  windowObj.window = windowObj;
  windowObj.document = documentObj;

  const syncWinToCtx = () => {
    for (const k of Object.keys(windowObj)) {
      if (!(k in ctx)) ctx[k] = windowObj[k];
    }
  };

  vm.runInContext(ID3_JS, ctx, { filename: "id3-parser.js" });
  syncWinToCtx();
  vm.runInContext(DB_JS, ctx, { filename: "db.js" });
  syncWinToCtx();
  vm.runInContext(AUDIO_JS, ctx, { filename: "audio-engine.js" });
  syncWinToCtx();

  // Inject test hook strictly inside in-memory VM copy of app.js before closing initSpotiLocalApp()
  const marker = "  try {\r\n    await loadCoverArtCatalog();";
  const markerLf = "  try {\n    await loadCoverArtCatalog();";
  const activeMarker = APP_JS.includes(marker) ? marker : markerLf;
  const idx = APP_JS.lastIndexOf(activeMarker);
  assert.notEqual(idx, -1, "Expected initSpotiLocalApp boot block in app.js");

  const hookCode = `
  globalThis.__testApi = {
    get songs() { return songs; },
    set songs(v) { songs = v; },
    get currentQueue() { return currentQueue; },
    set currentQueue(v) { currentQueue = v; },
    get unshuffledQueue() { return unshuffledQueue; },
    set unshuffledQueue(v) { unshuffledQueue = v; },
    get pendingQueue() { return pendingQueue; },
    set pendingQueue(v) { pendingQueue = v; },
    get currentSongIndex() { return currentSongIndex; },
    set currentSongIndex(v) { currentSongIndex = v; },
    get playlists() { return playlists; },
    set playlists(v) { playlists = v; },
    get isPlaying() { return isPlaying; },
    set isPlaying(v) { isPlaying = v; },
    get repeatMode() { return repeatMode; },
    get currentSongListenedSeconds() { return currentSongListenedSeconds; },
    set currentSongListenedSeconds(v) { currentSongListenedSeconds = v; },
    get lastTimeUpdate() { return lastTimeUpdate; },
    set lastTimeUpdate(v) { lastTimeUpdate = v; },
    get hasScrobbledCurrentPlay() { return hasScrobbledCurrentPlay; },
    set hasScrobbledCurrentPlay(v) { hasScrobbledCurrentPlay = v; },
    get _libraryInitialHydrationDone() { return _libraryInitialHydrationDone; },
    set _libraryInitialHydrationDone(v) { _libraryInitialHydrationDone = v; },
    get editingSongId() { return editingSongId; },
    set editingSongId(v) { editingSongId = v; },
    get _unappliedNativeStats() { return _unappliedNativeStats; },
    audioElement,
    toggleLikeSong,
    toggleRepeat,
    playSongById,
    playNextSong,
    playPrevSong,
    recordCurrentSongTime,
    isSongDeleted,
    isGenericArtistName,
    getSongCanonicalKey,
    isUnsafeSharedCanonicalKey,
    untangleLegacySharedGenericLedgerKeys,
    getSongLedgerStats,
    getSongStatsLedger,
    recordSongLedgerMonotonic,
    calculateSongStatsFromLogs,
    sanitizeCorruptedSongStats,
    coalesceListeningLogs,
    mergeListeningLogSources,
    restoreListeningLogsFromDB,
    recordListeningLog,
    getListeningLogs,
    flushUnappliedNativeStats,
    applyNativeListeningStats,
    loadSongsFromDB,
    handleFilesSelect,
    deleteSong,
    buildDurableBackupPayload,
    flushDurableBackupNow,
    applyExternalBackupPayload,
    rebindQueueToLiveSongs,
    getDeletedSongIds,
    saveCachedSongs,
  };
`;
  const instrumentedApp = APP_JS.slice(0, idx) + hookCode + APP_JS.slice(idx)
    .replace("    loadSongsFromDB();\n    loadPlaylistsFromDB();", "    await loadSongsFromDB();\n    await loadPlaylistsFromDB();")
    .replace("    loadSongsFromDB();\r\n    loadPlaylistsFromDB();", "    await loadSongsFromDB();\r\n    await loadPlaylistsFromDB();")
    .replace(
      /if \(document\.readyState === "loading"\)[\s\S]*$/,
      "globalThis.__bootPromise = initSpotiLocalApp();"
    );

  vm.runInContext(instrumentedApp, ctx, { filename: "app.js" });
  await ctx.__bootPromise;

  const dispose = () => {
    for (const item of activeTimers) {
      if (item.type === "interval") clearInterval(item.handle);
      else clearTimeout(item.handle);
    }
    activeTimers.clear();
  };

  return {
    ctx,
    api: ctx.__testApi,
    musicDB: windowObj.musicDB || vm.runInContext("typeof musicDB !== 'undefined' ? musicDB : new MusicDB()", ctx),
    localStorage,
    fakeIDB,
    elements,
    dispose,
  };
}

// ---------------------------------------------------------------------------
// 1. MusicDB Concurrency & Atomicity Tests (db.js)
// ---------------------------------------------------------------------------
describe("MusicDB concurrency & atomic stats persistence (db.js)", () => {
  function loadMusicDbInstance(fakeIDB) {
    const ctx = vm.createContext({
      console,
      Math,
      Date,
      JSON,
      Object,
      Array,
      Map,
      Set,
      Promise,
      Error,
      Number,
      String,
      Boolean,
      Blob,
      indexedDB: fakeIDB,
      window: { indexedDB: fakeIDB },
      setTimeout,
      clearTimeout,
      queueMicrotask,
    });
    ctx.globalThis = ctx;
    ctx.window = ctx;
    vm.runInContext(DB_JS, ctx, { filename: "db.js" });
    return vm.runInContext("({ MusicDB, musicDB: typeof musicDB !== 'undefined' ? musicDB : (window.musicDB || new MusicDB()) })", ctx);
  }

  it("serializes concurrent syncListeningStats, recordListeningTime, toggleLike, and stale saveSong without double-counting or dropping likes", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 4 });
    const { musicDB } = loadMusicDbInstance(fakeIDB);
    await musicDB.init();

    await musicDB.saveSong(
      {
        id: "s1",
        title: "Atomic Track",
        artist: "Real Artist",
        playCount: 2,
        totalTimeListened: 100,
        isLiked: false,
      },
      { forceExactStats: true }
    );

    const staleSnapshot = {
      id: "s1",
      title: "Atomic Track",
      artist: "Real Artist",
      playCount: 1,
      totalTimeListened: 50,
      isLiked: false,
    };

    // Launch interleaved operations concurrently on the same songId
    await Promise.all([
      musicDB.syncListeningStats("s1", 5, 105, 2),
      musicDB.toggleLike("s1"),
      musicDB.recordListeningTime("s1", 3),
      musicDB.syncListeningStats("s1", 5, 113, 3),
      musicDB.saveSong(staleSnapshot), // must NOT revert totalTimeListened to 50 or overwrite isLiked
      musicDB.toggleLike("s1"),
      musicDB.syncListeningStats("s1", 4, 117, 3),
      musicDB.toggleLike("s1"), // odd number of toggles -> true
      musicDB.recordListeningTime("s1", 3),
    ]);

    const finalSong = await musicDB.getSong("s1");
    // 100 + 5 + 3 + 5 + 4 + 3 = 120 exact
    assert.equal(finalSong.totalTimeListened, 120);
    assert.equal(finalSong.playCount, 3);
    assert.equal(finalSong.isLiked, true);
  });

  it("saveSong with forceExactStats resets inflated IDB stats to exact 0", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 2 });
    const { musicDB } = loadMusicDbInstance(fakeIDB);
    await musicDB.init();

    await musicDB.saveSong({ id: "s_reset", title: "Track", artist: "Artist", totalTimeListened: 9999, playCount: 40 });
    await musicDB.saveSong(
      { id: "s_reset", title: "Track", artist: "Artist", totalTimeListened: 0, playCount: 0, statsIsolated: true },
      { forceExactStats: true }
    );

    const saved = await musicDB.getSong("s_reset");
    assert.equal(saved.totalTimeListened, 0);
    assert.equal(saved.playCount, 0);
    assert.equal(saved.statsIsolated, true);
  });

  it("supports saveSongBlob, getAllBlobKeys, getAllLyrics, concurrent settings, and deleteSong cleanup", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 2 });
    const { musicDB } = loadMusicDbInstance(fakeIDB);
    await musicDB.init();

    await musicDB.saveSong({ id: "s_blob", title: "Blob Track", artist: "A", totalTimeListened: 10, playCount: 1 });
    const fakeBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/mpeg" });
    await musicDB.saveSongBlob("s_blob", fakeBlob);

    const blobKeys = await musicDB.getAllBlobKeys();
    assert.deepEqual(blobKeys, ["s_blob"]);
    const gotBlob = await musicDB.getAudioBlob("s_blob");
    assert.equal(gotBlob.size, 4);

    await musicDB.saveLyrics("s_blob", "[00:01.00] Hola");
    const lyrics = await musicDB.getAllLyrics();
    assert.equal(Object.keys(lyrics).length, 1);
    assert.equal(lyrics["s_blob"], "[00:01.00] Hola");

    await Promise.all([
      musicDB.setSetting("k1", [1]),
      musicDB.setSetting("k1", [1, 2]),
      musicDB.setSetting("k1", [1, 2, 3]),
    ]);
    assert.deepEqual(await musicDB.getSetting("k1"), [1, 2, 3]);

    await musicDB.deleteSong("s_blob");
    assert.equal(await musicDB.getSong("s_blob"), null);
    assert.deepEqual(await musicDB.getAllBlobKeys(), []);
    assert.equal(await musicDB.getLyrics("s_blob"), null);
  });

  it("blocks global inflation from orphan song IDs, serializes playlists, supports read-your-writes getSetting, and rejects aborted writes", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 3 });
    const { musicDB } = loadMusicDbInstance(fakeIDB);
    await musicDB.init();

    // Nonexistent song must NOT increment globalTotalSeconds
    const orphanSync = await musicDB.syncListeningStats("ghost_id", 120, 120, 1);
    assert.equal(orphanSync.song, null);
    assert.equal(await musicDB.getSetting("globalTotalSeconds", 0), 0);
    assert.equal(await musicDB.recordListeningTime("ghost_id", 60), null);
    assert.equal(await musicDB.getSetting("globalTotalSeconds", 0), 0);

    // Read-your-writes consistency while setSetting write is still queued
    const pWrite = musicDB.setSetting("pref_async", "latest_val");
    const gotSync = await musicDB.getSetting("pref_async");
    await pWrite;
    assert.equal(gotSync, "latest_val");

    // Concurrent playlist modifications must not drop songs
    await musicDB.savePlaylist({ id: "pl_atomic", name: "Atomic PL", songIds: [] });
    await Promise.all([
      musicDB.addSongToPlaylist("pl_atomic", "s1"),
      musicDB.addSongToPlaylist("pl_atomic", "s2"),
      musicDB.addSongToPlaylist("pl_atomic", "s3"),
    ]);
    await musicDB.removeSongFromPlaylist("pl_atomic", "s2");
    const finalPl = await musicDB.getPlaylist("pl_atomic");
    assert.deepEqual(finalPl.songIds, ["s1", "s3"]);

    // Verify tx error rejects saveSong instead of resolving on premature put
    const origTx = musicDB.db.transaction.bind(musicDB.db);
    musicDB.db.transaction = (stores, mode) => {
      const tx = origTx(stores, mode);
      const origStore = tx.objectStore.bind(tx);
      tx.objectStore = (name) => {
        const os = origStore(name);
        if (name === "song_blobs") {
          return {
            ...os,
            put: () => { throw new Error("Simulated QuotaExceededError"); },
          };
        }
        return os;
      };
      return tx;
    };
    await assert.rejects(
      () => musicDB.saveSong({ id: "s_fail", title: "Fail", artist: "A", audioBlob: new Blob([new Uint8Array([1, 2])]) }),
      /Simulated QuotaExceededError/
    );
  });
});

// ---------------------------------------------------------------------------
// 2. App Logic, Isolation, Sanitization, Log Engine, Recovery Tests (app.js)
// ---------------------------------------------------------------------------
describe("SpotiLocal stats isolation, sanitization, logs & durable recovery (app.js)", () => {
  it("isolates generic/placeholder artists under id:::<id> so tracks sharing titles never collide", async () => {
    const h = await createAppHarness();
    try {
      const genericNames = [
        "Artista Local",
        "Artista Desconocido",
        "Desconocido",
        "Unknown",
        "Unknown Artist",
        "Nube Cloud Track",
        "",
        null,
      ];
      for (const name of genericNames) {
        assert.equal(h.api.isGenericArtistName(name), true, `Expected "${name}" to be generic`);
      }
      assert.equal(h.api.isGenericArtistName("Daft Punk"), false);

      const s1 = { id: "id_alpha", title: "Track 01", artist: "Artista Desconocido" };
      const s2 = { id: "id_beta", title: "Track 01", artist: "Artista Local" };
      const s3 = { id: "id_gamma", title: "Track 01", artist: "Nube Cloud Track" };

      assert.equal(h.api.getSongCanonicalKey(s1), "id:::id_alpha");
      assert.equal(h.api.getSongCanonicalKey(s2), "id:::id_beta");
      assert.equal(h.api.getSongCanonicalKey(s3), "id:::id_gamma");
    } finally {
      h.dispose();
    }
  });

  it("initializes brand-new local uploads and cloud downloads at 0 without inheriting existing ledger history", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();

    // Seed existing library song AND matching ledger with 50 plays / 7200s
    const existingSong = {
      id: "song_existing_1",
      title: "Neon Horizon",
      artist: "Artist X",
      album: "Album X",
      playCount: 50,
      totalTimeListened: 7200,
      dateAdded: 1000,
    };
    const existingGeneric = {
      id: "song_existing_generic",
      title: "Cloud Gem",
      artist: "Nube Cloud Track",
      playCount: 15,
      totalTimeListened: 2400,
      dateAdded: 1000,
    };
    fakeLS.setItem("spotilocal_cached_songs", JSON.stringify([existingSong, existingGeneric]));
    fakeLS.setItem(
      "song_stats_ledger_v2",
      JSON.stringify({
        canonical: {
          "neon horizon:::artist x": { playCount: 50, totalTimeListened: 7200, title: "Neon Horizon", artist: "Artist X" },
          "cloud gem:::nube cloud track": { playCount: 15, totalTimeListened: 2400, title: "Cloud Gem", artist: "Nube Cloud Track" },
        },
        bySongId: {
          song_existing_1: "neon horizon:::artist x",
        },
      })
    );

    const mp3WithTags = buildId3v23Tag({ title: "Neon Horizon", artist: "Artist X", album: "Single" });
    const cloudMp3NoTags = Buffer.alloc(64, 0xaa);

    const h = await createAppHarness({
      fakeIDB,
      localStorage: fakeLS,
      fetchImpl: async (url) => {
        const u = decodeURIComponent(String(url));
        if (u.includes("Cloud Gem.flac")) {
          return {
            ok: true,
            status: 200,
            blob: async () => new Blob([cloudMp3NoTags], { type: "audio/flac" }),
          };
        }
        return { ok: false, status: 503, json: async () => ({}) };
      },
    });

    try {
      await h.musicDB.saveSong(existingSong, { forceExactStats: true });
      await h.musicDB.saveSong(existingGeneric, { forceExactStats: true });
      await h.api.loadSongsFromDB();

      // Upload a new file with identical title & real artist "Neon Horizon" / "Artist X"
      const uploadedFile = new File([mp3WithTags], "Neon Horizon.mp3", { type: "audio/mpeg" });
      await h.api.handleFilesSelect([uploadedFile]);

      const matchingNeon = h.api.songs.filter(s => s.title === "Neon Horizon" && s.artist === "Artist X");
      assert.equal(matchingNeon.length, 2);
      const newlyUploaded = matchingNeon.find(s => s.id !== "song_existing_1");
      assert.ok(newlyUploaded, "New uploaded song should exist");
      assert.equal(newlyUploaded.playCount, 0);
      assert.equal(newlyUploaded.totalTimeListened, 0);
      assert.equal(newlyUploaded.statsIsolated, true);

      const originalNeon = h.api.songs.find(s => s.id === "song_existing_1");
      assert.equal(originalNeon.playCount, 50);
      assert.equal(originalNeon.totalTimeListened, 7200);

      // Cloud download with generic fallback artist ("Nube Cloud Track") and matching filename "Cloud Gem"
      h.elements.get("cloud-url-input").value = "https://example.com/Cloud Gem.flac";
      const btn = h.elements.get("btn-start-cloud-download");
      await btn.trigger("click");

      const newlyCloud = h.api.songs.find(s => s.title === "Cloud Gem" && s.id !== "song_existing_generic");
      assert.ok(newlyCloud, "Newly downloaded cloud track should exist");
      assert.equal(newlyCloud.playCount, 0);
      assert.equal(newlyCloud.totalTimeListened, 0);
      assert.equal(newlyCloud.statsIsolated, true);
    } finally {
      h.dispose();
    }
  });

  it("untangleLegacySharedGenericLedgerKeys removes empty-artist ':::' buckets and multi-song collisions", async () => {
    const fakeLS = createFakeLocalStorage();
    const h = await createAppHarness({ localStorage: fakeLS });
    try {
      const songs = [
        { id: "g1", title: "Cancion", artist: "Artista Desconocido", playCount: 0, totalTimeListened: 0 },
        { id: "g2", title: "Cancion", artist: "Artista Local", playCount: 0, totalTimeListened: 0 },
        { id: "d1", title: "Dupe", artist: "Band A", playCount: 3, totalTimeListened: 300 },
        { id: "d2", title: "Dupe", artist: "Band A", playCount: 0, totalTimeListened: 0 },
      ];
      h.api.songs = songs;

      const poisonedLedger = {
        canonical: {
          "cancion:::": { playCount: 80, totalTimeListened: 18000, title: "Cancion", artist: "" },
          "cancion:::artista desconocido": { playCount: 40, totalTimeListened: 9000 },
          "dupe:::band a": { playCount: 99, totalTimeListened: 50000 },
          "valid:::unique artist": { playCount: 12, totalTimeListened: 2400 },
        },
        bySongId: {
          g1: "cancion:::",
          g2: "cancion:::artista desconocido",
          d1: "dupe:::band a",
          d2: "dupe:::band a",
          u1: "valid:::unique artist",
        },
      };

      const res = h.api.untangleLegacySharedGenericLedgerKeys(poisonedLedger, songs);
      assert.equal(res.changed, true);
      assert.equal("cancion:::" in poisonedLedger.canonical, false);
      assert.equal("cancion:::artista desconocido" in poisonedLedger.canonical, false);
      assert.equal("dupe:::band a" in poisonedLedger.canonical, false);
      assert.deepEqual(poisonedLedger.canonical["valid:::unique artist"], { playCount: 12, totalTimeListened: 2400 });
      assert.equal(songs.find(s => s.id === "d1").statsIsolated, true);
      assert.equal(songs.find(s => s.id === "d2").statsIsolated, true);
      assert.equal(res.multiRefSongs.has("d1"), true);
      assert.equal(res.multiRefSongs.has("d2"), true);
      assert.equal(res.hadEmptyBucketSongs.has("g1"), true);
      assert.equal(res.hadEmptyBucketSongs.has("g2"), true);
    } finally {
      h.dispose();
    }
  });

  it("sanitizeCorruptedSongStats repairs sub-10h corrupted stats & impossible playCounts while leaving legitimate stats untouched", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();

    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS });
    try {
      const now = Date.now();
      // Logs only support 180s / 1 play for s_sub10h, and 3600s / 20 plays for s_legit
      const logs = [
        { songId: "s_sub10h", seconds: 180, scrobbles: 1, timestamp: now - 500000 },
        { songId: "s_legit", seconds: 3600, scrobbles: 20, timestamp: now - 400000 },
      ];
      fakeLS.setItem("spotilocal_listening_logs", JSON.stringify(logs));
      await h.musicDB.setSetting("listeningLogs", logs);
      await h.api.restoreListeningLogsFromDB();

      const sSub10h = {
        id: "s_sub10h",
        title: "Sub 10h Corrupted",
        artist: "Artista X",
        duration: 180,
        playCount: 90,
        totalTimeListened: 18000, // 5 hours (< 10h threshold!), completely mismatched with logs (180s) & impossible density
      };
      const sImpossiblePlays = {
        id: "s_bad_plays",
        title: "Bad PlayCount",
        artist: "Artista Y",
        duration: 200,
        playCount: 30, // min plausible time = 30 * 200 * 0.4 = 2400s >> 900s listened
        totalTimeListened: 900,
      };
      const sLegit = {
        id: "s_legit",
        title: "Legitimate Song",
        artist: "Genuine Band",
        duration: 180,
        playCount: 20,
        totalTimeListened: 3600, // matches logs & density cleanly
      };

      const testSongs = [sSub10h, sImpossiblePlays, sLegit];
      h.api.songs = testSongs;
      await h.musicDB.saveSong(sSub10h, { forceExactStats: true });
      await h.musicDB.saveSong(sImpossiblePlays, { forceExactStats: true });
      await h.musicDB.saveSong(sLegit, { forceExactStats: true });

      const repairedCount = await h.api.sanitizeCorruptedSongStats(testSongs);
      assert.ok(repairedCount >= 2, "Both corrupted songs must be repaired");

      // Sub-10h corrupted song repaired down to real log-backed 180s / 1 play
      assert.equal(sSub10h.totalTimeListened, 180);
      assert.equal(sSub10h.playCount, 1);

      // Impossible playCount clamped cleanly without inflating totalTimeListened
      assert.equal(sImpossiblePlays.totalTimeListened, 900);
      assert.ok(sImpossiblePlays.playCount <= 12, `Expected clamped playCount <= 12, got ${sImpossiblePlays.playCount}`);

      // Legitimate song preserved 100% identically
      assert.equal(sLegit.totalTimeListened, 3600);
      assert.equal(sLegit.playCount, 20);
    } finally {
      h.dispose();
    }
  });

  it("coalesceListeningLogs & calculateSongStatsFromLogs preserve exact scrobbles and reject substring/title collisions", async () => {
    const fakeLS = createFakeLocalStorage();
    const h = await createAppHarness({ localStorage: fakeLS });
    try {
      const t0 = Date.now() - 120000;
      const coalesced = h.api.coalesceListeningLogs([
        { songId: "track_1", seconds: 60, scrobbles: 0, timestamp: t0 },
        { songId: "track_1", seconds: 90, scrobbles: 1, timestamp: t0 + 60000 },
        { songId: "track_1", seconds: 70, scrobbles: 1, timestamp: t0 + 120000 },
        { songId: "other_1", seconds: 500, scrobbles: 3, timestamp: t0 + 10000 },
      ]);
      // Entries within coalescing window keep sum of seconds (220) AND exact sum of scrobbles (2)
      const trackEntries = coalesced.filter(e => e.songId === "track_1");
      const sumSecs = trackEntries.reduce((acc, e) => acc + e.seconds, 0);
      const sumScrobbles = trackEntries.reduce((acc, e) => acc + (e.scrobbles || 0), 0);
      assert.equal(sumSecs, 220);
      assert.equal(sumScrobbles, 2);

      // Persist logs and verify strict ID + non-generic artist+title matching
      const testLogs = [
        { songId: "track_1", title: "Love", artist: "Artist A", seconds: 220, scrobbles: 2, timestamp: t0 },
        { songId: "track_2", title: "Love Story (Remix)", artist: "Artist B", seconds: 5000, scrobbles: 20, timestamp: t0 },
        { songId: "track_gen_other", title: "Love", artist: "Artista Desconocido", seconds: 900, scrobbles: 5, timestamp: t0 },
      ];
      fakeLS.setItem("spotilocal_listening_logs", JSON.stringify(testLogs));
      await h.musicDB.setSetting("listeningLogs", testLogs);
      await h.api.restoreListeningLogsFromDB();

      const statsTrack1 = h.api.calculateSongStatsFromLogs("track_1", "Love", "Artist A", 200);
      assert.equal(statsTrack1.totalSeconds, 220);
      assert.equal(statsTrack1.playCount, 2);

      // Generic artist song MUST match ONLY exact songId, never "Love" from another track
      const statsGenNew = h.api.calculateSongStatsFromLogs("track_gen_brandnew", "Love", "Artista Desconocido", 200);
      assert.equal(statsGenNew.totalSeconds, 0);
      assert.equal(statsGenNew.playCount, 0);
    } finally {
      h.dispose();
    }
  });

  it("restoreListeningLogsFromDB & mergeListeningLogSources never double logs across repeated cold starts", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 2 });
    const fakeLS = createFakeLocalStorage();
    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS });

    try {
      const ts = 1700000000000;
      const identicalSnapshot = [
        { songId: "song_m1", seconds: 120, scrobbles: 1, timestamp: ts, startTs: ts - 120000 },
        { songId: "song_m2", seconds: 45, scrobbles: 0, timestamp: ts + 600000, startTs: ts + 555000 },
      ];
      fakeLS.setItem("spotilocal_listening_logs", JSON.stringify(identicalSnapshot));
      await h.musicDB.setSetting("listeningLogs", identicalSnapshot);

      // Merge direct snapshot sources
      const merged = h.api.mergeListeningLogSources(identicalSnapshot, identicalSnapshot);
      const totalM1Merged = merged.filter(l => l.songId === "song_m1").reduce((a, b) => a + b.seconds, 0);
      assert.equal(totalM1Merged, 120);

      // Repeatedly call restoreListeningLogsFromDB() concurrently and sequentially (5 launches)
      await Promise.all([
        h.api.restoreListeningLogsFromDB(),
        h.api.restoreListeningLogsFromDB(),
      ]);
      await h.api.restoreListeningLogsFromDB();
      await h.api.restoreListeningLogsFromDB();
      await h.api.restoreListeningLogsFromDB();

      const restoredLogs = h.api.getListeningLogs();
      const s1Logs = restoredLogs.filter(l => l.songId === "song_m1");
      assert.equal(s1Logs.reduce((a, b) => a + b.seconds, 0), 120);
      assert.equal(s1Logs.reduce((a, b) => a + (b.scrobbles || 0), 0), 1);
      const s2Logs = restoredLogs.filter(l => l.songId === "song_m2");
      assert.equal(s2Logs.reduce((a, b) => a + b.seconds, 0), 45);
    } finally {
      h.dispose();
    }
  });

  it("buffers drained native stats in _unappliedNativeStats when called before songs load and applies cleanly once hydrated", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();

    let nativeQueue = [
      { songId: "s_offline", seconds: 20.25, scrobble: false, timestamp: 1700000010000 },
      { songId: "s_offline", seconds: 22.25, scrobble: true, timestamp: 1700000032250 },
    ];

    const nativeBridgeMock = {
      isPlaying: () => false,
      getState: () => JSON.stringify({ mediaId: "", isPlaying: false }),
      drainListeningStats: () => {
        if (nativeQueue.length === 0) return "[]";
        const out = JSON.stringify(nativeQueue);
        nativeQueue = [];
        return out;
      },
      saveDurableBackup: () => true,
      loadDurableBackup: () => "",
    };

    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS, nativePlayer: nativeBridgeMock });
    try {
      // Simulate drain triggered while library hasn't loaded yet
      h.api.songs = [];
      h.api._libraryInitialHydrationDone = false;

      const appliedEarly = h.api.applyNativeListeningStats();
      assert.equal(appliedEarly, false);
      assert.equal(h.api._unappliedNativeStats.length, 2, "Records must be preserved in _unappliedNativeStats");

      // Now hydrate library
      const track = {
        id: "s_offline",
        title: "Offline Native Track",
        artist: "Artist Z",
        duration: 180,
        playCount: 0,
        totalTimeListened: 0,
      };
      await h.musicDB.saveSong(track, { forceExactStats: true });
      h.api.songs = [track];
      h.api._libraryInitialHydrationDone = true;

      const flushed = h.api.flushUnappliedNativeStats();
      assert.equal(flushed, true);
      assert.equal(h.api._unappliedNativeStats.length, 0);
      assert.equal(track.totalTimeListened, 42.5);
      assert.equal(track.playCount, 1);

      // Allow queued IDB sync to settle and check IDB value
      await new Promise(r => setTimeout(r, 30));
      const inDb = await h.musicDB.getSong("s_offline");
      assert.equal(inDb.totalTimeListened, 42.5);
      assert.equal(inDb.playCount, 1);
    } finally {
      h.dispose();
    }
  });

  it("loadSongsFromDB automatically recovers wiped IndexedDB library with original IDs from NativeBackupStore", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();

    const durableBackup = JSON.stringify({
      schemaVersion: 2,
      appVersion: "1.8.6",
      savedAt: Date.now() - 10000,
      explicitlyCleared: false,
      deletedSongIds: [],
      archivedListenedSeconds: 120,
      songs: [
        {
          id: "orig_id_1",
          title: "Recovered Song One",
          artist: "Artist One",
          album: "Album 1",
          duration: 210,
          playCount: 7,
          totalTimeListened: 1470,
          isLiked: true,
          dateAdded: 1690000000000,
          hasAudioBlob: true,
        },
        {
          id: "orig_id_2",
          title: "Recovered Generic",
          artist: "Artista Desconocido",
          duration: 150,
          playCount: 2,
          totalTimeListened: 300,
          statsIsolated: true,
          dateAdded: 1695000000000,
        },
      ],
      playlists: [{ id: "pl_1", name: "Favoritas Offline", songIds: ["orig_id_1"], totalTimeListened: 500 }],
      listeningLogs: [
        { songId: "orig_id_1", seconds: 1470, scrobbles: 7, timestamp: 1699000000000 },
      ],
      statsLedger: {
        "recovered song one:::artist one": { playCount: 7, totalTimeListened: 1470 },
        "id:::orig_id_2": { playCount: 2, totalTimeListened: 300 },
      },
    });

    const nativeBridgeMock = {
      isPlaying: () => false,
      getState: () => JSON.stringify({ mediaId: "", isPlaying: false }),
      drainListeningStats: () => "[]",
      loadDurableBackup: () => durableBackup,
      saveDurableBackup: () => true,
      hasLocalAudio: (key) => key === "orig_id_1" || key === "orig_id_2",
      getLocalAudioInfo: (key) => JSON.stringify(
        key === "orig_id_1" || key === "orig_id_2"
          ? { exists: true, name: `${key}.mp3`, size: 65536 }
          : { exists: false }
      ),
    };

    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS, nativePlayer: nativeBridgeMock });
    try {
      // Boot ran loadSongsFromDB() with wiped IDB + wiped LS + no server -> should have recovered from durableBackup
      const ids = Array.from(h.api.songs.map(s => s.id)).sort();
      assert.deepEqual(ids, ["orig_id_1", "orig_id_2"]);

      const r1 = h.api.songs.find(s => s.id === "orig_id_1");
      assert.equal(r1.playCount, 7);
      assert.equal(r1.totalTimeListened, 1470);
      assert.equal(r1.isLiked, true);

      const r2 = h.api.songs.find(s => s.id === "orig_id_2");
      assert.equal(r2.playCount, 2);
      assert.equal(r2.totalTimeListened, 300);
      assert.equal(r2.statsIsolated, true);

      // Verify persisted back into IndexedDB
      const db1 = await h.musicDB.getSong("orig_id_1");
      assert.equal(db1.playCount, 7);
      assert.equal(db1.totalTimeListened, 1470);
    } finally {
      h.dispose();
    }
  });

  it("deleteSong cleanly removes song + native local audio without ReferenceError and adjusts currentSongIndex", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();
    const deletedAudioCalls = [];
    const savedBackups = [];

    const nativeBridgeMock = {
      isPlaying: () => false,
      getState: () => JSON.stringify({ mediaId: "", isPlaying: false }),
      drainListeningStats: () => "[]",
      deleteLocalAudio: (key) => { deletedAudioCalls.push(key); return true; },
      saveDurableBackup: (json) => { savedBackups.push(json); return true; },
      loadDurableBackup: () => "",
      pause: () => {},
    };

    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS, nativePlayer: nativeBridgeMock });
    try {
      const s0 = { id: "s0", title: "Zero", artist: "A0", duration: 100, playCount: 1, totalTimeListened: 100 };
      const s1 = { id: "s1", title: "One", artist: "A1", duration: 100, playCount: 2, totalTimeListened: 200 };
      const s2 = { id: "s2", title: "Two", artist: "A2", duration: 100, playCount: 3, totalTimeListened: 300 };

      await h.musicDB.saveSong(s0, { forceExactStats: true });
      await h.musicDB.saveSong(s1, { forceExactStats: true });
      await h.musicDB.saveSong(s2, { forceExactStats: true });
      await h.api.loadSongsFromDB();

      h.api.songs = [s0, s1, s2];
      h.api.currentQueue = [s0, s1, s2];
      h.api.currentSongIndex = 1; // Playing "s1"

      // Delete "s0" (before currentSongIndex): index should shift from 1 to 0, still pointing to "s1"
      await h.api.deleteSong("s0");
      assert.equal(h.api.currentSongIndex, 0);
      assert.equal(h.api.currentQueue[h.api.currentSongIndex].id, "s1");
      assert.ok(deletedAudioCalls.includes("s0"), "deleteLocalAudio should be invoked for s0");
      assert.equal(await h.musicDB.getSong("s0"), null);

      // Delete currently playing "s1": should execute without ReferenceError and flush backup
      await h.api.deleteSong("s1");
      assert.equal(h.api.songs.length, 1);
      assert.equal(h.api.songs[0].id, "s2");
      assert.ok(deletedAudioCalls.includes("s1"));
      assert.ok(savedBackups.length >= 1);
    } finally {
      h.dispose();
    }
  });

  it("saveEditedMetadata updates active playing track without ReferenceError and preserves exact stats", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();
    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS });
    try {
      const s = {
        id: "edit_s1",
        title: "Old Title",
        artist: "Artista Desconocido",
        album: "Old Album",
        playCount: 4,
        totalTimeListened: 620,
        statsIsolated: true,
        dateAdded: 1000,
      };
      await h.musicDB.saveSong(s, { forceExactStats: true });
      h.api.songs = [s];
      h.api.currentQueue = [{ ...s }];
      h.api.currentSongIndex = 0;

      // Open edit modal state for active song & click save
      h.api.editingSongId = "edit_s1";
      h.elements.get("edit-title-input").value = "New Title";
      h.elements.get("edit-artist-input").value = "New Artist";
      h.elements.get("edit-album-input").value = "New Album";
      await h.elements.get("btn-save-edit-meta").trigger("click");

      assert.equal(h.api.songs[0].title, "New Title");
      assert.equal(h.api.songs[0].artist, "New Artist");
      assert.equal(h.api.currentQueue[0].title, "New Title");
      assert.equal(h.api.songs[0].playCount, 4);
      assert.equal(h.api.songs[0].totalTimeListened, 620);

      await h.api.toggleLikeSong("edit_s1");
      assert.equal(h.api.songs[0].isLiked, true);
      assert.equal(h.api.currentQueue[0].isLiked, true);
    } finally {
      h.dispose();
    }
  });

  it("applyExternalBackupPayload respects explicitlyCleared=true and handles repeated applyNativeListeningStats batches atomically", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 2 });
    const fakeLS = createFakeLocalStorage();
    let drainCall = 0;
    const nativeBridgeMock = {
      isPlaying: () => true,
      getState: () => JSON.stringify({ mediaId: "b_s1", isPlaying: true, positionMs: 15000, durationMs: 180000 }),
      drainListeningStats: () => {
        drainCall++;
        if (drainCall === 1) {
          return JSON.stringify([
            { songId: "b_s1", seconds: 10.5, scrobble: false, timestamp: 1700001000000 },
            { songId: "b_s1", seconds: 12.5, scrobble: true, timestamp: 1700001012500 },
          ]);
        }
        return "[]";
      },
      saveDurableBackup: () => true,
      loadDurableBackup: () => JSON.stringify({
        version: 2,
        explicitlyCleared: true,
        songs: [],
      }),
    };

    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS, nativePlayer: nativeBridgeMock });
    try {
      const s = { id: "b_s1", title: "Batch Track", artist: "Batch Artist", duration: 180, playCount: 1, totalTimeListened: 30 };
      await h.musicDB.saveSong(s, { forceExactStats: true });
      h.api.songs = [s];
      h.api._libraryInitialHydrationDone = true;

      // Draining batch 1 applies +23.0s and +1 play once
      assert.equal(h.api.applyNativeListeningStats(), true);
      // Subsequent drain with empty native queue is a no-op
      assert.equal(h.api.applyNativeListeningStats(), false);

      assert.equal(s.totalTimeListened, 53);
      assert.equal(s.playCount, 2);

      await new Promise(r => setTimeout(r, 40));
      const stored = await h.musicDB.getSong("b_s1");
      assert.equal(stored.totalTimeListened, 53);
      assert.equal(stored.playCount, 2);
    } finally {
      h.dispose();
    }
  });

  it("untangles artist:::title canonical ledger collisions via sanitizeCorruptedSongStats and repairs sub-30m inflation", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();
    const now = Date.now();
    const logs = [
      { songId: "col_1", seconds: 60, scrobbles: 0, timestamp: now - 300000 },
      { songId: "sub30_song", seconds: 60, scrobbles: 0, timestamp: now - 200000 },
    ];
    fakeLS.setItem("spotilocal_listening_logs", JSON.stringify(logs));
    fakeLS.setItem("spotilocal_song_ledger_v2", JSON.stringify({
      canonical: {
        "varios artistas:::mi tema": { playCount: 40, totalTimeListened: 9000 },
        "artista real:::mismo titulo": { playCount: 18, totalTimeListened: 4200 },
        "banda unica:::tema limpio": { playCount: 4, totalTimeListened: 800 },
      },
      bySongId: {
        col_1: "artista real:::mismo titulo",
        col_2: "artista real:::mismo titulo",
        clean_1: "banda unica:::tema limpio",
      },
    }));

    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS });
    try {
      assert.equal(h.api.isUnsafeSharedCanonicalKey("varios artistas:::mi tema"), true);
      assert.equal(h.api.isUnsafeSharedCanonicalKey("artista real:::mismo titulo"), false);

      const c1 = { id: "col_1", title: "Mismo Titulo", artist: "Artista Real", duration: 200, playCount: 18, totalTimeListened: 4200, dateAdded: now - 50000 };
      const c2 = { id: "col_2", title: "Mismo Titulo", artist: "Artista Real", duration: 200, playCount: 0, totalTimeListened: 0, dateAdded: now - 10000 };
      const sub30 = { id: "sub30_song", title: "Inflado Menor 30m", artist: "Otro Artista", duration: 200, playCount: 2, totalTimeListened: 600, dateAdded: now - 50000 };
      await h.musicDB.saveSong(c1, { forceExactStats: true });
      await h.musicDB.saveSong(c2, { forceExactStats: true });
      await h.musicDB.saveSong(sub30, { forceExactStats: true });

      const repaired = await h.api.sanitizeCorruptedSongStats([c1, c2, sub30]);
      assert.ok(repaired >= 2);
      assert.equal(c1.statsIsolated, true);
      assert.equal(c2.statsIsolated, true);
      assert.equal(c1.totalTimeListened, 60);
      assert.equal(sub30.totalTimeListened, 60);

      const ledger = h.api.getSongStatsLedger();
      assert.equal("varios artistas:::mi tema" in ledger.canonical, false);
      assert.equal("artista real:::mismo titulo" in ledger.canonical, false);
      assert.deepEqual(ledger.canonical["banda unica:::tema limpio"], { playCount: 4, totalTimeListened: 800 });
      assert.equal((await h.musicDB.getSong("col_2")).statsIsolated, true);
    } finally {
      h.dispose();
    }
  });

  it("ignores deleted song stats on native drain and persists pre-hydration buffered stats across WebView reloads", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();

    let drainPayload = [
      { songId: "s_deleted", seconds: 45, scrobble: true, timestamp: 1700000100000 },
      { songId: "s_buffered", seconds: 19.5, scrobble: true, timestamp: 1700000200000 },
    ];
    const npMock = {
      isPlaying: () => false,
      getState: () => JSON.stringify({ mediaId: "", isPlaying: false }),
      drainListeningStats: () => {
        const out = JSON.stringify(drainPayload);
        drainPayload = [];
        return out;
      },
      saveDurableBackup: () => true,
      loadDurableBackup: () => "",
    };

    const h1 = await createAppHarness({ fakeIDB, localStorage: fakeLS, nativePlayer: npMock });
    try {
      const delSong = { id: "s_deleted", title: "Deleted", artist: "Del", duration: 180, playCount: 0, totalTimeListened: 0 };
      const keepSong = { id: "s_buffered", title: "Buffered", artist: "Keep", duration: 180, playCount: 0, totalTimeListened: 0 };
      await h1.musicDB.saveSong(delSong, { forceExactStats: true });
      await h1.musicDB.saveSong(keepSong, { forceExactStats: true });
      h1.api.songs = [delSong, keepSong];
      h1.api.currentQueue = [delSong, keepSong];
      await h1.api.deleteSong("s_deleted");

      // Simulate reload hitting native drain BEFORE library finishes hydrating
      h1.api.songs = [];
      h1.api.currentQueue = [];
      h1.api._libraryInitialHydrationDone = false;
      h1.api.applyNativeListeningStats();

      // Deleted song MUST be ignored; keepSong MUST be persisted to localStorage
      assert.equal(h1.api._unappliedNativeStats.length, 1);
      assert.equal(h1.api._unappliedNativeStats[0].songId, "s_buffered");
      const persistedRaw = fakeLS.getItem("spotilocal_unapplied_native_stats");
      assert.ok(persistedRaw && persistedRaw.includes("s_buffered"));
    } finally {
      h1.dispose();
    }

    // Simulated WebView restart: native drain returns empty now, persisted localStorage applies to hydrated keepSong!
    const h2 = await createAppHarness({ fakeIDB, localStorage: fakeLS, nativePlayer: npMock });
    try {
      const hydratedKeep = h2.api.songs.find(s => s.id === "s_buffered");
      assert.ok(hydratedKeep);
      assert.equal(hydratedKeep.totalTimeListened, 19.5);
      assert.equal(hydratedKeep.playCount, 1);
      assert.equal(fakeLS.getItem("spotilocal_unapplied_native_stats"), null);
    } finally {
      h2.dispose();
    }
  });

  it("prevents early NativeBackupStore load from re-inflating sanitized IDB and calls 2-arg hasLocalAudio cleanly", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();

    // Seed clean sanitized IDB song first (before loadSongsFromDB)
    {
      const tmp = await createAppHarness({ fakeIDB, localStorage: fakeLS });
      await tmp.musicDB.saveSong(
        { id: "orig_id_1", title: "Sanitized One", artist: "Artist One", duration: 200, playCount: 2, totalTimeListened: 300, hasAudioBlob: true, dateAdded: 1700000000000 },
        { forceExactStats: true }
      );
      tmp.dispose();
    }

    const hasLocalAudioCalls = [];
    const staleBackupWithExtraSong = JSON.stringify({
      version: 2,
      updatedAt: Date.now() - 5000,
      songs: [
        { id: "orig_id_1", title: "Sanitized One", artist: "Artist One", duration: 200, playCount: 99, totalTimeListened: 50000, hasAudioBlob: true },
        { id: "orig_id_2", title: "Offline Native Two", artist: "Artist Two", duration: 180, nativeAudioExt: "flac", playCount: 3, totalTimeListened: 540, hasAudioBlob: true },
      ],
      listeningLogs: [
        { songId: "orig_id_1", seconds: 300, scrobbles: 2, timestamp: 1700000010000 },
      ],
    });

    const npMock = {
      isPlaying: () => false,
      getState: () => JSON.stringify({ mediaId: "", isPlaying: false }),
      drainListeningStats: () => "[]",
      loadDurableBackup: () => staleBackupWithExtraSong,
      saveDurableBackup: () => true,
      hasLocalAudio: (key, ext) => {
        hasLocalAudioCalls.push([key, ext]);
        return key === "orig_id_2" && typeof ext === "string";
      },
    };

    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS, nativePlayer: npMock });
    try {
      const s1 = h.api.songs.find(s => s.id === "orig_id_1");
      const s2 = h.api.songs.find(s => s.id === "orig_id_2");
      assert.ok(s1 && s2);
      assert.equal(s1.playCount, 2, "Early backup step must not re-inflate sanitized IDB song");
      assert.equal(s1.totalTimeListened, 300);
      assert.equal(s2.playCount, 3, "Missing song must still recover from backup via 2-arg hasLocalAudio");
      assert.ok(hasLocalAudioCalls.some(([k, e]) => k === "orig_id_2" && e === "flac"));

      // Manual JSON import must restore higher stats from imported backup into existing 0-stats canonical ledger
      await h.api.applyExternalBackupPayload({
        songStatsLedgerV2: {
          canonical: { "artist one:::sanitized one": { playCount: 8, totalTimeListened: 1600 } },
          bySongId: { orig_id_1: "artist one:::sanitized one" },
        },
      }, { allowStatsRestore: true });
      const merged = h.api.getSongLedgerStats(s1);
      assert.equal(merged.playCount, 8);
      assert.equal(merged.totalTimeListened, 1600);
    } finally {
      h.dispose();
    }
  });

  it("isolates HTML5 track-switch listening time and resets Repeat-One scrobble via ended without audioElement.loop", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();
    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS });
    try {
      const sA = { id: "html_a", title: "Track A", artist: "Artist A", duration: 100, audioUrl: "http://localhost:3000/songs/a.mp3", playCount: 0, totalTimeListened: 0 };
      const sB = { id: "html_b", title: "Track B", artist: "Artist B", duration: 100, audioUrl: "http://localhost:3000/songs/b.mp3", playCount: 0, totalTimeListened: 0 };
      await h.musicDB.saveSong(sA, { forceExactStats: true });
      await h.musicDB.saveSong(sB, { forceExactStats: true });
      h.api.songs = [sA, sB];
      h.api.currentQueue = [sA, sB];
      h.api.unshuffledQueue = [sA, sB];
      h.api.currentSongIndex = 0;
      h.api.isPlaying = true;
      h.api._libraryInitialHydrationDone = true;

      // Simulate 1.8s elapsed on Track A (under periodic 3s flush threshold!)
      h.api.audioElement.duration = 100;
      h.api.audioElement.currentTime = 10;
      await h.api.audioElement.trigger("timeupdate");
      h.api.audioElement.currentTime = 11.8;
      await h.api.audioElement.trigger("timeupdate");
      assert.ok(h.api.currentSongListenedSeconds >= 1.7);

      // Jump directly to Track B via playSongById -> Track A's 1.8s MUST flush to sA and NOT bleed to sB
      await h.api.playSongById("html_b", [sA, sB]);
      assert.equal(sA.totalTimeListened, 1.8);
      assert.equal(sB.totalTimeListened, 0);
      assert.equal(h.api.currentSongListenedSeconds, 0);
      assert.equal(h.api.lastTimeUpdate, 0);

      // Enable Repeat-One: audioElement.loop MUST remain false so 'ended' resets scrobble per play
      h.api.toggleRepeat();
      assert.equal(h.api.repeatMode, 2);
      assert.equal(Boolean(h.api.audioElement.loop), false);

      // Cross 50% on Play #1 -> scrobbles once -> fire ended -> must reset hasScrobbledCurrentPlay
      h.api.audioElement.duration = 100;
      h.api.audioElement.currentTime = 52;
      await h.api.audioElement.trigger("timeupdate");
      assert.equal(sB.playCount, 1);
      assert.equal(h.api.hasScrobbledCurrentPlay, true);

      await h.api.audioElement.trigger("ended");
      assert.equal(h.api.hasScrobbledCurrentPlay, false);

      // Play #2 crosses 50% -> scrobbles second time cleanly
      h.api.audioElement.currentTime = 55;
      await h.api.audioElement.trigger("timeupdate");
      assert.equal(sB.playCount, 2);
    } finally {
      h.dispose();
    }
  });

  it("guards edit-metadata rename collisions, cleans playlists & unshuffledQueue on delete, and supports exportDatabase/clearDatabase", async () => {
    const fakeIDB = createFakeIndexedDB({ jitterMaxMs: 1 });
    const fakeLS = createFakeLocalStorage();
    const exportedCalls = [];
    const savedBackups = [];
    let stoppedCount = 0;
    let clearedNativeAudioCount = 0;

    const npMock = {
      isPlaying: () => false,
      getState: () => JSON.stringify({ mediaId: "", isPlaying: false }),
      drainListeningStats: () => "[]",
      saveDurableBackup: (json) => { savedBackups.push(JSON.parse(json)); return true; },
      loadDurableBackup: () => "",
      deleteLocalAudio: () => true,
      clearAllLocalAudio: () => { clearedNativeAudioCount++; return true; },
      stop: () => { stoppedCount++; },
      exportBackupToDownloads: (fn, json) => { exportedCalls.push({ fn, data: JSON.parse(json) }); return `Descargas/SpotiLocal/${fn}`; },
    };

    const h = await createAppHarness({ fakeIDB, localStorage: fakeLS, nativePlayer: npMock });
    try {
      const existing = { id: "real_1", title: "Real Song", artist: "Real Artist", album: "A1", playCount: 25, totalTimeListened: 4000 };
      const renamed = { id: "gen_1", title: "Sin identificar 1", artist: "Artista Desconocido", album: "", playCount: 0, totalTimeListened: 0, needsReview: true };
      await h.musicDB.saveSong(existing, { forceExactStats: true });
      await h.musicDB.saveSong(renamed, { forceExactStats: true });
      h.api.recordSongLedgerMonotonic(existing, 0, 0, true);
      await h.musicDB.savePlaylist({ id: "pl_1", name: "PL", songIds: ["gen_1", "real_1"] });
      h.api.playlists = await h.musicDB.getAllPlaylists();
      h.api.songs = [existing, renamed];
      h.api.currentQueue = [existing, renamed];
      h.api.unshuffledQueue = [existing, renamed];
      h.api.currentSongIndex = 0;

      // Rename gen_1 to collide with existing "Real Artist:::Real Song" -> MUST isolate gen_1 without clobbering existing!
      h.api.editingSongId = "gen_1";
      h.elements.get("edit-title-input").value = "Real Song";
      h.elements.get("edit-artist-input").value = "Real Artist";
      h.elements.get("edit-album-input").value = "Edited";
      await h.elements.get("btn-save-edit-meta").trigger("click");

      assert.equal(renamed.needsReview, false);
      assert.equal(renamed.statsIsolated, true);
      assert.equal(renamed.playCount, 0);
      assert.equal(h.api.getSongLedgerStats(existing).playCount, 25);
      assert.equal(h.api.getSongLedgerStats(existing).totalTimeListened, 4000);

      // Export backup via native downloads bridge
      await h.ctx.window.exportDatabase();
      assert.equal(exportedCalls.length, 1);
      assert.equal(exportedCalls[0].data.songs.find(s => s.id === "real_1").playCount, 25);

      // Delete both songs -> playlists + unshuffledQueue cleaned and native stop() called when queue becomes empty
      await h.api.deleteSong("gen_1");
      assert.deepEqual(h.api.playlists[0].songIds, ["real_1"]);
      assert.equal(h.api.unshuffledQueue.some(s => s.id === "gen_1"), false);
      await h.api.deleteSong("real_1");
      assert.ok(stoppedCount >= 1);

      // clearDatabase wipes IDB, localStorage, native audio, and persists explicitlyCleared=true
      await h.ctx.window.clearDatabase();
      assert.equal(clearedNativeAudioCount, 1);
      assert.ok(fakeIDB.deleteDatabaseCalls >= 1);
      assert.equal(savedBackups[savedBackups.length - 1].explicitlyCleared, true);
    } finally {
      h.dispose();
    }
  });
});
