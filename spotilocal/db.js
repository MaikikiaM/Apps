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
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

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
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error("IndexedDB error:", e);
        reject(e);
      };
    });
  }

  async saveSong(song) {
    if (!song || !song.id) return null;
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const hasBlobsStore = this.db.objectStoreNames.contains("song_blobs");
        const storeNames = hasBlobsStore ? ["songs", "song_blobs"] : ["songs"];
        const tx = this.db.transaction(storeNames, "readwrite");
        const songStore = tx.objectStore("songs");
        const blobStore = hasBlobsStore ? tx.objectStore("song_blobs") : null;

        const getReq = songStore.get(song.id);
        getReq.onsuccess = () => {
          const existing = getReq.result || {};
          let targetBlob = (song.audioBlob instanceof Blob) ? song.audioBlob : null;
          if (!targetBlob && (existing.audioBlob instanceof Blob)) {
            targetBlob = existing.audioBlob;
          }

          if (blobStore && targetBlob) {
            blobStore.put({ id: song.id, audioBlob: targetBlob });
          }

          const safeTotalTime = Math.max(
            Number(existing.totalTimeListened) || 0,
            Number(song.totalTimeListened) || 0
          );
          const safePlayCount = Math.max(
            Number(existing.playCount) || 0,
            Number(song.playCount) || 0
          );

          const hasAudio = Boolean(targetBlob || existing.hasAudioBlob || song.hasAudioBlob);
          const metaRecord = {
            ...existing,
            ...song,
            totalTimeListened: safeTotalTime,
            playCount: safePlayCount,
            audioBlob: (hasBlobsStore ? null : (targetBlob || null)),
            hasAudioBlob: hasAudio,
            coverBlob: song.coverBlob || existing.coverBlob || null
          };

          const putReq = songStore.put(metaRecord);
          putReq.onsuccess = () => resolve(metaRecord);
          putReq.onerror = (e) => reject(e);
        };
        getReq.onerror = (e) => reject(e);
      } catch (err) {
        reject(err);
      }
    });
  }

  async saveSongMeta(song) {
    if (!song || !song.id) return null;
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction("songs", "readwrite");
        const store = tx.objectStore("songs");
        const getReq = store.get(song.id);
        getReq.onsuccess = () => {
          const existing = getReq.result || {};
          const safeTotalTime = Math.max(
            Number(existing.totalTimeListened) || 0,
            Number(song.totalTimeListened) || 0
          );
          const safePlayCount = Math.max(
            Number(existing.playCount) || 0,
            Number(song.playCount) || 0
          );
          const metaRecord = {
            ...existing,
            ...song,
            totalTimeListened: safeTotalTime,
            playCount: safePlayCount,
            audioBlob: null,
            hasAudioBlob: Boolean(song.hasAudioBlob || existing.hasAudioBlob || (existing.audioBlob instanceof Blob)),
            coverBlob: song.coverBlob || existing.coverBlob || null
          };
          const putReq = store.put(metaRecord);
          putReq.onsuccess = () => resolve(metaRecord);
          putReq.onerror = (e) => reject(e);
        };
        getReq.onerror = (e) => reject(e);
      } catch (err) {
        reject(err);
      }
    });
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
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction("songs", "readonly");
          const store = tx.objectStore("songs");
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result || [];
            // Ensure audioBlob is not duplicated in memory from legacy records
            for (let i = 0; i < list.length; i++) {
              const item = list[i];
              if (item.audioBlob instanceof Blob) {
                item.hasAudioBlob = true;
                item.audioBlob = null;
              }
            }
            resolve(list);
          };
          req.onerror = (e) => {
            console.warn("getAllSongs error:", e);
            resolve([]);
          };
        } catch (e) {
          console.warn("getAllSongs tx error:", e);
          resolve([]);
        }
      });
    } catch (e) {
      console.warn("getAllSongs init error:", e);
      return [];
    }
  }

  async getAllBlobRecords() {
    try {
      await this.init();
      return new Promise((resolve) => {
        try {
          if (!this.db.objectStoreNames.contains("song_blobs")) return resolve([]);
          const tx = this.db.transaction("song_blobs", "readonly");
          const store = tx.objectStore("song_blobs");
          const req = store.getAll();
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
        await new Promise((resolveItem) => {
          try {
            const tx = this.db.transaction(["songs", "song_blobs"], "readwrite");
            const songStore = tx.objectStore("songs");
            const blobStore = tx.objectStore("song_blobs");
            const getReq = songStore.get(key);

            getReq.onsuccess = () => {
              const rec = getReq.result;
              if (rec && rec.audioBlob instanceof Blob) {
                blobStore.put({ id: rec.id, audioBlob: rec.audioBlob });
                rec.hasAudioBlob = true;
                rec.audioBlob = null;
                songStore.put(rec);
              }
              resolveItem();
            };
            getReq.onerror = () => resolveItem();
          } catch (e) {
            resolveItem();
          }
        });

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
        } catch (e) {
          resolve(false);
        }
      });
    } catch (e) {
      return false;
    }
  }

  async getSong(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("songs", "readonly");
      const store = tx.objectStore("songs");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  async deleteSong(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const storeNames = this.db.objectStoreNames.contains("song_blobs")
          ? ["songs", "song_blobs"]
          : ["songs"];
        const tx = this.db.transaction(storeNames, "readwrite");
        tx.objectStore("songs").delete(id);
        if (storeNames.includes("song_blobs")) {
          tx.objectStore("song_blobs").delete(id);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
      } catch (err) {
        reject(err);
      }
    });
  }

  async toggleLike(id) {
    const song = await this.getSong(id);
    if (song) {
      song.isLiked = !song.isLiked;
      await this.saveSongMeta(song);
      return song.isLiked;
    }
    return false;
  }

  async recordListeningTime(songId, secondsListened) {
    try {
      let song = await this.getSong(songId);
      if (!song) {
        const all = await this.getAllSongs();
        song = all.find(s => s.id === songId);
      }

      const preciseAdd = Math.round(secondsListened * 100) / 100;

      if (song) {
        song.totalTimeListened = Math.round(((song.totalTimeListened || 0) + preciseAdd) * 100) / 100;
        await this.saveSongMeta(song);
      }

      // Global total seconds stored with 2 decimal places precision
      let totalSeconds = await this.getSetting("globalTotalSeconds", 0);
      totalSeconds = Math.round(((Number(totalSeconds) || 0) + preciseAdd) * 100) / 100;
      await this.setSetting("globalTotalSeconds", totalSeconds);

      // Yearly persistent counter so annual listening time never drops on log rotation or song deletion
      const yearKey = `yearlyTotalSeconds_${new Date().getFullYear()}`;
      let yearSeconds = await this.getSetting(yearKey, 0);
      yearSeconds = Math.round(((Number(yearSeconds) || 0) + preciseAdd) * 100) / 100;
      await this.setSetting(yearKey, yearSeconds);

      return { globalTotalSeconds: totalSeconds, yearSeconds };
    } catch (e) {
      console.warn("recordListeningTime error:", e);
      return null;
    }
  }

  async updateSongMeta(songId, newTitle, newArtist, newAlbum) {
    const song = await this.getSong(songId);
    if (song) {
      song.title = newTitle;
      song.artist = newArtist;
      song.album = newAlbum;
      await this.saveSongMeta(song);
      return song;
    }
    return null;
  }

  async updateSongAudioTweaks(songId, tweaks = {}) {
    const song = await this.getSong(songId);
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
      await this.saveSongMeta(song);
      return song;
    }
    return null;
  }

  // Playlists
  async getAllPlaylists() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("playlists", "readonly");
      const store = tx.objectStore("playlists");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e);
    });
  }

  async getPlaylist(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("playlists", "readonly");
      const store = tx.objectStore("playlists");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e);
    });
  }

  async savePlaylist(playlist) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("playlists", "readwrite");
      const store = tx.objectStore("playlists");
      const req = store.put(playlist);
      req.onsuccess = () => resolve(playlist);
      req.onerror = (e) => reject(e);
    });
  }

  async deletePlaylist(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("playlists", "readwrite");
      const store = tx.objectStore("playlists");
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e);
    });
  }

  async addSongToPlaylist(playlistId, songId) {
    const pl = await this.getPlaylist(playlistId);
    if (!pl) return false;
    if (!pl.songIds) pl.songIds = [];
    if (!pl.songIds.includes(songId)) {
      pl.songIds.push(songId);
      await this.savePlaylist(pl);
      return true;
    }
    return false;
  }

  async removeSongFromPlaylist(playlistId, songId) {
    const pl = await this.getPlaylist(playlistId);
    if (!pl || !pl.songIds) return false;
    pl.songIds = pl.songIds.filter(id => id !== songId);
    await this.savePlaylist(pl);
    return true;
  }

  // Lyrics
  async saveLyrics(songId, lrcContent) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("lyrics", "readwrite");
      const store = tx.objectStore("lyrics");
      const req = store.put({ songId, content: lrcContent });
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e);
    });
  }

  async getLyrics(songId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("lyrics", "readonly");
      const store = tx.objectStore("lyrics");
      const req = store.get(songId);
      req.onsuccess = () => resolve(req.result ? req.result.content : null);
      req.onerror = (e) => reject(e);
    });
  }

  // Settings
  async setSetting(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("settings", "readwrite");
      const store = tx.objectStore("settings");
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e);
    });
  }

  async getSetting(key, defaultValue = null) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("settings", "readonly");
      const store = tx.objectStore("settings");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = (e) => reject(e);
    });
  }

  // Persistent Per-Song Stats Ledger (Inmunidad Estadística Infranqueable)
  async getSongStatsLedger() {
    return await this.getSetting("song_stats_ledger", { canonical: {}, bySongId: {} });
  }

  async saveSongStatsLedger(ledger) {
    if (!ledger || typeof ledger !== "object") return false;
    return await this.setSetting("song_stats_ledger", ledger);
  }
}

window.musicDB = new MusicDB();
