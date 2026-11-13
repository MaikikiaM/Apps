# SpotiLocal - Complete Project Handoff

**Last updated:** 2026-11-13
**Status:** SpotiLocal v1.8.7 (Build #79, versionCode 29) - Endurecimiento integral tras auditoría escéptica de v1.8.6: transacciones IDB seguras con colas FIFO de playlists y read-your-writes, limpieza total de llaves `artist:::title` en ledger/backups, aislamiento de títulos/artistas y pistas nuevas/editadas, seguimiento exacto HTML5/ExoPlayer en fin de pista/pausa/transición/repetición, limpieza completa de DB/caché nativo, y exportación Android vía `MediaStore.Downloads`.
**Version displayed to user:** v1.8.7 (`app-version.json`, `index.html`, `release.json`)
**Internal CURRENT_APP_VERSION constant:** `1.8.7` (`app.js`)

---

## 0. Current Verified Snapshot

This is the state verified immediately before the last update of this document:

- The project root is `C:\Users\migue\Proyectos IA varios\SpotiLocal`.
- The project root is not itself a Git repository.
- `songs/` contains 12 MP3 files and `GET http://127.0.0.1:3000/api/songs` returns all 12 with HTTP 200.
- `server.js` is currently running in the background as Node PID `26552`.
- The server listens on `0.0.0.0:3000`; the current LAN address is `192.168.1.51`.
- The mobile/PWA URL on the same Wi-Fi is `http://192.168.1.51:3000`.
- Audio streaming was verified with HTTP Range: `206 Partial Content`, `Content-Type: audio/mpeg`, and a 1024-byte range response.
- The newest timestamped queue build is `SpotiLocal_queue_ui_20260909_205325.apk` (7,471,303 bytes; modified `2026-09-09 20:53:13`).
- Direct queue build URL: `http://192.168.1.65:3000/SpotiLocal_queue_ui_20260909_205325.apk`.
- A new offline-capable APK was compiled successfully: `SpotiLocal_offline_queue_20260910.apk` (7,471,860 bytes). If the server is running, its direct URL is `http://192.168.1.65:3000/SpotiLocal_offline_queue_20260910.apk`.
- A follow-up build adds a visible mobile queue entry point, interruption-free native queue insertion, native-to-local offline fallback, and statistics recovery: `SpotiLocal_offline_queue_ui_20260910.apk` (7,487,116 bytes). Direct URL: `http://192.168.1.65:3000/SpotiLocal_offline_queue_ui_20260910.apk`.
- Canonical no-cache download name for the final build: `SpotiLocal_offline_queue_ui_statsfix_20260910.apk` (SHA-256 `A0881D0EC61E72A30CB4402D8FB32A446E9995D19F5F0999891BB195D65D4440`). Direct URL: `http://192.168.1.65:3000/SpotiLocal_offline_queue_ui_statsfix_20260910.apk`.
- Latest stability build: `SpotiLocal_offline_stable_20260910.apk` (7,487,168 bytes; SHA-256 `32D73FF222CBA241DD368DDF0EFE2DE4994C5BD0760BF65B85723EBB9FC56414`). This build makes synchronized local blobs the primary playback path and leaves ExoPlayer only for uncached tracks.
- Latest background-capable build: `SpotiLocal_offline_background_20260910.apk` (7,488,496 bytes; SHA-256 `D47509803AC3E6242C701CC1B732A687AA088507B8B2DB295D4DC6A70E208491`). It copies synchronized IndexedDB blobs into `NativeAudioStore` and gives ExoPlayer a local-file queue.
- Definitive background statistics & scrobbles fix build: `SpotiLocal_background_stats_20260912.apk` (7,491,814 bytes; SHA-256 `90B8198B500E59530BD343386E28D457D7BB0EA4E2B60FB6CE723528F0964AC6`). Also mirrored to `SpotiLocal.apk`. Direct URL: `http://192.168.1.65:3000/SpotiLocal_background_stats_20260912.apk`. Tracks elapsed listening time continuously inside `PlaybackService` on Android, captures track transitions and scrobbles while the phone is locked or app minimized, persists pending stats in `SharedPreferences`, and atomically drains them to `app.js` upon app resume or poller tick.
- `GET /api/version` still advertises legacy `SpotiPirata_v1.6.apk`; it does **not** currently advertise the timestamped queue build or the offline build. Use the explicit direct URLs above.
- Existing historical APKs are immutable. The offline fix is present in `SpotiLocal_offline_queue_20260910.apk` and `SpotiLocal_offline_queue_ui_20260910.apk`; installing an older queue APK will not gain the fix.
- The API key mentioned during the conversation was changed manually by the user and is intentionally not recorded here. Never put that secret in this handoff or in the web bundle.

The server process is not persistent across Windows restarts. Start it again with `node server.js` or `npm start` from the project root.

---

## 1. What Is This Project?

SpotiLocal (formerly SpotiPirata) is a **self-hosted music player** that runs as:
- A **PWA** (Progressive Web App) in any browser
- A **native Android APK** via Capacitor (wraps the same web code in a WebView)

It streams FLAC/MP3/WAV audio from a local Node.js server running on your PC at `http://<PC_IP>:3000`, and caches songs to IndexedDB for offline playback on mobile.

**Target device:** OnePlus Nord 3 5G (primary), any Android phone, any desktop browser.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PC (Windows)                          │
│                                                         │
│  server.js ─── Node.js built-in HTTP server on :3000     │
│     ├── GET /api/songs     → JSON list of files in songs/│
│     ├── GET /api/version   → { version, fileName }      │
│     ├── GET /songs/*.flac  → Raw audio stream (206)     │
│     └── Static files       → index.html, JS, CSS, APK   │
│                                                         │
│  songs/               → MP3 audio files (12 currently)  │
│  *.apk                → Versioned APK builds            │
│  app-version.json     → { "version": "1.6" }           │
│  cover-art.json       → Cover art URL mapping           │
└─────────────────────────────────────────────────────────┘
          │ HTTP (WiFi LAN)
          ▼
┌─────────────────────────────────────────────────────────┐
│                    Mobile (Browser / APK)                │
│                                                         │
│  index.html          → SPA shell (775 lines)            │
│  styles.css          → Spotify dark theme (2260 lines)   │
│  id3-parser.js       → ID3v2 metadata reader (184 lines)│
│  db.js               → IndexedDB wrapper (289 lines)     │
│  audio-engine.js     → Web Audio API EQ (104 lines)      │
│  app.js              → Main controller (3933 lines)      │
│  sw.js               → Service Worker (87 lines)         │
│  manifest.json       → PWA manifest                     │
│                                                         │
│  IndexedDB (SpotiLocalDB)                               │
│     ├── songs       → Audio blobs + metadata             │
│     ├── playlists   → Playlist objects with songIds[]    │
│     ├── lyrics      → LRC text per songId                │
│     └── settings    → Key-value config                   │
│                                                         │
│  localStorage                                              │
│     ├── spotilocal_custom_ip        → Saved PC IP        │
│     ├── spotilocal_listening_logs   → Play time entries  │
│     ├── spotilocal_cached_songs     → Quick metadata     │
│     └── spotilocal_app_version      → Installed version  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. All Files in the Project (with Purpose)

### Core Web App
| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | 775 | SPA shell with all views, modals, player bar |
| `styles.css` | 2260 | Spotify dark theme, responsive (mobile/desktop), glass morphism |
| `app.js` | 3933 | Main controller: player, queue, playlists, stats, EQ visualizer, lyrics, settings, PWA install, MediaSession API |
| `db.js` | 289 | IndexedDB wrapper class `MusicDB` — songs, playlists, lyrics, settings stores |
| `audio-engine.js` | 104 | Web Audio API: 5-band EQ (60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz), AnalyserNode for visualizer |
| `id3-parser.js` | 184 | ID3v2 tag parser — reads title, artist, album, year, genre, APIC cover art from audio blobs |
| `sw.js` | 87 | Service Worker — cache-first for static assets, network-first for API/JS |
| `manifest.json` | 46 | PWA manifest — `display: standalone`, portrait orientation |

### Server & Build
| File | Purpose |
|------|---------|
| `server.js` | Node.js built-in HTTP server on port 3000, serves static files, `/api/songs` endpoint, APK downloads, and HTTP Range requests (206) for audio streaming |
| `package.json` | `"start": "node server.js"` — no dependencies, pure Node.js http module |
| `iniciar-servidor.bat` | Windows batch file: `node server.js` |
| `package_apk.ps1` | PowerShell script: copies APK from Capacitor build output, injects updated web files into the ZIP at `assets/public/` paths |

### Audio Generation & Tools
| File | Purpose |
|------|---------|
| `generate_songs.js` | Generates 4 WAV files (synthesized audio): La Llorona, Soy Rebelde, Por qué te vas, Zigeunerweisen — writes to `songs/` |
| `generate_more_songs.js` | Generates 7 more WAV files: Paint It Black, Viva La Vida, Libre, Fairytale, Gangsta's Paradise, Back in Black, Un beso y una flor |
| `convert_songs.js` | Batch converts `.webm` → `.mp3` using ffmpeg |
| `download_real_tracks.ps1` | Downloads real tracks from YouTube via `yt-dlp.exe` |
| `create_icons.js` | Generates `icon-192.png`, `icon-512.png`, `icon.svg` — pure Node.js PNG generator (no dependencies) |
| `yt-dlp.exe` | Binary: YouTube audio downloader |

### Data & Config
| File | Purpose |
|------|---------|
| `app-version.json` | `{ "version": "1.6" }` — displayed in Settings UI |
| `cover-art.json` | Array of 12 objects: `{ title, artist, url }` — maps song titles to Apple Music cover art URLs |
| `release.json` | `{ "version": "1.6", "versionCode": 7, "fileName": "SpotiPirata_v1.6.apk" }` |
| `project.json` | IDE metadata: title, description, visibility |
| `elementsData.js` | **UNRELATED** — Periodic table data for a different project, left in this directory by mistake |

### APK Versions (in root)
```
SpotiLocal_v1.5.apk  →  SpotiLocal_v2.30.apk  (30+ versioned builds)
SpotiPirata_v1.0.apk → SpotiPirata_v1.6.apk   (legacy name, 7 builds)
SpotiLocal.apk        (generic)
SpotiLocal_native_queue_20260909_201829.apk
SpotiLocal_queue_20260909_204654.apk
SpotiLocal_queue_ui_20260909_205325.apk  ← newest queue-labelled build
SpotiLocal_offline_queue_20260910.apk    ← newest offline-capable build
SpotiLocal_offline_queue_ui_20260910.apk ← offline + mobile queue button
```

### Songs Directory
`songs/` is auto-scanned by the server. The current working copy contains these 12 MP3 files:

```text
Back in Black - ACDC.mp3
Fairytale - Alexander Rybak.mp3
Gangsta Paradise - Coolio.mp3
La Llorona - Chavela Vargas.mp3
Libre - Nino Bravo.mp3
Paint It Black - The Rolling Stones.mp3
Por que te vas - Jeanette.mp3
Soy Rebelde - Jeanette.mp3
The Winner Takes It All - ABBA.mp3
Un beso y una flor - Nino Bravo.mp3
Viva La Vida - Coldplay.mp3
Zigeunerweisen - Pablo Sarasate.mp3
```

The server returns URL-encoded file paths such as `/songs/Back%20in%20Black%20-%20ACDC.mp3`. The app decodes and resolves them through `getFullUrl()`.

---

## 4. Key Code References (Line Numbers)

### Server (`server.js`)
- Port and static file serving: `server.js:1-35`
- `/api/songs` endpoint (auto-scan songs folder): `server.js:52-76`
- `/api/version` endpoint: `server.js:79-93`
- APK download with fallback: `server.js:95-121`
- HTTP Range request (206 Partial Content): `server.js:138-163`
- CORS headers for WebView: `server.js:39-46`
- Local IP detection: `server.js:167-178`

### App Controller (`app.js`)
- Capacitor/native detection: `app.js:6-7`
- Server IP resolution & URL rewriting: `app.js:8, 26-43`
- `CURRENT_APP_VERSION = "3.0.0"`: `app.js:330`
- `loadSongsFromDB()` — the main sync engine: `app.js:1001-1172`
- Song merge logic (DB + API): `app.js:1075-1115`
- `downloadAndCacheAllSongs()` — offline blob caching: `app.js:799-854`
- `handleFilesSelect()` — mobile file upload: `app.js:905-949`
- `loadAndPlayCurrentSong()` — audio source resolution (blob vs stream): `app.js:1852-1985`
- Native ExoPlayer bridge: `app.js:1911-1939`
- Native state poller (300ms interval): `app.js:2494-2585`
- Scrobble rule (50% threshold): `app.js:2407-2433`
- Listening time recording (every 5s flush): `app.js:2591-2638`
- Queue management (`getQueueEntries`, `addToQueue`): `app.js:621-659`
- Playlist CRUD: `app.js:3477-3860`
- Sleep timer: `app.js:3920-3945`
- Keyboard shortcuts: `app.js:2848-2875`
- Two-finger swipe gestures (next/prev/pause): `app.js:2122-2217`
- Cover art hydration from catalog: `app.js:1174-1218`
- Ambient glow color extraction: `app.js:3022-3050`
- MediaSession API (lockscreen controls): `app.js:3053-3144`
- PWA install prompt handling: `app.js:3882-3931`
- Canvas visualizer (bars/wave/circle modes): `app.js:3237-3304`
- LRC lyrics parser: `app.js:3310-3396`
- Search: `app.js:1757-1771`
- Crossfade: `app.js:2843-2845`
- Speed control: `app.js:3013-3020`

### Database (`db.js`)
- IndexedDB schema (4 stores): `db.js:22-44`
- `saveSong`, `getAllSongs`, `getSong`, `deleteSong`: `db.js:59-129`
- `toggleLike`: `db.js:131-139`
- `recordListeningTime`: `db.js:141-163`
- `updateSongMeta`: `db.js:165-175`
- Playlist CRUD: `db.js:178-240`
- Lyrics store: `db.js:242-263`
- Settings store: `db.js:265-286`

### Audio Engine (`audio-engine.js`)
- 5-band EQ initialization: `audio-engine.js:41-54`
- Signal chain: `Source → EQ0 → EQ1 → EQ2 → EQ3 → EQ4 → Gain → Analyser → Destination`: `audio-engine.js:56-65`
- Presets (flat, bassBoost, pop, rock, jazz, vocal, acoustic): `audio-engine.js:14-22`
- Frequency bands: `[60, 230, 910, 3600, 14000]` Hz: `audio-engine.js:12`

### ID3 Parser (`id3-parser.js`)
- ID3v2 header parsing: `id3-parser.js:21-24`
- Frame iteration (v2/v3/v4): `id3-parser.js:36-77`
- APIC (cover art) extraction: `id3-parser.js:141-181`
- Text encoding detection (ISO-8859-1, UTF-16, UTF-8): `id3-parser.js:111-138`

### Service Worker (`sw.js`)
- Cache name: `spotipirata-pwa-v160`: `sw.js:1`
- Static assets list: `sw.js:2-16`
- Stale-while-revalidate for static, network-first for API: `sw.js:41-76`
- `SKIP_WAITING` and `CLEAR_CACHE` message handlers: `sw.js:78-87`

---

## 5. Features Implemented

1. **Audio playback** — HTML5 Audio element + Web Audio API EQ chain
2. **5-band equalizer** — with 7 presets (flat, bass boost, pop, rock, jazz, vocal, acoustic)
3. **Canvas visualizer** — 3 modes: bars, wave, circular spectrum
4. **Queue system** — pending queue + current queue, add/remove/play from queue; native additions use incremental ExoPlayer insertion without re-preparing the active track
5. **Playlists** — create, delete, add songs, play all, view detail
6. **Library view** — sort by (recent 10d, date added, title, artist, album), filter (all, liked, top 10d, unplayed)
7. **Search** — global search across title/artist/album
8. **Like/Favorite** — heart toggle per song
9. **Edit metadata** — title, artist, album inline editing
10. **Download individual songs** — exports as FLAC
11. **Listening statistics** — minutes listened today/month/year/historical
12. **Ranking view** — weekly/monthly/yearly/historical, sorted by time listened
13. **Scrobble** — counts 1 reproduction after 50% of song duration
14. **Lyrics** — import .LRC files, auto-scroll synced lyrics, click-to-seek
15. **Crossfade** — configurable 0/2/4/6 seconds between songs
16. **Sleep timer** — 15/30/45/60 minutes
17. **Speed control** — 0.5x to 2.0x
18. **Volume control** — slider + mute button
19. **MediaSession API** — lockscreen/notification controls on Android
20. **Wake Lock** — prevents screen sleep during playback
21. **PWA install** — `beforeinstallprompt` + guide modal for manual install
22. **Self-update** — checks `/api/version`, clears SW cache, reloads
23. **Capacitor native bridge** — ExoPlayer integration via `window.SpotiLocalNativePlayer`
24. **Touch gestures** — 2-finger swipe (next/prev/pause), single-finger on player bar
25. **Ambient glow** — dynamic background color extracted from album art
26. **Cover art catalog** — `cover-art.json` maps titles to Apple Music URLs, with fuzzy matching
27. **ID3 parsing** — extracts metadata + embedded cover art from audio files on upload
28. **Offline caching** — all songs downloaded to IndexedDB blobs for true offline play
29. **Background sync** — auto-syncs from server on every load, downloads blobs silently
30. **Export database** — downloads JSON backup of songs, playlists, listening logs
31. **Desktop + mobile responsive** — sidebar on desktop, bottom nav on mobile
32. **Offline-first playback** — the stability APK uses local HTML5 blobs; the background APK copies those blobs to `NativeAudioStore` and uses native local-file ExoPlayer playback
33. **Statistics recovery** — local song metadata and listening logs have redundant localStorage/IndexedDB persistence and startup merge protection against an empty IndexedDB read

---

## 6. Data Flow

### On App Load
1. `initSpotiLocalApp()` called (line 3931)
2. Detects if running as native APK or PWA (line 6-7)
3. Purges legacy SW caches in native mode (line 11-24)
4. Loads version from `app-version.json` (line 45-56)
5. Loads cover art catalog from `cover-art.json` (line 74-88)
6. `loadSongsFromDB()` called:
   - First paints from localStorage cache (instant)
   - Reads IndexedDB songs
   - Fetches `/api/songs` from PC server (5s timeout)
   - Merges DB + API songs (dedup by title/url)
   - Saves merged back to IndexedDB
   - Triggers silent background blob download for offline
   - Renders UI tables/grids
7. `loadPlaylistsFromDB()` renders sidebar + grid

### On Song Play
1. `playSongById()` or `loadAndPlayCurrentSong()` (line 1816)
2. Checks for cached blob in IndexedDB
3. Creates `URL.createObjectURL()` from blob, or uses stream URL
4. If native APK: delegates to ExoPlayer bridge, pauses HTML5 audio
5. If browser: sets `audio.src`, calls `audio.play()`
6. Updates MediaSession metadata, wake lock, ambient glow
7. Loads lyrics if available

### On Song End
1. `audioElement.ended` fires (line 2401)
2. If repeat mode 2 (one): restart
3. Else: `playNextSong()` — checks pending queue first, then advances
4. Scrobble: increments `playCount` if >50% was played
5. Records listening time to IndexedDB

---

## 6A. Offline Playback Implementation

The offline fix was added after confirming that synchronized songs existed locally but the older APK still tried to send them to the native player using the saved LAN URL.

### Runtime behavior

1. `checkServerAudioAvailable()` in `app.js:47-77` probes only the server origin with a 2-byte HTTP Range request and caches the result for 10 seconds.
2. `loadAndPlayCurrentSong()` in `app.js:1899-2033` loads the IndexedDB blob first. It uses the LAN stream only when the probe succeeds.
3. In the stability build, if `audioBlob` exists, playback uses the HTML5 audio element with a `blob:` URL, even when the server is online; this prevents native/HTML5 queue contention.
4. In `SpotiLocal_offline_background_20260910.apk`, the same blob is copied once to `NativeAudioStore` in 64 KiB chunks and ExoPlayer uses the resulting local `file://` URI, allowing Android background playback and native queue advancement without the server.
5. `usingNativePlayback` makes play/pause, seek, previous/next, duration lookup, and the native state poller respect whether the current track is actually using ExoPlayer.
6. If ExoPlayer reports a network error while the server disappears between tracks, the native poller switches to the local IndexedDB blob instead of leaving the queue dead (`app.js:2542-2595`).
7. If neither a local blob nor a reachable stream exists, the UI reports that the song must be synchronized first.

### Statistics persistence

- When IndexedDB is temporarily empty/unavailable at startup, the API merge now uses the local metadata cache as ground truth instead of replacing existing `playCount` and `totalTimeListened` values with zeros (`app.js:1089-1120`).
- Listening logs are stored in both `localStorage` and the IndexedDB `settings` store under `listeningLogs` (`app.js:1244-1292`). Startup merges both copies and restores the newest unique entries.
- The current song metadata cache is written synchronously before the asynchronous IndexedDB update, reducing loss when Android closes the WebView during shutdown (`app.js:2660-2685`).
- Uninstalling/clearing Android app data still deletes both stores; no application can recover data after that without an exported backup.

### Installation requirement

The old APK cannot be repaired remotely because its JavaScript/native bridge is bundled inside the APK. Install `SpotiLocal_offline_background_20260910.apk` over the existing app, without clearing app data, so the songs and statistics already stored in `SpotiLocalDB` are preserved. If Android rejects the update because the APK signature differs, installing after uninstalling may delete the IndexedDB library; in that case start the server once, install the new APK, synchronize all songs, wait for the first local-native transfer, and then test with Wi-Fi/server disabled.

### Queue UI Access

- Desktop: click the list icon in the bottom player bar (`index.html:548`).
- Mobile: tap the current song/player bar to open the expanded player, then tap **Cola** in the expanded tools row (`index.html:636`). The compact mobile player hides `.player-right`, which is why the older queue build appeared not to have a queue button.
- The queue modal itself is defined in `index.html:641-661`; its rendering and add/remove behavior are in `app.js:3415-3472`.

### Offline acceptance test

1. Install the new offline APK over the previous APK; do not clear storage.
2. Open the library while the server is available and verify the songs are present.
3. Turn off Wi-Fi/mobile data, or stop `server.js`.
4. Play a previously synchronized song, pause/resume it, seek, change volume, and move to next/previous.
5. On the background build, the first play may take time while the song/queue is copied into native storage; later launches reuse those local files and do not need the server.

---

## 7. Capacitor APK Build Process

### Directory Structure
```
c:\Users\migue\Antigravity\SpotiLocal\     ← Capacitor project root (where the Android project lives)
c:\Users\migue\Proyectos IA varios\SpotiLocal\  ← THIS directory (web source files)
```

There is also an `apk-build/` tree under the current project root, including a staged `apk-build/www/` copy of web assets. Treat the root-level web files (`index.html`, `app.js`, `db.js`, `audio-engine.js`, `id3-parser.js`, `styles.css`, `sw.js`, and the JSON assets) as the canonical editable source. Do not assume that every APK in the directory was generated from the current source: the timestamped queue APKs are historical build artefacts.

### Steps
1. Web files live in THIS directory (`Proyectos IA varios\SpotiLocal`).
2. The checked-in `package_apk.ps1` is hardcoded to `c:\Users\migue\Antigravity\SpotiLocal`, so its `$baseDir` must be reviewed before reuse.
3. Copy/sync the canonical web files into the actual Capacitor project used for the build.
4. Build with `npx cap sync android`, then `./gradlew assembleDebug` from the Android project. On this Windows machine, use JDK 21 explicitly:
   `set JAVA_HOME=C:\Program Files\Java\jdk-21.0.12` followed by `gradlew.bat assembleDebug --no-daemon`.
5. The expected debug output is `apk-build\android\app\build\outputs\apk\debug\app-debug.apk` relative to the Capacitor project.
6. Run the packaging script only after checking its hardcoded source/destination paths. It injects files into the APK ZIP at `assets/public/` and currently names the destination `SpotiPirata_v1.3.apk`.

### Key Paths in `package_apk.ps1`
- Source APK: `$baseDir\apk-build\android\app\build\outputs\apk\debug\app-debug.apk`
- Destination: `$baseDir\SpotiPirata_v1.3.apk` (hardcoded version — update for new builds)
- Files injected into APK ZIP at `assets/public/` path

The timestamped queue APKs in the current project root were not produced by a documented reproducible command in this working copy. They are usable download artefacts, but their exact native source revision is not inferable from the filename alone.

The current offline APK was built from `apk-build/android/app/build/outputs/apk/debug/app-debug.apk` and copied to the root as `SpotiLocal_offline_queue_20260910.apk`.

### Android Bridge
The APK exposes `window.SpotiLocalNativePlayer` with methods:
- `isAvailable()` — check if native player exists
- `load(url, mediaId, title, artist, album, artworkUrl)` — load track
- `play()`, `pause()`, `stop()`
- `seekTo(ms)`
- `getState()` — returns JSON `{ isPlaying, positionMs, durationMs, mediaId, ended, error }`
- `setQueue(jsonString)` — queue of `{ id, url, title, artist, album, artworkUrl }`
- `setVolume(0-1)`, `setPlaybackRate(0.5-2.0)`
- `setRepeatMode(0/1/2)`
- `setEqBand(index, gainValue)` — 5-band EQ passthrough

---

## 8. Cover Art System

`cover-art.json` is an array of `{ title, artist, url }` where URLs are Apple Music CDN links (`600x600bb.jpg`).

The matching algorithm (`getMappedCoverUrl` in `app.js:98-109`):
1. Normalizes title and artist (lowercase, strip accents, strip non-alphanumeric)
2. Checks bidirectional `includes()` matching
3. Matches if title contains catalog title AND (artist matches OR either is empty)

The `hydrateCoverArt()` function (`app.js:1174-1218`) runs after song load:
- For each song, finds matching cover URL
- Downloads the cover image blob
- Saves to IndexedDB
- Re-renders UI

---

## 9. Known Issues / Gotchas

1. **`elementsData.js`** — This is a periodic table dataset for a completely different project. It's included in the directory but NOT loaded by `index.html`. Can be safely deleted.

2. **Version constants** — `app-version.json` says `"1.6"`, `CURRENT_APP_VERSION` in `app.js:330` says `"3.0.0"`, `server.js:86` returns `"1.6"`. The user-facing version is `1.6`.

3. **`package_apk.ps1`** is hardcoded to `SpotiPirata_v1.3.apk` — needs manual update for each new build.

4. **Service Worker cache name** is `spotipirata-pwa-v160` — doesn't match version numbers. Incrementing this triggers fresh cache.

5. **`download_real_tracks.ps1`** writes to `c:\Users\migue\Antigravity\songs\` (wrong path — should be current directory). Also references `yt-dlp.exe` at `c:\Users\migue\Antigravity\yt-dlp.exe`.

6. **No `node_modules`** — the server uses only Node.js built-in modules (`http`, `fs`, `path`, `os`). No `npm install` needed.

7. **Audio formats** — The server serves any format in the MIME map, but the app specifically handles: `.flac`, `.mp3`, `.wav`, `.m4a`, `.ogg`, `.aac`, `.webm`.

8. **`getFullUrl()` rewriting** — In native APK mode, all URLs pointing to `localhost:3000` are rewritten to `<activeServerIp>:3000`. The IP is stored in localStorage key `spotilocal_custom_ip`.

9. **Automatic update mismatch** — `server.js:85-90` advertises `SpotiPirata_v1.6.apk`, while the newest queue-labelled artefact is `SpotiLocal_queue_ui_20260909_205325.apk`. Use the direct queue URL from the current snapshot unless `server.js` is deliberately updated.

10. **Generated extension mismatch** — `generate_songs.js` and `generate_more_songs.js` write PCM RIFF/WAV data into filenames ending in `.flac`. These generated files are not genuine FLAC files. The current hosted library is MP3, so this does not affect the current server test.

11. **Two source roots** — The active web root is under `Proyectos IA varios`, but `package_apk.ps1` targets `Antigravity`. This can silently package stale files unless the source paths are aligned first.

12. **LAN prerequisites** — The phone and PC must be on the same Wi-Fi, Windows Firewall must allow inbound TCP 3000, and the phone must use the current PC IP. If DHCP changes the IP, update Settings > Dirección IP de tu PC en la Red Wi-Fi.

13. **Offline APK deployment** — Updating `app.js` or `apk-build/www/app.js` does not update an already installed APK. Rebuild and install `SpotiLocal_offline_queue_20260910.apk`; preserve app data if the synchronized IndexedDB library must survive the update.

---

## 10. How to Recreate from Scratch (5-Minute Guide)

```bash
# 1. Install Node.js (already on this machine at C:\Program Files\nodejs\node.exe)

# 2. Navigate to project
cd "C:\Users\migue\Proyectos IA varios\SpotiLocal"

# 3. Generate sample songs (creates WAV files in songs/)
node generate_songs.js
node generate_more_songs.js

# 4. (Optional) Generate icons
node create_icons.js

# 5. Start the server
node server.js
# → Server runs on http://localhost:3000
# → Phone connects via WiFi at http://<PC_IP>:3000

# 6. Open in browser
# → http://localhost:3000 (desktop)
# → http://<PC_IP>:3000 (mobile phone on same WiFi)
```

No dependencies. No build step. No configuration files needed.

### Current Machine Shortcut

For the current machine, the verified commands/URLs are:

```powershell
Start-Process -FilePath "C:\Program Files\nodejs\node.exe" -ArgumentList "server.js" -WorkingDirectory "C:\Users\migue\Proyectos IA varios\SpotiLocal"

# App/PWA and song sync:
http://192.168.1.65:3000

# Latest queue-labelled APK artefact:
http://192.168.1.65:3000/SpotiLocal_queue_ui_20260909_205325.apk

# Offline-capable APK built from the current source:
http://192.168.1.65:3000/SpotiLocal_offline_queue_20260910.apk

# Offline-capable APK with visible mobile queue button:
http://192.168.1.65:3000/SpotiLocal_offline_queue_ui_20260910.apk

# Final unique-name APK (avoid cached previous downloads):
http://192.168.1.65:3000/SpotiLocal_offline_queue_ui_statsfix_20260910.apk

# Latest stability APK: synchronized songs always use local IndexedDB audio:
http://192.168.1.65:3000/SpotiLocal_offline_stable_20260910.apk

# Background-capable offline APK: local blobs copied to native ExoPlayer storage:
http://192.168.1.65:3000/SpotiLocal_offline_background_20260910.apk

# Diagnostics:
http://192.168.1.65:3000/api/songs
http://192.168.1.65:3000/api/version
```

In the mobile app, save `192.168.1.65` in the PC IP setting and press **Sincronizar Música**. The app first uses local IndexedDB/localStorage, then fetches `/api/songs`, merges server metadata, and downloads missing audio blobs in the background.

---

## 11. localStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `spotilocal_custom_ip` | string | Saved PC IP address for native APK |
| `spotilocal_listening_logs` | JSON array | `[{ timestamp, songId, seconds, playlistId }]` — capped at 10000 entries |
| `spotilocal_cached_songs` | JSON array | Lightweight song metadata for instant first-paint |
| `spotilocal_app_version` | string | Last installed PWA version |

---

## 12. IndexedDB Schema (`SpotiLocalDB` v1)

### Store: `songs`
Key: `id` (string)
Indexes: `title`, `artist`, `album`, `isLiked`, `dateAdded`
Fields: `id, title, artist, album, year, genre, audioBlob (Blob), coverBlob (Blob), coverUrl, audioUrl, isLiked, playCount, totalTimeListened, dateAdded`

### Store: `playlists`
Key: `id` (string)
Fields: `id, name, songIds[] (string[]), createdAt, totalTimeListened`

### Store: `lyrics`
Key: `songId` (string)
Fields: `songId, content (LRC text)`

### Store: `settings`
Key: `key` (string)
Fields: `key, value`
Known keys: `globalTotalSeconds`

---

## 13. CSS Design System

### Color Variables (`styles.css:5-24`)
```css
--spotify-green: #1db954;
--spotify-black: #121212;
--spotify-dark-grey: #181818;
--spotify-light-grey: #282828;
--spotify-grey: #b3b3b3;
--spotify-white: #ffffff;
--glass-bg: rgba(255, 255, 255, 0.04);
--glass-border: rgba(255, 255, 255, 0.08);
--card-hover: #282828;
--accent-glow: rgba(29, 185, 84, 0.3);
```

### Fonts
- Main: `'Inter'` (weights 300-800)
- Display: `'Outfit'` (weights 500-800)

### Layout
- Desktop: sidebar (250px) + main content + bottom player (85px)
- Mobile: top header (60px) + content + bottom player (64px) + bottom nav (65px)
- Grid: CSS Grid with `grid-template-columns` and `grid-template-rows`
- Responsive breakpoint: `1024px`

### Key UI Components
- `.music-card` — grid cards for recent/favorites/playlists
- `.song-row` — table rows for library/ranking/queue
- `.filter-chip` — pill buttons for filters
- `.player-bar` — fixed bottom player (3-column grid)
- `.expanded-modal` — fullscreen player overlay
- `.modal-backdrop` — centered modal dialogs
- `.preset-chip` — EQ preset selector buttons
- `.queue-entry` — queue list items

---

## 14. JavaScript Libraries Used

| Library | Source | Purpose |
|---------|--------|---------|
| Font Awesome 6.4.0 | CDN | Icons throughout the UI |
| Google Fonts (Inter, Outfit) | CDN | Typography |
| None other | — | Everything else is vanilla JS |

The project has **zero npm dependencies**. The `package.json` has no `dependencies` field.

---

## 15. File Paths Reference

All paths are relative to project root:
```
C:\Users\migue\Proyectos IA varios\SpotiLocal\
```

Capacitor build project (separate):
```
C:\Users\migue\Antigravity\SpotiLocal\
```

Capacitor APK output:
```
C:\Users\migue\Antigravity\SpotiLocal\apk-build\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 16. Worklog / Handoff History

This section records the project-context actions that happened during the handoff session, without storing credentials:

1. The codebase was inspected across the root HTML, CSS, JavaScript, Node server, PWA manifest/service worker, IndexedDB wrapper, metadata parser, audio engine, build scripts, release metadata, cover-art catalog, and song tooling.
2. `HANDOFF.md` was created as the main cross-IA/project handoff document. It intentionally does not contain API keys or other secrets.
3. The user manually changed an external Go/API key. Its value is not present in this project and must not be copied into the handoff.
4. The server was started from the project root as a detached Node process. The verified process at the time of writing was PID `26552`.
5. The LAN server was tested at `http://192.168.1.65:3000`: root returned HTTP 200, `/api/songs` returned HTTP 200 with 12 tracks, and an MP3 Range request returned HTTP 206 with `audio/mpeg`.
6. The direct latest queue-labelled APK link was verified with HTTP 200 and `application/vnd.android.package-archive`.
7. `node --check server.js` and `node --check app.js` completed without syntax errors.
8. Offline playback was corrected in the canonical `app.js`, `apk-build/www/app.js`, and generated Android public assets: local IndexedDB blobs now win when the LAN stream is unavailable, and native polling no longer overrides local playback.
9. `npx.cmd cap copy android` completed successfully.
10. `gradlew.bat assembleDebug --no-daemon` completed successfully with `JAVA_HOME=C:\Program Files\Java\jdk-21.0.12`.
11. The resulting APK is `SpotiLocal_offline_queue_20260910.apk`; its embedded `assets/public/app.js` was inspected and confirmed to contain the server probe, offline fallback, and native-mode guard.
12. The source copies were syntax-checked with `node --check`; all three canonical/staged `app.js` copies have 4066 lines and the same SHA-256 hash.
13. The mobile queue access gap was fixed by adding `btn-open-queue-expanded` to the expanded player in `index.html` and wiring it to the existing queue modal.
14. The final combined build is `SpotiLocal_offline_queue_ui_20260910.apk`; its embedded HTML/JS was inspected and confirmed to contain the mobile queue button, handler, and offline fallback.
15. Queue insertion was optimized: the native bridge now exposes `insertQueueItem()`, and `PlaybackService` uses `player.addMediaItem()` instead of rebuilding/preparing the current playlist when a pending song is added.
16. Native-to-local fallback and statistics persistence were audited and implemented after the first offline APK still lost the native stream when the server disappeared between tracks.
17. The final APK was rebuilt successfully and verified at HTTP 200 with size 7,487,116 bytes; its embedded JavaScript contains the native fallback, IndexedDB log backup, and incremental queue insertion.
18. The final APK was copied to the unique filename `SpotiLocal_offline_queue_ui_statsfix_20260910.apk` to prevent browser/Android cache ambiguity. Its ZIP contents were verified and its HTTP response returned status 200 with the expected APK MIME type and length.
19. After observing severe runtime instability, the playback policy was simplified: synchronized songs no longer probe/use the server or native player at all; they play through the local HTML5/IndexedDB path. The new stability build is `SpotiLocal_offline_stable_20260910.apk`.
20. The definitive background fix was then implemented: synchronized blobs are transferred in 64 KiB chunks to `NativeAudioStore`, and the native queue uses persistent local `file://` URIs. The resulting APK is `SpotiLocal_offline_background_20260910.apk`.
21. Background statistics and scrobbles tracking fix (2026-09-12): When outside the app on Android (screen off or app minimized), Android paused JavaScript in the WebView, causing the poller to drop accumulated intervals (`delta < 3`) and missing track transitions/scrobbles. Fixed by implementing continuous real-time listening accumulation, scrobble detection, and disk persistence in `PlaybackService.java` (`SharedPreferences`), exposed via `NativePlayerBridge.drainListeningStats()` and consumed atomically in `app.js` upon app resume and state polling. Built and published `SpotiLocal_background_stats_20260912.apk` (and mirrored to `SpotiLocal.apk`).

If another AI takes over, read this file first, then inspect the actual root-level source files before changing anything. Treat runtime state (PID, IP, cached data, and APK availability) as potentially stale after a reboot or DHCP change and re-run the diagnostics above.

22. Exact Per-Song Stats & Library Recovery Hardening (`v1.8.5`, Build #77, 2026-11-13): Eliminated substring cross-contamination (`.includes()`) in `calculateSongStatsFromLogs`, `resolveLogSongId`, and `/api/songs` merging; migrated to exact `song_stats_ledger_v2` (`spotilocal_song_ledger_v2`) keyed by `id:::<id>` for generic titles and strict canonical title/artist pairs; removed legacy 40h manual floors (`historicalFloorSeconds`, `globalTotalSeconds`, `yearlyTotalSeconds_*`); added `sanitizeCorruptedSongStats()` to detect and repair inflated substring-leaked track totals without discarding real per-song logs; hardened `getAllSongs()` / `getAllBlobRecords()` in `db.js` to iterate via `getAllKeys()` instead of bulk `.getAll()` to prevent WebView Mojo IPC truncation (`[]`); removed ID3-override substring bugs in `matchCanonicalPreset()` and ghost `"Canción Histórica"` fabrication during `repairAndRecoverLibrary()`.

23. Atomic Concurrency, Generic-Artist Isolation, Sub-10h Sanitization & Native Durable Backup (`v1.8.6`, Build #78, versionCode 28, `SpotiLocal_v1.8.6.apk` [7,522,824 bytes], 2026-11-13):
   - Added per-song & per-setting FIFO async locks (`_enqueueSongWrite`, `_enqueueSettingWrite`), `saveSongBlob()`, `getAllLyrics()`, and atomic `syncListeningStats()` in `db.js` (protecting concurrent stats & `isLiked` against stale snapshot clobbering).
   - Fixed native stats draining (`_unappliedNativeStats` buffering until `_libraryInitialHydrationDone`, batched per-song `applyNativeListeningStats()`, 3000ms throttled poller + immediate transition/pause/end drains, and HTML5 `recordCurrentSongTime()` / scrobble using `syncListeningStats`).
   - Isolated generic/placeholder artists (`isGenericArtistName`: `"Artista Local"`, `"Artista Desconocido"`, `"Desconocido"`, `"Unknown"`, `"Unknown Artist"`, `"Nube Cloud Track"`, etc.) under `id:::<id>`; forced newly added tracks (`handleFilesSelect` and `btnStartCloudDownload`) to start at `0` (`statsIsolated: true`, `{ forceExactStats: true }`); fixed `untangleLegacySharedGenericLedgerKeys()` to detect `...:::` empty/generic buckets and colliding live keys; eliminated `restoreListeningLogsFromDB()` 2x log-doubling via snapshot-aware `mergeListeningLogSources()`; fixed sub-10h corrupted stats & impossible `playCount` checks in `sanitizeCorruptedSongStats()`.
   - Added crash-safe `NativeBackupStore.java` (atomic `.tmp` + `fsync` + `.bak` fallback outside WebView), extracted pure-Java `PlaybackStatsTracker.java`, updated `PlaybackService.java` synchronous `.commit()` persistence, fixed `NativeAudioStore.findAudioFile()` zero-byte rejection + `deleteAudioFile()`, exposed durable backup/hash/delete methods on `NativePlayerBridge.java`, added `window.importDatabase()` + `#btn-import-db` in `index.html`, and fixed `ReferenceError: currentSong` in `reEnrichSongMetadata()`, `deleteSong()`, and `saveEditedMetadata()`.
   - Verified with 14 automated Node tests (`tests/spotilocal.test.mjs`) and 6 Android JUnit4 tests (`NativePersistenceAndStatsTest.java` + `ExampleUnitTest.java`).

24. Skeptical Hardening Pass (`v1.8.7`, Build #79, versionCode 29, `SpotiLocal_v1.8.7.apk` [7,527,964 bytes], 2026-11-13):
   - **Database & Transaction Safety (`db.js`):** Settled song, blob, lyric, playlist, and setting mutations strictly on `tx.oncomplete` with `tx.onerror`/`tx.onabort`/`getReq.onerror` propagation and `try/catch` guards inside `onsuccess`; added `_initPromise` deduplication + `close()` + `onversionchange`; serialized playlist operations (`_playlistWriteQueues`) and per-key `migrateEmbeddedAudioBlobs`; drained write queues on `getSong`/`getPlaylist`/`getSetting` and `clearAllSongs`; prevented `_incrementGlobalStats()` from running when song IDs do not exist.
   - **Stats Ledger, Sanitization & Backup Isolation (`app.js`):** Fixed `isUnsafeSharedCanonicalKey()` / `untangleLegacySharedGenericLedgerKeys()` to match `artist:::title` order cleanly, narrowed `isGenericSongTitle()` so real Spanish titles (`"Canción Animal"`, `"Tema ..."`) are not wiped, prevented missing `dateAdded` from defaulting to `Date.now()` on restored/loaded tracks, added wall-clock impossibility + backup-safe checks in `sanitizeCorruptedSongStats()`, isolated preset loading and colliding `saveEditedMetadata` renames under `statsIsolated: true`, stopped early `NativeBackupStore` reads from re-inflating sanitized DBs (`{ allowStatsRestore: false, skipSongs: true }`), and fixed 2-argument `np.hasLocalAudio(ck, ext)` recovery.
   - **Playback, Lifecycle & Native Storage (`app.js`, `PlaybackStatsTracker.java`, `PlaybackService.java`, `NativeAudioStore.java`, `NativePlayerBridge.java`):** Flushed outgoing HTML5 track times on switch (`forceFlush`), reset Repeat-One scrobble via `ended` without `audioElement.loop`, persisted `_unappliedNativeStats` across reloads, fixed deleted-song drain guards (`isSongDeleted`), always flushed pending unreported scrobbles (`flushIfEligible`), fixed short-track replay detection (`Math.min(2000, max(250, duration/5))`), exposed `clearAllLocalAudio()` (including 0-byte and `.part` files) and `exportBackupToDownloads()` via `MediaStore.Downloads`, and switched `sw.js` to `spotipirata-pwa-v166`.
   - Verified with 20/20 Node tests (`tests/spotilocal.test.mjs`), 8/8 Android JUnit4 tests (`NativePersistenceAndStatsTest` + `ExampleUnitTest`), live `server.js` HTTP/Range verification, and 100% SHA-256 parity across root, `apk-build/www`, `assets/public`, and inside `SpotiLocal_v1.8.7.apk` (mirrored to `SpotiLocal.apk`).
