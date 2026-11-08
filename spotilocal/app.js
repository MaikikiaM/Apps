/**
 * SpotiLocal - Main Application Logic & Controller
 */
async function initSpotiLocalApp() {
  // Server Host Resolver for Native APK / Embedded WebView
  const isCapacitorLocalhost = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port !== "3000";
  const isEmbeddedNative = window.Capacitor || window.location.protocol === "file:" || window.location.protocol.startsWith("capacitor") || isCapacitorLocalhost;
  let activeServerIp = localStorage.getItem("spotilocal_custom_ip") || (window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.hostname : "192.168.1.63");

  // Purge legacy Service Worker caches in native APK to ensure fresh v1.5 load
  if (isEmbeddedNative) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      });
    }
  }

  function getFullUrl(url) {
    if (!url) return url;
     if (url.startsWith("http://") || url.startsWith("https://")) {
       try {
         const parsedUrl = new URL(url);
         if (isEmbeddedNative && parsedUrl.port === "3000" && (parsedUrl.pathname.startsWith("/songs/") || parsedUrl.pathname.startsWith("/api/"))) {
           return `http://${activeServerIp}:3000${parsedUrl.pathname}${parsedUrl.search}`;
         }
       } catch (e) {}
       return url;
     }
     if (url.startsWith("blob:") || url.startsWith("data:")) return url;
    const cleanUrl = url.startsWith("/") ? url : "/" + url;
    const host = isEmbeddedNative
      ? (window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? `http://${window.location.hostname}:3000` : `http://${activeServerIp}:3000`)
      : "";
    return host + cleanUrl;
  }

  let serverAudioProbe = { origin: "", ok: false, checkedAt: 0 };

  async function checkServerAudioAvailable(url) {
    if (!url || url.startsWith("blob:") || url.startsWith("data:")) return false;

    const now = Date.now();
    let origin = "";
    try { origin = new URL(url).origin; } catch (e) {}
    if (serverAudioProbe.origin === origin && now - serverAudioProbe.checkedAt < 10000) {
      return serverAudioProbe.ok;
    }

    let ok = false;
    let timeoutId = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-1" },
        cache: "no-store",
        signal: controller.signal
      });
      ok = response.ok && (response.status === 200 || response.status === 206);
      if (response.body && response.body.cancel) response.body.cancel();
    } catch (e) {
      ok = false;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    serverAudioProbe = { origin, ok, checkedAt: Date.now() };
    return ok;
  }

  async function loadDisplayedAppVersion() {
    const versionLabel = document.getElementById("app-version-label");
    if (!versionLabel) return;
    try {
      const response = await fetch("app-version.json", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.version) versionLabel.textContent = `SpotiLocal Pro v${data.version}`;
    } catch (e) {}
  }

  loadDisplayedAppVersion();

  const DEFAULT_COVER_CATALOG = [
    { "title": "zigeunerweisen", "artist": "pablo sarasate", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/90/ca/6a/90ca6abc-eae3-3bee-513a-6dbb9cacdf2e/00028947862666.rgb.jpg/600x600bb.jpg" },
    { "title": "viva la vida", "artist": "coldplay", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/52/aa/85/52aa851f-15b7-6322-f91f-df84b15b7b19/190295978044.jpg/600x600bb.jpg" },
    { "title": "un beso y una flor", "artist": "nino bravo", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/85/8d/bc/858dbc48-47e5-2391-e80b-d146418c5de7/00042284118224.rgb.jpg/600x600bb.jpg" },
    { "title": "the winner takes it all", "artist": "abba", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/03/bb/30/03bb30c3-e87f-d935-3906-2c44d6cc440e/14UMGIM07613.rgb.jpg/600x600bb.jpg" },
    { "title": "soy rebelde", "artist": "jeanette", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/54/de/4f/54de4f5f-890e-7eea-492d-30cd1b135274/5099909587359.jpg/600x600bb.jpg" },
    { "title": "por que te vas", "artist": "jeanette", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/54/de/4f/54de4f5f-890e-7eea-492d-30cd1b135274/5099909587359.jpg/600x600bb.jpg" },
    { "title": "paint it black", "artist": "rolling stones", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cd/89/04/cd890449-e58f-7257-2c60-9c8c31f24ce3/13ABKIM00063.rgb.jpg/600x600bb.jpg" },
    { "title": "libre", "artist": "nino bravo", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/85/8d/bc/858dbc48-47e5-2391-e80b-d146418c5de7/00042284118224.rgb.jpg/600x600bb.jpg" },
    { "title": "la llorona", "artist": "chavela vargas", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/95/5b/00/955b009c-79a3-d61b-f8fc-36a230a093fc/886443724303.jpg/600x600bb.jpg" },
    { "title": "gangsta paradise", "artist": "coolio", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/b7/d4/ce/b7d4cee5-38ab-34af-5605-1588e9a34fec/081227515461.png/600x600bb.jpg" },
    { "title": "fairytale", "artist": "alexander rybak", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/f4/e2/77/f4e277ab-ed7d-bbba-d1d0-f8b36603ab1e/196292629521.jpg/600x600bb.jpg" },
    { "title": "back in black", "artist": "acdc", "url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1e/14/58/1e145814-281a-58e0-3ab1-145f5d1af421/886443673441.jpg/600x600bb.jpg" }
  ];
  let coverArtCatalog = [...DEFAULT_COVER_CATALOG];

  async function loadCoverArtCatalog() {
    try {
      const response = await fetch("cover-art.json", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        coverArtCatalog = data;
        if (songs && songs.length > 0) {
          renderSongsTable(songs);
          renderRecentGrid(songs.slice(0, 6));
          renderFavoritesGrid(songs.filter(s => s.isLiked));
        }
      }
    } catch (e) {}
  }

  function normalizeCoverText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function getMappedCoverUrl(song) {
    if (!song || coverArtCatalog.length === 0) return "";
    const title = normalizeCoverText(song.title);
    const artist = normalizeCoverText(song.artist);
    const match = coverArtCatalog.find(item => {
      const itemTitle = normalizeCoverText(item.title);
      const itemArtist = normalizeCoverText(item.artist);
      return (title.includes(itemTitle) || itemTitle.includes(title)) &&
             (artist.includes(itemArtist) || itemArtist.includes(artist) || !artist || !itemArtist);
    });
    return match ? match.url : "";
  }

  // Mobile Device & PWA App Mode Detection
  function checkMobileMode() {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isNarrowScreen = window.innerWidth <= 1024;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone || isEmbeddedNative;

    if (isMobileDevice || isNarrowScreen || isStandalone) {
      document.body.classList.add("is-mobile");
    }

    // Hide install buttons if already running as installed app!
    if (isStandalone) {
      const btnInstallH = document.getElementById("btn-install-pwa-header");
      const pwaCard = document.getElementById("pwa-install-card");
      if (btnInstallH) btnInstallH.style.display = "none";
      if (pwaCard) pwaCard.style.display = "none";
    }
  }

  checkMobileMode();
  window.addEventListener("resize", checkMobileMode);

  // State
  let songs = [];
  let playlists = [];
  let currentQueue = [];
  let unshuffledQueue = [];
  let pendingQueue = [];
  let currentSongIndex = -1;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 1; // 1: all (infinite continuous loop), 2: one
  let currentTab = "home";
  let vizMode = "bars";
  let vizAnimationFrame = null;
  let sleepTimerInterval = null;
  let sleepTimerEndTime = null;
  let currentLyrics = [];
  let deferredPwaPrompt = null;
  let crossfadeDuration = 4; // Seconds
  let currentSongListenedSeconds = 0;
  let editingSongId = null;
  let currentRankingFilter = "weekly";
  let coverHydrationPromise = null;
  let usingNativePlayback = false;
  let nativeLocalAudioUrls = new Map();
  let nativeLocalQueuePromise = null;
  let _libraryTableDirty = true;
  const coverObjectUrlCache = new Map();

  function isNativeBridgeAvailable() {
    return Boolean(
      typeof window.SpotiLocalNativePlayer !== "undefined" &&
      window.SpotiLocalNativePlayer.isAvailable &&
      window.SpotiLocalNativePlayer.isAvailable()
    );
  }

  // Global Tab Switcher (available immediately)
  window.switchTab = function(tabName) {
    if (!tabName) return;
    currentTab = tabName;

    document.querySelectorAll(".nav-item, .mobile-nav-item").forEach(el => {
      if (el.getAttribute("data-tab") === tabName) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });

    document.querySelectorAll(".tab-view").forEach(view => {
      if (view.id === `view-${tabName}`) {
        view.classList.add("active");
        view.setAttribute("style", "display: flex !important;");
      } else {
        view.classList.remove("active");
        view.setAttribute("style", "display: none !important;");
      }
    });

    try {
      if (tabName === "home") {
        if (typeof startVisualizer === "function") startVisualizer();
        if (typeof renderHomeStats === "function") renderHomeStats();
      } else if (tabName === "ranking") {
        if (typeof renderRankingView === "function") renderRankingView(currentRankingFilter, true);
      } else if (tabName === "library") {
        if (_libraryTableDirty && typeof renderSongsTable === "function") {
          _libraryTableDirty = false;
          renderSongsTable(songs);
        }
        if (typeof renderPlaylistsGrid === "function") renderPlaylistsGrid();
      } else if (tabName === "settings") {
        if (typeof updateStatsAuditCard === "function") updateStatsAuditCard();
      }
    } catch(e) {}
  };

  // Global Document Delegation for Nav Items
  document.addEventListener("click", (e) => {
    const navBtn = e.target.closest(".nav-item, .mobile-nav-item");
    if (navBtn) {
      const tab = navBtn.getAttribute("data-tab");
      if (tab && window.switchTab) {
        window.switchTab(tab);
      }
    }
  });

  document.addEventListener("touchstart", (e) => {
    const navBtn = e.target.closest(".nav-item, .mobile-nav-item");
    if (navBtn) {
      const tab = navBtn.getAttribute("data-tab");
      if (tab && window.switchTab) {
        window.switchTab(tab);
      }
    }
  }, { passive: true });

  // Global Settings Action Handlers
  window.saveServerIp = function() {
    const input1 = document.getElementById("custom-ip-input");
    const input2 = document.getElementById("pc-ip-input");
    const newIp = (input1 && input1.value ? input1.value.trim() : "") || (input2 && input2.value ? input2.value.trim() : "");
    if (newIp) {
      activeServerIp = newIp;
      localStorage.setItem("spotilocal_custom_ip", newIp);
      if (input1) input1.value = newIp;
      if (input2) input2.value = newIp;
      if (typeof showToast === "function") showToast(`IP guardada: ${newIp} 📡`);
      if (typeof loadSongsFromDB === "function") loadSongsFromDB();
      if (typeof window.checkForUpdates === "function") window.checkForUpdates(true);
    }
  };

  window.forceSyncMusic = async function() {
    const btn = document.getElementById("btn-force-sync");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Conectando con PC (${activeServerIp})...`;
    }
    if (typeof showToast === "function") showToast(`Conectando con tu PC en ${activeServerIp}...`);

    try {
      if (typeof loadSongsFromDB === "function") {
        await loadSongsFromDB((msg) => {
          if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${msg}`;
        });
      }

      if (songs && songs.length > 0) {
        if (typeof downloadAndCacheAllSongs === "function") {
          await downloadAndCacheAllSongs(songs, btn);
        }
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#1db954;"></i> ¡Música Guardada en el Móvil! 📱`;
          setTimeout(() => {
            btn.innerHTML = `<i class="fa-solid fa-rotate"></i> Sincronizar Música 🔄`;
          }, 3500);
        }
      } else {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ff9800;"></i> Sin canciones en el PC`;
          setTimeout(() => {
            btn.innerHTML = `<i class="fa-solid fa-rotate"></i> Sincronizar Música 🔄`;
          }, 3500);
        }
      }
    } catch(err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ff5555;"></i> Error de conexión con PC`;
        setTimeout(() => {
          btn.innerHTML = `<i class="fa-solid fa-rotate"></i> Sincronizar Música 🔄`;
        }, 3500);
      }
    }
  };

  window.downloadApkUpdate = function(version) {
    const targetIp = window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.hostname : activeServerIp;
    const v = version || window.latestServerVersion || '1.7.4';
    const fileName = version ? `SpotiLocal_v${version}.apk` : (window.latestServerFileName || `SpotiLocal_v${v}.apk`);
    const apkUrl = version
      ? `http://${targetIp}:3000/${fileName}`
      : (window.latestServerDownloadUrl || `http://${targetIp}:3000/${fileName}`);
    if (typeof showToast === "function") showToast(`Iniciando descarga de SpotiLocal v${v}... 📥`);
    
    let link = document.getElementById("hidden-apk-download-link");
    if (!link) {
      link = document.createElement("a");
      link.id = "hidden-apk-download-link";
      link.target = "_blank";
      document.body.appendChild(link);
    }
    link.href = apkUrl;
    link.download = fileName;
    link.click();
  };

  const CURRENT_APP_VERSION = "1.8.4";

  window.checkForUpdates = async function(manual = true) {
    const statusEl = document.getElementById("update-status-lbl");
    const btn = document.getElementById("btn-check-update");
    const updateContainer = document.getElementById("pwa-update-action-container");
    const targetIp = window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.hostname : activeServerIp;
    
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Comprobando...`;
    }
    if (statusEl) statusEl.textContent = `Consultando servidor (${targetIp}:3000)...`;
    if (manual && typeof showToast === "function") showToast("Buscando actualizaciones de SpotiLocal...");

    // Also trigger Service Worker update check
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      } catch(e) {}
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`http://${targetIp}:3000/api/version?_t=${Date.now()}`, { 
        signal: controller.signal,
        cache: "no-store"
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const serverVersion = data.version || '3.0.0';
        window.latestServerVersion = serverVersion;

        const infoCardHeader = document.querySelector(".info-card h4");
        if (infoCardHeader) infoCardHeader.textContent = `SpotiLocal Pro v${serverVersion}`;

        if (updateContainer) {
          updateContainer.style.display = "block";
          const applyBtn = document.getElementById("btn-apply-pwa-update");
          if (applyBtn) applyBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Actualizar Ahora a v${serverVersion} ⚡`;
        }

        if (statusEl) statusEl.textContent = `¡Conectado! Versión v${serverVersion} disponible en tu servidor local.`;

        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#1db954;"></i> Actualización Lista ✨`;
          setTimeout(() => {
            btn.innerHTML = `<i class="fa-solid fa-rotate"></i> Buscar Actualizaciones 🚀`;
          }, 4000);
        }
        if (typeof loadSongsFromDB === "function") await loadSongsFromDB();
        if (manual && typeof showToast === "function") showToast(`¡SpotiLocal v${serverVersion} lista para actualizar! 🚀`);
      } else {
        if (statusEl) statusEl.textContent = "Modo Offline (Servidor no disponible)";
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ff9800;"></i> Servidor No Disponible`;
          setTimeout(() => {
            btn.innerHTML = `<i class="fa-solid fa-rotate"></i> Buscar Actualizaciones 🚀`;
          }, 3500);
        }
        if (manual && typeof showToast === "function") showToast("Servidor local no disponible (Modo Offline)");
      }
    } catch(e) {
      if (statusEl) statusEl.textContent = "Modo Offline Activo (Sin conexión al servidor)";
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ff5555;"></i> Modo Offline`;
        setTimeout(() => {
          btn.innerHTML = `<i class="fa-solid fa-rotate"></i> Buscar Actualizaciones 🚀`;
        }, 3500);
      }
      if (manual && typeof showToast === "function") showToast("Modo Offline activo (Sin conexión al servidor)");
    }
  };

  window.applyPwaUpdate = async function() {
    const statusEl = document.getElementById("update-status-lbl");
    const applyBtn = document.getElementById("btn-apply-pwa-update");
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Aplicando actualización...`;
    }
    if (statusEl) statusEl.textContent = "Limpiando caché antigua y descargando última versión...";
    if (typeof showToast === "function") showToast("⚡ Actualizando SpotiLocal PWA...");

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          if (registration.active) {
            registration.active.postMessage({ type: 'CLEAR_CACHE' });
          }
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if (window.latestServerVersion) {
        localStorage.setItem("spotilocal_app_version", window.latestServerVersion);
      }
    } catch(e) {
      console.warn("Update cache clear error:", e);
    }

    setTimeout(() => {
      if (typeof showToast === "function") showToast("🎉 ¡Actualización completada! Reiniciando...");
      window.location.reload(true);
    }, 600);
  };

  const pcIpInput = document.getElementById("pc-ip-input");
  const btnSavePcIp = document.getElementById("btn-save-pc-ip");
  if (pcIpInput) {
    pcIpInput.value = localStorage.getItem("spotilocal_custom_ip") || (window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.hostname : "192.168.1.63");
  }
  if (btnSavePcIp) {
    btnSavePcIp.addEventListener("click", () => {
      const val = pcIpInput ? pcIpInput.value.trim() : "";
      if (val) {
        localStorage.setItem("spotilocal_custom_ip", val);
        activeServerIp = val;
        if (typeof showToast === "function") showToast(`IP del PC actualizada a ${val} 📡`);
        loadSongsFromDB();
      }
    });
  }

  window.testMobileSpeaker = function() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
      if (typeof showToast === "function") showToast("🔊 Emitiendo tono de prueba 440Hz...");
    } catch(e) {
      alert("Error en altavoz: " + e.message);
    }
  };

  window.clearDatabase = async function() {
    if (confirm("⚠️ ¿Deseas borrar toda tu biblioteca de canciones, listas y estadísticas locales?")) {
      try {
        if (typeof musicDB !== "undefined" && musicDB.clearAllSongs) {
          await musicDB.clearAllSongs();
        }
      } catch(e) {}
      localStorage.removeItem("spotilocal_listening_logs");
      localStorage.removeItem("spotilocal_playlists");
      const req = indexedDB.deleteDatabase("SpotiLocalDB");
      req.onsuccess = () => location.reload();
      setTimeout(() => location.reload(), 500);
    }
  };

  window.exportDatabase = async function() {
    const exportData = {
      songs: (songs || []).map(s => {
        const lst = (typeof getSongLedgerStats === "function") ? getSongLedgerStats(s) : null;
        return {
          title: s.title,
          artist: s.artist,
          album: s.album,
          isLiked: s.isLiked,
          playCount: Math.max(s.playCount || 0, (lst ? lst.playCount : 0)),
          totalTimeListened: Math.max(s.totalTimeListened || 0, (lst ? lst.totalTimeListened : 0))
        };
      }),
      playlists: playlists || [],
      listeningLogs: typeof getListeningLogs === "function" ? getListeningLogs() : [],
      songStatsLedger: typeof getSongStatsLedger === "function" ? getSongStatsLedger() : null
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `SpotiLocal_Backup_${Date.now()}.json`;
    a.click();
    if (typeof showToast === "function") showToast("Copia de seguridad con estadísticas descargada 📄");
  };

  // DOM Elements
  const audioElement = document.getElementById("main-audio-element");
  if (audioElement) {
    audioElement.removeAttribute("crossorigin");
    audioElement.preload = "auto";
    audioElement.onerror = () => {
      const err = audioElement.error;
      const code = err ? err.code : "desconocido";
      const msg = err ? err.message : "";
      console.warn("Audio Element Error:", code, msg);
      if (typeof showToast === "function") {
        showToast(`Error de decodificación audio (${code}) ⚠️`);
      }
    };
  }
  const ambientGlow = document.getElementById("ambient-glow");
  
  // Stats Elements
  const statTotalTime = document.getElementById("stat-total-time");
  const statTopSong = document.getElementById("stat-top-song");
  const statTopArtist = document.getElementById("stat-top-artist");
  const crossfadeSelect = document.getElementById("crossfade-select");

  // Cloud & Repertoire Elements
  const btnForceSync = document.getElementById("btn-force-sync");
  const btnLoadPresetRepertoire = document.getElementById("btn-load-preset-repertoire");
  const cloudImportModal = document.getElementById("cloud-import-modal");
  const btnOpenCloudModal = document.getElementById("btn-open-cloud-modal");
  const btnCloseCloudModal = document.getElementById("btn-close-cloud-modal");
  const btnStartCloudDownload = document.getElementById("btn-start-cloud-download");
  const cloudUrlInput = document.getElementById("cloud-url-input");
  const cloudDownloadStatus = document.getElementById("cloud-download-status");
  const cloudStatusText = document.getElementById("cloud-status-text");
  
  // Navigation
  const navItems = document.querySelectorAll(".nav-item, .mobile-nav-item");
  const tabViews = document.querySelectorAll(".tab-view");

  // File Inputs
  const audioFileInput = document.getElementById("audio-file-input");
  const mobileAudioInput = document.getElementById("mobile-audio-input");
  const dropZone = document.getElementById("drop-zone");

  // Library & Grids
  const recentGrid = document.getElementById("recent-grid");
  const favoritesGrid = document.getElementById("favorites-grid");
  const songsTableBody = document.getElementById("songs-table-body");
  const globalSearchInput = document.getElementById("global-search-input");
  const libraryPlaylistsGrid = document.getElementById("library-playlists-grid");
  const songsListContainer = document.getElementById("songs-list-container");
  const sidebarPlaylistList = document.getElementById("sidebar-playlist-list");

  // Bottom Player Bar Elements
  const playerBar = document.getElementById("player-bar");
  const playerCover = document.getElementById("player-cover");
  const playerTitle = document.getElementById("player-title");
  const playerArtist = document.getElementById("player-artist");
  const playerLikeBtn = document.getElementById("player-like-btn");
  const btnPlayPause = document.getElementById("btn-play-pause");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnShuffle = document.getElementById("btn-shuffle");
  const btnRepeat = document.getElementById("btn-repeat");
  const progressContainer = document.getElementById("progress-container");
  const progressFill = document.getElementById("progress-fill");
  const progressSlider = document.getElementById("progress-slider");
  const timeCurrent = document.getElementById("time-current");
  const timeTotal = document.getElementById("time-total");
  const volumeSlider = document.getElementById("volume-slider");
  const btnMute = document.getElementById("btn-mute");

  // Fullscreen Expanded Modal
  const expandedPlayerModal = document.getElementById("expanded-player-modal");
  const btnExpandPlayer = document.getElementById("btn-expand-player");
  const btnCloseExpanded = document.getElementById("btn-close-expanded");
  const playerLeftClick = document.getElementById("player-left-click");
  const expandedCover = document.getElementById("expanded-cover");
  const expandedTitle = document.getElementById("expanded-title");
  const expandedArtist = document.getElementById("expanded-artist");
  const expandedLikeBtn = document.getElementById("expanded-like-btn");
  const expandedProgressContainer = document.getElementById("expanded-progress-container");
  const expandedProgressFill = document.getElementById("expanded-progress-fill");
  const expandedProgressSlider = document.getElementById("expanded-progress-slider");
  const expandedTimeCurrent = document.getElementById("expanded-time-current");
  const expandedTimeTotal = document.getElementById("expanded-time-total");
  const expBtnPlayPause = document.getElementById("exp-btn-play-pause");
  const expBtnPrev = document.getElementById("exp-btn-prev");
  const expBtnNext = document.getElementById("exp-btn-next");
  const expBtnShuffle = document.getElementById("exp-btn-shuffle");
  const expBtnRepeat = document.getElementById("exp-btn-repeat");
  const speedSelect = document.getElementById("speed-select");

  // Modals & Tools
  const queueModal = document.getElementById("queue-modal");
  const btnOpenQueue = document.getElementById("btn-open-queue");
  const btnOpenQueueExpanded = document.getElementById("btn-open-queue-expanded");
  const editMetaModal = document.getElementById("edit-meta-modal");
  const editTitleInput = document.getElementById("edit-title-input");
  const editArtistInput = document.getElementById("edit-artist-input");
  const editAlbumInput = document.getElementById("edit-album-input");
  const btnCloseEditModal = document.getElementById("btn-close-edit-modal");
  const btnSaveEditMeta = document.getElementById("btn-save-edit-meta");
  const editCoverPreview = document.getElementById("edit-cover-preview");
  const btnEditPickCover = document.getElementById("btn-edit-pick-cover");
  const btnEditFetchCover = document.getElementById("btn-edit-fetch-cover");
  const editCoverFileInput = document.getElementById("edit-cover-file-input");
  const btnSanitizeMetaTitle = document.getElementById("btn-sanitize-meta-title");
  const trimSongModal = document.getElementById("trim-song-modal");
  const btnCloseTrimModal = document.getElementById("btn-close-trim-modal");
  const btnOpenTrimExpanded = document.getElementById("btn-open-trim-expanded");
  const trimModalSongTitle = document.getElementById("trim-modal-song-title");
  const trimModalSongArtist = document.getElementById("trim-modal-song-artist");
  const trimVisualTrack = document.getElementById("trim-visual-track");
  const trimWaveformCanvas = document.getElementById("trim-waveform-canvas");
  const trimDimLeft = document.getElementById("trim-dim-left");
  const trimActiveRegion = document.getElementById("trim-active-region");
  const trimDimRight = document.getElementById("trim-dim-right");
  const trimPlayhead = document.getElementById("trim-playhead");
  const lblTrimStart = document.getElementById("lbl-trim-start");
  const lblTrimDuration = document.getElementById("lbl-trim-duration");
  const lblTrimEnd = document.getElementById("lbl-trim-end");
  const sliderTrimStart = document.getElementById("slider-trim-start");
  const sliderTrimEnd = document.getElementById("slider-trim-end");
  const btnTrimStartMinus = document.getElementById("btn-trim-start-minus");
  const btnTrimStartPlus = document.getElementById("btn-trim-start-plus");
  const btnSetTrimStartHere = document.getElementById("btn-set-trim-start-here");
  const btnTrimEndMinus = document.getElementById("btn-trim-end-minus");
  const btnTrimEndPlus = document.getElementById("btn-trim-end-plus");
  const btnSetTrimEndHere = document.getElementById("btn-set-trim-end-here");
  const btnPreviewStart = document.getElementById("btn-preview-start");
  const btnPreviewEnd = document.getElementById("btn-preview-end");
  const btnAutoDetectSilence = document.getElementById("btn-auto-detect-silence");
  const sliderTrimGain = document.getElementById("slider-trim-gain");
  const lblTrimGain = document.getElementById("lbl-trim-gain");
  const btnGainMinus = document.getElementById("btn-gain-minus");
  const btnGainZero = document.getElementById("btn-gain-zero");
  const btnGainPlus = document.getElementById("btn-gain-plus");
  const btnResetTrim = document.getElementById("btn-reset-trim");
  const btnSaveTrim = document.getElementById("btn-save-trim");
  const toggleTrimEnabled = document.getElementById("toggle-trim-enabled");
  const lblTrimToggleStatus = document.getElementById("lbl-trim-toggle-status");
  const lblTrimToggleSub = document.getElementById("lbl-trim-toggle-sub");
  const iconTrimToggle = document.getElementById("icon-trim-toggle");
  const trimControlsContainer = document.getElementById("trim-controls-container");
  const btnExpandedOptions = document.getElementById("btn-expanded-options");
  function getQueueEntries() {
    if (currentSongIndex < 0) {
      return [
        ...pendingQueue.map(song => ({ song, pending: true, current: false })),
        ...currentQueue.map(song => ({ song, pending: false, current: false }))
      ];
    }
    return [
      ...currentQueue.slice(0, currentSongIndex + 1).map(song => ({ song, pending: false, current: song === currentQueue[currentSongIndex] })),
      ...pendingQueue.map(song => ({ song, pending: true, current: false })),
      ...currentQueue.slice(currentSongIndex + 1).map(song => ({ song, pending: false, current: false }))
    ];
  }

  function serializeNativeSong(song) {
    const queueCover = getCoverSrc(song);
    const localUrl = nativeLocalAudioUrls.get(getNativeAudioKey(song)) || "";
    return {
      id: song.id || song.audioUrl,
      url: localUrl || (song.audioUrl ? getFullUrl(song.audioUrl) : ""),
      title: song.title || "Sin título",
      artist: song.artist || "Artista desconocido",
      album: song.album || "",
      artworkUrl: /^https?:\/\//i.test(queueCover) ? queueCover : "",
      trimStart: (song.trimEnabled !== false && typeof song.trimStart === "number") ? song.trimStart : 0,
      trimEnd: (song.trimEnabled !== false && typeof song.trimEnd === "number") ? song.trimEnd : 0,
      gainDb: typeof song.gainDb === "number" ? song.gainDb : 0
    };
  }

  function serializeNativeQueue() {
    return getQueueEntries().map(({ song }) => serializeNativeSong(song)).filter(song => song.url);
  }

  function syncNativeQueue() {
    if (!usingNativePlayback) return;
    if (typeof window.SpotiLocalNativePlayer === "undefined" || !window.SpotiLocalNativePlayer.setQueue) return;
    const nativeQueue = serializeNativeQueue();
    if (nativeQueue.length > 0) window.SpotiLocalNativePlayer.setQueue(JSON.stringify(nativeQueue));
  }

  async function addToQueue(song) {
    if (!song) return;
    pendingQueue.push(song);
    const nativePlayer = typeof window.SpotiLocalNativePlayer !== "undefined"
      ? window.SpotiLocalNativePlayer
      : null;
    if (usingNativePlayback && nativePlayer && nativePlayer.insertQueueItem) {
      await ensureNativeLocalAudio(song, nativePlayer);
      nativePlayer.insertQueueItem(JSON.stringify(serializeNativeSong(song)), pendingQueue.length - 1);
    } else {
      syncNativeQueue();
    }
    try { renderQueueModal(); } catch(e){}
    showToast(`"${song.title}" añadida a la cola 🎶`);
  }

  function showToast(msg) {
    let toast = document.getElementById("spotilocal-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "spotilocal-toast";
      toast.style.cssText = "position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1db954;color:#000;padding:10px 20px;border-radius:25px;font-weight:800;font-size:13px;z-index:3000000;box-shadow:0 8px 24px rgba(0,0,0,0.5);transition:opacity 0.3s ease;";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 2500);
  }

  // Queue Modal
  if (btnOpenQueue) {
    btnOpenQueue.addEventListener("click", () => queueModal.classList.add("open"));
  }
  const btnCloseQueue = document.getElementById("btn-close-queue");
  const btnClearQueue = document.getElementById("btn-clear-queue");
  const queueCount = document.getElementById("queue-count");
  const queueSongsList = document.getElementById("queue-songs-list");

  const playlistModal = document.getElementById("playlist-modal");
  const btnCreatePlaylist = document.getElementById("btn-create-playlist");
  const btnClosePlaylistModal = document.getElementById("btn-close-playlist-modal");
  const btnSavePlaylist = document.getElementById("btn-save-playlist");
  const playlistNameInput = document.getElementById("playlist-name-input");

  // Equalizer & Canvas
  const canvas = document.getElementById("visualizer-canvas");
  const canvasCtx = canvas.getContext("2d");
  const eqSliders = document.querySelectorAll(".eq-slider");
  const presetChips = document.querySelectorAll(".preset-chip");
  const vizBtns = document.querySelectorAll(".viz-btn");

  // Lyrics
  const lrcFileInput = document.getElementById("lrc-file-input");
  const lyricsScrollBox = document.getElementById("lyrics-scroll-box");
  const lyricsCover = document.getElementById("lyrics-cover");
  const lyricsTitle = document.getElementById("lyrics-title");
  const lyricsArtist = document.getElementById("lyrics-artist");
  const btnShowLyricsModal = document.getElementById("btn-show-lyrics-modal");

  // Settings
  const sleepTimerSelect = document.getElementById("sleep-timer-select");
  const sleepTimerStatus = document.getElementById("sleep-timer-status");
  const timerCountdown = document.getElementById("timer-countdown");
  const btnClearDb = document.getElementById("btn-clear-db");
  const btnExportDb = document.getElementById("btn-export-db");

  // Resize canvas
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // --------------------------------------------------------------------------
  // EVENT LISTENERS & NAVIGATION
  // --------------------------------------------------------------------------

  const switchTab = window.switchTab;

  // Automatic Mobile Device Detection (e.g. OnePlus Nord 3 5G)
  const isMobileDevice = window.innerWidth <= 900 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobileDevice) {
    document.body.classList.add("is-mobile");
  }

  // Greeting Message based on time
  function updateGreeting() {
    const hour = new Date().getHours();
    const greetingEl = document.getElementById("greeting-text");
    if (!greetingEl) return;
    if (hour < 12) greetingEl.textContent = "Buenos días ☀️";
    else if (hour < 20) greetingEl.textContent = "Buenas tardes 🎧";
    else greetingEl.textContent = "Buenas noches 🌙";
  }

  // --------------------------------------------------------------------------
  // FILE UPLOAD & PROCESSING (MOBILE & DESKTOP)
  // --------------------------------------------------------------------------

  const mobileUploadBtn = document.getElementById("mobile-upload-btn");
  if (mobileUploadBtn) {
    mobileUploadBtn.addEventListener("click", () => {
      const mobileInput = document.getElementById("mobile-audio-input");
      const audioInput = document.getElementById("audio-file-input");
      if (mobileInput) mobileInput.click();
      else if (audioInput) audioInput.click();
    });
  }

  [audioFileInput, mobileAudioInput].forEach(input => {
    if (input) {
      input.addEventListener("change", (e) => handleFilesSelect(e.target.files));
    }
  });

  // Drag & Drop
  if (dropZone) {
    dropZone.addEventListener("click", (e) => {
      if (e.target.closest(".drop-actions")) return;
      if (audioFileInput) audioFileInput.click();
    });
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      if (e.dataTransfer.files) {
        handleFilesSelect(e.dataTransfer.files);
      }
    });
  }

  // --------------------------------------------------------------------------
  // TRUE OFFLINE AUDIO DOWNLOAD & STORAGE ENGINE
  // --------------------------------------------------------------------------

  function getAudioMimeType(url, fallback = "audio/flac") {
    const pathname = String(url || "").split("?")[0].toLowerCase();
    const ext = pathname.includes(".") ? pathname.slice(pathname.lastIndexOf(".") + 1) : "";
    const mimeTypes = {
      flac: "audio/flac",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      aac: "audio/aac",
      ogg: "audio/ogg",
      opus: "audio/ogg",
      webm: "audio/webm"
    };
    return mimeTypes[ext] || fallback;
  }

  function getNativeAudioKey(song) {
    return String(song && (song.id || song.audioUrl || song.title) || "");
  }

  function getNativeAudioExtension(song) {
    const source = String(song && (song.audioUrl || song.title) || "").split("?")[0];
    const match = source.match(/\.([a-z0-9]+)$/i);
    if (match) return match[1].toLowerCase();
    const mime = String(song && song.audioBlob && song.audioBlob.type || "").toLowerCase();
    if (mime.includes("mpeg")) return "mp3";
    if (mime.includes("mp4")) return "m4a";
    if (mime.includes("wav")) return "wav";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("webm")) return "webm";
    return "mp3";
  }

  function blobChunkToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error("Audio chunk read failed"));
      reader.readAsDataURL(blob);
    });
  }

  function primeNativeLocalAudioMap(songList, nativePlayer) {
    if (!nativePlayer || !nativePlayer.resolveLocalAudioUrls || !Array.isArray(songList) || songList.length === 0) return;
    try {
      const items = [];
      for (let i = 0; i < songList.length; i++) {
        const s = songList[i];
        if (!s) continue;
        const key = getNativeAudioKey(s);
        const ext = getNativeAudioExtension(s);
        if (key && !nativeLocalAudioUrls.has(key)) {
          items.push({ key, ext });
        }
      }
      if (items.length === 0) return;
      const resJson = nativePlayer.resolveLocalAudioUrls(JSON.stringify(items));
      if (resJson) {
        const resolved = JSON.parse(resJson);
        for (const k in resolved) {
          if (resolved[k]) nativeLocalAudioUrls.set(k, resolved[k]);
        }
      }
    } catch(e) {}
  }

  const _inFlightNativeAudio = new Map();
  let _nativeTransferSeq = 0;

  async function ensureNativeLocalAudio(song, nativePlayer) {
    if (!song || !nativePlayer || !nativePlayer.hasLocalAudio || !nativePlayer.getLocalAudioUrl) return "";
    const key = getNativeAudioKey(song);
    const extension = getNativeAudioExtension(song);
    if (!key) return "";
    if (nativeLocalAudioUrls.has(key)) return nativeLocalAudioUrls.get(key);

    if (_inFlightNativeAudio.has(key)) {
      return _inFlightNativeAudio.get(key);
    }

    const transferPromise = (async () => {
      let transferId = null;
      try {
        if (nativePlayer.hasLocalAudio(key, extension)) {
          const existingUrl = nativePlayer.getLocalAudioUrl(key, extension) || "";
          if (existingUrl) {
            nativeLocalAudioUrls.set(key, existingUrl);
            return existingUrl;
          }
        }

        let blob = song.audioBlob;
        if (!blob && typeof musicDB !== "undefined" && musicDB.getAudioBlob) {
          blob = await musicDB.getAudioBlob(song.id);
          if (blob) song.audioBlob = blob;
        }
        if (!blob && typeof musicDB !== "undefined" && musicDB.getSong) {
          const dbSong = await musicDB.getSong(song.id);
          blob = dbSong && dbSong.audioBlob;
          if (blob) song.audioBlob = blob;
        }
        if (!blob || typeof blob.size !== "number" || blob.size <= 0) return "";

        transferId = "tx_" + Date.now() + "_" + (++_nativeTransferSeq);
        const useSessionTransfer = typeof nativePlayer.beginLocalAudioTransfer === "function";

        if (useSessionTransfer) {
          if (!nativePlayer.beginLocalAudioTransfer(transferId, key, extension)) return "";
        } else {
          if (!nativePlayer.beginLocalAudio || !nativePlayer.beginLocalAudio(key, extension)) return "";
        }

        const chunkSize = 256 * 1024;
        for (let offset = 0; offset < blob.size; offset += chunkSize) {
          const chunk = await blobChunkToBase64(blob.slice(offset, Math.min(offset + chunkSize, blob.size)));
          if (useSessionTransfer) {
            if (!nativePlayer.appendLocalAudioTransferChunk || !nativePlayer.appendLocalAudioTransferChunk(transferId, chunk)) {
              throw new Error("Native audio transfer chunk rejected");
            }
          } else {
            if (!nativePlayer.appendLocalAudioChunk || !nativePlayer.appendLocalAudioChunk(chunk)) {
              throw new Error("Native audio chunk rejected");
            }
          }
        }

        let localUrl = "";
        if (useSessionTransfer) {
          localUrl = nativePlayer.finishLocalAudioTransfer(transferId, key, extension) || "";
        } else {
          localUrl = nativePlayer.finishLocalAudio(key, extension) || "";
        }

        if (localUrl) nativeLocalAudioUrls.set(key, localUrl);
        return localUrl;
      } catch (e) {
        try {
          if (transferId && typeof nativePlayer.abortLocalAudioTransfer === "function") {
            nativePlayer.abortLocalAudioTransfer(transferId);
          } else if (nativePlayer.abortLocalAudio) {
            nativePlayer.abortLocalAudio();
          }
        } catch (ignored) {}
        return "";
      } finally {
        _inFlightNativeAudio.delete(key);
      }
    })();

    _inFlightNativeAudio.set(key, transferPromise);
    return transferPromise;
  }

  let _nativeLocalQueueGen = 0;
  function prepareNativeLocalQueueInBackground(songList, nativePlayer) {
    if (!nativePlayer || !Array.isArray(songList) || songList.length === 0) return;
    primeNativeLocalAudioMap(songList, nativePlayer);

    const pendingSongs = [];
    for (let i = 0; i < songList.length; i++) {
      const s = songList[i];
      if (!s) continue;
      const key = getNativeAudioKey(s);
      if (key && !nativeLocalAudioUrls.has(key)) {
        pendingSongs.push(s);
      }
    }
    if (pendingSongs.length === 0) {
      syncNativeQueue();
      return;
    }

    const currentGen = ++_nativeLocalQueueGen;
    let idx = 0;
    let processedSinceSync = 0;

    function processNext() {
      if (currentGen !== _nativeLocalQueueGen) return;
      if (idx >= pendingSongs.length) {
        syncNativeQueue();
        return;
      }
      const s = pendingSongs[idx++];
      ensureNativeLocalAudio(s, nativePlayer).then(() => {
        if (currentGen !== _nativeLocalQueueGen) return;
        processedSinceSync++;
        if (processedSinceSync >= 5) {
          processedSinceSync = 0;
          syncNativeQueue();
        }
        setTimeout(processNext, 25);
      }).catch(() => {
        if (currentGen !== _nativeLocalQueueGen) return;
        setTimeout(processNext, 25);
      });
    }
    setTimeout(processNext, 50);
  }

  async function prepareNativeLocalQueue(songList, nativePlayer) {
    if (!nativePlayer || !nativePlayer.hasLocalAudio) return "";
    primeNativeLocalAudioMap(songList, nativePlayer);
    const currSong = currentQueue[currentSongIndex];
    if (currSong) {
      const key = getNativeAudioKey(currSong);
      if (key && nativeLocalAudioUrls.has(key)) return nativeLocalAudioUrls.get(key);
      return await ensureNativeLocalAudio(currSong, nativePlayer);
    }
    return "";
  }

  async function downloadAndCacheAllSongs(songList, updateButton = null) {
    if (!songList || songList.length === 0) return;

    // Count how many actually need downloading
    const needsDownload = songList.filter(s => (!s.audioBlob || !(s.audioBlob instanceof Blob)) && s.audioUrl);
    const totalToDownload = needsDownload.length;

    if (totalToDownload === 0) {
      if (updateButton) {
        updateButton.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#1db954;"></i> ¡Todas las canciones ya están guardadas! 📱`;
        setTimeout(() => {
          updateButton.innerHTML = `<i class="fa-solid fa-rotate"></i> Sincronizar Música Local 🔄`;
        }, 3500);
      }
      return;
    }

    let downloadedCount = 0;

    for (let i = 0; i < songList.length; i++) {
      const song = songList[i];

      // Download audio Blob if not already saved in local device storage
      if ((!song.audioBlob || !(song.audioBlob instanceof Blob)) && song.audioUrl) {
        downloadedCount++;
        if (updateButton) {
          updateButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Descargando ${downloadedCount}/${totalToDownload}: ${song.title || 'canción'}...`;
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          const res = await fetch(getFullUrl(song.audioUrl), { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const blob = await res.blob();
            const responseType = blob.type && blob.type !== "application/octet-stream"
              ? blob.type
              : getAudioMimeType(song.audioUrl);
            const typedBlob = new Blob([blob], { type: responseType });
            song.audioBlob = typedBlob;
            await musicDB.saveSong(song);
          }
        } catch (e) {
          console.warn("Offline download warning for:", song.title, e);
        }
      }
    }

    if (updateButton) {
      updateButton.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#1db954;"></i> ¡${downloadedCount} canciones descargadas! 📱`;
      setTimeout(() => {
        updateButton.innerHTML = `<i class="fa-solid fa-rotate"></i> Sincronizar Música Local 🔄`;
      }, 3500);
    }
  }

  if (btnForceSync) {
    btnForceSync.addEventListener("click", async (e) => {
      e.stopPropagation();
      btnForceSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Conectando al PC (192.168.1.58)...`;
      try {
        await loadSongsFromDB((msg) => {
          btnForceSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${msg}`;
        });
        if (songs && songs.length > 0) {
          await downloadAndCacheAllSongs(songs, btnForceSync);
          btnForceSync.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#1db954;"></i> ¡Música Guardada en el Móvil! 📱`;
          setTimeout(() => {
            btnForceSync.innerHTML = `<i class="fa-solid fa-rotate"></i> Sincronizar Música Local 🔄`;
          }, 3500);
        } else {
          btnForceSync.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ff9800;"></i> Sin respuesta del PC`;
          setTimeout(() => {
            btnForceSync.innerHTML = `<i class="fa-solid fa-rotate"></i> Sincronizar Música Local 🔄`;
          }, 4000);
        }
      } catch (err) {
        btnForceSync.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ff5555;"></i> Error al conectar con PC`;
        setTimeout(() => {
          btnForceSync.innerHTML = `<i class="fa-solid fa-rotate"></i> Sincronizar Música Local 🔄`;
        }, 4000);
      }
    });
  }

  if (btnLoadPresetRepertoire) {
    btnLoadPresetRepertoire.addEventListener("click", async (e) => {
      e.stopPropagation();
      btnLoadPresetRepertoire.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando ABBA FLAC...`;
      try {
        await loadSongsFromDB();
        await downloadAndCacheAllSongs(songs, btnLoadPresetRepertoire);
      } catch (err) {
        btnLoadPresetRepertoire.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Cargar Repertorio Incluido 🎵`;
      }
    });
  }

  if (btnOpenCloudModal) {
    btnOpenCloudModal.addEventListener("click", async (e) => {
      e.stopPropagation();
      await loadSongsFromDB();
    });
  }

  async function handleFilesSelect(files) {
    if (!files || files.length === 0) return;

    if (typeof showToast === "function") {
      showToast("Añadiendo canción a tu biblioteca local... 🎵");
    }

    let addedCount = 0;
    let lastAddedTitle = "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let metadata = {
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: "Artista Local",
          album: "Música en Móvil",
          year: "2026",
          genre: "Audio Local",
          coverBlob: null
        };

        try {
          const parsed = await ID3Parser.parse(file);
          if (parsed) metadata = { ...metadata, ...parsed };
        } catch (e) {}

        const songId = "song_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
        if (typeof unmarkSongAsDeleted === "function") {
          unmarkSongAsDeleted(songId, metadata.title);
        }

        const songObj = {
          id: songId,
          title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: metadata.artist || "Artista Local",
          album: metadata.album || "Música en Móvil",
          year: metadata.year || "2026",
          genre: metadata.genre || "Audio Local",
          audioBlob: file,
          coverBlob: metadata.coverBlob || null,
          isLiked: false,
          playCount: 0,
          totalTimeListened: 0,
          dateAdded: Date.now()
        };

        const ledgerStats = (typeof getSongLedgerStats === "function") ? getSongLedgerStats(songObj) : null;
        if (ledgerStats) {
          songObj.totalTimeListened = ledgerStats.totalTimeListened || 0;
          songObj.playCount = ledgerStats.playCount || 0;
        }
        if (typeof recordSongLedgerMonotonic === "function") {
          recordSongLedgerMonotonic(songObj, 0, 0);
        }

        await musicDB.saveSong(songObj);

        // Immediate in-memory registration (instant 0ms update)
        const existingIdx = songs.findIndex(s => s.id === songObj.id);
        if (existingIdx === -1) {
          songs.unshift(songObj);
        } else {
          songs[existingIdx] = songObj;
        }

        if (currentQueue.length === 0) currentQueue = [...songs];
        else currentQueue.unshift(songObj);

        addedCount++;
        lastAddedTitle = songObj.title;
      } catch (err) {
        console.error("Error al guardar canción en móvil:", err);
      }
    }

    // Reset input elements so selecting the same file triggers change event properly
    if (audioFileInput) audioFileInput.value = "";
    if (mobileAudioInput) mobileAudioInput.value = "";
    const mobInp = document.getElementById("mobile-audio-input");
    if (mobInp) mobInp.value = "";
    const audInp = document.getElementById("audio-file-input");
    if (audInp) audInp.value = "";

    // Reset library filter to 'all' so the new song is never filtered out
    currentLibraryFilter = "all";
    document.querySelectorAll(".library-filters .filter-chip").forEach(b => {
      if (b.getAttribute("data-lib-filter") === "all") b.classList.add("active");
      else b.classList.remove("active");
    });

    // Instant UI refresh
    if (typeof saveCachedSongs === "function") saveCachedSongs(songs);
    _libraryTableDirty = true;
    renderSongsTable(songs);
    renderRecentGrid(songs.slice(0, 6));
    renderWrappedStats();
    if (typeof hydrateCoverArt === "function") hydrateCoverArt(songs);
    switchTab("library");

    if (addedCount > 0 && typeof showToast === "function") {
      showToast(addedCount === 1 ? `¡"${lastAddedTitle}" añadida con éxito! 🎵` : `¡${addedCount} canciones añadidas con éxito! 🎵`);
    }

    // Non-blocking background sync with native bridge
    if (typeof window.SpotiLocalNativePlayer !== "undefined") {
      primeNativeLocalAudioMap(songs, window.SpotiLocalNativePlayer);
      prepareNativeLocalQueueInBackground(songs, window.SpotiLocalNativePlayer);
    }
  }

  // --------------------------------------------------------------------------
  // DATABASE & UI RENDERING
  // --------------------------------------------------------------------------

  function parseSongFilename(filename) {
    const raw = filename.replace(/\.[^/.]+$/, "").trim();
    if (raw.toLowerCase().includes("abba") || raw.toLowerCase().includes("winner")) {
      return { title: "The Winner Takes It All", artist: "ABBA" };
    }
    if (raw.toLowerCase().includes("llorona")) {
      return { title: "La Llorona", artist: "Chavela Vargas" };
    }
    if (raw.toLowerCase().includes("soy rebelde")) {
      return { title: "Soy Rebelde", artist: "Jeanette" };
    }
    if (raw.toLowerCase().includes("por que te vas")) {
      return { title: "Por qué te vas", artist: "Jeanette" };
    }
    if (raw.toLowerCase().includes("zigeunerweisen")) {
      return { title: "Zigeunerweisen (Aires Gitanos)", artist: "Pablo Sarasate" };
    }
    if (raw.toLowerCase().includes("paint it black")) {
      return { title: "Paint It Black", artist: "The Rolling Stones" };
    }
    if (raw.toLowerCase().includes("viva la vida")) {
      return { title: "Viva La Vida", artist: "Coldplay" };
    }
    if (raw.toLowerCase().includes("libre")) {
      return { title: "Libre", artist: "Nino Bravo" };
    }
    if (raw.toLowerCase().includes("fairytale")) {
      return { title: "Fairytale", artist: "Alexander Rybak" };
    }
    if (raw.toLowerCase().includes("gangsta")) {
      return { title: "Gangsta's Paradise", artist: "Coolio" };
    }
    if (raw.toLowerCase().includes("back in black")) {
      return { title: "Back in Black", artist: "AC/DC" };
    }
    if (raw.toLowerCase().includes("un beso y una flor")) {
      return { title: "Un beso y una flor", artist: "Nino Bravo" };
    }

    if (raw.includes(" - ")) {
      const parts = raw.split(" - ");
      return { title: parts[0].trim(), artist: parts[1].trim() };
    }
    return { title: raw, artist: "Artista Local" };
  }

  // --------------------------------------------------------------------------
  // CANONICAL PRESET REPERTOIRE & DATA RESCUE ENGINE
  // --------------------------------------------------------------------------

  const CANONICAL_PRESET_SONGS = [
    { filename: "The Winner Takes It All - ABBA.mp3", title: "The Winner Takes It All", artist: "ABBA", album: "Super Trouper", year: "1980", genre: "Pop" },
    { filename: "Back in Black - ACDC.mp3", title: "Back in Black", artist: "AC/DC", album: "Back in Black", year: "1980", genre: "Rock" },
    { filename: "Fairytale - Alexander Rybak.mp3", title: "Fairytale", artist: "Alexander Rybak", album: "Fairytales", year: "2009", genre: "Pop / Folk" },
    { filename: "La Llorona - Chavela Vargas.mp3", title: "La Llorona", artist: "Chavela Vargas", album: "Grandes Éxitos", year: "1993", genre: "Ranchera" },
    { filename: "Viva La Vida - Coldplay.mp3", title: "Viva La Vida", artist: "Coldplay", album: "Viva la Vida", year: "2008", genre: "Alternative" },
    { filename: "Gangsta Paradise - Coolio.mp3", title: "Gangsta's Paradise", artist: "Coolio", album: "Gangsta's Paradise", year: "1995", genre: "Hip Hop" },
    { filename: "Por que te vas - Jeanette.mp3", title: "Por qué te vas", artist: "Jeanette", album: "Palabras, promesas", year: "1974", genre: "Pop / Balada" },
    { filename: "Soy Rebelde - Jeanette.mp3", title: "Soy Rebelde", artist: "Jeanette", album: "Palabras, promesas", year: "1971", genre: "Pop / Balada" },
    { filename: "Libre - Nino Bravo.mp3", title: "Libre", artist: "Nino Bravo", album: "Mi Tierra", year: "1972", genre: "Balada" },
    { filename: "Un beso y una flor - Nino Bravo.mp3", title: "Un beso y una flor", artist: "Nino Bravo", album: "Un beso y una flor", year: "1972", genre: "Balada" },
    { filename: "Zigeunerweisen - Pablo Sarasate.mp3", title: "Zigeunerweisen (Aires Gitanos)", artist: "Pablo Sarasate", album: "Classical Masterpieces", year: "1878", genre: "Clásica" },
    { filename: "Paint It Black - The Rolling Stones.mp3", title: "Paint It Black", artist: "The Rolling Stones", album: "Aftermath", year: "1966", genre: "Rock" }
  ];

  // --------------------------------------------------------------------------
  // PERMANENT DELETION BLACKLIST & CACHED REPOSITORY SHIELD
  // --------------------------------------------------------------------------

  function getDeletedSongIds() {
    try {
      const raw = localStorage.getItem("spotilocal_deleted_song_ids");
      const list = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(list) ? list.map(s => String(s).toLowerCase().trim()) : []);
    } catch (e) {
      return new Set();
    }
  }

  function markSongAsDeleted(id, title = null) {
    try {
      const set = getDeletedSongIds();
      if (id) {
        const strId = String(id).toLowerCase().trim();
        set.add(strId);
        if (strId.startsWith("folder_")) {
          set.add(strId.replace(/^folder_/, ""));
        }
      }
      if (title) {
        set.add("title_" + String(title).toLowerCase().trim());
      }
      const arr = Array.from(set);
      localStorage.setItem("spotilocal_deleted_song_ids", JSON.stringify(arr));
      if (typeof musicDB !== "undefined" && musicDB.setSetting) {
        musicDB.setSetting("deleted_song_ids", arr).catch(() => {});
      }
    } catch (e) {}
  }

  function isSongDeleted(id, title = null) {
    const set = getDeletedSongIds();
    if (!set || set.size === 0) return false;
    if (id) {
      const strId = String(id).toLowerCase().trim();
      if (set.has(strId)) return true;
      if (strId.startsWith("folder_") && set.has(strId.replace(/^folder_/, ""))) return true;
    }
    if (title) {
      const strTitle = "title_" + String(title).toLowerCase().trim();
      if (set.has(strTitle)) return true;
    }
    return false;
  }

  function unmarkSongAsDeleted(id, title = null) {
    try {
      const set = getDeletedSongIds();
      let changed = false;
      if (id) {
        const strId = String(id).toLowerCase().trim();
        if (set.has(strId)) { set.delete(strId); changed = true; }
        if (strId.startsWith("folder_")) {
          const raw = strId.replace(/^folder_/, "");
          if (set.has(raw)) { set.delete(raw); changed = true; }
        }
      }
      if (title) {
        const strTitle = "title_" + String(title).toLowerCase().trim();
        if (set.has(strTitle)) { set.delete(strTitle); changed = true; }
      }
      if (changed) {
        const arr = Array.from(set);
        localStorage.setItem("spotilocal_deleted_song_ids", JSON.stringify(arr));
        if (typeof musicDB !== "undefined" && musicDB.setSetting) {
          musicDB.setSetting("deleted_song_ids", arr).catch(() => {});
        }
      }
    } catch (e) {}
  }

  function saveCachedSongs(songList) {
    try {
      const list = songList || songs || [];
      const serializableSongs = list
        .filter(s => s && s.id && !isSongDeleted(s.id, s.title))
        .map(s => {
          const ledgerStats = (typeof getSongLedgerStats === "function") ? getSongLedgerStats(s) : null;
          const safeTime = Math.max(s.totalTimeListened || 0, (ledgerStats ? ledgerStats.totalTimeListened : 0));
          const safePlays = Math.max(s.playCount || 0, (ledgerStats ? ledgerStats.playCount : 0));
          return {
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            year: s.year,
            genre: s.genre,
            audioUrl: s.audioUrl,
            coverUrl: s.coverUrl || null,
            isLiked: s.isLiked,
            playCount: safePlays,
            totalTimeListened: safeTime,
            dateAdded: s.dateAdded,
            duration: typeof s.duration === "number" ? s.duration : 0,
            rawDuration: typeof s.rawDuration === "number" ? s.rawDuration : (typeof s.duration === "number" ? s.duration : 0),
            trimStart: typeof s.trimStart === "number" ? s.trimStart : 0,
            trimEnd: typeof s.trimEnd === "number" ? s.trimEnd : 0,
            trimEnabled: s.trimEnabled !== false,
            gainDb: typeof s.gainDb === "number" ? s.gainDb : 0,
            needsReview: Boolean(s.needsReview)
          };
        });
      localStorage.setItem("spotilocal_cached_songs", JSON.stringify(serializableSongs));
    } catch (e) {}
  }

  const CANONICAL_PRESET_BY_SIZE = [
    { size: 10245164, filename: "Back in Black - ACDC.mp3", title: "Back in Black", artist: "AC/DC", album: "Back in Black", year: "1980", genre: "Rock" },
    { size: 7297004, filename: "Fairytale - Alexander Rybak.mp3", title: "Fairytale", artist: "Alexander Rybak", album: "Fairytales", year: "2009", genre: "Pop / Folk" },
    { size: 9679724, filename: "Gangsta Paradise - Coolio.mp3", title: "Gangsta's Paradise", artist: "Coolio", album: "Gangsta's Paradise", year: "1995", genre: "Hip Hop" },
    { size: 18953324, filename: "La Llorona - Chavela Vargas.mp3", title: "La Llorona", artist: "Chavela Vargas", album: "Grandes Éxitos", year: "1993", genre: "Ranchera" },
    { size: 9970604, filename: "Libre - Nino Bravo.mp3", title: "Libre", artist: "Nino Bravo", album: "Mi Tierra", year: "1972", genre: "Balada" },
    { size: 8087084, filename: "Paint It Black - The Rolling Stones.mp3", title: "Paint It Black", artist: "The Rolling Stones", album: "Aftermath", year: "1966", genre: "Rock" },
    { size: 8218604, filename: "Por que te vas - Jeanette.mp3", title: "Por qué te vas", artist: "Jeanette", album: "Palabras, promesas", year: "1974", genre: "Pop / Balada" },
    { size: 7728044, filename: "Soy Rebelde - Jeanette.mp3", title: "Soy Rebelde", artist: "Jeanette", album: "Palabras, promesas", year: "1971", genre: "Pop / Balada" },
    { size: 11883941, filename: "The Winner Takes It All - ABBA.mp3", title: "The Winner Takes It All", artist: "ABBA", album: "Super Trouper", year: "1980", genre: "Pop" },
    { size: 10829804, filename: "Un beso y una flor - Nino Bravo.mp3", title: "Un beso y una flor", artist: "Nino Bravo", album: "Un beso y una flor", year: "1972", genre: "Balada" },
    { size: 9702764, filename: "Viva La Vida - Coldplay.mp3", title: "Viva La Vida", artist: "Coldplay", album: "Viva la Vida", year: "2008", genre: "Alternative" },
    { size: 20797484, filename: "Zigeunerweisen - Pablo Sarasate.mp3", title: "Zigeunerweisen (Aires Gitanos)", artist: "Pablo Sarasate", album: "Classical Masterpieces", year: "1878", genre: "Clásica" }
  ];

  function isGenericSongTitle(title) {
    if (!title) return true;
    const s = String(title).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return s === "" ||
           s === "cancion" ||
           s === "sin titulo" ||
           s === "untitled" ||
           s === "unknown" ||
           s === "desconocido" ||
           s === "audio" ||
           s === "tema" ||
           s === "pista" ||
           s === "track" ||
           s.includes("historica") ||
           s.includes("recuperada") ||
           s.startsWith("cancion") ||
           s.startsWith("tema") ||
           s.startsWith("audio") ||
           s.startsWith("pista") ||
           s.startsWith("track") ||
           s.startsWith("song_") ||
           s.startsWith("folder_") ||
           /^track\s*\d+/i.test(s) ||
           /^pista\s*\d+/i.test(s) ||
           /^audio\s*\d+/i.test(s);
  }

  function matchCanonicalPreset(idOrFilenameOrTitle) {
    if (!idOrFilenameOrTitle) return null;
    const str = String(idOrFilenameOrTitle).toLowerCase().trim().replace(/^folder_/, "");
    return CANONICAL_PRESET_SONGS.find(p => {
      const pFile = p.filename.toLowerCase().trim();
      const pTitle = p.title.toLowerCase().trim();
      const pArtist = p.artist.toLowerCase().trim();
      const pClean = pFile.replace(/\.[^/.]+$/, "");
      return str === pFile || str === pTitle || str === pClean ||
             str.includes(pClean) || pClean.includes(str) ||
             (str.includes(pTitle) && Math.abs(str.length - pTitle.length) < 20) ||
             (pArtist.length > 3 && str.includes(pArtist)) ||
             (str.includes("llorona") && pTitle.includes("llorona")) ||
             (str.includes("rebelde") && pTitle.includes("rebelde")) ||
             (str.includes("jeanette") && pArtist.includes("jeanette")) ||
             (str.includes("zigeunerweisen") && pTitle.includes("zigeunerweisen")) ||
             (str.includes("viva la vida") && pTitle.includes("viva")) ||
             (str.includes("gangsta") && pTitle.includes("gangsta")) ||
             (str.includes("fairytale") && pTitle.includes("fairytale")) ||
             (str.includes("back in black") && pTitle.includes("back")) ||
             (str.includes("paint it black") && pTitle.includes("paint")) ||
             (str.includes("beso y una flor") && pTitle.includes("beso")) ||
             (str.includes("libre") && pTitle.includes("libre") && pArtist.includes("nino"));
    }) || null;
  }

  function findPresetForSong(song) {
    if (!song) return null;
    return matchCanonicalPreset(song.id) ||
           (song.audioUrl ? matchCanonicalPreset(decodeURIComponent(song.audioUrl)) : null) ||
           (song.title ? matchCanonicalPreset(song.title) : null);
  }

  async function fetchOnlineCoverUrl(title, artist) {
    if (!title || !navigator.onLine) return null;
    try {
      const cleanArtist = (artist && artist !== "Artista Local" && artist !== "Artista Desconocido") ? artist : "";
      const q = `${title} ${cleanArtist}`.trim();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        const item = data.results[0];
        if (item.artworkUrl100) {
          return item.artworkUrl100.replace("100x100bb", "600x600bb");
        }
      }
    } catch(e) {}
    return null;
  }

  async function fetchBlobFromNativePlayer(keyOrMediaId, fileSize, ext = "mp3") {
    if (typeof window === "undefined" || !window.SpotiLocalNativePlayer || typeof window.SpotiLocalNativePlayer.readLocalAudioRange !== "function") {
      return null;
    }
    const player = window.SpotiLocalNativePlayer;
    const mimeMap = {
      mp3: "audio/mpeg",
      flac: "audio/flac",
      m4a: "audio/mp4",
      mp4: "audio/mp4",
      wav: "audio/wav",
      ogg: "audio/ogg",
      aac: "audio/aac"
    };
    const mimeType = mimeMap[(ext || "").toLowerCase()] || "audio/mpeg";

    try {
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalToRead = Math.min(fileSize, 40 * 1024 * 1024); // read up to 40MB
      const chunks = [];

      for (let offset = 0; offset < totalToRead; offset += chunkSize) {
        const len = Math.min(chunkSize, totalToRead - offset);
        const b64 = player.readLocalAudioRange(keyOrMediaId, offset, len);
        if (!b64) break;
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) {
          u8[j] = bin.charCodeAt(j);
        }
        chunks.push(u8);
      }

      if (chunks.length === 0) return null;
      return new Blob(chunks, { type: mimeType });
    } catch (err) {
      console.warn("fetchBlobFromNativePlayer error:", err);
      return null;
    }
  }

  async function getBlobFromAnySource(song, blobMap = null) {
    if (!song) return null;

    // 1. In-memory blob
    if (song.audioBlob instanceof Blob && song.audioBlob.size > 0) {
      return song.audioBlob;
    }

    // 2. IndexedDB blob by ID
    if (typeof musicDB !== "undefined" && musicDB.getAudioBlob) {
      try {
        const dbBlob = await musicDB.getAudioBlob(song.id);
        if (dbBlob instanceof Blob && dbBlob.size > 0) {
          song.audioBlob = dbBlob;
          song.hasAudioBlob = true;
          return dbBlob;
        }
      } catch (e) {}
    }

    // 3. Blob from blobMap if provided
    if (blobMap && blobMap.has(song.id)) {
      const mapped = blobMap.get(song.id);
      if (mapped instanceof Blob && mapped.size > 0) {
        song.audioBlob = mapped;
        song.hasAudioBlob = true;
        return mapped;
      }
    }

    // 4. Native audio file via bridge
    const nativePlayer = (typeof window !== "undefined" && window.SpotiLocalNativePlayer) ? window.SpotiLocalNativePlayer : null;
    if (nativePlayer && typeof nativePlayer.getLocalAudioInfo === "function" && typeof nativePlayer.readLocalAudioRange === "function") {
      const key = getNativeAudioKey(song);
      let info = null;
      let matchedKey = key;

      try {
        const raw = nativePlayer.getLocalAudioInfo(key);
        if (raw) info = JSON.parse(raw);
      } catch (e) {}

      if ((!info || !info.exists) && song.id && song.id !== key) {
        try {
          const raw2 = nativePlayer.getLocalAudioInfo(song.id);
          if (raw2) {
            const parsed = JSON.parse(raw2);
            if (parsed && parsed.exists) {
              info = parsed;
              matchedKey = song.id;
            }
          }
        } catch (e) {}
      }

      if (info && info.exists && info.size > 0) {
        const recoveredBlob = await fetchBlobFromNativePlayer(matchedKey, info.size, info.ext || "mp3");
        if (recoveredBlob instanceof Blob && recoveredBlob.size > 0) {
          song.audioBlob = recoveredBlob;
          song.hasAudioBlob = true;
          try {
            if (musicDB && musicDB.saveSongBlob) {
              await musicDB.saveSongBlob(song.id, recoveredBlob);
            }
          } catch (e) {}
          return recoveredBlob;
        }
      }
    }

    return null;
  }

  async function reEnrichSongMetadata(isManual = false) {
    let titlesRecovered = 0;
    let coversRecovered = 0;
    let unrecoveredCount = 0;
    if (!songs || songs.length === 0) return 0;

    let blobRecords = [];
    try {
      if (typeof musicDB !== "undefined" && musicDB.getAllBlobRecords) {
        blobRecords = await musicDB.getAllBlobRecords() || [];
      }
    } catch(e) {}

    const blobMap = new Map();
    blobRecords.forEach(r => {
      if (r && r.id && r.audioBlob instanceof Blob) blobMap.set(r.id, r.audioBlob);
    });

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      if (!song || !song.id) continue;
      if (isSongDeleted(song.id, song.title)) continue;

      let changed = false;
      const genericTitle = isGenericSongTitle(song.title);

      // Clean invalid deserialized `{}` coverBlob
      if (song.coverBlob && !(song.coverBlob instanceof Blob) && !(song.coverBlob instanceof File)) {
        song.coverBlob = null;
      }
      const hasValidBlobCover = (song.coverBlob instanceof Blob) || (song.coverBlob instanceof File);

      // 1. Get audio blob from ANY source (IndexedDB -> native-audio)
      const blob = await getBlobFromAnySource(song, blobMap);

      let foundExactTitle = false;
      let foundExactCover = false;

      // 2. If we have a blob, analyze it deterministically!
      if (blob instanceof Blob && blob.size > 0) {
        song.hasAudioBlob = true;

        // 2a. Match exact file size against canonical presets
        const presetBySize = CANONICAL_PRESET_BY_SIZE.find(p => Math.abs(p.size - blob.size) <= 4096);
        if (presetBySize) {
          if (genericTitle || song.title.startsWith("Canción Histórica") || !song.artist || song.artist === "Artista Local" || song.artist === "Artista Desconocido") {
            song.title = presetBySize.title;
            song.artist = presetBySize.artist;
            song.album = presetBySize.album;
            song.year = presetBySize.year;
            song.genre = presetBySize.genre;
            if (!song.audioUrl) song.audioUrl = getFullUrl(`/songs/${encodeURIComponent(presetBySize.filename)}`);
            foundExactTitle = true;
            changed = true;
          }
          if (!hasValidBlobCover && !song.coverBlob) {
            const mappedCover = getMappedCoverUrl(presetBySize);
            if (mappedCover && song.coverUrl !== mappedCover) {
              song.coverUrl = mappedCover;
              foundExactCover = true;
              changed = true;
            }
          }
        }

        // 2b. Parse ID3 / FLAC tags from blob
        try {
          const parsed = await ID3Parser.parse(blob);
          if (parsed) {
            if (parsed.title && !isGenericSongTitle(parsed.title) && (genericTitle || isGenericSongTitle(song.title) || song.title.startsWith("Canción Histórica") || (song.artist === "Artista Local" && song.title !== parsed.title))) {
              song.title = parsed.title;
              foundExactTitle = true;
              changed = true;
            }
            if (parsed.artist && parsed.artist !== "Artista Desconocido" && (!song.artist || song.artist === "Artista Local" || song.artist === "Artista Desconocido")) {
              song.artist = parsed.artist;
              changed = true;
            }
            if (parsed.album && parsed.album !== "Álbum Desconocido" && (!song.album || song.album === "Música en Móvil")) {
              song.album = parsed.album;
              changed = true;
            }
            if (parsed.year && !song.year) {
              song.year = parsed.year;
              changed = true;
            }
            if (parsed.genre && !song.genre) {
              song.genre = parsed.genre;
              changed = true;
            }
            if (parsed.coverBlob instanceof Blob) {
              song.coverBlob = parsed.coverBlob;
              foundExactCover = true;
              coverObjectUrlCache.delete(song.id);
              changed = true;
            }
          }
        } catch (e) {
          console.warn("ID3Parser error during recovery:", e);
        }
      }

      // 3. Check preset matching by ID or audioUrl
      const preset = findPresetForSong(song);
      if (preset && (isGenericSongTitle(song.title) || song.title.startsWith("Canción Histórica") || !song.artist || song.artist === "Artista Local" || song.artist === "Artista Desconocido")) {
        song.title = preset.title;
        song.artist = preset.artist;
        song.album = preset.album;
        song.year = preset.year;
        song.genre = preset.genre;
        if (!song.audioUrl) song.audioUrl = getFullUrl(`/songs/${encodeURIComponent(preset.filename)}`);
        foundExactTitle = true;
        changed = true;

        if (!song.coverBlob) {
          const mappedCover = getMappedCoverUrl(preset);
          if (mappedCover && song.coverUrl !== mappedCover) {
            song.coverUrl = mappedCover;
            foundExactCover = true;
            changed = true;
          }
        }
      }

      // 4. Filename parsing from ID if available
      if (isGenericSongTitle(song.title) && typeof song.id === "string") {
        let fn = null;
        if (song.id.startsWith("folder_")) fn = song.id.replace(/^folder_/, "");
        else if (song.id.endsWith(".mp3") || song.id.endsWith(".flac") || song.id.includes(" - ")) fn = song.id;
        if (fn) {
          const parsedFn = parseSongFilename(fn);
          if (parsedFn && parsedFn.title && !isGenericSongTitle(parsedFn.title)) {
            song.title = parsedFn.title;
            song.artist = parsedFn.artist || song.artist;
            foundExactTitle = true;
            changed = true;
          }
        }
      }

      // 5. Check DEFAULT_COVER_CATALOG if cover is still missing
      const stillNoCover = !(song.coverBlob instanceof Blob) && !(song.coverBlob instanceof File);
      if (stillNoCover && song.title && !isGenericSongTitle(song.title)) {
        const mappedUrl = getMappedCoverUrl(song);
        if (mappedUrl && song.coverUrl !== mappedUrl) {
          song.coverUrl = mappedUrl;
          foundExactCover = true;
          changed = true;
        }
      }

      // 6. Online cover search if online
      if (stillNoCover && !song.coverUrl && navigator.onLine && song.title && !isGenericSongTitle(song.title)) {
        try {
          const onlineUrl = await fetchOnlineCoverUrl(song.title, song.artist);
          if (onlineUrl && song.coverUrl !== onlineUrl) {
            song.coverUrl = onlineUrl;
            foundExactCover = true;
            changed = true;
          }
        } catch(e) {}
      }

      // 7. Check if song still has generic title or has no source at all:
      if (isGenericSongTitle(song.title)) {
        song.needsReview = true;
        unrecoveredCount++;
      } else {
        song.needsReview = false;
      }

      if (foundExactTitle) titlesRecovered++;
      if (foundExactCover) coversRecovered++;

      if (changed) {
        coverObjectUrlCache.delete(song.id);
        try {
          await musicDB.saveSong(song);
        } catch (e) {}
      }
    }

    // Notice: NO BLOCK F! We never guess or assign titles by array order!

    const totalEnriched = titlesRecovered + coversRecovered;
    if (totalEnriched > 0) {
      console.log(`SpotiLocal v1.8.3: ${titlesRecovered} títulos y ${coversRecovered} carátulas recuperados.`);
      saveCachedSongs(songs);
      _libraryTableDirty = true;
      renderSongsTable(songs);
      renderRecentGrid(songs.slice(0, 6));
      renderFavoritesGrid(songs.filter(s => s.isLiked));
      renderWrappedStats();
      try { renderHistoricalRanking(true); } catch(e) {}
      if (typeof hydrateCoverArt === "function") hydrateCoverArt(songs);
      if (currentSong) updatePlayerMetadata(currentSong);
      if (typeof showToast === "function") {
        let msg = `✨ ${titlesRecovered} títulos y ${coversRecovered} carátulas recuperados`;
        if (unrecoveredCount > 0) {
          msg += ` (${unrecoveredCount} sin identificar)`;
        }
        showToast(msg);
      }
    } else if (isManual) {
      if (typeof showToast === "function") {
        if (unrecoveredCount > 0) {
          showToast(`ℹ️ No se encontraron archivos para ${unrecoveredCount} canciones (abre Diagnóstico).`);
        } else {
          showToast("Todas las canciones activas ya tienen sus datos y carátulas asignados.");
        }
      }
    }

    return totalEnriched;
  }

  window.reEnrichSongMetadataUI = async function() {
    if (typeof showToast === "function") {
      showToast("Analizando canciones y recuperando carátulas... 🔍");
    }
    await reEnrichSongMetadata(true);
  };

  window.generateLibraryDiagnosticReport = async function() {
    const lines = [];
    lines.push("=== DIAGNÓSTICO FORENSE DE BIBLIOTECA SPOTILOCAL ===");
    lines.push(`Fecha: ${new Date().toISOString()}`);
    lines.push(`App Version: 1.8.4 (Build #75, versionCode 26)`);
    lines.push(`Total canciones en memoria: ${songs.length}`);
    lines.push(`User Agent: ${navigator.userAgent}`);
    lines.push("");

    const nativePlayer = (typeof window !== "undefined" && window.SpotiLocalNativePlayer) ? window.SpotiLocalNativePlayer : null;
    const hasNativeBridge = Boolean(nativePlayer && typeof nativePlayer.getLocalAudioInfo === "function");
    lines.push(`Puente nativo disponible: ${hasNativeBridge ? "SÍ" : "NO"}`);

    let nativeFiles = [];
    if (nativePlayer && typeof nativePlayer.listLocalAudioFiles === "function") {
      try {
        const raw = nativePlayer.listLocalAudioFiles();
        nativeFiles = JSON.parse(raw) || [];
      } catch (e) {
        lines.push(`Error listando native files: ${e.message}`);
      }
    }
    lines.push(`Archivos en files/native-audio: ${nativeFiles.length}`);
    lines.push("--------------------------------------------------");

    let blobRecords = [];
    try {
      if (typeof musicDB !== "undefined" && musicDB.getAllBlobRecords) {
        blobRecords = await musicDB.getAllBlobRecords() || [];
      }
    } catch(e) {}
    lines.push(`Registros en IndexedDB song_blobs: ${blobRecords.length}`);
    lines.push("--------------------------------------------------");
    lines.push("");

    lines.push("--- CANCIONES EN BIBLIOTECA ---");
    const matchedNativeNames = new Set();

    for (let i = 0; i < songs.length; i++) {
      const s = songs[i];
      lines.push(`[#${i+1}] ID: ${s.id}`);
      lines.push(`    Título: "${s.title}" | Artista: "${s.artist}" | Álbum: "${s.album}"`);
      lines.push(`    needsReview: ${Boolean(s.needsReview)} | isGeneric: ${isGenericSongTitle(s.title)}`);

      // Check IndexedDB audio blob
      let dbBlob = null;
      try {
        if (typeof musicDB !== "undefined" && musicDB.getAudioBlob) {
          dbBlob = await musicDB.getAudioBlob(s.id);
        }
      } catch(e) {}
      const dbBlobSize = (dbBlob && dbBlob.size) ? `${dbBlob.size} bytes` : "NO";
      lines.push(`    IndexedDB AudioBlob: ${dbBlobSize}`);

      // Check coverBlob
      const hasCover = (s.coverBlob instanceof Blob) ? `SÍ (${s.coverBlob.size} bytes)` : (s.coverUrl ? `URL: ${s.coverUrl.slice(0, 45)}...` : "NO");
      lines.push(`    Carátula: ${hasCover}`);

      // Check Native Audio
      if (hasNativeBridge) {
        try {
          const key = getNativeAudioKey(s);
          const raw = nativePlayer.getLocalAudioInfo(key);
          const info = raw ? JSON.parse(raw) : null;
          if (info && info.exists) {
            matchedNativeNames.add(info.name);
            lines.push(`    Copia nativa: SÍ (archivo: ${info.name}, tamaño: ${info.size} bytes, ext: ${info.ext})`);
          } else {
            const raw2 = (key !== s.id) ? nativePlayer.getLocalAudioInfo(s.id) : null;
            const info2 = raw2 ? JSON.parse(raw2) : null;
            if (info2 && info2.exists) {
              matchedNativeNames.add(info2.name);
              lines.push(`    Copia nativa: SÍ (por ID: ${info2.name}, tamaño: ${info2.size} bytes, ext: ${info2.ext})`);
            } else {
              lines.push(`    Copia nativa: NO encontrada`);
            }
          }
        } catch (e) {
          lines.push(`    Copia nativa error: ${e.message}`);
        }
      }
      lines.push("");
    }

    // List unassigned native files
    const orphanFiles = nativeFiles.filter(f => !matchedNativeNames.has(f.name));
    lines.push("--- ARCHIVOS NATIVOS HUÉRFANOS O NO EMPAREJADOS ---");
    if (orphanFiles.length === 0) {
      lines.push("Ningún archivo nativo huérfano.");
    } else {
      lines.push(`Total huérfanos: ${orphanFiles.length}`);
      orphanFiles.forEach(f => {
        lines.push(`  - ${f.name} (${f.size} bytes)`);
      });
    }

    lines.push("");
    lines.push("--- AUDITORÍA DE ESTADÍSTICAS ---");
    const diagStats = typeof getStatsIndex === "function" ? getStatsIndex() : { historyTotal: 0, yearTotal: 0 };
    lines.push(`Total Histórico Visible: ${Math.round(diagStats.historyTotal || 0)} s (${((diagStats.historyTotal || 0) / 3600).toFixed(2)} h)`);
    lines.push(`Total Este Año Visible: ${Math.round(diagStats.yearTotal || 0)} s (${((diagStats.yearTotal || 0) / 3600).toFixed(2)} h)`);
    lines.push(`Total Histórico Persistido: ${Math.round(_persistedGlobalTotalSeconds || 0)} s (${((_persistedGlobalTotalSeconds || 0) / 3600).toFixed(2)} h)`);
    lines.push(`Total Este Año Persistido: ${Math.round(_persistedYearlyTotalSeconds || 0)} s (${((_persistedYearlyTotalSeconds || 0) / 3600).toFixed(2)} h)`);
    lines.push(`Suelo Histórico Fijado: ${Math.round(_persistedHistoricalFloorSeconds || 0)} s (${((_persistedHistoricalFloorSeconds || 0) / 3600).toFixed(2)} h)`);
    lines.push(`Caché de Logs en Memoria: ${(_listeningLogsCache || []).length} entradas compactadas`);
    lines.push("");
    lines.push("=== FIN DEL INFORME ===");
    return lines.join("\n");
  };

  window.openDiagnosticUI = async function() {
    const modal = document.getElementById("diagnostic-modal");
    const pre = document.getElementById("diagnostic-report-text");
    const status = document.getElementById("diagnostic-status");
    if (!modal || !pre) return;

    modal.classList.remove("hidden");
    if (status) status.textContent = "Generando informe forense...";
    pre.textContent = "Escaneando biblioteca, base de datos IndexedDB y almacenamiento nativo...";

    try {
      const report = await window.generateLibraryDiagnosticReport();
      pre.textContent = report;
      if (status) status.textContent = `Generado (${songs.length} pistas analizadas)`;
    } catch (err) {
      pre.textContent = `Error generando diagnóstico: ${err.message}\n${err.stack || ""}`;
      if (status) status.textContent = "Error";
    }
  };

  window.copyDiagnosticReport = function() {
    const pre = document.getElementById("diagnostic-report-text");
    if (!pre) return;
    const text = pre.textContent || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (typeof showToast === "function") showToast("📋 Informe copiado al portapapeles");
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }

    function fallbackCopy(str) {
      const ta = document.createElement("textarea");
      ta.value = str;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        if (typeof showToast === "function") showToast("📋 Informe copiado al portapapeles");
      } catch (e) {
        if (typeof showToast === "function") showToast("No se pudo copiar automáticamente");
      }
      document.body.removeChild(ta);
    }
  };

  // ==========================================================================
  // INFRANQUEABILIDAD ESTADÍSTICA: LEDGER PERMANENTE POR CANCIÓN (LA VACUNA)
  // Desacoplado de logs rotatorios y blindado contra borrados, re-escaneos y reparaciones.
  // ==========================================================================
  let _songStatsLedgerCache = null;
  let _songStatsLedgerFlushTimer = null;

  function getSongCanonicalKey(songOrTitle, optArtist) {
    let title = "";
    let artist = "";
    let id = "";
    if (songOrTitle && typeof songOrTitle === "object") {
      title = songOrTitle.title || "";
      artist = songOrTitle.artist || "";
      id = songOrTitle.id || "";
    } else {
      title = songOrTitle || "";
      artist = optArtist || "";
    }

    let cleanTitle = String(title || "")
      .replace(/\.(mp3|flac|wav|ogg|m4a|aac|webm)$/i, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

    let cleanArtist = String(artist || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

    if ((!cleanTitle || (typeof isGenericSongTitle === "function" && isGenericSongTitle(cleanTitle))) && id) {
      const parsedFromId = String(id)
        .replace(/^folder_/, "")
        .replace(/^blob_/, "")
        .replace(/\.[a-z0-9]+$/i, "")
        .trim()
        .toLowerCase();
      if (parsedFromId) cleanTitle = parsedFromId;
    }

    if (!cleanTitle && !cleanArtist) {
      if (id) return `id:::${String(id).toLowerCase().trim()}`;
      return "desconocido:::desconocido";
    }

    return `${cleanArtist}:::${cleanTitle}`;
  }

  function getSongStatsLedger() {
    if (_songStatsLedgerCache !== null) return _songStatsLedgerCache;
    try {
      const raw = localStorage.getItem("spotilocal_song_ledger");
      if (raw) {
        _songStatsLedgerCache = JSON.parse(raw);
      }
    } catch (e) {}
    if (!_songStatsLedgerCache || typeof _songStatsLedgerCache !== "object") {
      _songStatsLedgerCache = { canonical: {}, bySongId: {} };
    }
    if (!_songStatsLedgerCache.canonical) _songStatsLedgerCache.canonical = {};
    if (!_songStatsLedgerCache.bySongId) _songStatsLedgerCache.bySongId = {};
    return _songStatsLedgerCache;
  }

  function scheduleSongStatsLedgerFlush() {
    if (_songStatsLedgerFlushTimer) return;
    _songStatsLedgerFlushTimer = setTimeout(() => {
      _songStatsLedgerFlushTimer = null;
      try {
        const ledger = getSongStatsLedger();
        localStorage.setItem("spotilocal_song_ledger", JSON.stringify(ledger));
        if (typeof musicDB !== "undefined" && musicDB.saveSongStatsLedger) {
          musicDB.saveSongStatsLedger(ledger).catch(() => {});
        } else if (typeof musicDB !== "undefined" && musicDB.setSetting) {
          musicDB.setSetting("song_stats_ledger", ledger).catch(() => {});
        }
      } catch (e) {}
    }, 1000);
  }

  async function restoreSongStatsLedgerFromDB() {
    try {
      let dbLedger = null;
      if (typeof musicDB !== "undefined" && musicDB.getSongStatsLedger) {
        dbLedger = await musicDB.getSongStatsLedger();
      } else if (typeof musicDB !== "undefined" && musicDB.getSetting) {
        dbLedger = await musicDB.getSetting("song_stats_ledger", null);
      }
      if (!dbLedger || typeof dbLedger !== "object") return;

      const mem = getSongStatsLedger();
      let changed = false;

      if (dbLedger.canonical) {
        for (const k in dbLedger.canonical) {
          const remote = dbLedger.canonical[k];
          if (!remote) continue;
          const local = mem.canonical[k];
          if (!local) {
            mem.canonical[k] = { ...remote };
            changed = true;
          } else {
            const maxSecs = Math.max(Number(local.totalTimeListened) || 0, Number(remote.totalTimeListened) || 0);
            const maxPlays = Math.max(Number(local.playCount) || 0, Number(remote.playCount) || 0);
            if (maxSecs > (local.totalTimeListened || 0) || maxPlays > (local.playCount || 0)) {
              local.totalTimeListened = maxSecs;
              local.playCount = maxPlays;
              local.lastUpdated = Math.max(local.lastUpdated || 0, remote.lastUpdated || 0);
              changed = true;
            }
          }
        }
      }

      if (dbLedger.bySongId) {
        for (const sid in dbLedger.bySongId) {
          if (!mem.bySongId[sid]) {
            mem.bySongId[sid] = dbLedger.bySongId[sid];
            changed = true;
          }
        }
      }

      if (changed) {
        localStorage.setItem("spotilocal_song_ledger", JSON.stringify(mem));
      }
    } catch (e) {
      console.warn("restoreSongStatsLedgerFromDB error:", e);
    }
  }

  function getSongLedgerStats(song) {
    if (!song) return { totalTimeListened: 0, playCount: 0 };
    const ledger = getSongStatsLedger();
    const canKey = getSongCanonicalKey(song);
    let entry = ledger.canonical[canKey];

    if (!entry && song.id && ledger.bySongId[song.id]) {
      const mappedKey = ledger.bySongId[song.id];
      entry = ledger.canonical[mappedKey];
    }

    if (!entry) {
      return { totalTimeListened: 0, playCount: 0 };
    }

    return {
      totalTimeListened: Number(entry.totalTimeListened) || 0,
      playCount: Number(entry.playCount) || 0
    };
  }

  function recordSongLedgerMonotonic(song, addSeconds = 0, addPlays = 0) {
    if (!song) return { totalTimeListened: 0, playCount: 0 };
    const ledger = getSongStatsLedger();
    const canKey = getSongCanonicalKey(song);
    const sid = song.id ? String(song.id) : null;

    let entry = ledger.canonical[canKey];
    if (!entry && sid && ledger.bySongId[sid]) {
      entry = ledger.canonical[ledger.bySongId[sid]];
    }

    if (!entry) {
      entry = {
        canonicalKey: canKey,
        title: song.title || "Canción",
        artist: song.artist || "Artista",
        totalTimeListened: 0,
        playCount: 0,
        lastUpdated: Date.now()
      };
      ledger.canonical[canKey] = entry;
    }

    if (sid) {
      ledger.bySongId[sid] = canKey;
    }

    // Monotonic Invariant: numbers can NEVER decrease
    const baseTime = Math.max(Number(entry.totalTimeListened) || 0, Number(song.totalTimeListened) || 0);
    const basePlays = Math.max(Number(entry.playCount) || 0, Number(song.playCount) || 0);

    const safeAddSecs = Math.max(0, Number(addSeconds) || 0);
    const safeAddPlays = Math.max(0, Number(addPlays) || 0);

    const newTime = Math.round((baseTime + safeAddSecs) * 100) / 100;
    const newPlays = basePlays + safeAddPlays;

    entry.totalTimeListened = newTime;
    entry.playCount = newPlays;
    entry.lastUpdated = Date.now();
    if (song.title && typeof isGenericSongTitle === "function" && !isGenericSongTitle(song.title)) entry.title = song.title;
    if (song.artist && song.artist !== "Artista Desconocido") entry.artist = song.artist;

    scheduleSongStatsLedgerFlush();

    return { totalTimeListened: newTime, playCount: newPlays };
  }

  function calculateSongStatsFromLogs(songId, songTitle, songArtist) {
    const logs = getListeningLogs();
    let totalSeconds = 0;
    let playsCount = 0;
    const cleanTitle = (songTitle || "").toLowerCase().trim();
    const cleanId = String(songId || "").toLowerCase();

    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      if (!l) continue;
      const sid = String(l.songId || "").toLowerCase();
      let matches = false;

      if (sid === cleanId) {
        matches = true;
      } else if (cleanTitle && (sid.includes(cleanTitle) || (l.title && l.title.toLowerCase().includes(cleanTitle)))) {
        matches = true;
      }

      if (matches) {
        const s = Number(l.seconds) || 0;
        totalSeconds += s;
        if (s >= 10) playsCount++;
      }
    }

    if (totalSeconds > 0 && playsCount === 0) {
      playsCount = Math.max(1, Math.round(totalSeconds / 180));
    }

    return { totalSeconds: Math.round(totalSeconds * 100) / 100, playCount: playsCount };
  }

  async function repairAndRecoverLibrary(isManual = false) {
    let recoveredCount = 0;
    let statsRestoredCount = 0;
    let blobsFoundCount = 0;

    await restoreListeningLogsFromDB().catch(() => {});
    await restoreSongStatsLedgerFromDB().catch(() => {});

    // 1. Gather all existing songs in IndexedDB and in memory
    let dbSongs = [];
    try {
      dbSongs = await musicDB.getAllSongs() || [];
    } catch (e) {}

    const songMap = new Map();
    dbSongs.forEach(s => {
      if (s && s.id && !isSongDeleted(s.id, s.title)) songMap.set(s.id, s);
    });

    songs.forEach(s => {
      if (s && s.id && !songMap.has(s.id) && !isSongDeleted(s.id, s.title)) songMap.set(s.id, s);
    });

    // 2. Scan localStorage cached songs for any missing entries
    try {
      const rawCached = localStorage.getItem("spotilocal_cached_songs");
      if (rawCached) {
        const cachedList = JSON.parse(rawCached);
        if (Array.isArray(cachedList)) {
          cachedList.forEach(cs => {
            if (cs && cs.id && !songMap.has(cs.id) && !isSongDeleted(cs.id, cs.title)) {
              songMap.set(cs.id, {
                ...cs,
                audioBlob: null,
                coverBlob: null,
                dateAdded: cs.dateAdded || Date.now()
              });
              recoveredCount++;
            }
          });
        }
      }
    } catch (e) {}

    // 3. Scan song_blobs in IndexedDB (Recovers user-uploaded songs whose audio blobs are intact!)
    try {
      if (typeof musicDB !== "undefined" && musicDB.getAllBlobRecords) {
        const blobRecords = await musicDB.getAllBlobRecords();
        blobsFoundCount = blobRecords.length;
        console.log(`Deep forensic rescue: found ${blobRecords.length} records in song_blobs`);

        for (const rec of blobRecords) {
          if (!rec || !rec.id) continue;
          if (isSongDeleted(rec.id)) {
            // Clean up blacklisted blob from storage
            try {
              if (musicDB.deleteSong) musicDB.deleteSong(rec.id).catch(() => {});
            } catch(e) {}
            continue;
          }
          const blob = rec.audioBlob;
          const isRealBlob = (blob instanceof Blob);

          let existing = songMap.get(rec.id);
          if (!existing) {
            let meta = {
              title: "",
              artist: "Artista Local",
              album: "Música en Móvil",
              year: "2026",
              genre: "Audio Local",
              coverBlob: null
            };

            if (isRealBlob) {
              try {
                const parsed = await ID3Parser.parse(blob);
                if (parsed) {
                  if (parsed.title && parsed.title !== "Canción") meta.title = parsed.title;
                  if (parsed.artist && parsed.artist !== "Artista Desconocido") meta.artist = parsed.artist;
                  if (parsed.album && parsed.album !== "Álbum Desconocido") meta.album = parsed.album;
                  if (parsed.year) meta.year = parsed.year;
                  if (parsed.genre) meta.genre = parsed.genre;
                  if (parsed.coverBlob) meta.coverBlob = parsed.coverBlob;
                }
              } catch(e) {}
            }

            const presetMatch = findPresetForSong({ id: rec.id });
            if (presetMatch) {
              meta.title = presetMatch.title;
              meta.artist = presetMatch.artist;
              meta.album = presetMatch.album;
              meta.year = presetMatch.year;
              meta.genre = presetMatch.genre;
            } else if (!meta.title) {
              meta.title = (isRealBlob && blob.name ? blob.name.replace(/\.[^/.]+$/, "") : `Tema Local (${rec.id.slice(-6)})`);
            }

            const ledgerStats = getSongLedgerStats({ id: rec.id, title: meta.title, artist: meta.artist });
            const restoredSong = {
              id: rec.id,
              title: meta.title,
              artist: meta.artist,
              album: meta.album,
              year: meta.year,
              genre: meta.genre,
              audioBlob: null,
              hasAudioBlob: isRealBlob,
              coverBlob: meta.coverBlob,
              isLiked: false,
              playCount: ledgerStats.playCount || 0,
              totalTimeListened: ledgerStats.totalTimeListened || 0,
              dateAdded: Date.now() - (7 * 86400 * 1000)
            };

            songMap.set(rec.id, restoredSong);
            recoveredCount++;
          } else {
            if (isRealBlob) existing.hasAudioBlob = true;
          }
        }
      }
    } catch (e) {
      console.warn("Forensic song_blobs scan error:", e);
    }

    // 4. Scan spotilocal_listening_logs for any orphan song IDs with accumulated listening history
    const logs = getListeningLogs();
    const songIdsInLogs = new Set();
    logs.forEach(l => {
      if (l && l.songId && !isSongDeleted(l.songId)) songIdsInLogs.add(String(l.songId));
    });

    for (const logSongId of songIdsInLogs) {
      if (!songMap.has(logSongId) && !isSongDeleted(logSongId)) {
        const presetMatch = findPresetForSong({ id: logSongId });
        let title = presetMatch ? presetMatch.title : `Canción Histórica (${logSongId.slice(-6)})`;
        let artist = presetMatch ? presetMatch.artist : "Artista Local";
        let album = presetMatch ? presetMatch.album : "Música en Móvil";
        let year = presetMatch ? presetMatch.year : "2026";
        let genre = presetMatch ? presetMatch.genre : "Audio Local";

        let blob = null;
        try {
          if (typeof musicDB !== "undefined" && musicDB.getAudioBlob) {
            blob = await musicDB.getAudioBlob(logSongId);
          }
        } catch(e) {}

        if (!blob) {
          blob = await getBlobFromAnySource({ id: logSongId });
        }

        let coverBlob = null;
        if (blob instanceof Blob) {
          try {
            const parsed = await ID3Parser.parse(blob);
            if (parsed) {
              if (parsed.title && parsed.title !== "Canción" && !isGenericSongTitle(parsed.title)) title = parsed.title;
              if (parsed.artist && parsed.artist !== "Artista Desconocido") artist = parsed.artist;
              if (parsed.album && parsed.album !== "Álbum Desconocido") album = parsed.album;
              if (parsed.year) year = parsed.year;
              if (parsed.genre) genre = parsed.genre;
              if (parsed.coverBlob instanceof Blob) coverBlob = parsed.coverBlob;
            }
          } catch(e) {}
        }

        const isUnidentified = isGenericSongTitle(title) && !presetMatch;
        if (isUnidentified) {
          title = `Sin identificar (${logSongId.slice(-6)})`;
        }

        const ledgerStats = getSongLedgerStats({ id: logSongId, title: title, artist: artist });
        const restored = {
          id: logSongId,
          title: title,
          artist: artist,
          album: album,
          year: year,
          genre: genre,
          audioBlob: (blob instanceof Blob) ? blob : null,
          audioUrl: presetMatch ? getFullUrl(`/songs/${encodeURIComponent(presetMatch.filename)}`) : null,
          hasAudioBlob: Boolean(blob),
          coverBlob: coverBlob,
          needsReview: isUnidentified,
          isLiked: false,
          playCount: ledgerStats.playCount || 0,
          totalTimeListened: ledgerStats.totalTimeListened || 0,
          dateAdded: Date.now() - (14 * 86400 * 1000)
        };
        songMap.set(logSongId, restored);
        recoveredCount++;
      }
    }

    // 5. Check all canonical preset songs
    for (const preset of CANONICAL_PRESET_SONGS) {
      const canonicalId = `folder_${preset.filename}`;
      if (isSongDeleted(canonicalId, preset.title)) continue;

      let existingSong = songMap.get(canonicalId);

      if (!existingSong) {
        for (const [id, s] of songMap.entries()) {
          if (s.title && s.title.toLowerCase().trim() === preset.title.toLowerCase().trim()) {
            existingSong = s;
            break;
          }
        }
      }

      if (!existingSong) {
        const ledgerStats = getSongLedgerStats({ id: canonicalId, title: preset.title, artist: preset.artist });
        const restored = {
          id: canonicalId,
          title: preset.title,
          artist: preset.artist,
          album: preset.album,
          year: preset.year,
          genre: preset.genre,
          audioUrl: getFullUrl(`/songs/${encodeURIComponent(preset.filename)}`),
          audioBlob: null,
          coverBlob: null,
          isLiked: false,
          playCount: ledgerStats.playCount || 0,
          totalTimeListened: ledgerStats.totalTimeListened || 0,
          dateAdded: Date.now() - (30 * 86400 * 1000)
        };
        songMap.set(canonicalId, restored);
        recoveredCount++;
      } else {
        // Heal generic titles if present
        if (!existingSong.title || existingSong.title.includes("Canción Histórica") || existingSong.title.includes("Canción Recuperada")) {
          existingSong.title = preset.title;
          existingSong.artist = preset.artist;
          existingSong.album = preset.album;
          existingSong.year = preset.year;
          existingSong.genre = preset.genre;
          if (!existingSong.audioUrl) existingSong.audioUrl = getFullUrl(`/songs/${encodeURIComponent(preset.filename)}`);
        }
      }
    }

    // 6. Enforce Monotonic Immunity and recalculate from logs only if higher
    for (const [id, song] of songMap.entries()) {
      if (isSongDeleted(song.id, song.title)) {
        songMap.delete(id);
        continue;
      }
      const stats = calculateSongStatsFromLogs(song.id, song.title, song.artist);
      const ledgerStats = getSongLedgerStats(song);

      const maxSecs = Math.max(song.totalTimeListened || 0, ledgerStats.totalTimeListened || 0, stats.totalSeconds || 0);
      const maxPlays = Math.max(song.playCount || 0, ledgerStats.playCount || 0, stats.playCount || 0);

      let changed = false;
      if (maxSecs > (song.totalTimeListened || 0)) {
        song.totalTimeListened = maxSecs;
        changed = true;
      }
      if (maxPlays > (song.playCount || 0)) {
        song.playCount = maxPlays;
        changed = true;
      }

      // Stamp highest value into immutable ledger
      recordSongLedgerMonotonic(song, 0, 0);

      if (changed) {
        statsRestoredCount++;
      }

      try {
        await musicDB.saveSong(song);
      } catch (e) {}
    }

    // 7. Update memory and UI
    songs = Array.from(songMap.values()).filter(s => !isSongDeleted(s.id, s.title));
    songs.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
    currentQueue = [...songs];

    // Reset library filter to all
    currentLibraryFilter = "all";
    document.querySelectorAll(".library-filters .filter-chip").forEach(b => {
      if (b.getAttribute("data-lib-filter") === "all") b.classList.add("active");
      else b.classList.remove("active");
    });

    _libraryTableDirty = true;
    renderSongsTable(songs);
    renderRecentGrid(songs.slice(0, 6));
    renderFavoritesGrid(songs.filter(s => s.isLiked));
    renderWrappedStats();
    renderHistoricalRanking(true);

    if (typeof window.SpotiLocalNativePlayer !== "undefined") {
      primeNativeLocalAudioMap(songs, window.SpotiLocalNativePlayer);
    }

    saveCachedSongs(songs);
    if (typeof hydrateCoverArt === "function") hydrateCoverArt(songs);

    const statusMsg = `🔍 Escaneo Forense: ${songs.length} canciones activas (${recoveredCount} recuperadas, ${blobsFoundCount} blobs en disco, ${statsRestoredCount} estadísticas vinculadas).`;
    console.log(statusMsg);
    if (isManual || recoveredCount > 0) {
      if (typeof showToast === "function") {
        showToast(statusMsg);
      }
    }

    return { recoveredCount, statsRestoredCount, blobsFoundCount, totalSongs: songs.length };
  }

  window.repairAndRecoverLibraryUI = async function() {
    if (confirm("🔍 ¿Deseas ejecutar el Escaneo Forense Profundo para rastrear y recuperar TODAS las canciones y blobs de audio almacenados en tu móvil?")) {
      await repairAndRecoverLibrary(true);
    }
  };

  async function loadSongsFromDB(statusCb = null) {
    try {
      if (statusCb) statusCb("Cargando memoria local...");
      restoreListeningLogsFromDB().catch(() => {});
      restoreSongStatsLedgerFromDB().catch(() => {});

      let localCachedSongs = [];
      // 0. Instant Synchronous First-Paint from localStorage (0.00ms)
      try {
        const cached = localStorage.getItem("spotilocal_cached_songs");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0 && songs.length === 0) {
            const valid = parsed.filter(s => !isSongDeleted(s.id, s.title));
            if (valid.length > 0) {
              valid.forEach(s => {
                if (s.coverBlob && !(s.coverBlob instanceof Blob) && !(s.coverBlob instanceof File)) {
                  s.coverBlob = null;
                }
              });
              localCachedSongs = valid;
              songs = valid;
              if (currentQueue.length === 0) currentQueue = [...songs];
              if (currentTab === "library") {
                renderSongsTable(songs);
                _libraryTableDirty = false;
              } else {
                _libraryTableDirty = true;
              }
              renderRecentGrid(songs.slice(0, 6));
              renderFavoritesGrid(songs.filter(s => s.isLiked));
              renderWrappedStats();
              hydrateFromNativePlayerState(false);
            }
          }
        }
      } catch (e) {}

      // Ensure listening logs and persisted stats index are fully hydrated before DB reads & repairs
      await restoreListeningLogsFromDB().catch(() => {});
    await restoreSongStatsLedgerFromDB().catch(() => {});

      // 1. Read IndexedDB songs
      let dbSongs = [];
      try {
        const allDb = await musicDB.getAllSongs() || [];
        dbSongs = allDb.filter(s => !isSongDeleted(s.id, s.title));
      } catch (e) {}

      if (dbSongs.length > 0) {
        songs = [...dbSongs];
        songs.forEach(s => {
          if (!s.dateAdded) s.dateAdded = Date.now();
          if (s.coverBlob && !(s.coverBlob instanceof Blob) && !(s.coverBlob instanceof File)) {
            s.coverBlob = null;
          }
          const lst = getSongLedgerStats(s);
          const bestSecs = Math.max(s.totalTimeListened || 0, lst.totalTimeListened || 0);
          const bestPlays = Math.max(s.playCount || 0, lst.playCount || 0);
          s.totalTimeListened = bestSecs;
          s.playCount = bestPlays;
          recordSongLedgerMonotonic(s, 0, 0);
        });
        songs.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
        if (currentQueue.length === 0) currentQueue = [...songs];

        if (currentTab === "library") {
          renderSongsTable(songs);
          _libraryTableDirty = false;
        } else {
          _libraryTableDirty = true;
        }
        renderRecentGrid(songs.slice(0, 6));
        renderFavoritesGrid(songs.filter(s => s.isLiked));
        renderWrappedStats();
        hydrateFromNativePlayerState(false);

        if (typeof window.SpotiLocalNativePlayer !== "undefined") {
          primeNativeLocalAudioMap(songs, window.SpotiLocalNativePlayer);
        }

        setTimeout(() => {
          if (typeof musicDB !== "undefined" && musicDB.migrateEmbeddedAudioBlobs) {
            musicDB.migrateEmbeddedAudioBlobs().catch(() => {});
          }
        }, 1000);
      }

      // ONLY trigger automatic recovery if library is completely empty (corrupted DB or virgin boot)
      if (songs.length === 0) {
        console.log("SpotiLocal: Biblioteca vacía detectada. Ejecutando recuperación forense inicial...");
        await repairAndRecoverLibrary(false);
      } else {
        // Library has songs: heal metadata and restore album covers safely without resurrecting deleted tracks
        await reEnrichSongMetadata();
      }

      // 2. Unconditional Sync from /api/songs (1.5s timeout)
      try {
        if (statusCb) statusCb("Buscando en servidor local...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(getFullUrl("/api/songs"), { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const files = await res.json();
          if (statusCb) statusCb(`¡Recibidas ${files.length} canciones del PC!`);
          const apiSongs = files.map(item => {
            const parsedMeta = parseSongFilename(item.name);
            return {
              id: `folder_${item.name}`,
              title: parsedMeta.title,
              artist: parsedMeta.artist,
              album: "Música FLAC / Local",
              year: "2026",
              genre: "FLAC Audio",
              audioUrl: getFullUrl(item.url),
              audioBlob: null,
              coverBlob: null,
              isLiked: false,
              playCount: 0,
              dateAdded: Date.now()
            };
          });

           // Keep local metadata/stats as ground truth if IndexedDB was temporarily unavailable.
           const localGroundTruthSongs = dbSongs.length > 0
             ? dbSongs
             : (localCachedSongs.length > 0 ? localCachedSongs : songs);

           // Bulletproof merge: Start with local data as ground truth
           const songMap = new Map();
           localGroundTruthSongs.forEach(dbSong => {
            if (dbSong && dbSong.id) {
              songMap.set(dbSong.id, dbSong);
            }
          });

          apiSongs.forEach(apiSong => {
            if (isSongDeleted(apiSong.id, apiSong.title)) return;
            let existingKey = null;
            if (songMap.has(apiSong.id)) {
              existingKey = apiSong.id;
            } else {
              for (const [id, dbSong] of songMap.entries()) {
                if (dbSong.title && apiSong.title && 
                   (dbSong.title.toLowerCase() === apiSong.title.toLowerCase() ||
                    dbSong.audioUrl === apiSong.audioUrl ||
                    id.toLowerCase().includes(apiSong.title.toLowerCase()))) {
                  existingKey = id;
                  break;
                }
              }
            }

            if (existingKey) {
              const existing = songMap.get(existingKey);
              const isOldWebm = existing.audioUrl && existing.audioUrl.endsWith(".webm");
              const ledgerStats = getSongLedgerStats(existing);
              const safeTime = Math.max(existing.totalTimeListened || 0, apiSong.totalTimeListened || 0, ledgerStats.totalTimeListened || 0);
              const safePlays = Math.max(existing.playCount || 0, apiSong.playCount || 0, ledgerStats.playCount || 0);
              const mergedRecord = {
                ...apiSong,
                ...existing,
                audioUrl: apiSong.audioUrl || existing.audioUrl,
                audioBlob: isOldWebm ? null : (existing.audioBlob || apiSong.audioBlob),
                coverBlob: existing.coverBlob || apiSong.coverBlob,
                duration: existing.duration || apiSong.duration || 0,
                rawDuration: existing.rawDuration || existing.duration || apiSong.rawDuration || apiSong.duration || 0,
                trimStart: typeof existing.trimStart === "number" ? existing.trimStart : (apiSong.trimStart || 0),
                trimEnd: typeof existing.trimEnd === "number" ? existing.trimEnd : (apiSong.trimEnd || 0),
                trimEnabled: existing.trimEnabled !== undefined ? existing.trimEnabled : (apiSong.trimEnabled !== false),
                gainDb: typeof existing.gainDb === "number" ? existing.gainDb : (apiSong.gainDb || 0),
                totalTimeListened: safeTime,
                playCount: safePlays,
                isLiked: existing.isLiked || false,
                dateAdded: existing.dateAdded || apiSong.dateAdded || Date.now()
              };
              recordSongLedgerMonotonic(mergedRecord, 0, 0);
              songMap.set(existingKey, mergedRecord);
            } else {
              const ledgerStats = getSongLedgerStats(apiSong);
              apiSong.totalTimeListened = Math.max(apiSong.totalTimeListened || 0, ledgerStats.totalTimeListened || 0);
              apiSong.playCount = Math.max(apiSong.playCount || 0, ledgerStats.playCount || 0);
              recordSongLedgerMonotonic(apiSong, 0, 0);
              songMap.set(apiSong.id, apiSong);
            }
          });

          const mergedSongs = Array.from(songMap.values()).filter(s => !isSongDeleted(s.id, s.title));
          if (mergedSongs.length > 0) {
            songs = mergedSongs;
            songs.forEach(s => {
              if (!s.dateAdded) s.dateAdded = Date.now();
            });

            songs.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
            currentQueue = [...songs];

            for (const s of songs) {
              try { await musicDB.saveSong(s); } catch(e){}
            }

            // Silent Automatic Background Download & Caching for offline playback!
            downloadAndCacheAllSongs(songs);

            // Save metadata cache to localStorage
            saveCachedSongs(songs);

            renderSongsTable(songs);
            renderRecentGrid(songs.slice(0, 6));
            renderFavoritesGrid(songs.filter(s => s.isLiked));
            renderWrappedStats();
            renderHistoricalRanking();
          }
        }
      } catch (e) {
        console.warn("Background API sync warning:", e);
      }

    } catch (e) {
      console.error("Critical loadSongsFromDB error:", e);
    }

    hydrateCoverArt(songs);
  }

  async function hydrateCoverArt(songList) {
    if (!songList || songList.length === 0 || coverArtCatalog.length === 0 || coverHydrationPromise) return;

    coverHydrationPromise = (async () => {
      let changed = false;
      for (const song of songList) {
        const coverUrl = getMappedCoverUrl(song);
        if (!coverUrl) continue;

        let songChanged = false;
        if (song.coverUrl !== coverUrl) {
          song.coverUrl = coverUrl;
          songChanged = true;
        }

        if (!song.coverBlob || !(song.coverBlob instanceof Blob)) {
          try {
            const response = await fetch(coverUrl, { cache: "force-cache" });
            if (response.ok) {
              song.coverBlob = await response.blob();
              songChanged = true;
            }
          } catch (e) {}
        }

        if (songChanged) {
          changed = true;
          try { await musicDB.saveSong(song); } catch (e) {}
        }
      }

      if (changed) {
        try {
          renderSongsTable(songs);
          renderRecentGrid(songs.slice(0, 6));
          renderFavoritesGrid(songs.filter(song => song.isLiked));
          renderQueueModal();
        } catch (e) {}
      }
    })().finally(() => {
      coverHydrationPromise = null;
    });

    return coverHydrationPromise;
  }

  // --------------------------------------------------------------------------
  // TIME-BASED STATISTICS & LOGGING ENGINE (V1.8.4 BULLETPROOF AUDITED)
  // --------------------------------------------------------------------------
  let activePlaylistId = null;
  let _listeningLogsCache = null;
  let _statsIndexDirty = true;
  let _currentStatsYear = new Date().getFullYear();
  let _persistedGlobalTotalSeconds = parseFloat(localStorage.getItem("spotilocal_global_total_secs") || "0") || 0;
  let _persistedYearlyTotalSeconds = parseFloat(localStorage.getItem(`spotilocal_yearly_total_secs_${_currentStatsYear}`) || "0") || 0;
  let _persistedHistoricalFloorSeconds = parseFloat(localStorage.getItem("spotilocal_historical_floor_secs") || "0") || 0;
  let _hasPriorYearLogs = false;

  let _cachedStatsIndex = {
    todayTotal: 0,
    monthTotal: 0,
    yearTotal: 0,
    historyTotal: 0,
    tenDaysBySong: new Map(),
    weeklyBySong: new Map(),
    monthlyBySong: new Map(),
    yearlyBySong: new Map()
  };
  let _logsFlushTimeout = null;

  function sanitizeListeningLogs(logs) {
    if (!Array.isArray(logs)) return [];
    const now = Date.now();
    const maxFuture = now + 60 * 1000;
    const clean = [];
    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      if (!l || !l.songId || typeof l.seconds !== "number" || l.seconds <= 0) continue;
      if (l.seconds > 14400) continue;
      if (l.timestamp && l.timestamp > maxFuture) continue;
      clean.push(l);
    }
    return clean;
  }

  function coalesceListeningLogs(logs) {
    if (!Array.isArray(logs) || logs.length <= 1) return logs || [];
    const sorted = sanitizeListeningLogs(logs).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const merged = [];
    const MAX_GAP_MS = 15 * 60 * 1000; // 15 minutos entre ticks continuos
    const MAX_BLOCK_SECS = 3600; // Máximo 1 hora acumulada por bloque coalescido

    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      if (!cur || !cur.songId || typeof cur.seconds !== "number" || cur.seconds <= 0) continue;

      if (merged.length === 0) {
        merged.push({ ...cur });
        continue;
      }

      const prev = merged[merged.length - 1];
      const sameSong = prev.songId === cur.songId;
      const samePlaylist = (prev.playlistId || null) === (cur.playlistId || null);
      const curTime = cur.timestamp || 0;
      const prevTime = prev.timestamp || 0;
      const timeDiff = curTime - prevTime;

      const dPrev = new Date(prevTime);
      const dCur = new Date(curTime);
      const sameDay = dPrev.getFullYear() === dCur.getFullYear() &&
                      dPrev.getMonth() === dCur.getMonth() &&
                      dPrev.getDate() === dCur.getDate();

      if (sameSong && samePlaylist && sameDay && timeDiff >= 0 && timeDiff <= MAX_GAP_MS && (prev.seconds + cur.seconds) <= MAX_BLOCK_SECS) {
        prev.seconds = Math.round((prev.seconds + cur.seconds) * 100) / 100;
        prev.timestamp = curTime;
      } else {
        merged.push({ ...cur });
      }
    }
    return merged;
  }

  function getListeningLogs() {
    if (_listeningLogsCache !== null) return _listeningLogsCache;
    try {
      const raw = localStorage.getItem("spotilocal_listening_logs");
      _listeningLogsCache = coalesceListeningLogs(JSON.parse(raw || "[]"));
    } catch(e) {
      _listeningLogsCache = [];
    }
    return _listeningLogsCache;
  }

  function scheduleLogsFlush() {
    if (_logsFlushTimeout) return;
    _logsFlushTimeout = setTimeout(() => {
      _logsFlushTimeout = null;
      try {
        if (_listeningLogsCache) {
          localStorage.setItem("spotilocal_listening_logs", JSON.stringify(_listeningLogsCache));
          if (typeof musicDB !== "undefined" && musicDB.setSetting) {
            musicDB.setSetting("listeningLogs", _listeningLogsCache).catch(() => {});
          }
        }
      } catch(e) {}
    }, 1500);
  }

  function invalidateStatsIndex() {
    _statsIndexDirty = true;
  }

  function resolveLogSongId(sid) {
    if (!sid) return null;
    if (songs && songs.some(s => s.id === sid)) return sid;
    const cleanSid = String(sid).toLowerCase().replace(/^folder_/, "").replace(/\.[a-z0-9]+$/i, "").trim();
    if (songs) {
      const match = songs.find(s => {
        const cleanTitle = (s.title || "").toLowerCase().trim();
        return cleanTitle && (cleanSid.includes(cleanTitle) || cleanTitle.includes(cleanSid));
      });
      if (match) return match.id;
    }
    return sid;
  }

  function getStatsIndex() {
    if (!_statsIndexDirty) return _cachedStatsIndex;
    const logs = getListeningLogs();
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const tenDaysAgo = Date.now() - (10 * 86400 * 1000);
    const monday = getStartOfWeekMonday();

    let todaySum = 0;
    let monthSum = 0;
    let yearSum = 0;
    let historySum = 0;

    const tenDaysMap = new Map();
    const weeklyMap = new Map();
    const monthlyMap = new Map();
    const yearlyMap = new Map();

    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      if (!l) continue;
      const t = l.timestamp || 0;
      const s = l.seconds || 0;
      const sid = resolveLogSongId(l.songId);

      historySum += s;
      if (t >= startOfToday && t <= endOfToday) todaySum += s;
      if (t >= startOfMonth) monthSum += s;
      if (t >= startOfYear) yearSum += s;

      if (sid != null) {
        if (t >= tenDaysAgo) tenDaysMap.set(sid, (tenDaysMap.get(sid) || 0) + s);
        if (t >= monday) weeklyMap.set(sid, (weeklyMap.get(sid) || 0) + s);
        if (t >= startOfMonth) monthlyMap.set(sid, (monthlyMap.get(sid) || 0) + s);
        if (t >= startOfYear) yearlyMap.set(sid, (yearlyMap.get(sid) || 0) + s);
      }
    }

    const sumSongTime = (songs || []).reduce((sum, s) => {
      const lst = (typeof getSongLedgerStats === "function") ? getSongLedgerStats(s) : null;
      return sum + Math.max(s.totalTimeListened || 0, (lst ? lst.totalTimeListened : 0));
    }, 0);
    const playlistSum = (playlists || []).reduce((sum, p) => sum + (p.totalTimeListened || 0), 0);

    let yearFromSongs = 0;
    if (Array.isArray(songs)) {
      for (let j = 0; j < songs.length; j++) {
        const s = songs[j];
        if (!s) continue;
        const lst = (typeof getSongLedgerStats === "function") ? getSongLedgerStats(s) : null;
        const songTrueTime = Math.max(s.totalTimeListened || 0, (lst ? lst.totalTimeListened : 0));
        const songYearlyLogs = yearlyMap.get(s.id) || 0;
        if (!s.dateAdded || s.dateAdded >= startOfYear) {
          yearFromSongs += Math.max(songYearlyLogs, songTrueTime);
        } else {
          yearFromSongs += songYearlyLogs;
        }
      }
    }

    const archivedSecs = parseFloat(localStorage.getItem("spotilocal_archived_secs") || "0") || 0;
    const effectiveYearTotal = Math.max(
      yearSum,
      yearFromSongs,
      _persistedYearlyTotalSeconds,
      (!_hasPriorYearLogs ? _persistedGlobalTotalSeconds : 0)
    );
    const effectiveHistoryTotal = Math.max(
      sumSongTime,
      historySum + archivedSecs,
      playlistSum,
      effectiveYearTotal,
      _persistedGlobalTotalSeconds,
      _persistedHistoricalFloorSeconds
    );

    if (effectiveHistoryTotal > _persistedGlobalTotalSeconds) {
      _persistedGlobalTotalSeconds = effectiveHistoryTotal;
      try {
        localStorage.setItem("spotilocal_global_total_secs", String(_persistedGlobalTotalSeconds));
        if (typeof musicDB !== "undefined" && musicDB.setSetting) {
          musicDB.setSetting("globalTotalSeconds", _persistedGlobalTotalSeconds).catch(() => {});
        }
      } catch(e) {}
    }
    if (effectiveYearTotal > _persistedYearlyTotalSeconds) {
      _persistedYearlyTotalSeconds = effectiveYearTotal;
      try {
        localStorage.setItem(`spotilocal_yearly_total_secs_${currentYear}`, String(_persistedYearlyTotalSeconds));
        if (typeof musicDB !== "undefined" && musicDB.setSetting) {
          musicDB.setSetting(`yearlyTotalSeconds_${currentYear}`, _persistedYearlyTotalSeconds).catch(() => {});
        }
      } catch(e) {}
    }

    _cachedStatsIndex = {
      todayTotal: todaySum,
      monthTotal: monthSum,
      yearTotal: effectiveYearTotal,
      historyTotal: effectiveHistoryTotal,
      tenDaysBySong: tenDaysMap,
      weeklyBySong: weeklyMap,
      monthlyBySong: monthlyMap,
      yearlyBySong: yearlyMap
    };
    _statsIndexDirty = false;
    return _cachedStatsIndex;
  }

  async function restoreListeningLogsFromDB() {
    if (typeof musicDB === "undefined" || !musicDB.getSetting) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    const [dbLogs, dbGlobalTotal, dbYearTotal, dbFloor, dbArchived] = await Promise.all([
      musicDB.getSetting("listeningLogs", []).catch(() => []),
      musicDB.getSetting("globalTotalSeconds", 0).catch(() => 0),
      musicDB.getSetting(`yearlyTotalSeconds_${currentYear}`, 0).catch(() => 0),
      musicDB.getSetting("historicalFloorSeconds", 0).catch(() => 0),
      musicDB.getSetting("archivedHistorySeconds", 0).catch(() => 0)
    ]);

    const localLogs = getListeningLogs();
    const candidates = [
      ...(Array.isArray(dbLogs) ? dbLogs : []),
      ...localLogs
    ];

    const coalesced = coalesceListeningLogs(candidates);
    const capped = coalesced.slice(-25000);
    _listeningLogsCache = capped;

    _hasPriorYearLogs = capped.some(l => l && l.timestamp && l.timestamp < startOfYear);

    const localGlobalTotal = parseFloat(localStorage.getItem("spotilocal_global_total_secs") || "0") || 0;
    const localYearTotal = parseFloat(localStorage.getItem(`spotilocal_yearly_total_secs_${currentYear}`) || "0") || 0;
    const localFloor = parseFloat(localStorage.getItem("spotilocal_historical_floor_secs") || "0") || 0;
    const localArchived = parseFloat(localStorage.getItem("spotilocal_archived_secs") || "0") || 0;

    _persistedHistoricalFloorSeconds = Math.max(Number(dbFloor) || 0, localFloor);
    _persistedGlobalTotalSeconds = Math.max(Number(dbGlobalTotal) || 0, localGlobalTotal, _persistedHistoricalFloorSeconds);
    _persistedYearlyTotalSeconds = Math.max(Number(dbYearTotal) || 0, localYearTotal);

    if (!_hasPriorYearLogs && _persistedYearlyTotalSeconds < _persistedGlobalTotalSeconds) {
      _persistedYearlyTotalSeconds = _persistedGlobalTotalSeconds;
    }

    const effectiveArchived = Math.max(Number(dbArchived) || 0, localArchived);
    if (effectiveArchived > 0) {
      try {
        localStorage.setItem("spotilocal_archived_secs", String(effectiveArchived));
      } catch(e) {}
    }

    try {
      localStorage.setItem("spotilocal_global_total_secs", String(_persistedGlobalTotalSeconds));
      localStorage.setItem(`spotilocal_yearly_total_secs_${currentYear}`, String(_persistedYearlyTotalSeconds));
      localStorage.setItem("spotilocal_historical_floor_secs", String(_persistedHistoricalFloorSeconds));
      localStorage.setItem("spotilocal_listening_logs", JSON.stringify(capped));

      await Promise.all([
        musicDB.setSetting("listeningLogs", capped).catch(() => {}),
        musicDB.setSetting("globalTotalSeconds", _persistedGlobalTotalSeconds).catch(() => {}),
        musicDB.setSetting(`yearlyTotalSeconds_${currentYear}`, _persistedYearlyTotalSeconds).catch(() => {}),
        musicDB.setSetting("historicalFloorSeconds", _persistedHistoricalFloorSeconds).catch(() => {})
      ]);
    } catch(e) {}

    invalidateStatsIndex();
    renderHomeStats();
    if (typeof updateStatsAuditCard === "function") updateStatsAuditCard();
  }

  function recordListeningLog(songId, seconds, playlistId = null, timestamp = null) {
    try {
      const logs = getListeningLogs();
      const recSecs = Math.round(seconds * 100) / 100;
      if (recSecs <= 0 || recSecs > 14400) return;
      const curTime = timestamp || Date.now();
      const MAX_GAP_MS = 15 * 60 * 1000;
      const MAX_BLOCK_SECS = 3600;

      let mergedIntoLast = false;
      if (logs.length > 0) {
        const last = logs[logs.length - 1];
        const sameSong = last.songId === songId;
        const samePlaylist = (last.playlistId || null) === (playlistId || null);
        const timeDiff = curTime - (last.timestamp || 0);

        const dPrev = new Date(last.timestamp || 0);
        const dCur = new Date(curTime);
        const sameDay = dPrev.getFullYear() === dCur.getFullYear() &&
                        dPrev.getMonth() === dCur.getMonth() &&
                        dPrev.getDate() === dCur.getDate();

        if (sameSong && samePlaylist && sameDay && timeDiff >= 0 && timeDiff <= MAX_GAP_MS && (last.seconds + recSecs) <= MAX_BLOCK_SECS) {
          last.seconds = Math.round((last.seconds + recSecs) * 100) / 100;
          last.timestamp = curTime;
          mergedIntoLast = true;
        }
      }

      if (!mergedIntoLast) {
        logs.push({
          timestamp: curTime,
          songId: songId,
          seconds: recSecs,
          playlistId: playlistId || null
        });
      }

      // Cap a 25.000 bloques compactados (~6.250+ horas de historial)
      if (logs.length > 25000) {
        const shifted = logs.shift();
        if (shifted && shifted.seconds > 0) {
          const prevArchived = parseFloat(localStorage.getItem("spotilocal_archived_secs") || "0") || 0;
          const nextArchived = Math.round((prevArchived + shifted.seconds) * 100) / 100;
          try {
            localStorage.setItem("spotilocal_archived_secs", String(nextArchived));
            if (typeof musicDB !== "undefined" && musicDB.setSetting) {
              musicDB.setSetting("archivedHistorySeconds", nextArchived).catch(() => {});
            }
          } catch(e) {}
        }
      }

      invalidateStatsIndex();
      scheduleLogsFlush();
    } catch(e) {}
  }

  function formatTimeListenedShort(totalSecs) {
    if (!totalSecs || totalSecs <= 0) return "0 min";
    if (totalSecs < 60) return `${Math.round(totalSecs)} s`;
    const mins = Math.floor(totalSecs / 60);
    if (mins < 60) return `${mins} min`;
    const hours = (totalSecs / 3600).toFixed(1);
    return `${hours} hrs`;
  }

  function getListeningSecondsForRange(range) {
    const idx = getStatsIndex();
    if (range === "today") return idx.todayTotal;
    if (range === "month") return idx.monthTotal;
    if (range === "year") return idx.yearTotal;
    if (range === "history") return idx.historyTotal;
    return 0;
  }

  function getSongSecondsLast10Days(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) return 0;
    const idx = getStatsIndex();
    if (idx.tenDaysBySong.has(songId)) return idx.tenDaysBySong.get(songId);
    const tenDaysAgo = Date.now() - (10 * 86400 * 1000);
    const ledgerStats = (typeof getSongLedgerStats === "function") ? getSongLedgerStats(song) : null;
    const safeSongTime = Math.max(song.totalTimeListened || 0, (ledgerStats ? ledgerStats.totalTimeListened : 0));
    if (song.dateAdded && song.dateAdded >= tenDaysAgo) return safeSongTime;
    return 0;
  }

  function getStartOfWeekMonday() {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? 6 : day - 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
    return monday.getTime();
  }

  function getStartOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
  }

  function getStartOfYear() {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
  }

  function getSongSecondsForFilter(songId, filter) {
    const song = songs.find(s => s.id === songId);
    if (!song) return 0;
    const ledgerStats = (typeof getSongLedgerStats === "function") ? getSongLedgerStats(song) : null;
    const safeSongTime = Math.max(song.totalTimeListened || 0, (ledgerStats ? ledgerStats.totalTimeListened : 0));
    if (filter === "historical") return safeSongTime;
    const idx = getStatsIndex();
    let map = null;
    let cutoff = 0;
    if (filter === "weekly") { map = idx.weeklyBySong; cutoff = getStartOfWeekMonday(); }
    else if (filter === "monthly") { map = idx.monthlyBySong; cutoff = getStartOfMonth(); }
    else if (filter === "yearly") { map = idx.yearlyBySong; cutoff = getStartOfYear(); }

    if (map && map.has(songId)) {
      const logged = map.get(songId);
      if (cutoff && (!song.dateAdded || song.dateAdded >= cutoff)) {
        return Math.max(logged, safeSongTime);
      }
      return logged;
    }
    if (cutoff && (!song.dateAdded || song.dateAdded >= cutoff)) return safeSongTime;
    return 0;
  }

  function updateStatsAuditCard() {
    const el = document.getElementById("stats-audit-summary");
    if (!el) return;
    const idx = getStatsIndex();
    const histHours = ((idx.historyTotal || 0) / 3600).toFixed(1);
    const yearHours = ((idx.yearTotal || 0) / 3600).toFixed(1);
    const ledger = (typeof getSongStatsLedger === "function") ? getSongStatsLedger() : { canonical: {} };
    const ledgerEntries = Object.keys(ledger.canonical || {}).length;
    let topSong = null;
    let topSecs = 0;
    if (ledger.canonical) {
      for (const k in ledger.canonical) {
        const item = ledger.canonical[k];
        if (item && item.totalTimeListened > topSecs) {
          topSecs = item.totalTimeListened;
          topSong = item;
        }
      }
    }
    const topSongText = topSong ? `${topSong.title} (${formatTimeListenedShort(topSong.totalTimeListened)})` : "Ninguna";
    const logCount = (_listeningLogsCache || []).length;

    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:var(--spotify-grey);">Estado de Protección:</span>
        <strong style="color:var(--spotify-green); font-size:13px;"><i class="fa-solid fa-shield-halved"></i> Vacuna Activa (Infranqueable)</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:var(--spotify-grey);">Canciones en Ledger Blindado:</span>
        <strong style="color:var(--spotify-white); font-size:13px;">${ledgerEntries} temas inmunes</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:var(--spotify-grey);">Total Histórico Acumulado:</span>
        <strong style="color:var(--spotify-green); font-size:14px;">${histHours} hrs</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:var(--spotify-grey);">Canción #1 Histórica:</span>
        <span style="color:var(--spotify-white); font-size:12px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:180px;">${topSongText}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--spotify-grey);">Bloques de Sesión:</span>
        <span style="color:var(--spotify-white);">${logCount} entradas</span>
      </div>
    `;
  }

  window.applyHistoricalHoursFloorUI = async function() {
    if (typeof showToast === "function") showToast("Inmunidad por canción activa en Ledger automático 🛡️✅");
  };

  function renderHomeStats() {
    const todayEl = document.getElementById("stat-time-today");
    const monthEl = document.getElementById("stat-time-month");
    const yearEl = document.getElementById("stat-time-year");
    const historyEl = document.getElementById("stat-time-history");

    if (todayEl) todayEl.textContent = formatTimeListenedShort(getListeningSecondsForRange("today"));
    if (monthEl) monthEl.textContent = formatTimeListenedShort(getListeningSecondsForRange("month"));
    if (yearEl) yearEl.textContent = formatTimeListenedShort(getListeningSecondsForRange("year"));
    if (historyEl) historyEl.textContent = formatTimeListenedShort(getListeningSecondsForRange("history"));

    if (typeof updateStatsAuditCard === "function") updateStatsAuditCard();
  }

  function renderWrappedStats() {
    renderHomeStats();
  }

  function getRankedSongs(filter = currentRankingFilter) {
    if (!songs || songs.length === 0) return [];
    return [...songs].sort((a, b) => {
      const timeA = getSongSecondsForFilter(a.id, filter);
      const timeB = getSongSecondsForFilter(b.id, filter);
      if (timeB !== timeA) return timeB - timeA;
      const totalA = a.totalTimeListened || 0;
      const totalB = b.totalTimeListened || 0;
      if (totalB !== totalA) return totalB - totalA;
      return (b.playCount || 0) - (a.playCount || 0);
    });
  }

  function renderHistoricalRanking(forceRender = false) {
    renderRankingView(currentRankingFilter, forceRender);
  }

  function renderRankingView(filter = currentRankingFilter, forceRender = false) {
    const rankingEl = document.getElementById("top-ranking-body");
    if (!rankingEl) return;

    // Avoid DOM churn if ranking tab is not currently visible
    const rankingView = document.getElementById("view-ranking");
    const isRankingActive = rankingView && (rankingView.classList.contains("active") || rankingView.style.display === "flex");
    if (!isRankingActive && !forceRender) {
      return;
    }

    if (songs.length === 0) {
      rankingEl.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--spotify-grey);">
          <p>Tus canciones aparecerán aquí con sus reproducciones y tiempo según el periodo seleccionado.</p>
        </div>
      `;
      return;
    }

    // Sort songs by time listened in selected filter timeframe, then by total time, then by play count
    const ranked = getRankedSongs(filter);

    // Remove empty-state message if present
    if (rankingEl.querySelector("p")) {
      rankingEl.innerHTML = "";
    }

    const existingRowsMap = new Map();
    Array.from(rankingEl.children).forEach(child => {
      if (child.dataset && child.dataset.songId) {
        existingRowsMap.set(child.dataset.songId, child);
      }
    });

    const activeSongIds = new Set();

    ranked.forEach((song, idx) => {
      activeSongIds.add(song.id);
      const isPlayingCurrent = currentSongIndex !== -1 && currentQueue[currentSongIndex]?.id === song.id;
      const filterSecs = getSongSecondsForFilter(song.id, filter);
      const formattedTime = formatTimeListenedShort(filterSecs);

      let badgeClass = "";
      let badgeIcon = `#${idx + 1}`;
      if (idx === 0) { badgeClass = "top-1"; badgeIcon = "🥇 #1"; }
      else if (idx === 1) { badgeClass = "top-2"; badgeIcon = "🥈 #2"; }
      else if (idx === 2) { badgeClass = "top-3"; badgeIcon = "🥉 #3"; }

      let row = existingRowsMap.get(song.id);
      if (row) {
        // In-place DOM update: NEVER recreate <img> or re-insert HTML to eliminate flickering
        const expectedRowClass = `song-row ranking-song-row ${isPlayingCurrent ? "playing" : ""}`;
        if (row.className !== expectedRowClass) row.className = expectedRowClass;

        const badgeEl = row.querySelector(".rank-badge");
        if (badgeEl) {
          const expectedBadgeClass = `rank-badge ${badgeClass}`;
          if (badgeEl.className !== expectedBadgeClass) badgeEl.className = expectedBadgeClass;
          if (badgeEl.textContent !== badgeIcon) badgeEl.textContent = badgeIcon;
        }

        const playsEl = row.querySelector(".col-plays-count");
        const playsText = `${song.playCount || 0} reproducciones`;
        if (playsEl && playsEl.textContent !== playsText) {
          playsEl.textContent = playsText;
        }

        const timeEl = row.querySelector(".col-ranking-time");
        if (timeEl && timeEl.textContent !== formattedTime) {
          timeEl.textContent = formattedTime;
        }

        if (rankingEl.children[idx] !== row) {
          rankingEl.insertBefore(row, rankingEl.children[idx] || null);
        }
      } else {
        row = document.createElement("div");
        row.dataset.songId = song.id;
        row.className = `song-row ranking-song-row ${isPlayingCurrent ? "playing" : ""}`;
        const coverSrc = getCoverSrc(song);

        row.innerHTML = `
          <span class="rank-badge ${badgeClass}">${badgeIcon}</span>
          <div class="col-title-wrapper">
            <img class="row-cover" src="${coverSrc}" alt="Cover">
            <div class="row-info">
              <span class="row-title">${escapeHtml(song.title)}</span>
              <span class="row-artist">${escapeHtml(song.artist)}</span>
            </div>
          </div>
          <span class="col-plays-count" style="font-weight:600;color:var(--spotify-white);">${song.playCount || 0} reproducciones</span>
          <span class="col-ranking-time" style="font-weight:700;color:var(--spotify-green);">${formattedTime}</span>
          <div class="col-actions" style="margin-left:8px;">
            <button class="icon-btn row-queue-btn" title="Añadir a la cola" style="color:var(--spotify-white);"><i class="fa-solid fa-list-check"></i></button>
          </div>
        `;

        row.addEventListener("click", (e) => {
          if (e.target.closest(".row-queue-btn")) {
            e.stopPropagation();
            addToQueue(song);
          } else if (e.target.closest(".row-download-btn")) {
            e.stopPropagation();
            downloadSong(song);
          } else {
            playSongById(song.id, getRankedSongs(currentRankingFilter));
          }
        });

        rankingEl.insertBefore(row, rankingEl.children[idx] || null);
      }
    });

    // Remove rows for songs that no longer exist
    Array.from(rankingEl.children).forEach(child => {
      if (child.dataset && child.dataset.songId && !activeSongIds.has(child.dataset.songId)) {
        rankingEl.removeChild(child);
      }
    });
  }

  function getAbbaCoverSvg() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1db954"/>
          <stop offset="50%" stop-color="#0b481f"/>
          <stop offset="100%" stop-color="#05190a"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f39c12"/>
          <stop offset="50%" stop-color="#f1c40f"/>
          <stop offset="100%" stop-color="#e67e22"/>
        </linearGradient>
        <radialGradient id="vinylGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
        </radialGradient>
      </defs>
      <rect width="300" height="300" fill="url(#bgGrad)" rx="14"/>
      <circle cx="150" cy="150" r="110" fill="#111111" stroke="#222222" stroke-width="4"/>
      <circle cx="150" cy="150" r="95" fill="none" stroke="#2a2a2a" stroke-width="1.5" stroke-dasharray="6,4"/>
      <circle cx="150" cy="150" r="80" fill="none" stroke="#222222" stroke-width="1"/>
      <circle cx="150" cy="150" r="65" fill="none" stroke="#2a2a2a" stroke-width="1.5"/>
      <circle cx="150" cy="150" r="110" fill="url(#vinylGlow)"/>
      <circle cx="150" cy="150" r="42" fill="url(#goldGrad)"/>
      <circle cx="150" cy="150" r="8" fill="#111111"/>
      <text x="150" y="55" font-family="'Inter', sans-serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle" letter-spacing="6">ABBA</text>
      <text x="150" y="78" font-family="'Inter', sans-serif" font-weight="700" font-size="11" fill="#f1c40f" text-anchor="middle" letter-spacing="2">THE WINNER TAKES IT ALL</text>
      <text x="150" y="255" font-family="'Inter', sans-serif" font-weight="700" font-size="11" fill="#1db954" text-anchor="middle" letter-spacing="3">SUPER TROUPER • FLAC AUDIO</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function getCustomCoverSvg(title, artist) {
    const colors = [
      ["#1db954", "#0b3c1a"],
      ["#8e44ad", "#2c3e50"],
      ["#e74c3c", "#2c3e50"],
      ["#f39c12", "#111111"],
      ["#3498db", "#1b2631"]
    ];
    const str = (title || "Song") + (artist || "Artist");
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
    const pair = colors[Math.abs(hash) % colors.length];

    const initial = (title || "M").charAt(0).toUpperCase();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <defs>
        <linearGradient id="cGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${pair[0]}"/>
          <stop offset="100%" stop-color="${pair[1]}"/>
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#cGrad)" rx="14"/>
      <circle cx="150" cy="140" r="75" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="5"/>
      <text x="150" y="165" font-family="'Inter', sans-serif" font-weight="900" font-size="70" fill="#ffffff" text-anchor="middle">${initial}</text>
      <text x="150" y="245" font-family="'Inter', sans-serif" font-weight="700" font-size="14" fill="#ffffff" text-anchor="middle">${escapeHtml(title).substr(0, 18)}</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function getCoverSrc(song) {
    if (!song) return getAbbaCoverSvg();
    if (song.coverBlob && (song.coverBlob instanceof Blob || song.coverBlob instanceof File)) {
      try {
        const cached = coverObjectUrlCache.get(song.id);
        if (cached) return cached;
        const url = URL.createObjectURL(song.coverBlob);
        coverObjectUrlCache.set(song.id, url);
        return url;
      } catch (e) {}
    }
    if (song.coverUrl) return song.coverUrl;
    const mappedCoverUrl = getMappedCoverUrl(song);
    if (mappedCoverUrl) return mappedCoverUrl;

    const titleLower = (song.title || "").toLowerCase();
    const artistLower = (song.artist || "").toLowerCase();
    if (titleLower.includes("winner") || titleLower.includes("abba") || artistLower.includes("abba")) {
      return getAbbaCoverSvg();
    }

    return getCustomCoverSvg(song.title, song.artist);
  }

  function downloadSong(song) {
    if (!song) return;
    let url = song.audioUrl;
    if (!url && song.audioBlob && (song.audioBlob instanceof Blob || song.audioBlob instanceof File)) {
      try {
        url = URL.createObjectURL(song.audioBlob);
      } catch (e) {}
    }
    if (!url) {
      alert("No se pudo obtener el archivo de audio para la descarga.");
      return;
    }

    const a = document.createElement("a");
    a.href = url;
    const filename = `${song.title}`.match(/\.flac$/i) ? song.title : `${song.artist} - ${song.title}.flac`;
    a.download = filename.replace(/[/\\?%*:|"<>]/g, "_");
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);
  }

  let currentLibraryFilter = "all";
  let currentLibrarySort = "recent10d";

  const librarySortSelect = document.getElementById("library-sort-select");
  const librarySongsCount = document.getElementById("library-songs-count");

  if (librarySortSelect) {
    librarySortSelect.addEventListener("change", (e) => {
      currentLibrarySort = e.target.value;
      renderSongsTable(songs);
    });
  }

  document.querySelectorAll(".library-filters .filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".library-filters .filter-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentLibraryFilter = btn.getAttribute("data-lib-filter") || "all";
      renderSongsTable(songs);
    });
  });

  function renderSongsTable(songsList = songs) {
    if (!songsTableBody) return;
    songsTableBody.innerHTML = "";

    // 1. Filter
    let filtered = [...songsList];
    if (currentLibraryFilter === "liked") {
      filtered = filtered.filter(s => s.isLiked);
    } else if (currentLibraryFilter === "top10d") {
      filtered = filtered.filter(s => getSongSecondsLast10Days(s.id) > 0);
    } else if (currentLibraryFilter === "unplayed") {
      filtered = filtered.filter(s => !s.playCount || s.playCount === 0);
    }

    if (librarySongsCount) {
      librarySongsCount.textContent = `(${filtered.length} tema${filtered.length === 1 ? '' : 's'})`;
    }

    if (filtered.length === 0) {
      songsTableBody.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--spotify-grey);">
          <i class="fa-solid fa-music" style="font-size: 36px; margin-bottom: 12px;"></i>
          <p>No se encontraron canciones con el filtro seleccionado.</p>
        </div>
      `;
      return;
    }

    // 2. Sort
    filtered.sort((a, b) => {
      if (currentLibrarySort === "recent10d") {
        const timeA = getSongSecondsLast10Days(a.id);
        const timeB = getSongSecondsLast10Days(b.id);
        if (timeB !== timeA) return timeB - timeA;
        return (b.totalTimeListened || 0) - (a.totalTimeListened || 0);
      } else if (currentLibrarySort === "dateAdded") {
        return (b.dateAdded || 0) - (a.dateAdded || 0);
      } else if (currentLibrarySort === "titleAsc") {
        return (a.title || "").localeCompare(b.title || "");
      } else if (currentLibrarySort === "artistAsc") {
        return (a.artist || "").localeCompare(b.artist || "");
      } else if (currentLibrarySort === "albumAsc") {
        return (a.album || "").localeCompare(b.album || "");
      }
      return 0;
    });

    filtered.forEach((song, idx) => {
      const row = document.createElement("div");
      row.dataset.songId = song.id;
      const isPlayingCurrent = currentSongIndex !== -1 && currentQueue[currentSongIndex]?.id === song.id;
      row.className = `song-row ${isPlayingCurrent ? "playing" : ""}`;
      const coverSrc = getCoverSrc(song);
      const secs10D = getSongSecondsLast10Days(song.id);
      const time10DText = formatTimeListenedShort(secs10D);

      const rawDur = song.rawDuration || song.duration || 0;
      const isTrimmed = (song.trimEnabled !== false) && ((song.trimStart && song.trimStart > 0.1) || (song.trimEnd && song.trimEnd > 0 && (!rawDur || song.trimEnd < rawDur - 0.5)));
      const hasCustomGain = typeof song.gainDb === "number" && Math.abs(song.gainDb) >= 0.5;
      const trimBadge = isTrimmed
        ? `<span class="trim-badge" title="Canción con recorte activo" style="display:inline-flex; align-items:center; gap:3px; font-size:10px; color:var(--spotify-green); background:rgba(29,185,84,0.14); padding:1px 5px; border-radius:4px; margin-left:6px; vertical-align:middle;"><i class="fa-solid fa-scissors" style="font-size:9px;"></i> Recortada</span>`
        : "";
      const gainBadge = hasCustomGain
        ? `<span class="gain-badge" title="Ganancia personalizada" style="display:inline-flex; align-items:center; gap:3px; font-size:10px; color:${song.gainDb > 0 ? '#38bdf8' : '#fb923c'}; background:rgba(255,255,255,0.08); padding:1px 5px; border-radius:4px; margin-left:6px; vertical-align:middle;"><i class="fa-solid fa-volume-high" style="font-size:9px;"></i> ${song.gainDb > 0 ? '+' : ''}${song.gainDb.toFixed(1)} dB</span>`
        : "";

      const isUnidentified = Boolean(song.needsReview || isGenericSongTitle(song.title));
      const unidentifiedBadge = isUnidentified
        ? `<span class="unidentified-badge" title="Toca para editar título y buscar carátula" style="display:inline-flex; align-items:center; gap:3px; font-size:10px; color:#fca5a5; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.5); padding:1px 6px; border-radius:6px; margin-left:6px; vertical-align:middle; cursor:pointer;"><i class="fa-solid fa-circle-question" style="font-size:9px;"></i> Sin identificar</span>`
        : "";

      row.innerHTML = `
        <button class="icon-btn row-play-btn" title="Reproducir" style="color:var(--spotify-green); font-size: 20px; padding: 4px; margin-right: 4px; cursor: pointer; display: flex; align-items: center;"><i class="fa-solid fa-circle-play"></i></button>
        <span class="col-num">${idx + 1}</span>
        <div class="col-title-wrapper">
          <img class="row-cover" src="${coverSrc}" alt="Cover">
          <div class="row-info">
            <span class="row-title">${escapeHtml(song.title)}${trimBadge}${gainBadge}${unidentifiedBadge}</span>
            <span class="row-artist">${escapeHtml(song.artist)}</span>
          </div>
        </div>
        <span class="col-album">${escapeHtml(song.album)}</span>
        <span class="col-date" style="color:var(--spotify-green); font-weight:700;">${time10DText}</span>
        <div class="col-actions">
          <button class="icon-btn row-playlist-btn" title="Añadir a lista" style="color:var(--spotify-green);"><i class="fa-solid fa-folder-plus"></i></button>
          <button class="icon-btn row-queue-btn" title="Añadir a la cola" style="color:var(--spotify-white);"><i class="fa-solid fa-list-check"></i></button>
          <button class="icon-btn row-download-btn" title="Descargar canción FLAC en tu dispositivo" style="color:var(--spotify-green);"><i class="fa-solid fa-download"></i></button>
          <button class="icon-btn row-trim-btn" title="${isTrimmed ? 'Recorte activo' : (hasCustomGain ? 'Ganancia personalizada' : 'Recortar y nivelar canción')}" style="color:${(isTrimmed || hasCustomGain) ? '#1db954' : 'var(--spotify-grey)'};"><i class="fa-solid fa-scissors"></i></button>
          <button class="icon-btn row-edit-btn" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn row-like-btn ${song.isLiked ? "liked" : ""}" title="Me gusta"><i class="${song.isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i></button>
          <button class="icon-btn row-delete-btn" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `;

      row.addEventListener("click", (e) => {
        if (e.target.closest(".row-playlist-btn")) {
          e.stopPropagation();
          openAddToPlaylistModal(song.id);
        } else if (e.target.closest(".row-queue-btn")) {
          e.stopPropagation();
          addToQueue(song);
        } else if (e.target.closest(".row-download-btn")) {
          e.stopPropagation();
          downloadSong(song);
        } else if (e.target.closest(".row-trim-btn")) {
          e.stopPropagation();
          openTrimModal(song);
        } else if (e.target.closest(".row-edit-btn")) {
          e.stopPropagation();
          openEditMetaModal(song);
        } else if (e.target.closest(".row-like-btn")) {
          e.stopPropagation();
          toggleLikeSong(song.id);
        } else if (e.target.closest(".row-delete-btn")) {
          e.stopPropagation();
          deleteSong(song.id);
        } else if (e.target.closest(".unidentified-badge")) {
          e.stopPropagation();
          openEditMetaModal(song);
        } else {
          playSongById(song.id, filtered);
        }
      });

      songsTableBody.appendChild(row);
    });
  }

  function renderRecentGrid(recentSongs) {
    recentGrid.innerHTML = "";
    if (recentSongs.length === 0) {
      recentGrid.innerHTML = `<p style="color:var(--spotify-grey)">Subirás tus primeros temas aquí.</p>`;
      return;
    }

    recentSongs.forEach(song => {
      const card = createMusicCard(song, recentSongs);
      recentGrid.appendChild(card);
    });
  }

  function renderFavoritesGrid(favSongs) {
    if (!favoritesGrid) return;
    favoritesGrid.innerHTML = "";
    if (favSongs.length === 0) {
      favoritesGrid.innerHTML = `<p style="color:var(--spotify-grey)">Toca el corazón ❤️ en cualquier canción para guardarla aquí.</p>`;
      return;
    }

    favSongs.forEach(song => {
      const card = createMusicCard(song, favSongs);
      favoritesGrid.appendChild(card);
    });
  }

  function createMusicCard(song, contextList = null) {
    const card = document.createElement("div");
    card.className = "music-card";
    const coverSrc = getCoverSrc(song);

    card.innerHTML = `
      <div class="card-img-wrapper">
        <img src="${coverSrc}" alt="Cover">
        <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
      </div>
      <div class="card-title">${escapeHtml(song.title)}</div>
      <div class="card-subtitle">${escapeHtml(song.artist)}</div>
    `;

    card.addEventListener("click", () => playSongById(song.id, contextList));
    return card;
  }

  async function toggleLikeSong(id) {
    const s = songs.find(x => x.id === id);
    if (s) {
      s.isLiked = !s.isLiked;
      renderSongsTable(songs);
      renderFavoritesGrid(songs.filter(x => x.isLiked));
      if (currentSongIndex !== -1 && currentQueue[currentSongIndex]?.id === id) {
        updateLikeBtnUI(s.isLiked);
      }
      try {
        await musicDB.toggleLike(id);
      } catch(e) {}
    }
  }

  async function deleteSong(id) {
    const song = songs.find(s => s.id === id);
    const songTitle = song ? song.title : "";
    const confirmMsg = songTitle 
      ? `¿Estás seguro de eliminar "${songTitle}" de tu biblioteca local?`
      : "¿Estás seguro de eliminar esta canción de tu biblioteca local?";

    if (!confirm(confirmMsg)) return;

    markSongAsDeleted(id, songTitle);

    // Lock historical and yearly totals before removing song so total hours never decrease
    const currentStats = getStatsIndex();
    _persistedGlobalTotalSeconds = Math.max(_persistedGlobalTotalSeconds, currentStats.historyTotal || 0);
    _persistedYearlyTotalSeconds = Math.max(_persistedYearlyTotalSeconds, currentStats.yearTotal || 0);
    try {
      localStorage.setItem("spotilocal_global_total_secs", String(_persistedGlobalTotalSeconds));
      localStorage.setItem(`spotilocal_yearly_total_secs_${new Date().getFullYear()}`, String(_persistedYearlyTotalSeconds));
      if (typeof musicDB !== "undefined" && musicDB.setSetting) {
        musicDB.setSetting("globalTotalSeconds", _persistedGlobalTotalSeconds).catch(() => {});
        musicDB.setSetting(`yearlyTotalSeconds_${new Date().getFullYear()}`, _persistedYearlyTotalSeconds).catch(() => {});
      }
    } catch(e) {}

    try {
      if (typeof musicDB !== "undefined" && musicDB.deleteSong) {
        await musicDB.deleteSong(id);
      }
    } catch (e) {
      console.warn("Error deleting from DB:", e);
    }

    songs = songs.filter(s => s.id !== id);
    currentQueue = currentQueue.filter(s => s.id !== id);

    saveCachedSongs(songs);
    invalidateStatsIndex();

    _libraryTableDirty = true;
    renderSongsTable(songs);
    renderRecentGrid(songs.slice(0, 6));
    renderFavoritesGrid(songs.filter(s => s.isLiked));
    renderWrappedStats();
    try { renderHistoricalRanking(true); } catch(e) {}

    if (currentSong && currentSong.id === id) {
      if (currentQueue.length > 0) {
        playNext();
      } else {
        if (audioPlayer && audioPlayer.pause) audioPlayer.pause();
        currentSong = null;
        updatePlayerUI(null);
      }
    }

    if (typeof showToast === "function") {
      showToast("Canción eliminada definitivamente 🗑️");
    }
  }

  // Filter chips in Library
  document.querySelectorAll(".library-filters .filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".library-filters .filter-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const filter = btn.getAttribute("data-filter");
      if (filter === "all") {
        songsListContainer.classList.remove("hidden");
        libraryPlaylistsGrid.classList.add("hidden");
        renderSongsTable(songs);
      } else if (filter === "top") {
        songsListContainer.classList.remove("hidden");
        libraryPlaylistsGrid.classList.add("hidden");
        const topSorted = [...songs].sort((a, b) => (b.totalTimeListened || 0) - (a.totalTimeListened || 0));
        renderSongsTable(topSorted);
      } else if (filter === "liked") {
        songsListContainer.classList.remove("hidden");
        libraryPlaylistsGrid.classList.add("hidden");
        renderSongsTable(songs.filter(s => s.isLiked));
      } else if (filter === "playlists") {
        songsListContainer.classList.add("hidden");
        libraryPlaylistsGrid.classList.remove("hidden");
        renderPlaylistsGrid();
      }
    });
  });

  // Global Search
  globalSearchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderSongsTable(songs);
      return;
    }

    const filtered = songs.filter(s => 
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.album.toLowerCase().includes(q)
    );
    renderSongsTable(filtered);
    switchTab("library");
  });

  // --------------------------------------------------------------------------
  // PLAYER ENGINE & CONTROLS
  // --------------------------------------------------------------------------

  function cryptoShuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      let j = 0;
      if (window.crypto && window.crypto.getRandomValues) {
        const randBuf = new Uint32Array(1);
        window.crypto.getRandomValues(randBuf);
        j = randBuf[0] % (i + 1);
      } else {
        j = Math.floor(Math.random() * (i + 1));
      }
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function getVisibleLibrarySongs() {
    const tableBody = document.getElementById("songs-table-body");
    if (tableBody) {
      const rows = tableBody.querySelectorAll(".song-row[data-song-id], tr[data-song-id]");
      if (rows && rows.length > 0) {
        const rowSongs = [];
        rows.forEach(r => {
          const sid = r.getAttribute("data-song-id");
          const s = songs.find(x => x.id === sid);
          if (s) rowSongs.push(s);
        });
        if (rowSongs.length > 0) return rowSongs;
      }
    }
    return songs.length > 0 ? [...songs] : [];
  }

  function setQueueFromContext(contextSongs, startSongId) {
    if (!Array.isArray(contextSongs) || contextSongs.length === 0) return;
    let baseList = [...contextSongs];
    const startIndex = baseList.findIndex(s => s.id === startSongId);
    const startSong = startIndex !== -1 ? baseList[startIndex] : baseList[0];

    // If context is a single song (e.g. search filter), chain the rest of the library after it
    if (baseList.length === 1 && Array.isArray(songs) && songs.length > 1) {
      const remaining = songs.filter(s => s.id !== startSong.id);
      baseList = [startSong, ...remaining];
    }

    unshuffledQueue = [...baseList];

    if (isShuffle) {
      const rest = unshuffledQueue.filter(s => s.id !== startSong.id);
      const shuffledRest = cryptoShuffle(rest);
      currentQueue = [startSong, ...shuffledRest];
      currentSongIndex = 0;
    } else {
      currentQueue = [...unshuffledQueue];
      const foundIdx = currentQueue.findIndex(s => s.id === startSong.id);
      currentSongIndex = foundIdx !== -1 ? foundIdx : 0;
    }
    syncNativeQueue();
  }

  async function playSongById(id, contextSongs = null) {
    pendingQueue = [];
    const sourceList = (Array.isArray(contextSongs) && contextSongs.length > 0)
      ? contextSongs
      : (unshuffledQueue.length > 0 ? unshuffledQueue : getVisibleLibrarySongs());

    setQueueFromContext(sourceList, id);

    const targetSong = currentQueue[currentSongIndex];
    if (targetSong && typeof showToast === "function") {
      showToast(`▶️ Reproduciendo: "${targetSong.title}"`);
    }
    await loadAndPlayCurrentSong();
  }

  let currentAudioObjectUrl = null;
  let wakeLockObj = null;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLockObj) {
        wakeLockObj = await navigator.wakeLock.request('screen');
        wakeLockObj.addEventListener('release', () => {
          wakeLockObj = null;
        });
      }
    } catch(e) {}
  }

  function releaseWakeLock() {
    if (wakeLockObj) {
      try { wakeLockObj.release(); } catch(e) {}
      wakeLockObj = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isPlaying) {
      requestWakeLock();
    }
  });

  function updatePlayingRowHighlight() {
    const currentSong = currentQueue[currentSongIndex];
    const currentId = currentSong ? currentSong.id : null;
    const rows = document.querySelectorAll(".song-row[data-song-id], tr[data-song-id]");
    rows.forEach(row => {
      const rowId = row.getAttribute("data-song-id");
      if (rowId === currentId) {
        row.classList.add("playing");
      } else {
        row.classList.remove("playing");
      }
    });
  }

  function updatePlayerMetadata(song, coverSrc = getCoverSrc(song)) {
    if (!song) return;
    if (playerCover) playerCover.src = coverSrc;
    if (expandedCover) expandedCover.src = coverSrc;
    if (lyricsCover) lyricsCover.src = coverSrc;
    if (playerTitle) playerTitle.textContent = song.title || "Sin Título";
    if (playerArtist) playerArtist.textContent = song.artist || "Artista Desconocido";
    if (expandedTitle) expandedTitle.textContent = song.title || "Sin Título";
    if (expandedArtist) expandedArtist.textContent = song.artist || "Artista Desconocido";
    if (lyricsTitle) lyricsTitle.textContent = song.title || "Sin Título";
    if (lyricsArtist) lyricsArtist.textContent = song.artist || "Artista Desconocido";
    updateLikeBtnUI(song.isLiked);
    updateAmbientGlow(coverSrc);
    try { updateMediaSession(song, coverSrc); } catch(e) {}
    try { loadLyricsForSong(song.id); } catch(e) {}
    try { updatePlayingRowHighlight(); } catch(e) {}
  }

  function ensureAudioConnected() {
    try {
      if (!audioElement || typeof audioEngine === "undefined") return;
      audioElement.crossOrigin = "anonymous";
      audioEngine.init(audioElement);
      audioEngine.resume();
    } catch(e) {
      console.warn("Audio Context note:", e);
    }
  }

  function applyCurrentTrackGain(gainDbOverride = null) {
    const song = (currentQueue && currentSongIndex >= 0) ? currentQueue[currentSongIndex] : null;
    const rawGain = gainDbOverride !== null ? gainDbOverride : (song && typeof song.gainDb === "number" ? song.gainDb : 0);
    const gainDb = Math.max(-30, Math.min(30, parseFloat(rawGain) || 0));
    const isMuted = Boolean(audioElement && audioElement.muted);
    const baseVol = isMuted ? 0 : (parseFloat(volumeSlider ? volumeSlider.value : 1.0) || 1.0);

    const nativePlayer = typeof window.SpotiLocalNativePlayer !== "undefined"
      && window.SpotiLocalNativePlayer.isAvailable
      && window.SpotiLocalNativePlayer.isAvailable()
      ? window.SpotiLocalNativePlayer
      : null;

    if (usingNativePlayback && nativePlayer) {
      if (nativePlayer.setVolume) nativePlayer.setVolume(baseVol);
      if (nativePlayer.setTrackGainDb) nativePlayer.setTrackGainDb(gainDb);
    } else {
      const trackGainMul = Math.pow(10, gainDb / 20);
      if (typeof audioEngine !== "undefined" && audioEngine && audioEngine.gainNode) {
        if (audioElement) audioElement.volume = Math.max(0, Math.min(1.0, baseVol));
        if (audioEngine.setGain) audioEngine.setGain(trackGainMul);
      } else {
        const effectiveVol = Math.max(0, Math.min(1.0, baseVol * trackGainMul));
        if (audioElement) audioElement.volume = effectiveVol;
      }
    }
  }

  async function loadAndPlayCurrentSong() {
    const song = currentQueue[currentSongIndex];
    if (!song) return;

    hasScrobbledCurrentPlay = false;

    if (currentAudioObjectUrl) {
      try { URL.revokeObjectURL(currentAudioObjectUrl); } catch(e) {}
      currentAudioObjectUrl = null;
    }

    // Prefer the cached local Blob so pause/resume does not depend on the Wi-Fi stream.
    let rawBlob = song.audioBlob;
    if (!rawBlob && song.id && typeof musicDB !== "undefined" && musicDB.getAudioBlob) {
      try {
        rawBlob = await musicDB.getAudioBlob(song.id);
        if (rawBlob) song.audioBlob = rawBlob;
      } catch (e) {}
    }
    if (!rawBlob && song.id && typeof musicDB !== "undefined" && musicDB.getSong) {
      try {
        const dbSong = await musicDB.getSong(song.id);
        if (dbSong && dbSong.audioBlob) {
          rawBlob = dbSong.audioBlob;
          song.audioBlob = dbSong.audioBlob;
        }
      } catch (e) {}
    }

    // Resolve stream URL as a fallback when the local copy is unavailable.
    let streamUrl = "";
    if (song.audioUrl) {
      streamUrl = getFullUrl(song.audioUrl);
    }

    const nativePlayer = typeof window.SpotiLocalNativePlayer !== "undefined"
      && window.SpotiLocalNativePlayer.isAvailable
      && window.SpotiLocalNativePlayer.isAvailable()
      ? window.SpotiLocalNativePlayer
      : null;

    // Determine audio source: 1. Local IndexedDB Blob, 2. Direct Server Stream
    _nativeLocalQueueGen++;
    let audioSrc = "";
    const hasLocalAudio = rawBlob && typeof rawBlob.size === "number" && rawBlob.size > 0 && typeof rawBlob.slice === "function";
    let nativeLocalUrl = nativePlayer
      ? await ensureNativeLocalAudio(song, nativePlayer)
      : "";
    if (nativePlayer && !nativeLocalUrl && hasLocalAudio) {
      nativeLocalUrl = await ensureNativeLocalAudio(song, nativePlayer);
    }
    const isHttpStream = /^https?:\/\//i.test(streamUrl);
    const serverAvailable = !hasLocalAudio && !nativeLocalUrl && isHttpStream && await checkServerAudioAvailable(streamUrl);
    if (hasLocalAudio) {
      try {
        const mimeType = rawBlob.type || getAudioMimeType(song.audioUrl, "audio/mpeg");
        const typedBlob = rawBlob.type ? rawBlob : new Blob([rawBlob], { type: mimeType });
        audioSrc = URL.createObjectURL(typedBlob);
        currentAudioObjectUrl = audioSrc;
      } catch (e) {
        console.warn("ObjectURL creation error:", e);
      }
    }
    if (!audioSrc && streamUrl && serverAvailable) {
      audioSrc = streamUrl;
    }

    if (!audioSrc && !nativeLocalUrl) {
      if (typeof showToast === "function") {
        showToast(hasLocalAudio
          ? "Preparando reproducción offline... ⚠️"
          : "Canción no guardada offline. Sincronízala con el PC primero ⚠️");
      }
      updatePlayerMetadata(song);
      return;
    }

    const isTrimActive = song.trimEnabled !== false;
    const trimStart = isTrimActive && typeof song.trimStart === "number" && song.trimStart > 0 ? song.trimStart : 0;
    const trimEnd = isTrimActive && typeof song.trimEnd === "number" && song.trimEnd > 0 ? song.trimEnd : 0;
    const songGainDb = typeof song.gainDb === "number" ? Math.max(-30, Math.min(30, song.gainDb)) : 0;

    if (nativePlayer && (nativeLocalUrl || serverAvailable || hasLocalAudio)) {
      // ExoPlayer owns the APK audio session; never play the same track twice.
      usingNativePlayback = true;
      _nativeOfflineFallbackAttempted = false;
      audioElement.pause();
      audioElement.removeAttribute("src");
      audioElement.load();
      const coverUrl = getCoverSrc(song);
      const artworkUrl = /^https?:\/\//i.test(coverUrl) ? coverUrl : "";
      const nativeQueue = serializeNativeQueue();
      if (nativeQueue.length > 0 && nativePlayer.setQueue) {
        nativePlayer.setQueue(JSON.stringify(nativeQueue));
      }
      if (nativePlayer.setRepeatMode) nativePlayer.setRepeatMode(repeatMode);
      if (nativePlayer.setShuffleMode) nativePlayer.setShuffleMode(isShuffle);
      if (nativePlayer.setPlaybackRate) nativePlayer.setPlaybackRate(parseFloat(speedSelect ? speedSelect.value : 1) || 1);
      if (nativePlayer.setEqBand) {
        eqSliders.forEach(slider => nativePlayer.setEqBand(parseInt(slider.getAttribute("data-band")), parseFloat(slider.value)));
      }
      applyCurrentTrackGain(songGainDb);
      nativePlayer.load(nativeLocalUrl || streamUrl, song.id || "", song.title || "", song.artist || "", song.album || "", artworkUrl, trimStart, trimEnd, songGainDb);
      prepareNativeLocalQueueInBackground(getQueueEntries().map(entry => entry.song), nativePlayer);
      isPlaying = true;
      updatePlayPauseUI();
      if ("mediaSession" in navigator && !isNativeBridgeAvailable()) navigator.mediaSession.playbackState = "playing";
      requestWakeLock();
    } else {
      // Browser/PWA playback stays on the HTML5 audio element.
      const wasUsingNativePlayback = usingNativePlayback;
      usingNativePlayback = false;
      if (wasUsingNativePlayback && nativePlayer && nativePlayer.pause) nativePlayer.pause();
      audioElement.crossOrigin = "anonymous";
      if (audioSrc.startsWith("blob:")) audioElement.removeAttribute("crossorigin");
      audioElement.src = audioSrc;
      audioElement.muted = false;
      audioElement.playbackRate = parseFloat(speedSelect ? speedSelect.value : 1.0) || 1.0;
      audioElement.load();
      ensureAudioConnected();
      applyCurrentTrackGain(songGainDb);
      const playPromise = audioElement.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (trimStart > 0 && Math.abs(audioElement.currentTime - trimStart) > 0.5) {
            try { audioElement.currentTime = trimStart; } catch(e){}
          }
          isPlaying = true;
          updatePlayPauseUI();
          if ("mediaSession" in navigator && !isNativeBridgeAvailable()) {
            navigator.mediaSession.playbackState = "playing";
          }
          requestWakeLock();
        }).catch(e => {
          console.warn("Initial play error:", e);
          if (streamUrl && serverAvailable && audioSrc.startsWith("blob:")) {
            audioElement.removeAttribute("crossorigin");
            audioElement.src = streamUrl;
            audioElement.load();
            audioElement.play().catch(() => {});
          } else if (typeof showToast === "function") {
            showToast(`Error al reproducir: Comprueba la IP (${activeServerIp}) ⚠️`);
          }
          isPlaying = false;
          updatePlayPauseUI();
        });
      } else {
        isPlaying = true;
        updatePlayPauseUI();
      }
    }

    updatePlayerMetadata(song);
  }

  function updatePlayPauseUI() {
    const iconClass = isPlaying ? "fa-pause" : "fa-play";
    btnPlayPause.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    expBtnPlayPause.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
  }

  audioElement.addEventListener("play", () => {
    if (isNativeBridgeAvailable() || usingNativePlayback) return;
    isPlaying = true;
    updatePlayPauseUI();
    if ("mediaSession" in navigator && !isNativeBridgeAvailable()) {
      navigator.mediaSession.playbackState = "playing";
    }
    requestWakeLock();
  });

  audioElement.addEventListener("pause", () => {
    if (isNativeBridgeAvailable() || usingNativePlayback) return;
    isPlaying = false;
    updatePlayPauseUI();
    if ("mediaSession" in navigator && !isNativeBridgeAvailable()) {
      navigator.mediaSession.playbackState = "paused";
    }
    releaseWakeLock();
  });

  function updateLikeBtnUI(isLiked) {
    const iconClass = isLiked ? "fa-solid" : "fa-regular";
    playerLikeBtn.innerHTML = `<i class="${iconClass} fa-heart"></i>`;
    expandedLikeBtn.innerHTML = `<i class="${iconClass} fa-heart"></i>`;

    if (isLiked) {
      playerLikeBtn.classList.add("liked");
      expandedLikeBtn.classList.add("liked");
    } else {
      playerLikeBtn.classList.remove("liked");
      expandedLikeBtn.classList.remove("liked");
    }
  }

  btnPlayPause.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePlayPause();
  });
  expBtnPlayPause.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePlayPause();
  });

  let fadeInterval = null;
  function fadeVolume(targetVol, durationMs = 120, callback) {
    if (fadeInterval) clearInterval(fadeInterval);
    const startVol = audioElement.volume;
    const diff = targetVol - startVol;
    if (Math.abs(diff) < 0.02) {
      audioElement.volume = targetVol;
      if (callback) callback();
      return;
    }
    const steps = 10;
    const stepDuration = durationMs / steps;
    const stepDiff = diff / steps;
    let stepCount = 0;

    fadeInterval = setInterval(() => {
      stepCount++;
      const nextVol = Math.max(0, Math.min(1, audioElement.volume + stepDiff));
      audioElement.volume = nextVol;
      if (stepCount >= steps) {
        clearInterval(fadeInterval);
        fadeInterval = null;
        audioElement.volume = targetVol;
        if (callback) callback();
      }
    }, stepDuration);
  }

  function togglePlayPause() {
    if (currentSongIndex === -1) {
      if (songs.length > 0) {
        currentSongIndex = 0;
        loadAndPlayCurrentSong();
      }
      return;
    }

    const useNative = usingNativePlayback && typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.isAvailable && window.SpotiLocalNativePlayer.isAvailable();

    const userVol = parseFloat(volumeSlider ? volumeSlider.value : 1.0) || 1.0;

    if (isPlaying) {
      if (useNative) {
        window.SpotiLocalNativePlayer.pause();
        applyNativeListeningStats();
      } else {
        audioElement.pause();
      }
      isPlaying = false;
      updatePlayPauseUI();
      if ("mediaSession" in navigator && !isNativeBridgeAvailable()) {
        navigator.mediaSession.playbackState = "paused";
      }
    } else {
      if (useNative) {
        window.SpotiLocalNativePlayer.play();
        isPlaying = true;
        updatePlayPauseUI();
        if ("mediaSession" in navigator && !isNativeBridgeAvailable()) navigator.mediaSession.playbackState = "playing";
        requestWakeLock();
      } else {
        applyCurrentTrackGain();
        if (typeof audioEngine !== "undefined" && audioEngine.resume) {
          audioEngine.resume();
        }
        const playPromise = audioElement.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.then(() => {
            isPlaying = true;
            updatePlayPauseUI();
            if ("mediaSession" in navigator && !isNativeBridgeAvailable()) {
              navigator.mediaSession.playbackState = "playing";
            }
            requestWakeLock();
          }).catch(e => {
            isPlaying = false;
            updatePlayPauseUI();
            console.warn("Play error:", e);
          });
        } else {
          isPlaying = true;
          updatePlayPauseUI();
        }
      }
    }
    updatePlayPauseUI();
  }

  // --------------------------------------------------------------------------
  // TOUCH SWIPE GESTURES (Single finger on player & Two fingers globally for OnePlus Nord)
  // --------------------------------------------------------------------------

  // Global Two-Finger Swipe (Anywhere on screen, doesn't interfere with normal 1-finger scroll)
  let twoFingerStartX = 0;
  let twoFingerStartY = 0;
  let isTwoFingerActive = false;

  window.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length === 2) {
      isTwoFingerActive = true;
      twoFingerStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      twoFingerStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    } else {
      isTwoFingerActive = false;
    }
  }, { passive: true });

  window.addEventListener("touchend", (e) => {
    if (!isTwoFingerActive) return;
    isTwoFingerActive = false;

    if (e.changedTouches && e.changedTouches.length >= 1) {
      let endX = e.changedTouches[0].clientX;
      let endY = e.changedTouches[0].clientY;
      if (e.changedTouches.length >= 2) {
        endX = (e.changedTouches[0].clientX + e.changedTouches[1].clientX) / 2;
        endY = (e.changedTouches[0].clientY + e.changedTouches[1].clientY) / 2;
      }

      const diffX = endX - twoFingerStartX;
      const diffY = endY - twoFingerStartY;

      // Horizontal swipe: Left -> Next, Right -> Previous
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
        if (diffX < 0) {
          playNextSong();
          const targetSong = currentQueue[currentSongIndex];
          if (typeof showToast === "function") {
            showToast(`✌️ Siguiente: "${targetSong ? targetSong.title : ''}"`);
          }
        } else {
          playPrevSong();
          const targetSong = currentQueue[currentSongIndex];
          if (typeof showToast === "function") {
            showToast(`✌️ Anterior: "${targetSong ? targetSong.title : ''}"`);
          }
        }
      }
      // Vertical swipe DOWN with 2 fingers: Pause / Stop
      else if (diffY > 60 && Math.abs(diffY) > Math.abs(diffX) * 1.2) {
        togglePlayPause();
        if (typeof showToast === "function") {
          showToast(isPlaying ? "✌️ ▶️ Reanudado" : "✌️ ⏸️ Pausado");
        }
      }
    }
  }, { passive: true });

  // Single finger swipe on specific player elements
  function setupSwipeGestures(element, onSwipeLeft, onSwipeRight, onSwipeDown) {
    if (!element) return;
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    element.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    }, { passive: true });

    element.addEventListener("touchend", (e) => {
      if (e.changedTouches && e.changedTouches.length === 1) {
        endX = e.changedTouches[0].clientX;
        endY = e.changedTouches[0].clientY;
        const diffX = endX - startX;
        const diffY = endY - startY;

        // Horizontal swipe threshold: 45px
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
          if (diffX < 0 && onSwipeLeft) {
            onSwipeLeft();
          } else if (diffX > 0 && onSwipeRight) {
            onSwipeRight();
          }
        }
        // Vertical swipe down threshold: 60px
        else if (diffY > 60 && Math.abs(diffY) > Math.abs(diffX) && onSwipeDown) {
          onSwipeDown();
        }
      }
    }, { passive: true });
  }

  setupSwipeGestures(playerBar, () => playNextSong(), () => playPrevSong());
  setupSwipeGestures(expandedPlayerModal, () => playNextSong(), () => playPrevSong(), () => closeExpandedPlayer());

  btnNext.addEventListener("click", (e) => {
    e.stopPropagation();
    playNextSong();
  });
  expBtnNext.addEventListener("click", (e) => {
    e.stopPropagation();
    playNextSong();
  });

  function playNextSong() {
    if (currentQueue.length === 0) return;
    if (usingNativePlayback) applyNativeListeningStats();
    else recordCurrentSongTime();
    if (pendingQueue.length > 0 && repeatMode !== 2) {
      const nextQueuedSong = pendingQueue.shift();
      const insertIndex = currentSongIndex >= 0 ? currentSongIndex + 1 : currentQueue.length;
      currentQueue.splice(insertIndex, 0, nextQueuedSong);
      currentSongIndex = insertIndex;
      syncNativeQueue();
      loadAndPlayCurrentSong();
      try { renderQueueModal(); } catch(e) {}
      return;
    }

    if (currentSongIndex >= currentQueue.length - 1) {
      if (isShuffle && currentQueue.length > 1) {
        const lastSong = currentQueue[currentSongIndex];
        const pool = (unshuffledQueue && unshuffledQueue.length > 0) ? unshuffledQueue : currentQueue;
        let newShuffled = cryptoShuffle(pool);
        if (newShuffled[0]?.id === lastSong?.id && newShuffled.length > 1) {
          const swapIdx = 1 + Math.floor(Math.random() * (newShuffled.length - 1));
          const tmp = newShuffled[0];
          newShuffled[0] = newShuffled[swapIdx];
          newShuffled[swapIdx] = tmp;
        }
        currentQueue = newShuffled;
        currentSongIndex = 0;
        syncNativeQueue();
      } else {
        currentSongIndex = 0;
      }
    } else {
      currentSongIndex = currentSongIndex + 1;
    }
    loadAndPlayCurrentSong();
  }

  btnPrev.addEventListener("click", (e) => {
    e.stopPropagation();
    playPrevSong();
  });
  expBtnPrev.addEventListener("click", (e) => {
    e.stopPropagation();
    playPrevSong();
  });

  function playPrevSong() {
    if (currentQueue.length === 0) return;
    if (usingNativePlayback) applyNativeListeningStats();
    else recordCurrentSongTime();
    const useNative = usingNativePlayback && typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.isAvailable && window.SpotiLocalNativePlayer.isAvailable();
    // If more than 3s played, restart current song
    let currentPos = 0;
    if (useNative) {
      try {
        const st = JSON.parse(window.SpotiLocalNativePlayer.getState());
        currentPos = (st.positionMs || 0) / 1000;
      } catch(e) {}
    } else {
      currentPos = audioElement.currentTime;
    }
    if (currentPos > 3) {
      if (useNative) {
        window.SpotiLocalNativePlayer.seekTo(0);
      } else {
        audioElement.currentTime = 0;
      }
      return;
    }
    currentSongIndex = (currentSongIndex - 1 + currentQueue.length) % currentQueue.length;
    loadAndPlayCurrentSong();
  }

  btnShuffle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleShuffle();
  });
  expBtnShuffle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleShuffle();
  });

  function toggleShuffle() {
    if (repeatMode === 2) {
      repeatMode = 1;
      localStorage.setItem("spotilocal_repeat_mode", "1");
      audioElement.loop = false;
      if (typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.setRepeatMode) {
        window.SpotiLocalNativePlayer.setRepeatMode(1);
      }
      updateRepeatUI();
    }
    isShuffle = !isShuffle;
    localStorage.setItem("spotilocal_is_shuffle", isShuffle ? "true" : "false");
    if (btnShuffle) btnShuffle.classList.toggle("active", isShuffle);
    if (expBtnShuffle) expBtnShuffle.classList.toggle("active", isShuffle);

    const currSong = currentQueue[currentSongIndex];

    if (isShuffle) {
      if (unshuffledQueue.length === 0 && currentQueue.length > 0) {
        unshuffledQueue = [...currentQueue];
      }
      if (currSong) {
        const rest = unshuffledQueue.filter(s => s.id !== currSong.id);
        currentQueue = [currSong, ...cryptoShuffle(rest)];
        currentSongIndex = 0;
      } else {
        currentQueue = cryptoShuffle(unshuffledQueue.length > 0 ? unshuffledQueue : currentQueue);
        currentSongIndex = 0;
      }
      if (typeof showToast === "function") showToast("Modo aleatorio infinito activado 🔀");
    } else {
      if (unshuffledQueue.length > 0) {
        currentQueue = [...unshuffledQueue];
        if (currSong) {
          const idx = currentQueue.findIndex(s => s.id === currSong.id);
          currentSongIndex = idx !== -1 ? idx : 0;
        }
      }
      if (typeof showToast === "function") showToast("Modo continuo ordenado activado ➡️");
    }

    syncNativeQueue();
    if (typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.setShuffleMode) {
      window.SpotiLocalNativePlayer.setShuffleMode(isShuffle);
    }
    try { renderQueueModal(); } catch(e) {}
  }

  btnRepeat.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleRepeat();
  });
  expBtnRepeat.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleRepeat();
  });

  function updateRepeatUI() {
    if (repeatMode !== 2) repeatMode = 1;
    if (repeatMode === 1) {
      if (btnRepeat) {
        btnRepeat.classList.add("active");
        btnRepeat.title = "Bucle continuo: Lista infinita activa";
        btnRepeat.style.position = "relative";
        btnRepeat.innerHTML = `<i class="fa-solid fa-repeat"></i>`;
      }
      if (expBtnRepeat) {
        expBtnRepeat.classList.add("active");
        expBtnRepeat.title = "Bucle continuo: Lista infinita activa";
        expBtnRepeat.style.position = "relative";
        expBtnRepeat.innerHTML = `<i class="fa-solid fa-repeat"></i>`;
      }
    } else if (repeatMode === 2) {
      if (btnRepeat) {
        btnRepeat.classList.add("active");
        btnRepeat.title = "Repetir: Canción actual";
        btnRepeat.style.position = "relative";
        btnRepeat.innerHTML = `<i class="fa-solid fa-repeat"></i><span style="position:absolute; bottom:2px; right:4px; font-size:9px; font-weight:800; color:var(--spotify-green);">1</span>`;
      }
      if (expBtnRepeat) {
        expBtnRepeat.classList.add("active");
        expBtnRepeat.title = "Repetir: Canción actual";
        expBtnRepeat.style.position = "relative";
        expBtnRepeat.innerHTML = `<i class="fa-solid fa-repeat"></i><span style="position:absolute; bottom:2px; right:4px; font-size:9px; font-weight:800; color:var(--spotify-green);">1</span>`;
      }
    }
  }

  function toggleRepeat() {
    repeatMode = (repeatMode === 1) ? 2 : 1;
    localStorage.setItem("spotilocal_repeat_mode", String(repeatMode));
    audioElement.loop = (repeatMode === 2);
    if (typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.setRepeatMode) {
      window.SpotiLocalNativePlayer.setRepeatMode(repeatMode);
    }
    updateRepeatUI();
    if (typeof showToast === "function") {
      showToast(repeatMode === 2 ? "Repetir 1 canción activado 🔂" : "Bucle continuo activo (lista infinita) 🔁");
    }
  }

  function hydratePlaybackPrefsUI() {
    try {
      const savedShuffle = localStorage.getItem("spotilocal_is_shuffle");
      if (savedShuffle !== null) {
        isShuffle = savedShuffle === "true";
        if (btnShuffle) btnShuffle.classList.toggle("active", isShuffle);
        if (expBtnShuffle) expBtnShuffle.classList.toggle("active", isShuffle);
      }
      const savedRepeat = localStorage.getItem("spotilocal_repeat_mode");
      if (savedRepeat !== null) {
        const parsed = parseInt(savedRepeat, 10);
        repeatMode = (parsed === 2) ? 2 : 1;
      } else {
        repeatMode = 1;
      }
      updateRepeatUI();
    } catch(e) {}
  }
  hydratePlaybackPrefsUI();

  playerLikeBtn.addEventListener("click", () => {
    if (currentSongIndex !== -1) {
      toggleLikeSong(currentQueue[currentSongIndex].id);
    }
  });

  expandedLikeBtn.addEventListener("click", () => {
    if (currentSongIndex !== -1) {
      toggleLikeSong(currentQueue[currentSongIndex].id);
    }
  });

  // Track listening time & Scrobble threshold
  let lastTimeUpdate = 0;
  let lastProgressWallTime = 0;
  let hasScrobbledCurrentPlay = false;
  let isProgressSliderDragging = false;

  function updatePlaybackProgress(cur, dur) {
    const currentSong = currentQueue[currentSongIndex];
    if (currentSong && dur > 0 && !usingNativePlayback) {
      if (!currentSong.duration || Math.abs(currentSong.duration - dur) > 0.5) {
        currentSong.duration = dur;
        currentSong.rawDuration = dur;
      }
    }
    let displayCur = cur;
    let displayDur = dur;
    if (!usingNativePlayback && currentSong) {
      const isTrimActive = currentSong.trimEnabled !== false;
      const tStart = isTrimActive && typeof currentSong.trimStart === "number" ? currentSong.trimStart : 0;
      const tEnd = isTrimActive && (typeof currentSong.trimEnd === "number" && currentSong.trimEnd > 0) ? currentSong.trimEnd : dur;
      if (tEnd > tStart) {
        displayDur = tEnd - tStart;
        displayCur = Math.max(0, Math.min(displayDur, cur - tStart));
      }
    }

    const percent = displayDur > 0 ? (displayCur / displayDur) * 100 : 0;
    const progressValue = `${Math.max(0, Math.min(100, percent))}%`;

    progressFill.style.width = progressValue;
    expandedProgressFill.style.width = progressValue;
    progressContainer.style.setProperty("--progress", progressValue);
    expandedProgressContainer.style.setProperty("--progress", progressValue);
    if (!isProgressSliderDragging) {
      const progressRatio = displayDur > 0 ? Math.max(0, Math.min(1, displayCur / displayDur)) : 0;
      if (progressSlider) progressSlider.value = progressRatio;
      if (expandedProgressSlider) expandedProgressSlider.value = progressRatio;
    }

    timeCurrent.textContent = formatTime(displayCur);
    expandedTimeCurrent.textContent = formatTime(displayCur);
    timeTotal.textContent = formatTime(displayDur);
    expandedTimeTotal.textContent = formatTime(displayDur);

    // Track listened seconds for Stats / Wrapped (HTML5 fallback only; native is tracked by PlaybackService)
    const nowWall = Date.now();
    const wallElapsed = lastProgressWallTime > 0 ? (nowWall - lastProgressWallTime) / 1000 : 0;
    lastProgressWallTime = nowWall;

    if (isPlaying && lastTimeUpdate > 0 && !usingNativePlayback) {
      const diff = cur - lastTimeUpdate;
      // Allow background throttled progress while rejecting jumps/seeks
      if (diff > 0 && (diff < 3.5 || (wallElapsed > 0 && Math.abs(diff - wallElapsed * (audioElement.playbackRate || 1.0)) < 3.0))) {
        currentSongListenedSeconds += diff;
      }
    }
    lastTimeUpdate = cur;

    // Scrobble Rule: Count 1 reproduction ONLY after reaching 50% of the song duration
    if (currentSongIndex !== -1 && !hasScrobbledCurrentPlay && !usingNativePlayback) {
      const song = currentQueue[currentSongIndex];
      if (song && (dur > 0 && cur >= dur * 0.5)) {
        hasScrobbledCurrentPlay = true;
        const ledgerStats = recordSongLedgerMonotonic(song, 0, 1);
        song.playCount = ledgerStats.playCount;
        try { musicDB.saveSong(song); } catch(e){}
        saveCachedSongs(songs);
        renderWrappedStats();
        try { renderHistoricalRanking(); } catch(e){}
      }
    }

    syncLyricsWithTime(cur);
  }

  let lastMediaSessionPositionSync = 0;
  audioElement.addEventListener("timeupdate", () => {
    const cur = audioElement.currentTime || 0;
    const dur = audioElement.duration || 0;
    const currentSong = currentQueue[currentSongIndex];
    if (currentSong && !usingNativePlayback && !_trimPreviewUnclippedActive) {
      const isTrimActive = currentSong.trimEnabled !== false;
      const trimStart = isTrimActive && typeof currentSong.trimStart === "number" ? currentSong.trimStart : 0;
      const trimEnd = isTrimActive && (typeof currentSong.trimEnd === "number" && currentSong.trimEnd > 0) ? currentSong.trimEnd : dur;
      if (isTrimActive && trimEnd > 0 && cur >= trimEnd) {
        if (repeatMode === 2) {
          audioElement.currentTime = trimStart;
        } else {
          playNextSong();
        }
        return;
      }
      if (isTrimActive && Array.isArray(currentSong.skipSegments)) {
        for (const seg of currentSong.skipSegments) {
          if (cur >= seg.start && cur < seg.end) {
            audioElement.currentTime = seg.end;
            return;
          }
        }
      }
    }
    updatePlaybackProgress(cur, dur);
    if (Math.abs(cur - lastMediaSessionPositionSync) >= 1) {
      lastMediaSessionPositionSync = cur;
      updateMediaSessionPosition();
    }
  });

  audioElement.addEventListener("seeking", () => {
    lastTimeUpdate = audioElement.currentTime || 0;
    lastProgressWallTime = Date.now();
  });
  audioElement.addEventListener("seeked", () => {
    lastTimeUpdate = audioElement.currentTime || 0;
    lastProgressWallTime = Date.now();
  });

  audioElement.addEventListener("ended", () => {
    if (currentSongIndex !== -1 && !hasScrobbledCurrentPlay) {
      const song = currentQueue[currentSongIndex];
      if (song) {
        hasScrobbledCurrentPlay = true;
        const ledgerStats = recordSongLedgerMonotonic(song, 0, 1);
        song.playCount = ledgerStats.playCount;
        try { musicDB.saveSong(song); } catch(e){}
        saveCachedSongs(songs);
        try { renderWrappedStats(); } catch(e) {}
        try { renderHistoricalRanking(); } catch(e){}
      }
    }

    if (repeatMode === 2) {
      audioElement.currentTime = 0;
      const replayPromise = audioElement.play();
      if (replayPromise && typeof replayPromise.catch === "function") {
        replayPromise.catch(() => {});
      }
    } else {
      playNextSong();
    }
  });

  // ─── NATIVE PLAYER STATE POLLER ───
  // When using native ExoPlayer (APK), the HTML5 <audio> element doesn't fire
  // timeupdate/ended events. This poller reads native state and drains listening stats.
  let _nativePollerRunning = false;
  let _nativeLastEnded = false;
  let _nativeLastMediaId = "";
  let _nativeOfflineFallbackAttempted = false;

  function applyNativeListeningStats() {
    if (typeof window.SpotiLocalNativePlayer === "undefined" || !window.SpotiLocalNativePlayer.drainListeningStats) return;
    try {
      const raw = window.SpotiLocalNativePlayer.drainListeningStats();
      if (!raw || raw === "[]") return;
      const records = JSON.parse(raw);
      if (!Array.isArray(records) || records.length === 0) return;

      let statsChanged = false;
      records.forEach(rec => {
        if (!rec || !rec.songId || typeof rec.seconds !== "number" || rec.seconds <= 0) return;

        const secsToRecord = Math.round(rec.seconds * 100) / 100;
        const masterSong = songs.find(s => s.id === rec.songId) || currentQueue.find(s => s.id === rec.songId);

        if (masterSong) {
          const ledgerStats = recordSongLedgerMonotonic(masterSong, secsToRecord, rec.scrobble ? 1 : 0);
          masterSong.totalTimeListened = ledgerStats.totalTimeListened;

          const queueSong = currentQueue.find(s => s.id === rec.songId);
          if (queueSong && queueSong !== masterSong) {
            queueSong.totalTimeListened = masterSong.totalTimeListened;
          }

          if (rec.scrobble) {
            masterSong.playCount = ledgerStats.playCount;
            if (queueSong && queueSong !== masterSong) {
              queueSong.playCount = masterSong.playCount;
            }
            if (currentSongIndex !== -1 && currentQueue[currentSongIndex]?.id === rec.songId) {
              hasScrobbledCurrentPlay = true;
            }
          }

          _persistedGlobalTotalSeconds = Math.round(((_persistedGlobalTotalSeconds || 0) + secsToRecord) * 100) / 100;
          _persistedYearlyTotalSeconds = Math.round(((_persistedYearlyTotalSeconds || 0) + secsToRecord) * 100) / 100;
          try {
            localStorage.setItem("spotilocal_global_total_secs", String(_persistedGlobalTotalSeconds));
            localStorage.setItem(`spotilocal_yearly_total_secs_${new Date().getFullYear()}`, String(_persistedYearlyTotalSeconds));
          } catch(e) {}

          recordListeningLog(masterSong.id, secsToRecord, activePlaylistId, rec.timestamp || Date.now());

          if (activePlaylistId && playlists) {
            const pl = playlists.find(p => p.id === activePlaylistId);
            if (pl) {
              pl.totalTimeListened = Math.round(((pl.totalTimeListened || 0) + secsToRecord) * 100) / 100;
              try { musicDB.savePlaylist(pl); } catch(e) {}
            }
          }

          try { musicDB.recordListeningTime(masterSong.id, secsToRecord); } catch(e) {}
          try { musicDB.saveSong(masterSong); } catch(e) {}

          statsChanged = true;
        }
      });

      if (statsChanged) {
        saveCachedSongs(songs);
        renderHomeStats();
        try { renderRankingView(); } catch(e) {}
      }
    } catch(e) {}
  }

  function hydrateFromNativePlayerState(allowWarmUp = true) {
    if (!isNativeBridgeAvailable()) return;
    try {
      const raw = window.SpotiLocalNativePlayer.getState();
      if (!raw) return;
      const st = JSON.parse(raw);
      if (st.mediaId) {
        usingNativePlayback = true;
        if (typeof st.shuffle === "boolean") {
          isShuffle = st.shuffle;
          if (btnShuffle) btnShuffle.classList.toggle("active", isShuffle);
          if (expBtnShuffle) expBtnShuffle.classList.toggle("active", isShuffle);
        }
        if (typeof st.repeat === "number") {
          repeatMode = (st.repeat === 2) ? 2 : 1;
          updateRepeatUI();
        }

        if (Array.isArray(st.queue) && st.queue.length > 0) {
          const restoredQ = [];
          for (let i = 0; i < st.queue.length; i++) {
            const item = st.queue[i];
            const found = songs.find(s => s.id === item.id) || item;
            restoredQ.push(found);
          }
          currentQueue = restoredQ;
        } else if (currentQueue.length === 0 && songs.length > 0) {
          currentQueue = [...songs];
        }

        const idx = currentQueue.findIndex(s => s.id === st.mediaId);
        if (idx !== -1) {
          currentSongIndex = idx;
          updatePlayerMetadata(currentQueue[idx]);
          const curSec = (st.positionMs || 0) / 1000;
          const durSec = (st.rawDurationMs || st.durationMs || 0) / 1000;
          if (durSec > 0) {
            if (!st.isClipped) {
              currentQueue[idx].duration = durSec;
              currentQueue[idx].rawDuration = durSec;
            }
            updatePlaybackProgress(curSec, durSec);
          }
        }

        isPlaying = Boolean(st.isPlaying);
        updatePlayPauseUI();

        if (allowWarmUp && window.SpotiLocalNativePlayer.warmUp) {
          window.SpotiLocalNativePlayer.warmUp();
        }
      }
    } catch(e) {}
  }

  function startNativeStatePoller() {
    if (_nativePollerRunning) return;
    if (typeof window.SpotiLocalNativePlayer === "undefined" || !window.SpotiLocalNativePlayer.getState) return;
    _nativePollerRunning = true;

    setInterval(() => {
      if (!usingNativePlayback) {
        hydrateFromNativePlayerState(false);
        return;
      }
      try {
        applyNativeListeningStats();

        const raw = window.SpotiLocalNativePlayer.getState();
        if (!raw) return;
        const st = JSON.parse(raw);

        if (st.error && !_nativeOfflineFallbackAttempted) {
          _nativeOfflineFallbackAttempted = true;
          if (!isNativeBridgeAvailable()) {
            usingNativePlayback = false;
            serverAudioProbe.ok = false;
            serverAudioProbe.checkedAt = 0;
            try { window.SpotiLocalNativePlayer.pause(); } catch (e) {}
            isPlaying = false;
            updatePlayPauseUI();
            loadAndPlayCurrentSong().catch(() => {});
          }
          return;
        }

        if (st.mediaId && st.mediaId !== _nativeLastMediaId) {
          _nativeLastMediaId = st.mediaId;
          let nativeIndex = currentQueue.findIndex(song => song.id === st.mediaId);
          if (nativeIndex === -1) {
            const pendingIndex = pendingQueue.findIndex(song => song.id === st.mediaId);
            if (pendingIndex !== -1) {
              const [pendingSong] = pendingQueue.splice(pendingIndex, 1);
              const insertIndex = currentSongIndex >= 0 ? currentSongIndex + 1 : currentQueue.length;
              currentQueue.splice(insertIndex, 0, pendingSong);
              nativeIndex = insertIndex;
            }
          }
          if (nativeIndex !== -1) {
            currentSongIndex = nativeIndex;
            hasScrobbledCurrentPlay = false;
            updatePlayerMetadata(currentQueue[nativeIndex]);
            try { renderQueueModal(); } catch(e) {}
          }
        }

        // Update progress UI
        const curSec = (st.positionMs || 0) / 1000;
        const durSec = (st.rawDurationMs || st.durationMs || 0) / 1000;
        if (durSec > 0) {
          if (currentQueue[currentSongIndex] && !st.isClipped) {
            currentQueue[currentSongIndex].duration = durSec;
            currentQueue[currentSongIndex].rawDuration = durSec;
          }
          updatePlaybackProgress(curSec, durSec);
        }

        // Sync play/pause state
        if (st.isPlaying && !isPlaying) {
          isPlaying = true;
          updatePlayPauseUI();
        } else if (!st.isPlaying && isPlaying && !st.ended) {
          // Native paused externally (notification controls, etc.)
          isPlaying = false;
          updatePlayPauseUI();
        }

        // Lyrics and position sync (absolute track position)
        const absSec = ((st.clipStartMs || 0) + (st.positionMs || 0)) / 1000;
        if (st.isPlaying && curSec > 0) {
          lastTimeUpdate = curSec;
          syncLyricsWithTime(absSec);
        }
        if (trimSongModal && !trimSongModal.classList.contains("hidden") && trimmingSong && trimmingSong.id === st.mediaId) {
          const rawTotal = trimmingSong.rawDuration || trimmingSong.duration || 1;
          const ratio = Math.max(0, Math.min(1, absSec / rawTotal));
          if (trimPlayhead) trimPlayhead.style.left = `${ratio * 100}%`;
        }

        // Handle song ended
        if (st.ended && !_nativeLastEnded) {
          _nativeLastEnded = true;
          applyNativeListeningStats();
          // Auto-advance
          if (repeatMode === 2) {
            loadAndPlayCurrentSong();
          } else {
            playNextSong();
          }
        } else if (!st.ended) {
          _nativeLastEnded = false;
        }

        // Native errors are handled above by switching to the local IndexedDB blob.
      } catch(e) {}
    }, 300);
  }

  // Start poller if native bridge exists
  if (typeof window.SpotiLocalNativePlayer !== "undefined") {
    startNativeStatePoller();
    hydrateFromNativePlayerState(true);
  }

  // Save listened seconds continuously every 5 seconds or on pause/unload
  function recordCurrentSongTime() {
    if (currentSongIndex !== -1 && currentSongListenedSeconds >= 1) {
      const song = currentQueue[currentSongIndex];
      if (song) {
        const secsToRecord = currentSongListenedSeconds;
        currentSongListenedSeconds = 0;

        // Update master song object and ledger
        const masterSong = songs.find(s => s.id === song.id) || song;
        const ledgerStats = recordSongLedgerMonotonic(masterSong, secsToRecord, 0);
        masterSong.totalTimeListened = ledgerStats.totalTimeListened;
        song.totalTimeListened = masterSong.totalTimeListened;

        // Update playlist time if playing from playlist (no double counting)
        if (activePlaylistId && playlists) {
          const pl = playlists.find(p => p.id === activePlaylistId);
          if (pl) {
            pl.totalTimeListened = Math.round(((pl.totalTimeListened || 0) + secsToRecord) * 100) / 100;
            try { musicDB.savePlaylist(pl); } catch(e) {}
          }
        }

        _persistedGlobalTotalSeconds = Math.round(((_persistedGlobalTotalSeconds || 0) + secsToRecord) * 100) / 100;
        _persistedYearlyTotalSeconds = Math.round(((_persistedYearlyTotalSeconds || 0) + secsToRecord) * 100) / 100;
        try {
          localStorage.setItem("spotilocal_global_total_secs", String(_persistedGlobalTotalSeconds));
          localStorage.setItem(`spotilocal_yearly_total_secs_${new Date().getFullYear()}`, String(_persistedYearlyTotalSeconds));
        } catch(e) {}

        // Single log entry for time-based stats
        recordListeningLog(masterSong.id, secsToRecord, activePlaylistId);

        // Keep a synchronous metadata backup in case the WebView closes before IndexedDB resolves.
        saveCachedSongs(songs);

        musicDB.recordListeningTime(masterSong.id, secsToRecord).then(() => {
          saveCachedSongs(songs);
          renderHomeStats();
          try { renderRankingView(); } catch(e){}
        });
      }
    }
  }

  // Periodic flush every 5 seconds while playing
  setInterval(() => {
    if (isPlaying && currentSongListenedSeconds >= 3) {
      recordCurrentSongTime();
    }
  }, 5000);

  audioElement.addEventListener("pause", recordCurrentSongTime);
  window.addEventListener("beforeunload", () => {
    if (usingNativePlayback) applyNativeListeningStats();
    else recordCurrentSongTime();
  });
  window.addEventListener("pagehide", () => {
    if (usingNativePlayback) applyNativeListeningStats();
    else recordCurrentSongTime();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (isNativeBridgeAvailable()) {
        hydrateFromNativePlayerState(false);
        applyNativeListeningStats();
      } else {
        recordCurrentSongTime();
      }
    }
  });
  window.addEventListener("focus", () => {
    if (isNativeBridgeAvailable()) {
      hydrateFromNativePlayerState(false);
      applyNativeListeningStats();
    }
  });

  // Cloud / URL Import Handlers
  if (btnOpenCloudModal) {
    btnOpenCloudModal.addEventListener("click", () => cloudImportModal.classList.remove("hidden"));
  }
  if (btnCloseCloudModal) {
    btnCloseCloudModal.addEventListener("click", () => cloudImportModal.classList.add("hidden"));
  }

  if (btnStartCloudDownload) {
    btnStartCloudDownload.addEventListener("click", async () => {
      let url = cloudUrlInput.value.trim();
      if (!url) return;

      // Handle Dropbox dl=1 conversion
      if (url.includes("dropbox.com") && !url.includes("dl=1")) {
        url = url.replace("dl=0", "dl=1");
        if (!url.includes("dl=1")) url += (url.includes("?") ? "&dl=1" : "?dl=1");
      }

      cloudDownloadStatus.classList.remove("hidden");
      cloudStatusText.textContent = "Descargando archivo FLAC/audio desde la nube...";
      btnStartCloudDownload.disabled = true;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

        const blob = await response.blob();
        
        // Determine filename / title from URL or headers
        let filename = url.substring(url.lastIndexOf("/") + 1).split("?")[0] || "nube_track.flac";
        if (!filename.includes(".")) filename += ".flac";

        const dummyFile = new File([blob], filename, { type: blob.type || "audio/flac" });

        cloudStatusText.textContent = "Extrayendo metadatos y carátula FLAC...";
        const metadata = await ID3Parser.parse(dummyFile);
        const songId = "song_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
        if (typeof unmarkSongAsDeleted === "function") {
          unmarkSongAsDeleted(songId, metadata.title);
        }

        const songObj = {
          id: songId,
          title: metadata.title || filename.replace(/\.[^/.]+$/, ""),
          artist: metadata.artist || "Nube Cloud Track",
          album: metadata.album || "Descarga Cloud FLAC",
          year: metadata.year || "",
          genre: metadata.genre || "FLAC Audio",
          audioBlob: blob,
          coverBlob: metadata.coverBlob || null,
          isLiked: false,
          playCount: 0,
          totalTimeListened: 0,
          dateAdded: Date.now()
        };

        const ledgerStats = (typeof getSongLedgerStats === "function") ? getSongLedgerStats(songObj) : null;
        if (ledgerStats) {
          songObj.totalTimeListened = ledgerStats.totalTimeListened || 0;
          songObj.playCount = ledgerStats.playCount || 0;
        }
        if (typeof recordSongLedgerMonotonic === "function") {
          recordSongLedgerMonotonic(songObj, 0, 0);
        }

        await musicDB.saveSong(songObj);
        await loadSongsFromDB();

        cloudStatusText.textContent = "¡Canción FLAC guardada con éxito!";
        setTimeout(() => {
          cloudImportModal.classList.add("hidden");
          cloudDownloadStatus.classList.add("hidden");
          cloudUrlInput.value = "";
          btnStartCloudDownload.disabled = false;
          switchTab("library");
        }, 1000);

      } catch (err) {
        console.error("Cloud download error:", err);
        cloudStatusText.textContent = `❌ Error al descargar de la nube: ${err.message}. Asegúrate de usar un enlace directo.`;
        btnStartCloudDownload.disabled = false;
      }
    });
  }



  // Preset Music Repertoire Catalog
  const PRESET_CATALOG = [
    {
      title: "Cyberpunk Neon Drive",
      artist: "Neon Pulse",
      album: "Synthwave Dreams (FLAC)",
      genre: "Electronic / Synthwave",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    },
    {
      title: "Midnight Lo-Fi Chill",
      artist: "Lofi Cafe",
      album: "Study Beats Collection",
      genre: "Lo-Fi / Chillhop",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
    },
    {
      title: "Acoustic Sunset Horizon",
      artist: "Acoustic Collective",
      album: "Warm Breeze",
      genre: "Acoustic / Folk",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
    },
    {
      title: "Velvet Night Lounge",
      artist: "The Smooth Jazz Quartet",
      album: "Midnight Sessions",
      genre: "Jazz",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
    },
    {
      title: "Epic Cinematic Overture",
      artist: "Philharmonia Orchestra",
      album: "Orchestral Legends",
      genre: "Classical / Cinematic",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
    }
  ];

  if (btnLoadPresetRepertoire) {
    btnLoadPresetRepertoire.addEventListener("click", async () => {
      btnLoadPresetRepertoire.disabled = true;
      btnLoadPresetRepertoire.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cargando Repertorio (0/${PRESET_CATALOG.length})...`;

      let loadedCount = 0;

      for (let i = 0; i < PRESET_CATALOG.length; i++) {
        const item = PRESET_CATALOG[i];
        btnLoadPresetRepertoire.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Descargando "${item.title}" (${i + 1}/${PRESET_CATALOG.length})...`;

        try {
          const res = await fetch(item.url);
          if (!res.ok) continue;

          const blob = await res.blob();
          const songId = "preset_song_" + Date.now() + "_" + i;

          const songObj = {
            id: songId,
            title: item.title,
            artist: item.artist,
            album: item.album,
            genre: item.genre,
            year: "2026",
            audioBlob: blob,
            coverBlob: null,
            isLiked: i === 0, // Like first song automatically
            playCount: 0,
            totalTimeListened: 0,
            dateAdded: Date.now() - (i * 1000)
          };

          const ledgerStats = (typeof getSongLedgerStats === "function") ? getSongLedgerStats(songObj) : null;
          if (ledgerStats) {
            songObj.totalTimeListened = ledgerStats.totalTimeListened || 0;
            songObj.playCount = ledgerStats.playCount || 0;
          }
          if (typeof recordSongLedgerMonotonic === "function") {
            recordSongLedgerMonotonic(songObj, 0, 0);
          }

          await musicDB.saveSong(songObj);
          loadedCount++;
        } catch (e) {
          console.warn("Preset load warning:", e);
        }
      }

      await loadSongsFromDB();
      btnLoadPresetRepertoire.disabled = false;
      btnLoadPresetRepertoire.innerHTML = `<i class="fa-solid fa-check"></i> ¡Repertorio Cargado (${loadedCount} Canciones)!`;
      setTimeout(() => {
        btnLoadPresetRepertoire.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Cargar Repertorio de Música Incluido 🎵`;
      }, 3000);

      switchTab("library");
    });
  }

  // Edit Metadata Modal Handlers
  let tempEditCoverBlob = null;
  let tempEditCoverUrl = null;

  function openEditMetaModal(song) {
    if (!editMetaModal || !editTitleInput || !editArtistInput || !editAlbumInput) return;
    editingSongId = song.id;
    editTitleInput.value = song.title;
    editArtistInput.value = song.artist;
    editAlbumInput.value = song.album;
    tempEditCoverBlob = null;
    tempEditCoverUrl = null;
    if (editCoverPreview) {
      editCoverPreview.src = getCoverSrc(song);
    }
    editMetaModal.classList.remove("hidden");
  }

  if (btnEditPickCover && editCoverFileInput) {
    btnEditPickCover.addEventListener("click", () => {
      editCoverFileInput.value = "";
      editCoverFileInput.click();
    });
  }

  if (editCoverFileInput) {
    editCoverFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        tempEditCoverBlob = file;
        tempEditCoverUrl = null;
        if (editCoverPreview) {
          editCoverPreview.src = URL.createObjectURL(file);
        }
        if (typeof showToast === "function") {
          showToast("Imagen seleccionada. Pulsa 'Guardar Cambios' para aplicarla.");
        }
      }
    });
  }

  if (btnEditFetchCover) {
    btnEditFetchCover.addEventListener("click", async () => {
      const title = editTitleInput.value.trim();
      const artist = editArtistInput.value.trim();
      if (!title) {
        showToast("Introduce al menos un título para buscar online.");
        return;
      }
      showToast("Buscando carátula en alta resolución... 🔍");
      const url = await fetchOnlineCoverUrl(title, artist);
      if (url) {
        tempEditCoverUrl = url;
        tempEditCoverBlob = null;
        if (editCoverPreview) {
          editCoverPreview.src = url;
        }
        showToast("¡Carátula online encontrada! Pulsa 'Guardar Cambios' para guardarla.");
      } else {
        showToast("No se encontró carátula para esta canción en internet.");
      }
    });
  }

  if (btnCloseEditModal && editMetaModal) {
    btnCloseEditModal.addEventListener("click", () => editMetaModal.classList.add("hidden"));
  }

  if (btnSaveEditMeta && editMetaModal && editTitleInput && editArtistInput && editAlbumInput) {
    btnSaveEditMeta.addEventListener("click", async () => {
      if (editingSongId) {
        const title = editTitleInput.value.trim() || "Sin título";
        const artist = editArtistInput.value.trim() || "Artista Desconocido";
        const album = editAlbumInput.value.trim() || "Álbum Desconocido";

        let targetSong = songs.find(s => s.id === editingSongId);
        if (!targetSong) {
          try {
            targetSong = await musicDB.getSong(editingSongId);
          } catch(e) {}
        }

        if (targetSong) {
          targetSong.title = title;
          targetSong.artist = artist;
          targetSong.album = album;
          if (tempEditCoverBlob instanceof Blob) {
            targetSong.coverBlob = tempEditCoverBlob;
            targetSong.coverUrl = null;
            coverObjectUrlCache.delete(editingSongId);
          } else if (tempEditCoverUrl) {
            targetSong.coverUrl = tempEditCoverUrl;
            targetSong.coverBlob = null;
            coverObjectUrlCache.delete(editingSongId);
          }
          await musicDB.saveSong(targetSong);
        } else {
          await musicDB.updateSongMeta(editingSongId, title, artist, album);
        }

        editMetaModal.classList.add("hidden");
        saveCachedSongs(songs);
        _libraryTableDirty = true;
        renderSongsTable(songs);
        renderRecentGrid(songs.slice(0, 6));
        renderFavoritesGrid(songs.filter(s => s.isLiked));
        renderWrappedStats();
        if (currentSong && currentSong.id === editingSongId) {
          if (targetSong) currentSong = targetSong;
          updatePlayerMetadata(currentSong);
        }
        if (typeof showToast === "function") {
          showToast("¡Canción y carátula actualizadas con éxito! 🎨");
        }
      }
    });
  }

  // Title Sanitizer Helper for YouTube & Web Rips
  function sanitizeSongTitle(rawTitle) {
    if (!rawTitle) return "";
    let clean = String(rawTitle);
    const patterns = [
      /\s*[\[\(]\s*(?:official\s*(?:music\s*)?video|video\s*oficial|audio\s*oficial|official\s*audio|visualizer|lyric\s*video|video\s*con\s*letra|letra|lyrics)\s*[\]\)]/gi,
      /\s*[\[\(]\s*(?:4k|1080p|720p|hd|hq|uhd)\s*(?:remaster(?:ed)?|audio)?\s*[\]\)]/gi,
      /\s*[\[\(]\s*(?:remastered|remasterizado|remaster)\s*(?:\d{4})?\s*[\]\)]/gi,
      /\s*[\[\(]\s*(?:en\s*vivo|live(?:\s*at\s*[^\]\)]+)?|directo)\s*[\]\)]/gi,
      /\s*[\[\(]\s*(?:clip\s*officiel|music\s*video)\s*[\]\)]/gi,
      /\s*[\[\(]\s*(?:prod\.?\s*by\s*[^\]\)]+)\s*[\]\)]/gi,
      /\s*\|\s*video\s*oficial.*$/gi,
      /\s*\|\s*official\s*video.*$/gi
    ];
    patterns.forEach(r => { clean = clean.replace(r, ""); });
    clean = clean.replace(/\s{2,}/g, " ").trim();
    clean = clean.replace(/^["'«]+|["'»]+$/g, "").trim();
    clean = clean.replace(/\s*-\s*$/, "").trim();
    return clean;
  }

  if (btnSanitizeMetaTitle && editTitleInput) {
    btnSanitizeMetaTitle.addEventListener("click", () => {
      const orig = editTitleInput.value;
      const cleaned = sanitizeSongTitle(orig);
      const parts = cleaned.split(/\s+[-–—]\s+/);
      if (parts.length === 2 && (!editArtistInput.value || editArtistInput.value === "Artista Desconocido" || editArtistInput.value === "Unknown Artist")) {
        editArtistInput.value = parts[0].trim();
        editTitleInput.value = parts[1].trim();
        if (typeof showToast === "function") showToast("Artista y Título separados y limpiados 🧹");
      } else {
        editTitleInput.value = cleaned;
        if (typeof showToast === "function") showToast("Título limpiado de etiquetas de YouTube 🧹");
      }
    });
  }

  // ─── TRIM & AUDIO TWEAKS MODAL (V1.8.4 HIGH PRECISION & ±30dB GAIN) ───
  let trimmingSong = null;
  let trimPreviewTimeout = null;
  let _trimPreviewUnclippedActive = false;
  let _trimOriginalSnapshot = null;

  function formatTrimTime(secs) {
    if (isNaN(secs) || secs < 0) secs = 0;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
  }

  function getPlaybackCurrentTime() {
    if (usingNativePlayback && window.SpotiLocalNativePlayer && window.SpotiLocalNativePlayer.getState) {
      try {
        const st = JSON.parse(window.SpotiLocalNativePlayer.getState() || "{}");
        if (typeof st.positionMs === "number" && st.positionMs >= 0) {
          return ((st.clipStartMs || 0) + st.positionMs) / 1000;
        }
      } catch(e) {}
    }
    return audioElement ? (audioElement.currentTime || 0) : 0;
  }

  async function resolveSongDuration(song) {
    if (!song) return 0;
    // 1. Raw duration explicitly cached
    if (typeof song.rawDuration === "number" && song.rawDuration > 0) {
      return song.rawDuration;
    }

    // 2. Instant native metadata probe via MediaMetadataRetriever (Android Native)
    const nativePlayer = (typeof window !== "undefined" && window.SpotiLocalNativePlayer) ? window.SpotiLocalNativePlayer : null;
    if (nativePlayer && typeof nativePlayer.getLocalAudioDurationMs === "function") {
      try {
        const key = getNativeAudioKey(song);
        let ms = nativePlayer.getLocalAudioDurationMs(key);
        if (ms <= 0 && song.id && song.id !== key) {
          ms = nativePlayer.getLocalAudioDurationMs(song.id);
        }
        if (ms > 0) {
          const durSec = ms / 1000;
          song.rawDuration = durSec;
          song.duration = durSec;
          try {
            if (musicDB && musicDB.updateSongAudioTweaks) {
              musicDB.updateSongAudioTweaks(song.id, { rawDuration: durSec, duration: durSec }).catch(() => {});
            }
          } catch(e) {}
          return durSec;
        }
      } catch(e) {}
    }

    // 3. Check active playback state ONLY if currently unclipped
    const curPlaying = currentQueue[currentSongIndex];
    if (curPlaying && curPlaying.id === song.id) {
      if (usingNativePlayback && nativePlayer && nativePlayer.getState) {
        try {
          const st = JSON.parse(nativePlayer.getState() || "{}");
          if (!st.isClipped && (st.rawDurationMs || st.durationMs) > 0) {
            const durSec = (st.rawDurationMs || st.durationMs) / 1000;
            song.rawDuration = durSec;
            song.duration = durSec;
            return durSec;
          }
        } catch(e) {}
      } else if (audioElement && audioElement.duration && isFinite(audioElement.duration) && audioElement.duration > 0) {
        song.rawDuration = audioElement.duration;
        song.duration = audioElement.duration;
        return audioElement.duration;
      }
    }

    // 4. Probe duration using getBlobFromAnySource (v1.8.x offline blob + range chunks)
    try {
      let blob = await getBlobFromAnySource(song);
      let src = "";
      let revoke = false;
      if (blob) {
        src = URL.createObjectURL(blob);
        revoke = true;
      } else if (song.audioUrl) {
        src = getFullUrl(song.audioUrl);
      }
      if (src) {
        const audioProbe = new Audio();
        audioProbe.preload = "metadata";
        const dur = await new Promise((resolve) => {
          const to = setTimeout(() => resolve(0), 4000);
          audioProbe.onloadedmetadata = () => {
            clearTimeout(to);
            resolve(audioProbe.duration || 0);
          };
          audioProbe.onerror = () => {
            clearTimeout(to);
            resolve(0);
          };
          audioProbe.src = src;
        });
        if (revoke) {
          try { URL.revokeObjectURL(src); } catch(e){}
        }
        if (dur > 0 && isFinite(dur)) {
          song.rawDuration = dur;
          song.duration = dur;
          try {
            if (musicDB && musicDB.updateSongAudioTweaks) {
              musicDB.updateSongAudioTweaks(song.id, { rawDuration: dur, duration: dur }).catch(() => {});
            }
          } catch(e){}
          return dur;
        }
      }
    } catch(e) {}

    return song.duration || 0;
  }

  function updateTrimUIFromSliders() {
    if (!trimmingSong) return;
    const maxBound = Math.max(parseFloat(sliderTrimEnd.max) || 600, parseFloat(sliderTrimStart.max) || 600);
    const dur = (trimmingSong.rawDuration || trimmingSong.duration || maxBound);
    let startVal = parseFloat(sliderTrimStart.value) || 0;
    let endVal = parseFloat(sliderTrimEnd.value) || dur;

    if (startVal > endVal - 0.5) {
      startVal = Math.max(0, endVal - 0.5);
      sliderTrimStart.value = startVal;
    }

    if (lblTrimStart) lblTrimStart.textContent = formatTrimTime(startVal);
    if (lblTrimEnd) lblTrimEnd.textContent = formatTrimTime(endVal);
    if (lblTrimDuration) lblTrimDuration.textContent = formatTime(Math.max(0, endVal - startVal));

    const leftPercent = dur > 0 ? Math.min(100, (startVal / dur) * 100) : 0;
    const rightPercent = dur > 0 ? Math.min(100, (endVal / dur) * 100) : 100;
    const widthPercent = Math.max(0, rightPercent - leftPercent);

    if (trimDimLeft) trimDimLeft.style.width = `${leftPercent}%`;
    if (trimActiveRegion) {
      trimActiveRegion.style.left = `${leftPercent}%`;
      trimActiveRegion.style.width = `${widthPercent}%`;
    }
    if (trimDimRight) trimDimRight.style.width = `${Math.max(0, 100 - rightPercent)}%`;
  }

  function renderTrimWaveform(song) {
    if (!trimWaveformCanvas) return;
    const ctx = trimWaveformCanvas.getContext("2d");
    if (!ctx) return;
    const w = trimWaveformCanvas.width;
    const h = trimWaveformCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const bars = 80;
    const barWidth = w / bars;
    const seed = (song.title || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + Math.round(song.rawDuration || song.duration || 100);

    ctx.fillStyle = "#1db954";
    for (let i = 0; i < bars; i++) {
      const envelope = Math.sin((i / bars) * Math.PI);
      const pseudoRandom = Math.abs(Math.sin(seed * (i + 1) * 9301 + 49297));
      const barHeight = Math.max(6, (envelope * 0.7 + pseudoRandom * 0.3) * (h * 0.85));
      const x = i * barWidth;
      const y = (h - barHeight) / 2;
      ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
    }
  }

  function openTrimModal(song) {
    if (!song || !trimSongModal) return;
    trimmingSong = song;
    if (trimPreviewTimeout) {
      clearTimeout(trimPreviewTimeout);
      trimPreviewTimeout = null;
    }
    _trimPreviewUnclippedActive = false;

    // Snapshot original configuration to restore if modal is cancelled
    _trimOriginalSnapshot = {
      trimStart: typeof song.trimStart === "number" ? song.trimStart : 0,
      trimEnd: typeof song.trimEnd === "number" ? song.trimEnd : 0,
      gainDb: typeof song.gainDb === "number" ? song.gainDb : 0,
      trimEnabled: song.trimEnabled !== false
    };

    // 1. Resolve true duration: prefer rawDuration over clipped duration
    let dur = (typeof song.rawDuration === "number" && song.rawDuration > 0)
      ? song.rawDuration
      : (typeof song.duration === "number" && song.duration > 0 ? song.duration : (song.trimEnd && song.trimEnd > 0 ? Math.max(song.trimEnd + 60, 600) : 600));

    const startVal = typeof song.trimStart === "number" ? song.trimStart : 0;
    const endVal = (typeof song.trimEnd === "number" && song.trimEnd > 0) ? Math.min(dur, song.trimEnd) : dur;
    const gainVal = typeof song.gainDb === "number" ? Math.max(-30, Math.min(30, song.gainDb)) : 0;

    if (trimModalSongTitle) trimModalSongTitle.textContent = song.title || "Sin título";
    if (trimModalSongArtist) trimModalSongArtist.textContent = song.artist || "Artista Desconocido";

    if (sliderTrimStart) {
      sliderTrimStart.min = 0;
      sliderTrimStart.max = dur;
      sliderTrimStart.step = 0.1;
      sliderTrimStart.value = startVal;
    }

    if (sliderTrimEnd) {
      sliderTrimEnd.min = 0;
      sliderTrimEnd.max = dur;
      sliderTrimEnd.step = 0.1;
      sliderTrimEnd.value = endVal;
    }

    if (sliderTrimGain) {
      sliderTrimGain.min = -30;
      sliderTrimGain.max = 30;
      sliderTrimGain.step = 0.5;
      sliderTrimGain.value = gainVal;
    }
    if (lblTrimGain) {
      lblTrimGain.textContent = `${gainVal > 0 ? "+" : ""}${gainVal} dB (${gainVal === 0 ? "Normal" : gainVal > 0 ? "Más fuerte" : "Más bajo"})`;
    }

    renderTrimWaveform(song);
    updateTrimUIFromSliders();

    const isTrimActive = song.trimEnabled !== false;
    if (toggleTrimEnabled) {
      toggleTrimEnabled.checked = isTrimActive;
      updateTrimToggleUI(isTrimActive);
    }

    trimSongModal.classList.remove("hidden");

    // 2. Asynchronously resolve exact unclipped duration in background
    resolveSongDuration(song).then((realDur) => {
      if (realDur > 0 && trimmingSong && trimmingSong.id === song.id) {
        trimmingSong.rawDuration = realDur;
        trimmingSong.duration = realDur;
        const currentEnd = parseFloat(sliderTrimEnd.value);
        const wasAtMax = currentEnd >= dur - 1 || !song.trimEnd;
        sliderTrimStart.max = realDur;
        sliderTrimEnd.max = realDur;
        if (wasAtMax || currentEnd > realDur) {
          sliderTrimEnd.value = realDur;
        }
        updateTrimUIFromSliders();
        renderTrimWaveform(song);
      }
    });
  }

  function updateTrimToggleUI(enabled) {
    if (trimControlsContainer) {
      trimControlsContainer.classList.toggle("trim-controls-disabled", !enabled);
    }
    if (lblTrimToggleStatus) {
      lblTrimToggleStatus.textContent = enabled ? "Recorte Activado" : "Recorte Desactivado";
    }
    if (lblTrimToggleSub) {
      lblTrimToggleSub.textContent = enabled ? "Se aplicarán los cortes de inicio y fin" : "La canción sonará completa de inicio a fin";
    }
    if (iconTrimToggle) {
      iconTrimToggle.style.color = enabled ? "var(--spotify-green)" : "var(--spotify-grey)";
    }
  }

  if (toggleTrimEnabled) {
    toggleTrimEnabled.addEventListener("change", () => {
      updateTrimToggleUI(toggleTrimEnabled.checked);
    });
  }

  if (sliderTrimStart) sliderTrimStart.addEventListener("input", updateTrimUIFromSliders);
  if (sliderTrimEnd) sliderTrimEnd.addEventListener("input", updateTrimUIFromSliders);

  function setModalGainValue(val) {
    const clamped = Math.max(-30, Math.min(30, Math.round(val * 2) / 2));
    if (sliderTrimGain) sliderTrimGain.value = clamped;
    if (lblTrimGain) {
      lblTrimGain.textContent = `${clamped > 0 ? "+" : ""}${clamped} dB (${clamped === 0 ? "Normal" : clamped > 0 ? "Más fuerte" : "Más bajo"})`;
    }
    if (trimmingSong && currentQueue[currentSongIndex]?.id === trimmingSong.id) {
      applyCurrentTrackGain(clamped);
    }
  }

  if (sliderTrimGain) {
    sliderTrimGain.addEventListener("input", () => {
      const g = parseFloat(sliderTrimGain.value) || 0;
      setModalGainValue(g);
    });
  }

  if (btnGainMinus) {
    btnGainMinus.addEventListener("click", () => {
      const cur = parseFloat(sliderTrimGain ? sliderTrimGain.value : 0) || 0;
      setModalGainValue(cur - 1);
    });
  }
  if (btnGainZero) {
    btnGainZero.addEventListener("click", () => {
      setModalGainValue(0);
    });
  }
  if (btnGainPlus) {
    btnGainPlus.addEventListener("click", () => {
      const cur = parseFloat(sliderTrimGain ? sliderTrimGain.value : 0) || 0;
      setModalGainValue(cur + 1);
    });
  }

  if (btnTrimStartMinus && sliderTrimStart) {
    btnTrimStartMinus.addEventListener("click", () => {
      sliderTrimStart.value = Math.max(0, parseFloat(sliderTrimStart.value) - 0.5);
      updateTrimUIFromSliders();
    });
  }
  if (btnTrimStartPlus && sliderTrimStart && sliderTrimEnd) {
    btnTrimStartPlus.addEventListener("click", () => {
      sliderTrimStart.value = Math.min(parseFloat(sliderTrimEnd.value) - 0.5, parseFloat(sliderTrimStart.value) + 0.5);
      updateTrimUIFromSliders();
    });
  }
  if (btnSetTrimStartHere && sliderTrimStart && sliderTrimEnd) {
    btnSetTrimStartHere.addEventListener("click", () => {
      const cur = getPlaybackCurrentTime();
      sliderTrimStart.value = Math.max(0, Math.min(parseFloat(sliderTrimEnd.value) - 0.5, Math.round(cur * 10) / 10));
      updateTrimUIFromSliders();
      if (typeof showToast === "function") showToast(`Inicio fijado en ${lblTrimStart ? lblTrimStart.textContent : ""} 📍`);
    });
  }

  if (btnTrimEndMinus && sliderTrimStart && sliderTrimEnd) {
    btnTrimEndMinus.addEventListener("click", () => {
      sliderTrimEnd.value = Math.max(parseFloat(sliderTrimStart.value) + 0.5, parseFloat(sliderTrimEnd.value) - 0.5);
      updateTrimUIFromSliders();
    });
  }
  if (btnTrimEndPlus && sliderTrimEnd) {
    btnTrimEndPlus.addEventListener("click", () => {
      let curMax = parseFloat(sliderTrimEnd.max) || 600;
      let nextVal = parseFloat(sliderTrimEnd.value) + 0.5;
      if (nextVal > curMax) {
        curMax = Math.ceil(nextVal + 30);
        sliderTrimEnd.max = curMax;
        if (sliderTrimStart) sliderTrimStart.max = curMax;
        if (trimmingSong) {
          trimmingSong.rawDuration = Math.max(trimmingSong.rawDuration || 0, curMax);
          trimmingSong.duration = trimmingSong.rawDuration;
        }
      }
      sliderTrimEnd.value = nextVal;
      updateTrimUIFromSliders();
    });
  }
  if (btnSetTrimEndHere && sliderTrimStart && sliderTrimEnd) {
    btnSetTrimEndHere.addEventListener("click", () => {
      const cur = getPlaybackCurrentTime();
      const rounded = Math.round(cur * 10) / 10;
      let curMax = parseFloat(sliderTrimEnd.max) || 600;
      if (rounded > curMax) {
        curMax = Math.ceil(rounded + 30);
        sliderTrimEnd.max = curMax;
        if (sliderTrimStart) sliderTrimStart.max = curMax;
        if (trimmingSong) {
          trimmingSong.rawDuration = Math.max(trimmingSong.rawDuration || 0, curMax);
          trimmingSong.duration = trimmingSong.rawDuration;
        }
      }
      sliderTrimEnd.value = Math.max(parseFloat(sliderTrimStart.value) + 0.5, rounded);
      updateTrimUIFromSliders();
      if (typeof showToast === "function") showToast(`Fin fijado en ${lblTrimEnd ? lblTrimEnd.textContent : ""} 📍`);
    });
  }

  // Preescucha sin recorte para probar libremente cualquier segundo del tema original
  async function previewSongAtUnclippedTime(song, targetSec, previewDurationMs = 4000) {
    if (!song) return;
    if (trimPreviewTimeout) clearTimeout(trimPreviewTimeout);
    _trimPreviewUnclippedActive = true;
    const modalGain = parseFloat(sliderTrimGain ? sliderTrimGain.value : 0) || 0;

    const nativePlayer = (typeof window !== "undefined" && window.SpotiLocalNativePlayer && window.SpotiLocalNativePlayer.isAvailable && window.SpotiLocalNativePlayer.isAvailable())
      ? window.SpotiLocalNativePlayer
      : null;

    if (usingNativePlayback && nativePlayer) {
      const localUrl = await ensureNativeLocalAudio(song, nativePlayer);
      const streamUrl = song.audioUrl ? getFullUrl(song.audioUrl) : "";
      const coverUrl = getCoverSrc(song);
      const artworkUrl = /^https?:\/\//i.test(coverUrl) ? coverUrl : "";

      applyCurrentTrackGain(modalGain);
      const rawState = nativePlayer.getState ? JSON.parse(nativePlayer.getState() || "{}") : {};
      if (rawState.mediaId !== song.id || rawState.isClipped) {
        nativePlayer.load(localUrl || streamUrl, song.id || "", song.title || "", song.artist || "", song.album || "", artworkUrl, 0, 0, modalGain);
      }
      nativePlayer.seekTo(Math.round(targetSec * 1000));
      nativePlayer.play();
    } else if (audioElement) {
      if (currentQueue[currentSongIndex]?.id !== song.id) {
        await playSongById(song.id);
      }
      applyCurrentTrackGain(modalGain);
      audioElement.currentTime = targetSec;
      audioElement.play().catch(() => {});
    }
    isPlaying = true;
    updatePlayPauseUI();

    trimPreviewTimeout = setTimeout(() => {
      _trimPreviewUnclippedActive = false;
      if (usingNativePlayback && nativePlayer && nativePlayer.pause) {
        nativePlayer.pause();
      } else if (audioElement) {
        audioElement.pause();
      }
      isPlaying = false;
      updatePlayPauseUI();
    }, previewDurationMs);
  }

  if (btnPreviewStart) {
    btnPreviewStart.addEventListener("click", async () => {
      if (!trimmingSong) return;
      const startSec = parseFloat(sliderTrimStart ? sliderTrimStart.value : 0) || 0;
      if (typeof showToast === "function") showToast(`Preescuchando inicio (${formatTrimTime(startSec)})... 🎧`);
      await previewSongAtUnclippedTime(trimmingSong, startSec, 4000);
    });
  }

  if (btnPreviewEnd) {
    btnPreviewEnd.addEventListener("click", async () => {
      if (!trimmingSong) return;
      const songDur = (trimmingSong.rawDuration || trimmingSong.duration || parseFloat(sliderTrimEnd.max) || 600);
      const startSec = parseFloat(sliderTrimStart ? sliderTrimStart.value : 0) || 0;
      const endSec = parseFloat(sliderTrimEnd ? sliderTrimEnd.value : songDur) || songDur;
      const previewFrom = Math.max(startSec, endSec - 4);
      if (typeof showToast === "function") showToast(`Preescuchando fin hasta ${formatTrimTime(endSec)}... 🎧`);
      const previewMs = Math.max(1000, Math.round((endSec - previewFrom) * 1000));
      await previewSongAtUnclippedTime(trimmingSong, previewFrom, previewMs);
    });
  }

  if (trimVisualTrack) {
    trimVisualTrack.addEventListener("click", (e) => {
      if (!trimmingSong) return;
      const rect = trimVisualTrack.getBoundingClientRect();
      if (!rect.width) return;
      const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const songDur = (trimmingSong.rawDuration || trimmingSong.duration || parseFloat(sliderTrimEnd.max) || 600);
      const targetSec = clickRatio * songDur;
      if (typeof showToast === "function") showToast(`Preescuchando desde ${formatTrimTime(targetSec)}... 🎧`);
      previewSongAtUnclippedTime(trimmingSong, targetSec, 4000);
    });
  }

  if (btnAutoDetectSilence) {
    btnAutoDetectSilence.addEventListener("click", async () => {
      if (!trimmingSong) return;
      if (typeof showToast === "function") showToast("Escaneando silencios en la pista (completa)... ⚡");

      try {
        let blob = await getBlobFromAnySource(trimmingSong);
        if (!blob && trimmingSong.audioUrl) {
          try {
            const resp = await fetch(getFullUrl(trimmingSong.audioUrl));
            if (resp.ok) blob = await resp.blob();
          } catch(e) {}
        }
        if (!blob) {
          if (typeof showToast === "function") showToast("Descarga la canción offline para auto-detectar silencios ⚠️");
          return;
        }

        // Leer audio completo hasta 45 MB sin truncar a 10 MB para capturar el final real
        let arrayBuf;
        if (blob.size <= 45 * 1024 * 1024) {
          arrayBuf = await blob.arrayBuffer();
        } else {
          arrayBuf = await blob.slice(0, 35 * 1024 * 1024).arrayBuffer();
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const tempCtx = new AudioCtx();
        const audioBuf = await tempCtx.decodeAudioData(arrayBuf);
        const channelData = audioBuf.getChannelData(0);
        const sampleRate = audioBuf.sampleRate;
        const totalDuration = audioBuf.duration || trimmingSong.rawDuration || trimmingSong.duration || 300;
        trimmingSong.rawDuration = totalDuration;
        trimmingSong.duration = totalDuration;
        sliderTrimStart.max = totalDuration;
        sliderTrimEnd.max = totalDuration;

        const windowSize = Math.floor(sampleRate * 0.05);
        const silenceThreshold = 0.01;
        let detectedStart = 0;
        for (let i = 0; i < Math.min(channelData.length, sampleRate * 45); i += windowSize) {
          let sum = 0;
          for (let j = 0; j < windowSize && (i + j) < channelData.length; j++) {
            sum += channelData[i + j] * channelData[i + j];
          }
          const rms = Math.sqrt(sum / windowSize);
          if (rms > silenceThreshold) {
            detectedStart = Math.max(0, (i / sampleRate) - 0.1);
            break;
          }
        }

        let detectedEnd = totalDuration;
        const endScanLimit = Math.max(0, channelData.length - sampleRate * 45);
        for (let i = channelData.length - windowSize; i >= endScanLimit; i -= windowSize) {
          let sum = 0;
          for (let j = 0; j < windowSize && (i + j) < channelData.length; j++) {
            sum += channelData[i + j] * channelData[i + j];
          }
          const rms = Math.sqrt(sum / windowSize);
          if (rms > silenceThreshold) {
            detectedEnd = Math.min(totalDuration, ((i + windowSize) / sampleRate) + 0.1);
            break;
          }
        }
        try { tempCtx.close(); } catch(e){}

        detectedStart = Math.round(detectedStart * 10) / 10;
        detectedEnd = Math.round(detectedEnd * 10) / 10;
        if (detectedEnd <= detectedStart) detectedEnd = totalDuration;

        if (sliderTrimStart) sliderTrimStart.value = detectedStart;
        if (sliderTrimEnd) sliderTrimEnd.value = detectedEnd;
        updateTrimUIFromSliders();

        if (typeof showToast === "function") {
          showToast(`¡Silencios detectados! [${formatTrimTime(detectedStart)} - ${formatTrimTime(detectedEnd)}] ⚡`);
        }
      } catch (err) {
        console.warn("Silence detection note:", err);
        const fallbackDur = await resolveSongDuration(trimmingSong);
        if (fallbackDur > 0) {
          sliderTrimStart.max = fallbackDur;
          sliderTrimEnd.max = fallbackDur;
          updateTrimUIFromSliders();
        }
        if (typeof showToast === "function") showToast("Ajuste manual disponible con los deslizadores 🎧");
      }
    });
  }

  if (btnResetTrim) {
    btnResetTrim.addEventListener("click", () => {
      if (!trimmingSong) return;
      const dur = (trimmingSong.rawDuration || trimmingSong.duration || parseFloat(sliderTrimEnd.max) || 600);
      if (sliderTrimStart) sliderTrimStart.value = 0;
      if (sliderTrimEnd) sliderTrimEnd.value = dur;
      setModalGainValue(0);
      if (toggleTrimEnabled) {
        toggleTrimEnabled.checked = true;
        updateTrimToggleUI(true);
      }
      updateTrimUIFromSliders();
      if (typeof showToast === "function") showToast("Valores restablecidos a original 🔄");
    });
  }

  if (btnSaveTrim) {
    btnSaveTrim.addEventListener("click", async () => {
      if (!trimmingSong) return;
      const isEnabled = toggleTrimEnabled ? toggleTrimEnabled.checked : true;
      const songDur = (trimmingSong.rawDuration || trimmingSong.duration || parseFloat(sliderTrimEnd.max) || 600);
      const startVal = parseFloat(sliderTrimStart ? sliderTrimStart.value : 0) || 0;
      const endVal = parseFloat(sliderTrimEnd ? sliderTrimEnd.value : songDur) || songDur;
      const gainVal = parseFloat(sliderTrimGain ? sliderTrimGain.value : 0) || 0;

      trimmingSong.trimEnabled = isEnabled;
      trimmingSong.trimStart = startVal > 0.1 ? startVal : 0;
      trimmingSong.trimEnd = (endVal < songDur - 0.2) ? endVal : 0;
      trimmingSong.gainDb = gainVal;
      trimmingSong.rawDuration = songDur;
      trimmingSong.duration = songDur;

      const sMaster = songs.find(s => s.id === trimmingSong.id);
      if (sMaster) {
        sMaster.trimStart = trimmingSong.trimStart;
        sMaster.trimEnd = trimmingSong.trimEnd;
        sMaster.gainDb = trimmingSong.gainDb;
        sMaster.trimEnabled = isEnabled;
        sMaster.rawDuration = songDur;
        sMaster.duration = songDur;
      }
      const sQueue = currentQueue.find(s => s.id === trimmingSong.id);
      if (sQueue && sQueue !== trimmingSong) {
        sQueue.trimStart = trimmingSong.trimStart;
        sQueue.trimEnd = trimmingSong.trimEnd;
        sQueue.gainDb = trimmingSong.gainDb;
        sQueue.trimEnabled = isEnabled;
        sQueue.rawDuration = songDur;
        sQueue.duration = songDur;
      }

      await musicDB.updateSongAudioTweaks(trimmingSong.id, {
        trimStart: trimmingSong.trimStart,
        trimEnd: trimmingSong.trimEnd,
        gainDb: trimmingSong.gainDb,
        duration: songDur,
        rawDuration: songDur,
        trimEnabled: isEnabled
      });

      saveCachedSongs(songs);
      _trimOriginalSnapshot = null;

      if (currentQueue[currentSongIndex]?.id === trimmingSong.id) {
        applyCurrentTrackGain(gainVal);
        syncNativeQueue();

        const curPos = getPlaybackCurrentTime();
        if (isEnabled) {
          if (trimmingSong.trimStart > 0 && curPos < trimmingSong.trimStart) {
            if (usingNativePlayback && window.SpotiLocalNativePlayer && window.SpotiLocalNativePlayer.seekTo) {
              window.SpotiLocalNativePlayer.seekTo(Math.round(trimmingSong.trimStart * 1000));
            } else if (audioElement) {
              audioElement.currentTime = trimmingSong.trimStart;
            }
          } else if (trimmingSong.trimEnd > 0 && curPos >= trimmingSong.trimEnd) {
            playNextSong();
          }
        }
      }

      if (currentTab === "library") {
        renderSongsTable(songs);
      }

      trimSongModal.classList.add("hidden");
      if (typeof showToast === "function") {
        showToast(isEnabled ? "Recorte y ajustes guardados con éxito ✂️💾" : "Recorte desactivado (canción completa) 🎵💾");
      }
    });
  }

  function handleOpenTrimForCurrentSong() {
    const currentSong = currentQueue[currentSongIndex];
    if (currentSong) {
      openTrimModal(currentSong);
    } else if (typeof showToast === "function") {
      showToast("No hay canción activa reproduciéndose ⚠️");
    }
  }

  if (btnOpenTrimExpanded) {
    btnOpenTrimExpanded.addEventListener("click", handleOpenTrimForCurrentSong);
  }
  if (btnExpandedOptions) {
    btnExpandedOptions.addEventListener("click", handleOpenTrimForCurrentSong);
  }

  if (btnCloseTrimModal && trimSongModal) {
    btnCloseTrimModal.addEventListener("click", () => {
      if (trimPreviewTimeout) clearTimeout(trimPreviewTimeout);
      _trimPreviewUnclippedActive = false;

      // Restablecer recorte y ganancia originales si se cerró sin guardar
      if (_trimOriginalSnapshot && trimmingSong) {
        trimmingSong.trimStart = _trimOriginalSnapshot.trimStart;
        trimmingSong.trimEnd = _trimOriginalSnapshot.trimEnd;
        trimmingSong.gainDb = _trimOriginalSnapshot.gainDb;
        trimmingSong.trimEnabled = _trimOriginalSnapshot.trimEnabled;
        if (currentQueue[currentSongIndex]?.id === trimmingSong.id) {
          syncNativeQueue();
          applyCurrentTrackGain(_trimOriginalSnapshot.gainDb);
        }
      }
      _trimOriginalSnapshot = null;
      trimSongModal.classList.add("hidden");
    });
  }

  // Crossfade Select
  crossfadeSelect.addEventListener("change", (e) => {
    crossfadeDuration = parseInt(e.target.value);
  });

  // Keyboard Shortcuts (Space, Arrows)
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      playNextSong();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      playPrevSong();
    } else if (e.code === "ArrowUp") {
      e.preventDefault();
      const currentVolume = parseFloat(volumeSlider ? volumeSlider.value : 1.0) || 1.0;
      const newVol = Math.min(1, Math.round((currentVolume + 0.1) * 10) / 10);
      volumeSlider.value = newVol;
      audioElement.muted = false;
      applyCurrentTrackGain();
      updateVolumeIcon(newVol);
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      const currentVolume = parseFloat(volumeSlider ? volumeSlider.value : 1.0) || 1.0;
      const newVol = Math.max(0, Math.round((currentVolume - 0.1) * 10) / 10);
      volumeSlider.value = newVol;
      audioElement.muted = (newVol === 0);
      applyCurrentTrackGain();
      updateVolumeIcon(newVol);
    }
  });

  function getProgressDurationMs() {
    const useNative = usingNativePlayback && typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.getState;
    if (useNative) {
      try {
        const st = JSON.parse(window.SpotiLocalNativePlayer.getState());
        if (st.durationMs > 0) return st.durationMs;
      } catch(e) {}
    }
    return Number.isFinite(audioElement.duration) ? audioElement.duration * 1000 : 0;
  }

  function seekFromPointer(event, container) {
    const clientX = typeof event.clientX === "number"
      ? event.clientX
      : (event.touches && event.touches[0] ? event.touches[0].clientX : null);
    if (clientX === null) return;

    const rect = container.getBoundingClientRect();
    if (!rect.width) return;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const durationMs = getProgressDurationMs();
    if (!durationMs) return;

    seekToPosition(pos);
  }

  function seekToPosition(pos) {
    const durationMs = getProgressDurationMs();
    if (!durationMs) return;
    const clampedPosition = Math.max(0, Math.min(1, Number(pos) || 0));
    const seekMs = Math.round(clampedPosition * durationMs);

    const useNative = usingNativePlayback && typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.isAvailable && window.SpotiLocalNativePlayer.isAvailable();
    if (useNative) {
      window.SpotiLocalNativePlayer.seekTo(seekMs);
    } else {
      audioElement.currentTime = seekMs / 1000;
    }
    updateMediaSessionPosition();
  }

  function handleSeek(e) {
    seekFromPointer(e, e.currentTarget);
  }

  function bindProgressScrubber(container) {
    if (!container) return;
    let dragging = false;

    container.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      try { container.setPointerCapture(e.pointerId); } catch (err) {}
      seekFromPointer(e, container);
      e.preventDefault();
    });

    container.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      seekFromPointer(e, container);
      e.preventDefault();
    });

    const finishDrag = (e) => {
      if (!dragging) return;
      seekFromPointer(e, container);
      dragging = false;
      try { container.releasePointerCapture(e.pointerId); } catch (err) {}
    };

    container.addEventListener("pointerup", finishDrag);
    container.addEventListener("pointercancel", finishDrag);
    container.addEventListener("click", handleSeek);
  }

  progressContainer.addEventListener("click", handleSeek);
  expandedProgressContainer.addEventListener("click", handleSeek);

  function bindProgressSlider(slider) {
    if (!slider) return;
    slider.addEventListener("pointerdown", () => {
      isProgressSliderDragging = true;
    });
    slider.addEventListener("pointerup", () => {
      isProgressSliderDragging = false;
    });
    slider.addEventListener("pointercancel", () => {
      isProgressSliderDragging = false;
    });
    slider.addEventListener("input", (e) => {
      seekToPosition(parseFloat(e.target.value));
    });
  }

  bindProgressSlider(progressSlider);
  bindProgressSlider(expandedProgressSlider);

  // Volume
  volumeSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    audioElement.muted = (val === 0);
    applyCurrentTrackGain();
    updateVolumeIcon(val);
  });

  btnMute.addEventListener("click", () => {
    const currentVolume = parseFloat(volumeSlider ? volumeSlider.value : 1.0) || 0;
    if (currentVolume > 0 && !audioElement.muted) {
      audioElement.muted = true;
      applyCurrentTrackGain();
      updateVolumeIcon(0);
    } else {
      audioElement.muted = false;
      const restoreVol = currentVolume > 0 ? currentVolume : 0.8;
      volumeSlider.value = restoreVol;
      applyCurrentTrackGain();
      updateVolumeIcon(restoreVol);
    }
  });

  function updateVolumeIcon(val) {
    if (val === 0) btnMute.innerHTML = `<i class="fa-solid fa-volume-xmark"></i>`;
    else if (val < 0.5) btnMute.innerHTML = `<i class="fa-solid fa-volume-low"></i>`;
    else btnMute.innerHTML = `<i class="fa-solid fa-volume-high"></i>`;
  }

  // Speed
  speedSelect.addEventListener("change", (e) => {
    const rate = parseFloat(e.target.value);
    audioElement.playbackRate = rate;
    if (typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.setPlaybackRate) {
      window.SpotiLocalNativePlayer.setPlaybackRate(rate);
    }
  });

  // Dynamic Background Glow Color Extraction
  function updateAmbientGlow(imgSrc) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgSrc;
    img.onload = () => {
      try {
        const tempCanvas = document.createElement("canvas");
        const ctx = tempCanvas.getContext("2d");
        tempCanvas.width = 50;
        tempCanvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(10, 10, 30, 30).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        const count = data.length / 4;
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        ambientGlow.style.background = `radial-gradient(circle at 50% 30%, rgba(${r},${g},${b},0.45) 0%, rgba(18, 18, 18, 0.95) 70%)`;
      } catch (e) {}
    };
  }

  // --------------------------------------------------------------------------
  // MEDIA SESSION API (Lockscreen & Notifications)
  // --------------------------------------------------------------------------

  function initMediaSession() {
    if (isNativeBridgeAvailable()) return;
    if (!("mediaSession" in navigator)) return;

    const handlers = {
      play: () => {
        if (!isPlaying) togglePlayPause();
      },
      pause: () => {
        if (isPlaying) togglePlayPause();
      },
      previoustrack: () => playPrevSong(),
      nexttrack: () => playNextSong(),
      seekto: (details) => {
        if (details.seekTime !== undefined && audioElement.duration) {
          audioElement.currentTime = Math.max(0, Math.min(audioElement.duration, details.seekTime));
          updateMediaSessionPosition();
        }
      },
      seekbackward: (details) => {
        const offset = details.seekOffset || 10;
        audioElement.currentTime = Math.max(0, audioElement.currentTime - offset);
        updateMediaSessionPosition();
      },
      seekforward: (details) => {
        const offset = details.seekOffset || 10;
        audioElement.currentTime = Math.min(audioElement.duration || 0, audioElement.currentTime + offset);
        updateMediaSessionPosition();
      },
      stop: () => {
        if (typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.stop) {
          window.SpotiLocalNativePlayer.stop();
        } else {
          audioElement.pause();
        }
        audioElement.currentTime = 0;
        isPlaying = false;
        updatePlayPauseUI();
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "none";
        }
        releaseWakeLock();
      }
    };

    Object.entries(handlers).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch(e) {
        // Older Android WebViews may not implement every seek action.
      }
    });
  }

  initMediaSession();

  function updateMediaSession(song, coverUrl) {
    if (isNativeBridgeAvailable()) return;
    if (!("mediaSession" in navigator) || !song) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || "SpotiLocal",
        artist: song.artist || "SpotiLocal Pro",
        album: song.album || "SpotiLocal Library",
        artwork: [
          { src: coverUrl || "./icon-512.png", sizes: "512x512", type: "image/png" },
          { src: coverUrl || "./icon-192.png", sizes: "192x192", type: "image/png" }
        ]
      });

      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
      updateMediaSessionPosition();
    } catch(e) {
      console.warn("[MediaSession] Error updating metadata:", e);
    }
  }

  function updateMediaSessionPosition() {
    if (isNativeBridgeAvailable()) return;
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (audioElement.duration && !isNaN(audioElement.duration) && isFinite(audioElement.duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audioElement.duration,
          playbackRate: audioElement.playbackRate || 1.0,
          position: Math.min(Math.max(0, audioElement.currentTime), audioElement.duration)
        });
      } catch(e) {}
    }
  }

  // --------------------------------------------------------------------------
  // EXPANDED FULLSCREEN PLAYER MODAL
  // --------------------------------------------------------------------------

  function openExpandedPlayer() {
    if (!expandedPlayerModal) return;
    applyExpandedProgressAppearance();
    expandedPlayerModal.classList.remove("hidden");
    expandedPlayerModal.classList.add("is-open");
    expandedPlayerModal.style.display = "flex";
    expandedPlayerModal.setAttribute("aria-hidden", "false");
  }

  function closeExpandedPlayer() {
    if (!expandedPlayerModal) return;
    expandedPlayerModal.classList.remove("is-open");
    expandedPlayerModal.classList.add("hidden");
    expandedPlayerModal.style.display = "none";
    expandedPlayerModal.setAttribute("aria-hidden", "true");
  }

  function applyExpandedProgressAppearance() {
    if (!expandedProgressContainer) return;
    expandedProgressContainer.style.setProperty("height", "10px", "important");
    expandedProgressContainer.style.setProperty("min-height", "10px", "important");
    expandedProgressContainer.style.setProperty("flex", "0 0 10px", "important");
    expandedProgressContainer.style.setProperty("border-radius", "5px", "important");
    expandedProgressContainer.style.setProperty("border", "1px solid rgba(148, 163, 184, 0.65)", "important");
    expandedProgressContainer.style.setProperty("background", "linear-gradient(to right, #2f80ed 0%, #2f80ed var(--progress, 0%), transparent var(--progress, 0%), transparent 100%)", "important");
    if (expandedProgressFill) {
      expandedProgressFill.style.setProperty("height", "100%", "important");
      expandedProgressFill.style.setProperty("border-radius", "5px", "important");
      expandedProgressFill.style.setProperty("background-color", "#2f80ed", "important");
    }
  }

  if (playerLeftClick) {
    playerLeftClick.addEventListener("click", (e) => {
      if (e.target.closest("#player-like-btn") || e.target.closest(".like-btn")) {
        return;
      }
      openExpandedPlayer();
    });
  }
  if (btnExpandPlayer) btnExpandPlayer.addEventListener("click", openExpandedPlayer);
  if (btnCloseExpanded) btnCloseExpanded.addEventListener("click", closeExpandedPlayer);

  // --------------------------------------------------------------------------
  // EQUALIZER & VISUALIZER CANVAS
  // --------------------------------------------------------------------------

  eqSliders.forEach(slider => {
    slider.addEventListener("input", (e) => {
      const band = parseInt(e.target.getAttribute("data-band"));
      const val = parseFloat(e.target.value);
      document.getElementById(`eq-val-${band}`).textContent = `${val > 0 ? "+" : ""}${val} dB`;
      if (typeof audioEngine !== "undefined" && audioEngine.setEqBand) audioEngine.setEqBand(band, val);
      if (typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.setEqBand) {
        window.SpotiLocalNativePlayer.setEqBand(band, val);
      }
    });
  });

  presetChips.forEach(chip => {
    chip.addEventListener("click", () => {
      presetChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const presetName = chip.getAttribute("data-preset");
       const values = typeof audioEngine !== "undefined" && audioEngine.applyPreset
         ? audioEngine.applyPreset(presetName)
         : [0, 0, 0, 0, 0];
       values.forEach((v, idx) => {
         eqSliders[idx].value = v;
         document.getElementById(`eq-val-${idx}`).textContent = `${v > 0 ? "+" : ""}${v} dB`;
         if (typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.setEqBand) {
           window.SpotiLocalNativePlayer.setEqBand(idx, v);
         }
       });
    });
  });

  vizBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      vizBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      vizMode = btn.getAttribute("data-mode");
    });
  });

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }

  function startVisualizer() {
    if (vizAnimationFrame) cancelAnimationFrame(vizAnimationFrame);
    const dataArray = new Uint8Array(64);

    function draw() {
      vizAnimationFrame = requestAnimationFrame(draw);
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      if (audioEngine.analyser) {
        audioEngine.getFrequencyData(dataArray);
      }

      const width = canvas.width;
      const height = canvas.height;

      if (vizMode === "bars") {
        const barWidth = (width / dataArray.length) * 1.5;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const barHeight = (dataArray[i] / 255) * height;
          const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, "#1db954");
          gradient.addColorStop(1, "#1ed760");

          canvasCtx.fillStyle = gradient;
          canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
          x += barWidth;
        }
      } else if (vizMode === "wave") {
        canvasCtx.beginPath();
        canvasCtx.lineWidth = 3;
        canvasCtx.strokeStyle = "#1db954";
        const sliceWidth = width / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) canvasCtx.moveTo(x, y);
          else canvasCtx.lineTo(x, y);
          x += sliceWidth;
        }
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
      } else if (vizMode === "circle") {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) - 40;

        for (let i = 0; i < dataArray.length; i++) {
          const angle = (i / dataArray.length) * Math.PI * 2;
          const barLen = (dataArray[i] / 255) * 60;
          const x1 = centerX + Math.cos(angle) * radius;
          const y1 = centerY + Math.sin(angle) * radius;
          const x2 = centerX + Math.cos(angle) * (radius + barLen);
          const y2 = centerY + Math.sin(angle) * (radius + barLen);

          canvasCtx.strokeStyle = "#1db954";
          canvasCtx.lineWidth = 3;
          canvasCtx.beginPath();
          canvasCtx.moveTo(x1, y1);
          canvasCtx.lineTo(x2, y2);
          canvasCtx.stroke();
        }
      }
    }
    draw();
  }

  // --------------------------------------------------------------------------
  // LYRICS (.LRC PARSER & AUTO SCROLL)
  // --------------------------------------------------------------------------

  lrcFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file && currentSongIndex !== -1) {
      const text = await file.text();
      const songId = currentQueue[currentSongIndex].id;
      await musicDB.saveLyrics(songId, text);
      parseAndRenderLyrics(text);
    }
  });

  btnShowLyricsModal.addEventListener("click", () => {
    closeExpandedPlayer();
    switchTab("lyrics");
  });

  async function loadLyricsForSong(songId) {
    const text = await musicDB.getLyrics(songId);
    if (text) {
      parseAndRenderLyrics(text);
    } else {
      currentLyrics = [];
      lyricsScrollBox.innerHTML = `
        <div class="lyrics-empty">
          <i class="fa-solid fa-music"></i>
          <p>Sin letras sincronizadas</p>
          <small>Importa un archivo .lrc usando el botón superior.</small>
        </div>
      `;
    }
  }

  function parseAndRenderLyrics(lrcText) {
    const lines = lrcText.split("\n");
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    currentLyrics = [];

    lines.forEach(line => {
      const match = line.match(regex);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = parseInt(match[3]);
        const time = min * 60 + sec + ms / 100;
        const text = match[4].trim();
        if (text) {
          currentLyrics.push({ time, text });
        }
      }
    });

    lyricsScrollBox.innerHTML = "";
    currentLyrics.forEach((item, idx) => {
      const p = document.createElement("p");
      p.className = "lyric-line";
      p.id = `lyric-line-${idx}`;
      p.textContent = item.text;
      p.addEventListener("click", () => {
        if (usingNativePlayback && typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.seekTo) {
          window.SpotiLocalNativePlayer.seekTo(Math.round(item.time * 1000));
        } else {
          audioElement.currentTime = item.time;
        }
      });
      lyricsScrollBox.appendChild(p);
    });
  }

  function syncLyricsWithTime(curTime) {
    if (currentLyrics.length === 0) return;
    let activeIdx = -1;

    for (let i = 0; i < currentLyrics.length; i++) {
      if (curTime >= currentLyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== -1) {
      document.querySelectorAll(".lyric-line").forEach((el, idx) => {
        if (idx === activeIdx) {
          el.classList.add("active");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          el.classList.remove("active");
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // QUEUE & PLAYLIST MODALS
  // --------------------------------------------------------------------------

  btnOpenQueue.addEventListener("click", () => {
    renderQueueModal();
    queueModal.classList.remove("hidden");
  });
  if (btnOpenQueueExpanded) {
    btnOpenQueueExpanded.addEventListener("click", () => {
      closeExpandedPlayer();
      renderQueueModal();
      queueModal.classList.remove("hidden");
    });
  }
  btnCloseQueue.addEventListener("click", () => queueModal.classList.add("hidden"));
  if (btnClearQueue) {
    btnClearQueue.addEventListener("click", () => {
      pendingQueue = [];
      syncNativeQueue();
      renderQueueModal();
      showToast("Cola vaciada");
    });
  }

  function renderQueueModal() {
    if (!queueSongsList) return;
    queueSongsList.innerHTML = "";
    const entries = getQueueEntries();
    if (queueCount) queueCount.textContent = `${pendingQueue.length} pendiente${pendingQueue.length === 1 ? "" : "s"}`;
    if (entries.length === 0) {
      queueSongsList.innerHTML = `<div style="padding:24px;text-align:center;color:var(--spotify-grey);">La cola está vacía.</div>`;
      return;
    }

    entries.forEach((entry, idx) => {
      const song = entry.song;
      const item = document.createElement("div");
      item.className = `song-row queue-entry ${entry.current ? "playing" : ""}`;
      item.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;";
      const queueLabel = entry.current
        ? "REPRODUCIENDO AHORA"
        : entry.pending
          ? `SIGUIENTE ${pendingQueue.indexOf(song) + 1}`
          : "DESPUÉS";
      item.innerHTML = `
        <span class="col-num" style="min-width:24px;">${entry.current ? "▶" : idx + 1}</span>
        <img class="row-cover" src="${getCoverSrc(song)}" style="width:44px;height:44px;flex:0 0 44px;border-radius:6px;">
        <div class="col-title-wrapper" style="flex:1;min-width:0;">
          <div class="row-info">
            <span class="row-title">${escapeHtml(song.title)}</span>
            <span class="row-artist">${escapeHtml(song.artist)}</span>
          </div>
        </div>
        <span style="font-size:10px;color:${entry.current ? "var(--spotify-green)" : "var(--spotify-grey)"};font-weight:800;white-space:nowrap;">${queueLabel}</span>
        ${entry.pending ? '<button class="icon-btn queue-remove-btn" title="Quitar de la cola" style="color:#ff6b6b;padding:6px;"><i class="fa-solid fa-xmark"></i></button>' : ""}
      `;
      item.addEventListener("click", () => {
        if (entry.pending) {
          const pendingIndex = pendingQueue.indexOf(song);
          if (pendingIndex !== -1) pendingQueue.splice(pendingIndex, 1);
          const insertIndex = currentSongIndex >= 0 ? currentSongIndex + 1 : currentQueue.length;
          currentQueue.splice(insertIndex, 0, song);
          currentSongIndex = insertIndex;
        } else {
          const queueIndex = currentQueue.indexOf(song);
          if (queueIndex !== -1) currentSongIndex = queueIndex;
        }
        syncNativeQueue();
        loadAndPlayCurrentSong();
        queueModal.classList.add("hidden");
      });
      const removeButton = item.querySelector(".queue-remove-btn");
      if (removeButton) {
        removeButton.addEventListener("click", (event) => {
          event.stopPropagation();
          const pendingIndex = pendingQueue.indexOf(song);
          if (pendingIndex !== -1) pendingQueue.splice(pendingIndex, 1);
          syncNativeQueue();
          renderQueueModal();
        });
      }
      queueSongsList.appendChild(item);
    });
  }

  // --------------------------------------------------------------------------
  // PLAYLIST MANAGEMENT & DETAIL VIEW
  // --------------------------------------------------------------------------

  const libraryMainContent = document.getElementById("library-main-content");
  const playlistDetailContainer = document.getElementById("playlist-detail-container");
  const playlistDetailTitle = document.getElementById("playlist-detail-title");
  const playlistDetailMeta = document.getElementById("playlist-detail-meta");
  const playlistSongsTableBody = document.getElementById("playlist-songs-table-body");
  const btnBackToLibrary = document.getElementById("btn-back-to-library");
  const btnPlayAllPlaylist = document.getElementById("btn-play-all-playlist");
  const btnDeletePlaylistCurrent = document.getElementById("btn-delete-playlist-current");

  const addToPlaylistModal = document.getElementById("add-to-playlist-modal");
  const btnCloseAddPlaylistModal = document.getElementById("btn-close-add-playlist-modal");
  const addPlaylistSongTitle = document.getElementById("add-playlist-song-title");
  const playlistSelectionList = document.getElementById("playlist-selection-list");
  const newPlaylistQuickInput = document.getElementById("new-playlist-quick-input");
  const btnCreateAndAddPlaylist = document.getElementById("btn-create-and-add-playlist");

  let currentAddingSongId = null;
  let currentlyViewedPlaylistId = null;

  // Open Add To Playlist Modal
  window.openAddToPlaylistModal = async function(songId) {
    currentAddingSongId = songId;
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    if (addPlaylistSongTitle) {
      addPlaylistSongTitle.textContent = `"${song.title}" - ${song.artist}`;
    }

    if (newPlaylistQuickInput) newPlaylistQuickInput.value = "";

    await renderPlaylistSelectionList(songId);

    if (addToPlaylistModal) {
      addToPlaylistModal.classList.remove("hidden");
    }
  };

  async function renderPlaylistSelectionList(songId) {
    if (!playlistSelectionList) return;
    playlistSelectionList.innerHTML = "";
    playlists = await musicDB.getAllPlaylists();

    if (playlists.length === 0) {
      playlistSelectionList.innerHTML = `
        <div style="padding: 12px; text-align: center; color: var(--spotify-grey); font-size: 13px;">
          No tienes ninguna lista creada todavía. ¡Crea una abajo!
        </div>
      `;
      return;
    }

    playlists.forEach(pl => {
      const isSongInPl = pl.songIds && pl.songIds.includes(songId);
      const count = pl.songIds ? pl.songIds.length : 0;
      const item = document.createElement("div");
      item.className = `playlist-choice-item ${isSongInPl ? "added" : ""}`;
      item.innerHTML = `
        <div class="playlist-choice-title">
          <i class="fa-solid ${isSongInPl ? "fa-circle-check" : "fa-list-ul"}" style="color:${isSongInPl ? "var(--spotify-green)" : "var(--spotify-grey)"}"></i>
          <span>${escapeHtml(pl.name)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="playlist-choice-count">${count} temas</span>
          <i class="fa-solid ${isSongInPl ? "fa-check" : "fa-plus"}" style="color:${isSongInPl ? "var(--spotify-green)" : "var(--spotify-grey)"}; font-size:12px;"></i>
        </div>
      `;

      item.addEventListener("click", async () => {
        if (isSongInPl) {
          await musicDB.removeSongFromPlaylist(pl.id, songId);
          if (typeof showToast === "function") showToast(`Eliminada de "${pl.name}"`);
        } else {
          await musicDB.addSongToPlaylist(pl.id, songId);
          if (typeof showToast === "function") showToast(`Añadida a "${pl.name}" 🎵`);
        }
        if (addToPlaylistModal) addToPlaylistModal.classList.add("hidden");
        await loadPlaylistsFromDB();
        if (currentlyViewedPlaylistId === pl.id) {
          window.viewPlaylist(pl.id);
        }
      });

      playlistSelectionList.appendChild(item);
    });
  }

  if (btnCloseAddPlaylistModal) {
    btnCloseAddPlaylistModal.addEventListener("click", () => {
      if (addToPlaylistModal) addToPlaylistModal.classList.add("hidden");
    });
  }

  async function handleCreateAndAddPlaylist() {
    const name = newPlaylistQuickInput ? newPlaylistQuickInput.value.trim() : "";
    if (!name) {
      if (typeof showToast === "function") showToast("Escribe un nombre para la lista ⚠️");
      return;
    }
    const newPl = {
      id: "pl_" + Date.now(),
      name: name,
      songIds: currentAddingSongId ? [currentAddingSongId] : [],
      createdAt: Date.now()
    };
    await musicDB.savePlaylist(newPl);
    if (newPlaylistQuickInput) newPlaylistQuickInput.value = "";
    if (typeof showToast === "function") showToast(`Lista "${name}" creada y canción añadida 🎵`);
    if (addToPlaylistModal) addToPlaylistModal.classList.add("hidden");
    await loadPlaylistsFromDB();
    if (currentlyViewedPlaylistId === newPl.id) {
      window.viewPlaylist(newPl.id);
    }
  }

  if (btnCreateAndAddPlaylist) {
    btnCreateAndAddPlaylist.addEventListener("click", handleCreateAndAddPlaylist);
  }

  if (newPlaylistQuickInput) {
    newPlaylistQuickInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreateAndAddPlaylist();
      }
    });
  }

  // Create Playlist Modal (Standard)
  if (btnCreatePlaylist) {
    btnCreatePlaylist.addEventListener("click", () => {
      if (playlistModal) {
        playlistModal.classList.remove("hidden");
        setTimeout(() => { if (playlistNameInput) playlistNameInput.focus(); }, 100);
      }
    });
  }

  if (btnClosePlaylistModal) {
    btnClosePlaylistModal.addEventListener("click", () => {
      if (playlistModal) playlistModal.classList.add("hidden");
    });
  }

  if (playlistModal) {
    playlistModal.addEventListener("click", (e) => {
      if (e.target === playlistModal) {
        playlistModal.classList.add("hidden");
      }
    });
  }

  async function handleSavePlaylist() {
    const name = playlistNameInput ? playlistNameInput.value.trim() : "";
    if (name) {
      const newPl = {
        id: "pl_" + Date.now(),
        name: name,
        songIds: [],
        createdAt: Date.now()
      };
      await musicDB.savePlaylist(newPl);
      if (playlistNameInput) playlistNameInput.value = "";
      if (playlistModal) playlistModal.classList.add("hidden");
      if (typeof showToast === "function") showToast(`Lista "${name}" creada con éxito 🎵`);
      await loadPlaylistsFromDB();
    } else {
      if (typeof showToast === "function") showToast("Escribe un nombre para la lista ⚠️");
    }
  }

  if (btnSavePlaylist) {
    btnSavePlaylist.addEventListener("click", handleSavePlaylist);
  }

  if (playlistNameInput) {
    playlistNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSavePlaylist();
      }
    });
  }

  const btnCreatePlaylistLib = document.getElementById("btn-create-playlist-lib");
  if (btnCreatePlaylistLib) {
    btnCreatePlaylistLib.addEventListener("click", () => {
      if (playlistModal) {
        playlistModal.classList.remove("hidden");
        setTimeout(() => { if (playlistNameInput) playlistNameInput.focus(); }, 100);
      }
    });
  }

  const pwaInstallGuideModal = document.getElementById("pwa-install-guide-modal");

  // Backdrop dismiss for all other modals
  [addToPlaylistModal, queueModal, pwaInstallGuideModal].forEach(m => {
    if (m) {
      m.addEventListener("click", (e) => {
        if (e.target === m) {
          m.classList.add("hidden");
        }
      });
    }
  });

  // View Playlist Details
  window.viewPlaylist = async function(playlistId) {
    currentlyViewedPlaylistId = playlistId;
    const pl = playlists.find(p => p.id === playlistId) || await musicDB.getPlaylist(playlistId);
    if (!pl) return;

    window.switchTab("library");

    if (libraryMainContent) libraryMainContent.classList.add("hidden");
    if (playlistDetailContainer) playlistDetailContainer.classList.remove("hidden");

    if (playlistDetailTitle) playlistDetailTitle.textContent = pl.name;

    const plSongs = songs.filter(s => pl.songIds && pl.songIds.includes(s.id));
    const totalSecs = plSongs.reduce((acc, s) => acc + (s.duration || 0), 0);
    const totalMinutes = Math.round(totalSecs / 60);

    if (playlistDetailMeta) {
      playlistDetailMeta.textContent = `${plSongs.length} temas • ${totalMinutes} min aproximadamente`;
    }

    if (playlistSongsTableBody) {
      playlistSongsTableBody.innerHTML = "";
      if (plSongs.length === 0) {
        playlistSongsTableBody.innerHTML = `
          <div style="padding: 30px; text-align: center; color: var(--spotify-grey);">
            <i class="fa-solid fa-music" style="font-size: 28px; margin-bottom: 8px;"></i>
            <p>Esta lista está vacía. Añade temas pulsando el botón <i class="fa-solid fa-folder-plus" style="color:var(--spotify-green)"></i> en cualquier canción.</p>
          </div>
        `;
      } else {
        plSongs.forEach((song, idx) => {
          const row = document.createElement("div");
          row.dataset.songId = song.id;
          const isPlayingCurrent = currentSongIndex !== -1 && currentQueue[currentSongIndex]?.id === song.id;
          row.className = `song-row ${isPlayingCurrent ? "playing" : ""}`;
          const coverSrc = getCoverSrc(song);
          const durText = formatTime(song.duration || 0);

          row.innerHTML = `
            <button class="icon-btn row-play-btn" title="Reproducir" style="color:var(--spotify-green); font-size: 20px; padding: 4px; margin-right: 4px; cursor: pointer; display: flex; align-items: center;"><i class="fa-solid fa-circle-play"></i></button>
            <span class="col-num">${idx + 1}</span>
            <div class="col-title-wrapper">
              <img class="row-cover" src="${coverSrc}" alt="Cover">
              <div class="row-info">
                <span class="row-title">${escapeHtml(song.title)}</span>
                <span class="row-artist">${escapeHtml(song.artist)}</span>
              </div>
            </div>
            <span class="col-album">${escapeHtml(song.album)}</span>
            <span class="col-date">${durText}</span>
            <div class="col-actions">
              <button class="icon-btn row-remove-pl-btn" title="Quitar de esta lista" style="color:#ff5555;"><i class="fa-solid fa-xmark"></i></button>
            </div>
          `;

          row.addEventListener("click", async (e) => {
            if (e.target.closest(".row-remove-pl-btn")) {
              e.stopPropagation();
              await musicDB.removeSongFromPlaylist(pl.id, song.id);
              if (typeof showToast === "function") showToast(`Eliminada de "${pl.name}"`);
              await loadPlaylistsFromDB();
              window.viewPlaylist(pl.id);
            } else {
              setQueueFromContext(plSongs, song.id);
              loadAndPlayCurrentSong();
            }
          });

          playlistSongsTableBody.appendChild(row);
        });
      }
    }
  };

  if (btnBackToLibrary) {
    btnBackToLibrary.addEventListener("click", () => {
      currentlyViewedPlaylistId = null;
      if (playlistDetailContainer) playlistDetailContainer.classList.add("hidden");
      if (libraryMainContent) libraryMainContent.classList.remove("hidden");
    });
  }

  if (btnPlayAllPlaylist) {
    btnPlayAllPlaylist.addEventListener("click", () => {
      if (!currentlyViewedPlaylistId) return;
      playPlaylist(currentlyViewedPlaylistId);
    });
  }

  if (btnDeletePlaylistCurrent) {
    btnDeletePlaylistCurrent.addEventListener("click", async () => {
      if (!currentlyViewedPlaylistId) return;
      const pl = playlists.find(p => p.id === currentlyViewedPlaylistId);
      const name = pl ? pl.name : "esta lista";
      if (confirm(`¿Estás seguro de que deseas eliminar la lista "${name}"?`)) {
        await musicDB.deletePlaylist(currentlyViewedPlaylistId);
        if (typeof showToast === "function") showToast(`Lista "${name}" eliminada`);
        currentlyViewedPlaylistId = null;
        if (playlistDetailContainer) playlistDetailContainer.classList.add("hidden");
        if (libraryMainContent) libraryMainContent.classList.remove("hidden");
        await loadPlaylistsFromDB();
      }
    });
  }

  async function loadPlaylistsFromDB() {
    playlists = await musicDB.getAllPlaylists();
    sidebarPlaylistList.innerHTML = "";
    playlists.forEach(pl => {
      const li = document.createElement("li");
      li.className = "playlist-item";
      li.textContent = pl.name;
      li.addEventListener("click", () => window.viewPlaylist(pl.id));
      sidebarPlaylistList.appendChild(li);
    });
    renderPlaylistsGrid();
    invalidateStatsIndex();
    renderHomeStats();
  }

  function playPlaylist(playlistId, startSongId = null) {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    activePlaylistId = pl.id;
    const plSongs = songs.filter(s => pl.songIds && pl.songIds.includes(s.id));
    if (plSongs.length > 0) {
      setQueueFromContext(plSongs, startSongId || plSongs[0].id);
      loadAndPlayCurrentSong();
      if (typeof showToast === "function") showToast(`Reproduciendo lista: "${pl.name}" 🎵`);
    } else {
      if (typeof showToast === "function") showToast(`La lista "${pl.name}" no tiene canciones añadidas`);
    }
  }

  const btnShuffleLibrary = document.getElementById("btn-shuffle-library");
  if (btnShuffleLibrary) {
    btnShuffleLibrary.addEventListener("click", () => {
      const targetList = getVisibleLibrarySongs();
      if (!targetList || targetList.length === 0) {
        if (typeof showToast === "function") showToast("No hay canciones en la biblioteca 🎵");
        return;
      }
      isShuffle = true;
      localStorage.setItem("spotilocal_is_shuffle", "true");
      if (btnShuffle) btnShuffle.classList.add("active");
      if (expBtnShuffle) expBtnShuffle.classList.add("active");
      const randomSong = targetList[Math.floor(Math.random() * targetList.length)];
      setQueueFromContext(targetList, randomSong.id);
      loadAndPlayCurrentSong();
      if (typeof showToast === "function") showToast(`🔀 Biblioteca en modo aleatorio: "${randomSong.title}"`);
    });
  }

  // Ranking filter chips listener
  document.querySelectorAll(".ranking-filters .filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ranking-filters .filter-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRankingFilter = btn.getAttribute("data-ranking-filter") || "weekly";
      renderRankingView(currentRankingFilter);
    });
  });

  function renderPlaylistsGrid() {
    if (!libraryPlaylistsGrid) return;
    libraryPlaylistsGrid.innerHTML = "";
    if (playlists.length === 0) {
      libraryPlaylistsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed var(--glass-border);">
          <p style="color:var(--spotify-grey); margin-bottom: 10px;">No has creado ninguna lista de reproducción aún.</p>
          <button class="primary-btn" onclick="document.getElementById('playlist-modal').classList.remove('hidden')" style="background:var(--spotify-green); color:black; font-weight:700; font-size:13px;">
            <i class="fa-solid fa-plus"></i> Crear tu primera lista
          </button>
        </div>
      `;
      return;
    }

    playlists.forEach(pl => {
      const card = document.createElement("div");
      card.className = "music-card";
      const timeText = formatTimeListenedShort(pl.totalTimeListened || 0);
      card.innerHTML = `
        <div class="card-img-wrapper">
          <div style="width:100%;height:100%;background:linear-gradient(135deg, #1db954, #0b481f);display:flex;align-items:center;justify-content:center;border-radius:8px;">
            <i class="fa-solid fa-list-ul" style="font-size:36px;color:#ffffff"></i>
          </div>
          <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
        </div>
        <div class="card-title">${escapeHtml(pl.name)}</div>
        <div class="card-subtitle">${pl.songIds ? pl.songIds.length : 0} temas • ${timeText}</div>
      `;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".card-play-btn")) {
          e.stopPropagation();
          playPlaylist(pl.id);
        } else {
          window.viewPlaylist(pl.id);
        }
      });
      libraryPlaylistsGrid.appendChild(card);
    });
  }

  // --------------------------------------------------------------------------
  // SETTINGS & PWA INSTALLATION
  // --------------------------------------------------------------------------

  let deferredInstallPrompt = null;
  const btnInstallPwaHeader = document.getElementById("btn-install-pwa-header");
  const btnInstallPwaSettings = document.getElementById("btn-install-pwa");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btnInstallPwaHeader) btnInstallPwaHeader.classList.remove("hidden");
    console.log("[PWA] Evento beforeinstallprompt capturado");
  });

  const btnClosePwaGuide = document.getElementById("btn-close-pwa-guide");
  const btnPwaGuideOk = document.getElementById("btn-pwa-guide-ok");

  if (btnClosePwaGuide) btnClosePwaGuide.addEventListener("click", () => pwaInstallGuideModal && pwaInstallGuideModal.classList.add("hidden"));
  if (btnPwaGuideOk) btnPwaGuideOk.addEventListener("click", () => pwaInstallGuideModal && pwaInstallGuideModal.classList.add("hidden"));

  async function triggerPwaInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      console.log(`[PWA] Resultado de instalación: ${choiceResult.outcome}`);
      deferredInstallPrompt = null;
      if (btnInstallPwaHeader) btnInstallPwaHeader.classList.add("hidden");
    } else {
      if (pwaInstallGuideModal) {
        pwaInstallGuideModal.classList.remove("hidden");
      } else if (typeof showToast === "function") {
        showToast("📱 Pulsa los 3 puntos de Chrome -> 'Añadir a pantalla de inicio'");
      }
    }
  }

  if (btnInstallPwaHeader) btnInstallPwaHeader.addEventListener("click", triggerPwaInstall);
  if (btnInstallPwaSettings) btnInstallPwaSettings.addEventListener("click", triggerPwaInstall);

  window.addEventListener("appinstalled", () => {
    console.log("[PWA] SpotiLocal instalada exitosamente");
    if (btnInstallPwaHeader) btnInstallPwaHeader.classList.add("hidden");
    if (typeof showToast === "function") showToast("🎉 ¡SpotiLocal Pro instalada en tu dispositivo!");
  });

  sleepTimerSelect.addEventListener("change", (e) => {
    const minutes = parseInt(e.target.value);
    if (isNaN(minutes)) {
      if (sleepTimerInterval) clearInterval(sleepTimerInterval);
      sleepTimerStatus.classList.add("hidden");
      return;
    }

    sleepTimerEndTime = Date.now() + minutes * 60 * 1000;
    sleepTimerStatus.classList.remove("hidden");

    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    sleepTimerInterval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((sleepTimerEndTime - Date.now()) / 1000));
      timerCountdown.textContent = formatTime(remaining);

      if (remaining <= 0) {
        clearInterval(sleepTimerInterval);
        if (usingNativePlayback && typeof window.SpotiLocalNativePlayer !== "undefined" && window.SpotiLocalNativePlayer.pause) {
          window.SpotiLocalNativePlayer.pause();
        } else {
          audioElement.pause();
        }
        isPlaying = false;
        updatePlayPauseUI();
        sleepTimerStatus.classList.add("hidden");
        sleepTimerSelect.value = "off";
      }
    }, 1000);
  });

  // --------------------------------------------------------------------------


  // Helpers
  function formatTime(secs) {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[m]);
  }

  try {
    await loadCoverArtCatalog();
    loadSongsFromDB();
    loadPlaylistsFromDB();
  } catch (e) {
    console.warn("DB init warning:", e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSpotiLocalApp);
} else {
  initSpotiLocalApp();
}
