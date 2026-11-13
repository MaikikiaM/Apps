/**
 * IndexedDB Wrapper for SpotiLocal Music Player
 * Handles offline storage for Audio Blobs, Metadata, Playlists, Lyrics, and Settings.
 * Version 2: Separates heavy FLAC Audio Blobs into 'song_blobs' to guarantee 0ms metadata reads.
 */
class MusicDB {
  constructor() {
    this.dbName = "SpotiLocalDB";
    this.version = 2;
    this.db = null;
    this._initPromise = null;
    this._songWriteQueues = new Map();
    this._settingWriteQueues = new Map();
    this._playlistWriteQueues = new Map();
  }

  _enqueuePlaylistWrite(playlistId, taskFn) {
    if (!playlistId) return Promise.resolve().then(taskFn);
    const key = String(playlistId);
    const prev = this._playlistWriteQueues.get(key) || Promise.resolve();
    const next = prev.then(() => taskFn(), () => taskFn());
    const tracked = next.catch(() => {});
    this._playlistWriteQueues.set(key, tracked);
    tracked.then(() => {
      if (this._playlistWriteQueues.get(key) === tracked) {
        this._playlistWriteQueues.delete(key);
      }
    });
    return next;
  }

  _enqueueSongWrite(songId, taskFn) {
    if (!songId) return Promise.resolve().then(taskFn);
    const key = String(songId);
    const prev = this._songWriteQueues.get(key) || Promise.resolve();
    const next = prev.then(() => taskFn(), () => taskFn());
    const tracked = next.catch(() => {});
    this._songWriteQueues.set(key, tracked);
    tracked.then(() => {
      if (this._songWriteQueues.get(key) === tracked) {
        this._songWriteQueues.delete(key);
      }
    });
    return next;
  }

  _enqueueSettingWrite(settingKey, taskFn) {
    const key = String(settingKey || "__default");
    const prev = this._settingWriteQueues.get(key) || Promise.resolve();
    const next = prev.then(() => taskFn(), () => taskFn());
    const tracked = next.catch(() => {});
    this._settingWriteQueues.set(key, tracked);
    tracked.then(() => {
      if (this._settingWriteQueues.get(key) === tracked) {
        this._settingWriteQueues.delete(key);
      }
    });
    return next;
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {}
      this.db = null;
    }
    this._initPromise = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = indexedDB.open(this.dbName, this.version);
      } catch (err) {
        this._initPromise = null;
        reject(err);
        return;
      }

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Songs Store (Lightweight metadata)
        if (!db.objectStoreNames.contains("songs")) {
          const songStore = db.createObjectStore("songs", { keyPath: "id" });
          songStore.createIndex("title", "title", { unique: false });
          songStore.createIndex("artist", "artist", { unique: false });
          songStore.createIndex("album", "album", { unique: false });
          songStore.createIndex("isLiked", "isLiked", { unique: false });
          songStore.createIndex("dateAdded", "dateAdded", { unique: false });
        }

        // Dedicated Audio Blobs Store (Separated from metadata to prevent RAM bloat and UI freezing)
        if (!db.objectStoreNames.contains("song_blobs")) {
          db.createObjectStore("song_blobs", { keyPath: "id" });
        }

        // Playlists Store
        if (!db.objectStoreNames.contains("playlists")) {
          db.createObjectStore("playlists", { keyPath: "id" });
        }

        // Lyrics Store (.lrc text)
        if (!db.objectStoreNames.contains("lyrics")) {
          db.createObjectStore("lyrics", { keyPath: "songId" });
        }

        // Settings Store
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };

      request.onsuccess = (e) => {
        const db = e.target.result;
        this.db = db;
        try {
          db.onversionchange = () => {
            try { db.close(); } catch (err) {}
            if (this.db === db) {
              this.db = null;
              this._initPromise = null;
            }
          };
          db.onclose = () => {
            if (this.db === db) {
              this.db = null;
              this._initPromise = null;
            }
          };
        } catch (err) {}
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error("IndexedDB error:", e);
        this._initPromise = null;
        reject(e);
      };
    });

    return this._initPromise;
  }

  async saveSong(song, options = {}) {
    if (!song || !song.id) return null;
    await this.init();
    return this._enqueueSongWrite(song.id, () => this._saveSongUnlocked(song, options));
  }

  _saveSongUnlocked(song, options = {}) {
    const forceExact = Boolean((options && options.forceExactStats) || song._forceExactStats);
    const cleanSong = { ...song };
    delete cleanSong._forceExactStats;
    return new Promise((resolve, reject) => {
      try {
        const hasBlobsStore = this.db.objectStoreNames.contains("song_blobs");
        const storeNames = hasBlobsStore ? ["songs", "song_blobs"] : ["songs"];
        const tx = this.db.transaction(storeNames, "readwrite");
        const songStore = tx.objectStore("songs");
        const blobStore = hasBlobsStore ? tx.objectStore("song_blobs") : null;
        let settled = false;
        const fail = (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        };

        const getReq = songStore.get(cleanSong.id);
        getReq.onsuccess = () => {
          try {
            const existing = getReq.result || {};
            let targetBlob = (cleanSong.audioBlob instanceof Blob) ? cleanSong.audioBlob : null;
            if (!targetBlob && (existing.audioBlob instanceof Blob)) {
              targetBlob = existing.audioBlob;
            }

            if (blobStore && targetBlob) {
              // blobStore.put handled after tx handlers attached
            }

            const safeTotalTime = forceExact
              ? Math.max(0, Number(cleanSong.totalTimeListened) || 0)
              : Math.max(
                  Number(existing.totalTimeListened) || 0,
                  Number(cleanSong.totalTimeListened) || 0
                );
            const safePlayCount = forceExact
              ? Math.max(0, Number(cleanSong.playCount) || 0)
              : Math.max(
                  Number(existing.playCount) || 0,
                  Number(cleanSong.playCount) || 0
                );

            const forceExactLike = Boolean(forceExact || (options && options.updateLike));
            const safeLiked = (existing && existing.id && !forceExactLike && typeof existing.isLiked === "boolean")
              ? Boolean(existing.isLiked)
              : Boolean(cleanSong.isLiked);

            const hasAudio = Boolean(targetBlob || existing.hasAudioBlob || cleanSong.hasAudioBlob);
            const metaRecord = {
              ...existing,
              ...cleanSong,
              isLiked: safeLiked,
              totalTimeListened: Math.round(safeTotalTime * 100) / 100,
              playCount: safePlayCount,
              audioBlob: (hasBlobsStore ? null : (targetBlob || null)),
              hasAudioBlob: hasAudio,
              coverBlob: cleanSong.coverBlob || existing.coverBlob || null
            };

            tx.oncomplete = () => {
              if (!settled) {
                settled = true;
                resolve(metaRecord);
              }
            };
            tx.onerror = (e) => fail(tx.error || e);
            tx.onabort = (e) => fail(tx.error || e || new Error("IndexedDB transaction aborted"));

            if (blobStore && targetBlob) {
              const blobPutReq = blobStore.put({ id: cleanSong.id, audioBlob: targetBlob });
              blobPutReq.onerror = (e) => fail(blobPutReq.error || tx.error || e);
            }

            const putReq = songStore.put(metaRecord);
            putReq.onerror = (e) => fail(putReq.error || tx.error || e);
          } catch (innerErr) {
            try { if (typeof tx.abort === "function") tx.abort(); } catch (_) {}
            fail(innerErr);
          }
        };
        getReq.onerror = (e) => fail(getReq.error || tx.error || e);
      } catch (err) {
        reject(err);
      }
    });
  }

  async saveSongMeta(song, options = {}) {
    if (!song || !song.id) return null;
    await this.init();
    return this._enqueueSongWrite(song.id, () => this._saveSongMetaUnlocked(song, options));
  }

  _saveSongMetaUnlocked(song, options = {}) {
    const forceExact = Boolean((options && options.forceExactStats) || song._forceExactStats);
    const cleanSong = { ...song };
    delete cleanSong._forceExactStats;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction("songs", "readwrite");
        const store = tx.objectStore("songs");
        let settled = false;
        const fail = (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        };
        const getReq = store.get(cleanSong.id);
        getReq.onsuccess = () => {
          try {
            const existing = getReq.result || {};
            const safeTotalTime = forceExact
              ? Math.max(0, Number(cleanSong.totalTimeListened) || 0)
              : Math.max(
                  Number(existing.totalTimeListened) || 0,
                  Number(cleanSong.totalTimeListened) || 0
                );
            const safePlayCount = forceExact
              ? Math.max(0, Number(cleanSong.playCount) || 0)
              : Math.max(
                  Number(existing.playCount) || 0,
                  Number(cleanSong.playCount) || 0
                );
            const forceExactLike = Boolean(forceExact || (options && options.updateLike));
            const safeLiked = (existing && existing.id && !forceExactLike && typeof existing.isLiked === "boolean")
              ? Boolean(existing.isLiked)
              : Boolean(cleanSong.isLiked);
            const metaRecord = {
              ...existing,
              ...cleanSong,
              isLiked: safeLiked,
              totalTimeListened: Math.round(safeTotalTime * 100) / 100,
              playCount: safePlayCount,
              audioBlob: null,
              hasAudioBlob: Boolean(cleanSong.hasAudioBlob || existing.hasAudioBlob || (existing.audioBlob instanceof Blob)),
              coverBlob: cleanSong.coverBlob || existing.coverBlob || null
            };
            tx.oncomplete = () => {
              if (!settled) {
                settled = true;
                resolve(metaRecord);
              }
            };
            tx.onerror = (e) => fail(tx.error || e);
            tx.onabort = (e) => fail(tx.error || e || new Error("IndexedDB transaction aborted"));
            const putReq = store.put(metaRecord);
            putReq.onerror = (e) => fail(putReq.error || tx.error || e);
          } catch (innerErr) {
            try { if (typeof tx.abort === "function") tx.abort(); } catch (_) {}
            fail(innerErr);
          }
        };
        getReq.onerror = (e) => fail(getReq.error || tx.error || e);
      } catch (err) {
        reject(err);
      }
    });
  }

  async saveSongBlob(id, audioBlob) {
    if (!id || !(audioBlob instanceof Blob) || audioBlob.size <= 0) return false;
    await this.init();
    return this._enqueueSongWrite(id, () => new Promise((resolve) => {
      try {
        const hasBlobsStore = this.db.objectStoreNames.contains("song_blobs");
        const storeNames = hasBlobsStore ? ["songs", "song_blobs"] : ["songs"];
        const tx = this.db.transaction(storeNames, "readwrite");
        const songStore = tx.objectStore("songs");
        if (hasBlobsStore) {
          tx.objectStore("song_blobs").put({ id, audioBlob });
        }
        const getReq = songStore.get(id);
        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (existing) {
            existing.hasAudioBlob = true;
            if (hasBlobsStore) existing.audioBlob = null;
            else existing.audioBlob = audioBlob;
            songStore.put(existing);
          }
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    }));
  }

  async getAudioBlob(id) {
    if (!id) return null;
    await this.init();
    return new Promise((resolve) => {
      try {
        if (this.db.objectStoreNames.contains("song_blobs")) {
          const tx = this.db.transaction("song_blobs", "readonly");
          const store = tx.objectStore("song_blobs");
          const req = store.get(id);
          req.onsuccess = () => {
            if (req.result && req.result.audioBlob instanceof Blob) {
              resolve(req.result.audioBlob);
            } else {
              this.getLegacyAudioBlob(id).then(resolve);
            }
          };
          req.onerror = () => this.getLegacyAudioBlob(id).then(resolve);
        } else {
          this.getLegacyAudioBlob(id).then(resolve);
        }
      } catch (e) {
        resolve(null);
      }
    });
  }

  async getLegacyAudioBlob(id) {
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction("songs", "readonly");
        const store = tx.objectStore("songs");
        const req = store.get(id);
        req.onsuccess = () => {
          resolve((req.result && req.result.audioBlob instanceof Blob) ? req.result.audioBlob : null);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async getAllSongs() {
    try {
      await this.init();
      const keys = await new Promise((resolve) => {
        try {
          const tx = this.db.transaction("songs", "readonly");
          const store = tx.objectStore("songs");
          const req = store.getAllKeys();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });

      if (!keys || keys.length === 0) return [];

      // Read record-by-record so Chromium/WebView IPC size limits never cause getAll() to fail with []
      const list = [];
      for (const key of keys) {
        const item = await new Promise((resolveItem) => {
          try {
            const tx = this.db.transaction("songs", "readonly");
            const req = tx.objectStore("songs").get(key);
            req.onsuccess = () => resolveItem(req.result || null);
            req.onerror = () => resolveItem(null);
          } catch (e) {
            resolveItem(null);
          }
        });
        if (item) {
          if (item.audioBlob instanceof Blob) {
            item.hasAudioBlob = true;
            item.audioBlob = null;
          }
          list.push(item);
        }
      }
      return list;
    } catch (e) {
      console.warn("getAllSongs init error:", e);
      return [];
    }
  }

  async getAllBlobRecords() {
    try {
      await this.init();
      if (!this.db.objectStoreNames.contains("song_blobs")) return [];
      const keys = await this.getAllBlobKeys();
      if (!keys || keys.length === 0) return [];
      const records = [];
      for (const key of keys) {
        const rec = await new Promise((resolveRec) => {
          try {
            const tx = this.db.transaction("song_blobs", "readonly");
            const req = tx.objectStore("song_blobs").get(key);
            req.onsuccess = () => resolveRec(req.result || null);
            req.onerror = () => resolveRec(null);
          } catch (e) {
            resolveRec(null);
          }
        });
        if (rec) records.push(rec);
      }
      return records;
    } catch (e) {
      return [];
    }
  }

  async getAllBlobKeys() {
    try {
      await this.init();
      return new Promise((resolve) => {
        try {
          if (!this.db.objectStoreNames.contains("song_blobs")) return resolve([]);
          const tx = this.db.transaction("song_blobs", "readonly");
          const store = tx.objectStore("song_blobs");
          const req = store.getAllKeys();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
    } catch (e) {
      return [];
    }
  }

  async migrateEmbeddedAudioBlobs(yieldMs = 20) {
    try {
      await this.init();
      if (!this.db.objectStoreNames.contains("song_blobs")) return false;

      const keys = await new Promise((resolve) => {
        try {
          const tx = this.db.transaction("songs", "readonly");
          const req = tx.objectStore("songs").getAllKeys();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });

      if (!keys || keys.length === 0) return true;

      for (const key of keys) {
        await this._enqueueSongWrite(key, () => new Promise((resolveItem) => {
          try {
            const tx = this.db.transaction(["songs", "song_blobs"], "readwrite");
            const songStore = tx.objectStore("songs");
            const blobStore = tx.objectStore("song_blobs");
            tx.oncomplete = () => resolveItem();
            tx.onerror = () => resolveItem();
            tx.onabort = () => resolveItem();
            const getReq = songStore.get(key);

            getReq.onsuccess = () => {
              const rec = getReq.result;
              if (rec && rec.audioBlob instanceof Blob) {
                blobStore.put({ id: rec.id, audioBlob: rec.audioBlob });
                rec.hasAudioBlob = true;
                rec.audioBlob = null;
                songStore.put(rec);
              }
            };
          } catch (e) {
            resolveItem();
          }
        }));

        if (yieldMs > 0) {
          await new Promise((r) => setTimeout(r, yieldMs));
        }
      }
      return true;
    } catch (e) {
      console.warn("migrateEmbeddedAudioBlobs warning:", e);
      return false;
    }
  }

  async clearAllSongs() {
    try {
      await this.init();
      const pending = Array.from(this._songWriteQueues.values());
      if (pending.length > 0) {
        await Promise.allSettled(pending);
      }
      return new Promise((resolve) => {
        try {
          const storeNames = this.db.objectStoreNames.contains("song_blobs")
            ? ["songs", "song_blobs"]
            : ["songs"];
          const tx = this.db.transaction(storeNames, "readwrite");
          tx.objectStore("songs").clear();
          if (storeNames.includes("song_blobs")) {
            tx.objectStore("song_blobs").clear();
          }
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    } catch (e) {
      return false;
    }
  }

  async getSong(id) {
    if (!id) return null;
    await this.init();
    const pending = this._songWriteQueues.get(String(id));
    if (pending) {
      try { await pending; } catch (e) {}
    }
    return this._getSongUnlocked(id);
  }

  _getSongUnlocked(id) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction("songs", "readonly");
        const store = tx.objectStore("songs");
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(req.error || e);
      } catch (e) {
        reject(e);
      }
    });
  }

  async deleteSong(id) {
    if (!id) return false;
    await this.init();
    return this._enqueueSongWrite(id, () => new Promise((resolve, reject) => {
      try {
        const storeNames = ["songs"];
        if (this.db.objectStoreNames.contains("song_blobs")) storeNames.push("song_blobs");
        if (this.db.objectStoreNames.contains("lyrics")) storeNames.push("lyrics");
        const tx = this.db.transaction(storeNames, "readwrite");
        tx.objectStore("songs").delete(id);
        if (storeNames.includes("song_blobs")) {
          tx.objectStore("song_blobs").delete(id);
        }
        if (storeNames.includes("lyrics")) {
          tx.objectStore("lyrics").delete(id);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(tx.error || e);
        tx.onabort = (e) => reject(tx.error || e || new Error("IndexedDB transaction aborted"));
      } catch (err) {
        reject(err);
      }
    }));
  }

  async toggleLike(id) {
    if (!id) return false;
    await this.init();
    return this._enqueueSongWrite(id, async () => {
      const song = await this._getSongUnlocked(id);
      if (song) {
        song.isLiked = !song.isLiked;
        await this._saveSongMetaUnlocked(song, { updateLike: true });
        return song.isLiked;
      }
      return false;
    });
  }

  async _incrementGlobalStats(preciseAdd) {
    if (!preciseAdd || preciseAdd <= 0) return { globalTotalSeconds: 0, yearSeconds: 0 };
    const globalTotalSeconds = await this._enqueueSettingWrite("globalTotalSeconds", async () => {
      const cur = await this._getSettingUnlocked("globalTotalSeconds", 0);
      const next = Math.round(((Number(cur) || 0) + preciseAdd) * 100) / 100;
      await this._setSettingUnlocked("globalTotalSeconds", next);
      return next;
    });

    const yearKey = `yearlyTotalSeconds_${new Date().getFullYear()}`;
    const yearSeconds = await this._enqueueSettingWrite(yearKey, async () => {
      const cur = await this._getSettingUnlocked(yearKey, 0);
      const next = Math.round(((Number(cur) || 0) + preciseAdd) * 100) / 100;
      await this._setSettingUnlocked(yearKey, next);
      return next;
    });

    return { globalTotalSeconds, yearSeconds };
  }

  async recordListeningTime(songId, secondsListened) {
    try {
      if (!songId || typeof secondsListened !== "number" || !Number.isFinite(secondsListened) || secondsListened <= 0) {
        return null;
      }
      await this.init();
      const preciseAdd = Math.round(secondsListened * 100) / 100;
      if (preciseAdd <= 0) return null;

      const didUpdateSong = await this._enqueueSongWrite(songId, async () => {
        let song = await this._getSongUnlocked(songId);
        if (!song) {
          const all = await this.getAllSongs();
          song = all.find(s => s.id === songId);
        }
        if (song) {
          song.totalTimeListened = Math.round(((Number(song.totalTimeListened) || 0) + preciseAdd) * 100) / 100;
          await this._saveSongMetaUnlocked(song);
          return true;
        }
        return false;
      });

      if (!didUpdateSong) return null;
      return await this._incrementGlobalStats(preciseAdd);
    } catch (e) {
      console.warn("recordListeningTime error:", e);
      return null;
    }
  }

  // Serialized, idempotent authoritative stats sync (never double-adds when ledger already incremented)
  async syncListeningStats(songId, deltaSeconds, authoritativeTotalTime, authoritativePlayCount, options = {}) {
    try {
      if (!songId) return null;
      await this.init();
      const preciseDelta = (typeof deltaSeconds === "number" && Number.isFinite(deltaSeconds) && deltaSeconds > 0)
        ? Math.round(deltaSeconds * 100) / 100
        : 0;
      const forceExact = Boolean(options && options.forceExactStats);

      const savedSong = await this._enqueueSongWrite(songId, async () => {
        let song = await this._getSongUnlocked(songId);
        if (!song) return null;
        const safeTargetTime = Math.max(0, Number(authoritativeTotalTime) || 0);
        const safeTargetPlays = Math.max(0, Number(authoritativePlayCount) || 0);
        const nextTime = forceExact
          ? safeTargetTime
          : Math.max(Number(song.totalTimeListened) || 0, safeTargetTime);
        const nextPlays = forceExact
          ? safeTargetPlays
          : Math.max(Number(song.playCount) || 0, safeTargetPlays);
        song.totalTimeListened = Math.round(nextTime * 100) / 100;
        song.playCount = nextPlays;
        return await this._saveSongMetaUnlocked(song, { forceExactStats: forceExact });
      });

      const totals = (savedSong && preciseDelta > 0)
        ? await this._incrementGlobalStats(preciseDelta)
        : { globalTotalSeconds: null, yearSeconds: null };

      return { song: savedSong, ...totals };
    } catch (e) {
      console.warn("syncListeningStats error:", e);
      return null;
    }
  }

  async updateSongMeta(songId, newTitle, newArtist, newAlbum) {
    if (!songId) return null;
    await this.init();
    return this._enqueueSongWrite(songId, async () => {
      const song = await this._getSongUnlocked(songId);
      if (song) {
        song.title = newTitle;
        song.artist = newArtist;
        song.album = newAlbum;
        await this._saveSongMetaUnlocked(song);
        return song;
      }
      return null;
    });
  }

  async updateSongAudioTweaks(songId, tweaks = {}) {
    if (!songId) return null;
    await this.init();
    return this._enqueueSongWrite(songId, async () => {
      const song = await this._getSongUnlocked(songId);
      if (song) {
        if (typeof tweaks.trimStart === "number") song.trimStart = tweaks.trimStart;
        if (typeof tweaks.trimEnd === "number") song.trimEnd = tweaks.trimEnd;
        if (Array.isArray(tweaks.skipSegments)) song.skipSegments = tweaks.skipSegments;
        if (typeof tweaks.gainDb === "number") song.gainDb = tweaks.gainDb;
        if (typeof tweaks.duration === "number" && tweaks.duration > 0) song.duration = tweaks.duration;
        if (typeof tweaks.rawDuration === "number" && tweaks.rawDuration > 0) {
          song.rawDuration = tweaks.rawDuration;
          song.duration = tweaks.rawDuration;
        }
        if (typeof tweaks.trimEnabled === "boolean") song.trimEnabled = tweaks.trimEnabled;
        await this._saveSongMetaUnlocked(song);
        return song;
      }
      return null;
    });
  }

  // Playlists
  async getAllPlaylists() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("playlists", "readonly");
      const store = tx.objectStore("playlists");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(req.error || e);
    });
  }

  async getPlaylist(id) {
    if (!id) return null;
    await this.init();
    const pending = this._playlistWriteQueues.get(String(id));
    if (pending) {
      try { await pending; } catch (e) {}
    }
    return this._getPlaylistUnlocked(id);
  }

  _getPlaylistUnlocked(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("playlists", "readonly");
      const store = tx.objectStore("playlists");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e);
    });
  }

  async savePlaylist(playlist) {
    if (!playlist || !playlist.id) return null;
    await this.init();
    return this._enqueuePlaylistWrite(playlist.id, () => this._savePlaylistUnlocked(playlist));
  }

  _savePlaylistUnlocked(playlist) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("playlists", "readwrite");
      const store = tx.objectStore("playlists");
      let settled = false;
      const fail = (err) => {
        if (!settled) { settled = true; reject(err); }
      };
      tx.oncomplete = () => {
        if (!settled) { settled = true; resolve(playlist); }
      };
      tx.onerror = (e) => fail(tx.error || e);
      tx.onabort = (e) => fail(tx.error || e || new Error("IndexedDB transaction aborted"));
      const req = store.put(playlist);
      req.onerror = (e) => fail(req.error || e);
    });
  }

  async deletePlaylist(id) {
    if (!id) return false;
    await this.init();
    return this._enqueuePlaylistWrite(id, () => new Promise((resolve, reject) => {
      const tx = this.db.transaction("playlists", "readwrite");
      const store = tx.objectStore("playlists");
      let settled = false;
      const fail = (err) => {
        if (!settled) { settled = true; reject(err); }
      };
      tx.oncomplete = () => {
        if (!settled) { settled = true; resolve(true); }
      };
      tx.onerror = (e) => fail(tx.error || e);
      tx.onabort = (e) => fail(tx.error || e || new Error("IndexedDB transaction aborted"));
      const req = store.delete(id);
      req.onerror = (e) => fail(req.error || e);
    }));
  }

  async addSongToPlaylist(playlistId, songId) {
    if (!playlistId || !songId) return false;
    await this.init();
    return this._enqueuePlaylistWrite(playlistId, async () => {
      const pl = await this._getPlaylistUnlocked(playlistId);
      if (!pl) return false;
      if (!pl.songIds) pl.songIds = [];
      if (!pl.songIds.includes(songId)) {
        pl.songIds.push(songId);
        await this._savePlaylistUnlocked(pl);
        return true;
      }
      return false;
    });
  }

  async removeSongFromPlaylist(playlistId, songId) {
    if (!playlistId || !songId) return false;
    await this.init();
    return this._enqueuePlaylistWrite(playlistId, async () => {
      const pl = await this._getPlaylistUnlocked(playlistId);
      if (!pl || !pl.songIds) return false;
      pl.songIds = pl.songIds.filter(id => id !== songId);
      await this._savePlaylistUnlocked(pl);
      return true;
    });
  }

  // Lyrics
  async saveLyrics(songId, lrcContent) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("lyrics", "readwrite");
      const store = tx.objectStore("lyrics");
      let settled = false;
      const fail = (err) => {
        if (!settled) { settled = true; reject(err); }
      };
      tx.oncomplete = () => {
        if (!settled) { settled = true; resolve(true); }
      };
      tx.onerror = (e) => fail(tx.error || e);
      tx.onabort = (e) => fail(tx.error || e || new Error("IndexedDB transaction aborted"));
      const req = store.put({ songId, content: lrcContent });
      req.onerror = (e) => fail(req.error || e);
    });
  }

  async getLyrics(songId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("lyrics", "readonly");
      const store = tx.objectStore("lyrics");
      const req = store.get(songId);
      req.onsuccess = () => resolve(req.result ? req.result.content : null);
      req.onerror = (e) => reject(req.error || e);
    });
  }

  async getAllLyrics() {
    try {
      await this.init();
      const keys = await new Promise((resolve) => {
        try {
          const tx = this.db.transaction("lyrics", "readonly");
          const req = tx.objectStore("lyrics").getAllKeys();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
      const result = {};
      for (const k of keys) {
        try {
          const content = await this.getLyrics(k);
          if (content) result[k] = content;
        } catch (e) {}
      }
      return result;
    } catch (e) {
      return {};
    }
  }

  // Settings
  async setSetting(key, value) {
    if (!key) return false;
    await this.init();
    return this._enqueueSettingWrite(key, () => this._setSettingUnlocked(key, value));
  }

  _setSettingUnlocked(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("settings", "readwrite");
      const store = tx.objectStore("settings");
      let settled = false;
      const fail = (err) => {
        if (!settled) { settled = true; reject(err); }
      };
      tx.oncomplete = () => {
        if (!settled) { settled = true; resolve(true); }
      };
      tx.onerror = (e) => fail(tx.error || e);
      tx.onabort = (e) => fail(tx.error || e || new Error("IndexedDB transaction aborted"));
      const req = store.put({ key, value });
      req.onerror = (e) => fail(req.error || e);
    });
  }

  async getSetting(key, defaultValue = null) {
    await this.init();
    const qKey = String(key || "__default");
    const pending = this._settingWriteQueues.get(qKey);
    if (pending) {
      try { await pending; } catch (e) {}
    }
    return this._getSettingUnlocked(key, defaultValue);
  }

  _getSettingUnlocked(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("settings", "readonly");
      const store = tx.objectStore("settings");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = (e) => reject(req.error || e);
    });
  }

  // Persistent Per-Song Stats Ledger (Inmunidad Estadística Infranqueable)
  async getSongStatsLedger(key = "song_stats_ledger_v2") {
    return await this.getSetting(key, { canonical: {}, bySongId: {} });
  }

  async saveSongStatsLedger(ledger, key = "song_stats_ledger_v2") {
    if (!ledger || typeof ledger !== "object") return false;
    return await this.setSetting(key, ledger);
  }
}

if (typeof window !== "undefined") {
  window.musicDB = new MusicDB();
}
if (typeof module === "object" && module.exports && typeof window === "undefined") {
  module.exports = { MusicDB };
}
