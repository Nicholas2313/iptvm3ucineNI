const APP_NAME = "M3UCINE";
const STORAGE_KEY = "m3ucine-state-v1";
const LEGACY_STORAGE_KEY = "calicine-iptv-v1";
const HISTORY_KEY = "m3ucine-history-v1";
const LEGACY_HISTORY_KEY = "calicine-iptv-history-v1";
const PROGRESS_KEY = "m3ucine-progress-v1";
const LAST_M3U_URL_KEY = "m3ucine-last-m3u-url";
const LEGACY_LAST_M3U_URL_KEY = "calicine-iptv-last-m3u-url";
const MIN_CONTINUE_SECONDS = 8;
const PLAYBACK_SAVE_INTERVAL_MS = 1000;
const LIBRARY_FETCH_TIMEOUT_MS = 45000;
const MAX_LIBRARY_ITEMS = 20000;
const PROFILE_SYNC_ENDPOINT = "/api/profile-state";
const PROFILE_SYNC_DEBOUNCE_MS = 700;
const AVATAR_SIZE = 512;
const SEARCH_RENDER_DELAY_MS = 120;
const MAX_SEARCH_RESULTS = 96;
const MAX_PROFILES = 4;
const PROFILE_THEMES = ["blue", "pink", "violet", "green"];

const els = {
  activeAvatar: document.getElementById("active-avatar"),
  menuAvatar: document.getElementById("menu-avatar"),
  activeName: document.getElementById("active-name"),
  activeMeta: document.getElementById("active-meta"),
  profileLibraryCount: document.getElementById("profile-library-count"),
  profileMenuBtn: document.getElementById("profile-menu-btn"),
  profileMenuPanel: document.getElementById("profile-menu-panel"),
  editProfileMenuBtn: document.getElementById("edit-profile-menu-btn"),
  profileGrid: document.getElementById("profile-grid"),
  editProfileBtn: document.getElementById("edit-profile-btn"),
  profileModal: document.getElementById("profile-modal"),
  profileEditForm: document.getElementById("profile-edit-form"),
  profileModalTitle: document.getElementById("profile-modal-title"),
  editProfileName: document.getElementById("edit-profile-name"),
  editProfileAvatar: document.getElementById("edit-profile-avatar"),
  editProfileTheme: document.getElementById("edit-profile-theme"),
  editProfileAvatarPreview: document.getElementById("edit-profile-avatar-preview"),
  deleteProfileBtn: document.getElementById("delete-profile-btn"),
  closeProfileModal: document.getElementById("close-profile-modal"),
  seriesModal: document.getElementById("series-modal"),
  closeSeriesModal: document.getElementById("close-series-modal"),
  seriesModalTitle: document.getElementById("series-modal-title"),
  seriesModalMeta: document.getElementById("series-modal-meta"),
  seriesModalPoster: document.getElementById("series-modal-poster"),
  seriesModalOverview: document.getElementById("series-modal-overview"),
  seriesSeasonTabs: document.getElementById("series-season-tabs"),
  seriesEpisodeGrid: document.getElementById("series-episode-grid"),
  seriesModalStatus: document.getElementById("series-modal-status"),
  avatarInput: document.getElementById("avatar-input"),
  newProfileForm: document.getElementById("new-profile-form"),
  newProfileName: document.getElementById("new-profile-name"),
  m3uUrl: document.getElementById("m3u-url"),
  importForm: document.getElementById("import-form"),
  importStatus: document.getElementById("import-status"),
  importButton: document.querySelector("#import-form button[type='submit']"),
  tabs: document.getElementById("tabs"),
  exitBtn: document.getElementById("exit-btn"),
  quickExitBtn: document.getElementById("quick-exit-btn"),
  searchInput: document.getElementById("search-input"),
  groupFilter: document.getElementById("group-filter"),
  libraryTitle: document.getElementById("library-title"),
  libraryGrid: document.getElementById("library-grid"),
  favoriteGrid: document.getElementById("favorite-grid"),
  resultsCount: document.getElementById("results-count"),
  statItems: document.getElementById("stat-items"),
  statMovies: document.getElementById("stat-movies"),
  statSeries: document.getElementById("stat-series"),
  heroHeadline: document.getElementById("hero-headline"),
  heroMeta: document.getElementById("hero-meta"),
  heroEpisodeTitle: document.getElementById("hero-episode-title"),
  heroDescription: document.getElementById("hero-description"),
  heroContinueBtn: document.getElementById("hero-continue-btn"),
  heroFavoriteBtn: document.getElementById("hero-favorite-btn"),
  featuredBanner: document.getElementById("featured-banner"),
  featuredTitle: document.getElementById("featured-title"),
  featuredDescription: document.getElementById("featured-description"),
  player: document.getElementById("player"),
  playerEmpty: document.getElementById("player-empty"),
  downloadLink: document.getElementById("download-link"),
  openLink: document.getElementById("open-link"),
  playerSeasonsSection: document.getElementById("player-seasons-section"),
  playerSeasonSelect: document.getElementById("player-season-select"),
  playerEpisodeList: document.getElementById("player-episode-list"),
  continueSection: document.getElementById("continue-section"),
  continueGrid: document.getElementById("continue-grid"),
  favoritesSection: document.getElementById("favorites-section"),
  recentGrid: document.getElementById("recent-grid"),
  popularMoviesGrid: document.getElementById("popular-movies-grid"),
  seriesGrid: document.getElementById("series-grid"),
  animeGrid: document.getElementById("anime-grid"),
  recommendedGrid: document.getElementById("recommended-grid"),
  similarGrid: document.getElementById("similar-grid"),
  catalogStatus: document.getElementById("catalog-status"),
  catalogSource: document.getElementById("catalog-source"),
  clearHistory: document.getElementById("clear-history"),
};

const state = loadState();
let activeTab = "all";
let activeGroup = "all";
let searchTerm = "";
let selectedItemId = null;
let importTimer = null;
const recentHistory = loadHistory();
let isImporting = false;
let profileGateOpen = false;
let profileCatalogLoading = false;
let profileSyncTimer = null;
let profileSyncBusy = false;
let profileSyncPending = false;
let searchRenderTimer = null;
let profileManageMode = false;
let profileMosaicTimer = null;
let activePlayback = null;
let playbackRestoreTime = 0;
let playbackSaveTimer = null;
let lastPlaybackSaveAt = 0;
let inlineSeriesState = {
  loading: false,
  seriesItem: null,
  details: null,
  activeSeason: null,
  selectedEpisodeId: null,
};
const seriesDetailsCache = new Map();
const seriesDetailsLoading = new Map();
const searchIndexCache = new WeakMap();
let currentSeriesState = {
  open: false,
  loading: false,
  error: "",
  series: null,
  details: null,
  activeSeason: null,
  selectedEpisodeId: null,
};

function uid() {
  return window.crypto?.randomUUID?.() || `id-${Math.random().toString(36).slice(2, 10)}`;
}

function stableId(value) {
  let hash = 0;
  for (const ch of String(value || "")) {
    hash = (hash << 5) - hash + ch.charCodeAt(0);
    hash |= 0;
  }
  return `m3u-${Math.abs(hash).toString(36)}`;
}

function defaultAvatar(name) {
  const seed = (name || "Perfil").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const hue = 196 + (seed % 34);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="hsl(${hue}, 100%, 64%)" />
          <stop offset="55%" stop-color="hsl(${(hue + 18) % 360}, 100%, 48%)" />
          <stop offset="100%" stop-color="#031126" />
        </linearGradient>
        <radialGradient id="a" cx="35%" cy="24%" r="72%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.55)" />
          <stop offset="42%" stop-color="rgba(74,202,255,0.22)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <rect width="240" height="240" rx="120" fill="url(#g)"/>
      <rect width="240" height="240" rx="120" fill="url(#a)"/>
      <circle cx="120" cy="91" r="43" fill="rgba(226,248,255,0.86)"/>
      <path d="M48 205c9-49 36-75 72-75s63 26 72 75c-20 14-44 21-72 21s-52-7-72-21z" fill="rgba(226,248,255,0.76)"/>
      <circle cx="120" cy="120" r="112" fill="none" stroke="rgba(158,224,255,0.55)" stroke-width="8"/>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function isLegacyGeneratedAvatar(avatar) {
  if (typeof avatar !== "string" || !avatar.startsWith("data:image/svg+xml")) return false;
  try {
    return decodeURIComponent(avatar).includes("<text");
  } catch {
    return avatar.includes("%3Ctext") || avatar.includes("<text");
  }
}

function normalizeAvatarValue(avatar, name) {
  return avatar && !isLegacyGeneratedAvatar(avatar) ? avatar : defaultAvatar(name);
}

function normalizeProfileTheme(theme, index = 0) {
  return PROFILE_THEMES.includes(theme) ? theme : PROFILE_THEMES[index % PROFILE_THEMES.length];
}

function profileCardLabel(index, profile, activeId) {
  return profile.id === activeId ? "Perfil ativo" : "Toque para selecionar";
}

function openProfileEditor(profile) {
  if (!els.profileModal || !els.profileModalTitle || !els.editProfileName || !els.editProfileAvatarPreview) return;
  els.profileModalTitle.textContent = profile.name;
  els.editProfileName.value = profile.name;
  els.editProfileAvatar.value = "";
  if (els.editProfileTheme) els.editProfileTheme.value = normalizeProfileTheme(profile.theme);
  els.editProfileAvatarPreview.src = renderAvatar(profile);
  els.profileModal.dataset.profileId = profile.id;
  if (els.deleteProfileBtn) {
    els.deleteProfileBtn.hidden = state.profiles.length <= 1;
  }
  if (typeof els.profileModal.showModal === "function") {
    els.profileModal.showModal();
  } else {
    els.profileModal.setAttribute("open", "open");
  }
}

function closeProfileEditor() {
  if (!els.profileModal) return;
  if (typeof els.profileModal.close === "function") {
    els.profileModal.close();
  } else {
    els.profileModal.removeAttribute("open");
  }
}

function getProfileById(profileId) {
  return state.profiles.find((profile) => profile.id === profileId) || null;
}

function createManagedProfile() {
  if (state.profiles.length >= MAX_PROFILES) return;
  const profile = createProfile(`Perfil ${state.profiles.length + 1}`, state.profiles.length);
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  profileManageMode = true;
  saveState();
  render();
  queueProfileSync();
  openProfileEditor(profile);
}

function deleteProfile(profileId) {
  if (state.profiles.length <= 1) {
    window.alert("Você precisa manter pelo menos um perfil.");
    return;
  }
  const profile = getProfileById(profileId);
  if (!profile) return;
  const confirmed = window.confirm(`Excluir o perfil "${profile.name}"? Favoritos e progresso deste perfil também deixarão de aparecer.`);
  if (!confirmed) return;
  state.profiles = state.profiles.filter((item) => item.id !== profileId);
  delete progressState[profileId];
  saveProgressState();
  if (state.activeProfileId === profileId) {
    state.activeProfileId = state.profiles[0]?.id || null;
  }
  closeProfileEditor();
  saveState();
  render();
  queueProfileSync();
}

function readFileAsDataUrl(file, fallbackName) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || defaultAvatar(fallbackName)));
    reader.onerror = () => resolve(defaultAvatar(fallbackName));
    reader.readAsDataURL(file);
  });
}

function loadImageSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function fileToAvatarDataUrl(file, fallbackName) {
  const raw = await readFileAsDataUrl(file, fallbackName);
  try {
    const image = await loadImageSource(raw);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return raw;

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const side = Math.min(sourceWidth, sourceHeight);
    const sx = Math.max(0, (sourceWidth - side) / 2);
    const sy = Math.max(0, (sourceHeight - side) / 2);

    context.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return raw;
  }
}

function openProfileGate() {
  profileGateOpen = false;
  profileManageMode = false;
  document.body.classList.add("profile-gate");
  closeProfileEditor();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function createProfile(name, index = 0) {
  return {
    id: uid(),
    name,
    avatar: defaultAvatar(name),
    theme: normalizeProfileTheme(null, index),
    library: [],
    favorites: [],
  };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
    if (raw?.profiles?.length) {
      return normalizeState(raw);
    }
  } catch {}
  return normalizeState({
    activeProfileId: null,
    profiles: [
      createProfile("Perfil 1", 0),
      createProfile("Perfil 2", 1),
      createProfile("Perfil 3", 2),
      createProfile("Perfil 4", 3),
    ],
  });
}

function normalizeState(input) {
  const sourceProfiles = Array.isArray(input.profiles) ? input.profiles : [];
  const source = sourceProfiles.length ? sourceProfiles.slice(0, MAX_PROFILES) : Array.from({ length: MAX_PROFILES });
  const profiles = source.map((sourceProfile, index) => {
    const profile = sourceProfile || sourceProfiles[index];
    const fallbackName = `Perfil ${index + 1}`;
    return {
      id: profile?.id || uid(),
      name: profile?.name || fallbackName,
      avatar: normalizeAvatarValue(profile?.avatar, profile?.name || fallbackName),
      theme: normalizeProfileTheme(profile?.theme, index),
      library: [],
      favorites: Array.isArray(profile?.favorites) ? profile.favorites : [],
    };
  });

  return {
    activeProfileId:
      input.activeProfileId && profiles.some((profile) => profile.id === input.activeProfileId)
        ? input.activeProfileId
        : profiles[0].id,
    profiles,
  };
}

function saveState() {
  const storedState = {
    activeProfileId: state.activeProfileId,
    profiles: state.profiles.map((profile, index) => ({
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar,
      theme: normalizeProfileTheme(profile.theme, index),
      favorites: profile.favorites,
      library: [],
    })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function buildProfileSyncPayload() {
  return {
    profiles: state.profiles.slice(0, MAX_PROFILES).map((profile, index) => ({
      id: profile.id,
      name: toText(profile.name) || `Perfil ${index + 1}`,
      avatar: normalizeAvatarValue(profile.avatar, profile.name),
      theme: normalizeProfileTheme(profile.theme, index),
      favorites: Array.isArray(profile.favorites) ? Array.from(new Set(profile.favorites)).slice(0, 1000) : [],
    })),
  };
}

function sameList(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function applyRemoteProfile(profile, remote, index) {
  let changed = false;
  const remoteId = toText(remote.id);
  if (remoteId && profile.id !== remoteId) {
    profile.id = remoteId;
    changed = true;
  }

  const remoteName = toText(remote.name);
  if (remoteName && remoteName !== profile.name) {
    profile.name = remoteName;
    changed = true;
  }

  if (typeof remote.avatar === "string" && remote.avatar) {
    const remoteAvatar = normalizeAvatarValue(remote.avatar, profile.name);
    if (remoteAvatar !== profile.avatar) {
      profile.avatar = remoteAvatar;
      changed = true;
    }
  } else if (isLegacyGeneratedAvatar(profile.avatar)) {
    profile.avatar = defaultAvatar(profile.name);
    changed = true;
  }

  const remoteTheme = normalizeProfileTheme(remote.theme, index);
  if (remoteTheme !== profile.theme) {
    profile.theme = remoteTheme;
    changed = true;
  }

  if (Array.isArray(remote.favorites)) {
    const remoteFavorites = Array.from(new Set(remote.favorites.map((item) => String(item || "")).filter(Boolean)));
    if (!sameList(remoteFavorites, profile.favorites)) {
      profile.favorites = remoteFavorites;
      changed = true;
    }
  }

  return changed;
}

function applyProfileSyncPayload(payload) {
  const remoteProfiles = Array.isArray(payload?.profiles) ? payload.profiles.slice(0, MAX_PROFILES) : [];
  if (!remoteProfiles.length) return false;

  let changed = false;
  const nextProfiles = remoteProfiles.map((remote, index) => {
    const remoteId = toText(remote.id);
    return (
      (remoteId && state.profiles.find((profile) => profile.id === remoteId)) ||
      state.profiles[index] ||
      createProfile(toText(remote.name) || `Perfil ${index + 1}`, index)
    );
  });
  if (
    nextProfiles.length !== state.profiles.length ||
    nextProfiles.some((profile, index) => profile !== state.profiles[index])
  ) {
    state.profiles = nextProfiles;
    changed = true;
  }

  state.profiles.forEach((profile, index) => {
    if (applyRemoteProfile(profile, remoteProfiles[index], index)) changed = true;
  });

  if (!state.profiles.some((profile) => profile.id === state.activeProfileId)) {
    state.activeProfileId = state.profiles[0]?.id || null;
    changed = true;
  }

  return changed;
}

async function loadProfileSync() {
  try {
    const response = await fetch(PROFILE_SYNC_ENDPOINT, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (applyProfileSyncPayload(payload)) {
      saveState();
      render();
    }
  } catch {}
}

async function saveProfileSync() {
  clearTimeout(profileSyncTimer);
  profileSyncTimer = null;
  if (profileSyncBusy) {
    profileSyncPending = true;
    return;
  }

  profileSyncBusy = true;
  try {
    await fetch(PROFILE_SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildProfileSyncPayload()),
    });
  } catch {
  } finally {
    profileSyncBusy = false;
    if (profileSyncPending) {
      profileSyncPending = false;
      queueProfileSync(300);
    }
  }
}

function queueProfileSync(delay = PROFILE_SYNC_DEBOUNCE_MS) {
  clearTimeout(profileSyncTimer);
  profileSyncTimer = setTimeout(() => {
    saveProfileSync();
  }, delay);
}

function getActiveProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0];
}

function setActiveProfile(id) {
  state.activeProfileId = id;
  selectedItemId = null;
  activePlayback = null;
  playbackRestoreTime = 0;
  profileGateOpen = true;
  document.body.classList.remove("profile-gate");
  saveState();
  render();
}

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || localStorage.getItem(LEGACY_HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(recentHistory.slice(0, 12)));
  localStorage.removeItem(LEGACY_HISTORY_KEY);
}

function clearAllHistoryStorage() {
  recentHistory.splice(0, recentHistory.length);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(LEGACY_HISTORY_KEY);
}

function loadProgressState() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveProgressState() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressState));
}

const progressState = loadProgressState();

function getProfileProgress(profileId) {
  if (!progressState[profileId] || typeof progressState[profileId] !== "object") {
    progressState[profileId] = {};
  }
  return progressState[profileId];
}

function persistProfileProgress(profileId) {
  getProfileProgress(profileId);
  saveProgressState();
}

function buildPlaybackKey(item) {
  return item?.progressKey || item?.episodeId || item?.seriesId || item?.id || stableId(item?.url || item?.title || "");
}

function makeProgressEntry(profileId, item, currentTime = 0, duration = 0) {
  return {
    profileId,
    key: buildPlaybackKey(item),
    kind: item.kind || item.type || "movie",
    type: item.type || "movie",
    title: item.kind === "episode" ? item.fullTitle || item.title : item.title,
    subtitle: item.kind === "episode" ? item.seriesTitle || item.group || "" : item.group || "",
    logo: item.logo || "",
    url: item.url || "",
    seriesId: item.seriesId || "",
    seasonNumber: item.seasonNumber || null,
    episodeNumber: item.episodeNumber || null,
    currentTime: Math.max(0, currentTime || 0),
    duration: Math.max(0, duration || 0),
    updatedAt: Date.now(),
  };
}

function savePlaybackProgress(profileId, item, currentTime, duration, options = {}) {
  if (!profileId || !item || !item.url) return;
  const progress = getProfileProgress(profileId);
  const key = buildPlaybackKey(item);
  const remaining = duration > 0 ? Math.max(duration - currentTime, 0) : Infinity;

  if (options.completed || (duration > 0 && remaining <= 10)) {
    delete progress[key];
    saveProgressState();
    return;
  }

  if (currentTime < MIN_CONTINUE_SECONDS) {
    delete progress[key];
    saveProgressState();
    return;
  }

  progress[key] = makeProgressEntry(profileId, item, currentTime, duration);
  saveProgressState();
}

function saveActivePlaybackProgress(options = {}) {
  if (!activePlayback || !els.player) return;
  const currentTime = Number(els.player.currentTime || 0);
  const duration = Number(els.player.duration || 0);
  savePlaybackProgress(activePlayback.profileId, activePlayback, currentTime, duration, options);
  lastPlaybackSaveAt = Date.now();
}

function clearAllPlaybackProgress() {
  for (const key of Object.keys(progressState)) {
    delete progressState[key];
  }
  localStorage.removeItem(PROGRESS_KEY);
  saveProgressState();
}

function getProfileContinueItems(profile) {
  const progress = getProfileProgress(profile.id);
  return Object.values(progress)
    .filter((entry) => entry && Number(entry.currentTime || 0) >= MIN_CONTINUE_SECONDS)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function getProgressPercent(entry) {
  if (!entry || !entry.duration) return 0;
  return Math.max(0, Math.min(100, (entry.currentTime / entry.duration) * 100));
}

function buildPlayableEntry(entry) {
  const isSeriesEpisode = entry?.kind === "episode" || entry?.type === "series" || Boolean(entry?.seriesId);
  return {
    ...entry,
    id: entry?.key || entry?.id || stableId(entry?.url || entry?.title || ""),
    kind: isSeriesEpisode ? "episode" : "movie",
    type: isSeriesEpisode ? "series" : "movie",
    title: entry?.title || entry?.fullTitle || "Titulo",
    fullTitle: entry?.fullTitle || entry?.title || "Titulo",
    group: entry?.subtitle || entry?.group || "",
    seriesTitle: entry?.subtitle || entry?.seriesTitle || entry?.group || "",
    progressKey: entry?.key || entry?.progressKey || "",
    url: entry?.url || "",
  };
}

function playProgressEntry(profile, entry, options = {}) {
  const playable = buildPlayableEntry(entry);
  if (!playable.url) return;
  selectedItemId = playable.id;
  rememberItem(playable.id);
  updateStreamingHero(profile, playable);
  playMediaItem(profile, playable, { restoreTime: options.restart ? 0 : entry?.currentTime || 0 });
}

function rememberItem(itemId) {
  const index = recentHistory.indexOf(itemId);
  if (index >= 0) recentHistory.splice(index, 1);
  recentHistory.unshift(itemId);
  recentHistory.splice(12);
  saveHistory();
}

function toText(input) {
  return (input || "").trim();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseAttributes(text) {
  const attrs = {};
  const regex = /([a-z0-9-]+)="([^"]*)"/gi;
  let match;
  while ((match = regex.exec(text))) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function detectType(title, group) {
  const haystack = normalizeText(`${title} ${group}`);
  if (/(canal|canais|live|ao vivo|channel|iptv|tv ao vivo|broadcast)/i.test(haystack)) return null;
  if (/(serie|series|season|episode|episodio|episodios|show|capitulo)/i.test(haystack)) return "series";
  if (/(filme|filmes|movie|movies|vod|cinema)/i.test(haystack)) return "movie";
  return "movie";
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const items = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const commaIndex = line.indexOf(",");
      const rawMeta = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const rawTitle = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "";
      const attrs = parseAttributes(rawMeta);
      const title = rawTitle || attrs["tvg-name"] || "Sem titulo";
      const group = attrs["group-title"] || "Geral";
      const type = detectType(title, group);
      if (!type) {
        current = null;
        continue;
      }
      current = {
        id: "",
        title,
        group,
        type,
        url: "",
        logo: attrs["tvg-logo"] || "",
        source: "M3U",
      };
      continue;
    }

    if (line.startsWith("#")) continue;

    if (current && !current.url) {
      current.url = line;
      current.id = stableId(`${current.title}|${current.group}|${current.url}`);
      items.push(current);
      current = null;
    }
  }

  return items;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

async function fetchTextWithFallback(url) {
  const proxyUrl = `/api/fetch-m3u?url=${encodeURIComponent(url)}`;
  const proxied = await withTimeout(fetch(proxyUrl, { cache: "no-store" }), 12000, "Tempo esgotado");
  if (!proxied.ok) {
    throw new Error(`Falha ao carregar a lista (${proxied.status})`);
  }
  return await proxied.text();
}

function importItemsIntoProfile(profile, items) {
  profile.library = items.slice(0, MAX_LIBRARY_ITEMS);
  profile.favorites = profile.favorites.filter((favoriteId) =>
    profile.library.some((item) => item.id === favoriteId)
  );
  selectedItemId = null;
  activePlayback = null;
  playbackRestoreTime = 0;
}

function getCurrentLibrary(profile) {
  return profile.library;
}

function matchesGroupFilter(item) {
  return activeGroup === "all" || (item.group || "").toLowerCase() === activeGroup.toLowerCase();
}

function getItemSearchIndex(item) {
  const cached = searchIndexCache.get(item);
  if (cached) return cached;
  const value = normalizeText(`${item.title} ${item.group} ${item.type} ${item.source || ""}`);
  searchIndexCache.set(item, value);
  return value;
}

function getVisibleItems(profile) {
  const library = getCurrentLibrary(profile);
  const query = normalizeText(searchTerm);
  if (!query) return [];
  const tab = activeTab === "favorites" ? "all" : activeTab;

  return library.filter((item) => {
    const haystack = getItemSearchIndex(item);
    const matchesSearch = haystack.includes(query);
    const isFavorite = profile.favorites.includes(item.id);
    const matchesTab =
      tab === "all" ||
      (tab === "favorites" && isFavorite) ||
      (tab === "movies" && item.type === "movie") ||
      (tab === "series" && item.type === "series");
    return matchesSearch && matchesTab && matchesGroupFilter(item);
  });
}

function setStatus(message, tone = "info") {
  if (!els.importStatus) return;
  els.importStatus.textContent = message;
  els.importStatus.dataset.tone = tone;
}

function renderAvatar(profile) {
  return normalizeAvatarValue(profile.avatar, profile.name);
}

function fallbackPoster(theme = "blue", index = 0) {
  const colors = {
    blue: ["#42d7ff", "#075dff"],
    pink: ["#ff7ac8", "#8d3dff"],
    violet: ["#b56cff", "#4b6dff"],
    green: ["#31f0a2", "#0b7fce"],
  };
  const [start, end] = colors[normalizeProfileTheme(theme)] || colors.blue;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="360" height="540" viewBox="0 0 360 540">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="${start}"/>
          <stop offset="1" stop-color="${end}"/>
        </linearGradient>
        <radialGradient id="r" cx="50%" cy="18%" r="70%">
          <stop stop-color="rgba(255,255,255,.34)"/>
          <stop offset="1" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <rect width="360" height="540" rx="34" fill="#061329"/>
      <rect width="360" height="540" rx="34" fill="url(#g)" opacity=".72"/>
      <rect width="360" height="540" rx="34" fill="url(#r)"/>
      <circle cx="${110 + index * 26}" cy="${140 + index * 18}" r="88" fill="rgba(255,255,255,.14)"/>
      <path d="M64 394c56-84 126-126 210-126 28 0 54 5 78 16v256H0v-58c14-31 35-60 64-88z" fill="rgba(2,8,18,.42)"/>
      <text x="34" y="80" fill="white" font-family="Arial, sans-serif" font-size="32" font-weight="800">M3UCINE</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function findKnownLibraryItem(itemId, preferredProfile) {
  if (!itemId) return null;
  const preferred = preferredProfile?.library?.find((item) => item.id === itemId);
  if (preferred) return preferred;
  for (const profile of state.profiles) {
    const found = profile.library?.find((item) => item.id === itemId);
    if (found) return found;
  }
  return null;
}

function addMosaicItem(list, seen, item, label) {
  const logo = item?.logo || item?.poster || "";
  const title = item?.title || item?.fullTitle || label || "M3UCINE";
  const key = logo || item?.id || item?.key || item?.url || title;
  if (!logo || seen.has(key)) return;
  seen.add(key);
  list.push({ logo, title, label });
}

function getProfileMosaicItems(profile, index = 0) {
  const items = [];
  const seen = new Set();

  profile.favorites.forEach((favoriteId) => {
    addMosaicItem(items, seen, findKnownLibraryItem(favoriteId, profile), "Favorito");
  });

  Object.values(getProfileProgress(profile.id))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .forEach((entry) => addMosaicItem(items, seen, entry, "Continuar"));

  profile.library
    .filter((item) => item.logo)
    .slice(0, 24)
    .forEach((item) => addMosaicItem(items, seen, item, "Recomendado"));

  if (items.length) return items.slice(0, 6);

  return Array.from({ length: 4 }, (_, fallbackIndex) => ({
    logo: fallbackPoster(profile.theme, fallbackIndex + index),
    title: "Arte M3UCINE",
    label: "Sem conteúdo salvo",
  }));
}

function renderProfileMosaic(profile, index) {
  const mosaic = getProfileMosaicItems(profile, index);
  return mosaic
    .map(
      (item, itemIndex) => `
        <img
          class="profile-mosaic-img"
          src="${escapeHtml(item.logo)}"
          alt="${escapeHtml(item.title)}"
          loading="lazy"
          data-profile-mosaic-img
          data-fallback="${escapeHtml(fallbackPoster(profile.theme, itemIndex))}"
        />
      `
    )
    .join("");
}

function getProfileMeta(profile) {
  return profile.library.length > 0 ? "Catalogo carregado" : "Catalogo em espera";
}

function getStreamingProfileMeta(profile) {
  return profile.library.length > 0 ? "Catalogo conectado" : "Conectando catalogo";
}

function buildGroupOptions(profile) {
  const groups = Array.from(new Set(profile.library.map((item) => item.group || "Geral"))).sort();
  return [
    `<option value="all">Todas as categorias</option>`,
    ...groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`),
  ].join("");
}

function isAnimeItem(item) {
  return /anime|animes|animacao|animation|desenho|crunchyroll/i.test(
    normalizeText(`${item?.title || ""} ${item?.group || ""}`)
  );
}

function itemTypeLabel(item) {
  if (isAnimeItem(item)) return "Anime";
  return item?.type === "series" ? "Série" : "Filme";
}

function getItemProgress(profile, item) {
  return getSavedPlaybackEntry(profile.id, item);
}

function getStreamingItemTypeLabel(item) {
  if (isAnimeItem(item)) return "Anime";
  return item?.type === "series" ? "Serie" : "Filme";
}

function renderCardProgress(profile, item) {
  const progress = getItemProgress(profile, item);
  if (!progress || !progress.currentTime) return "";
  return `<div class="card-progress"><span style="width:${getProgressPercent(progress)}%"></span></div>`;
}

function uniqueItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function pickRailItems(profile, filter, limit = 18) {
  return uniqueItems(profile.library.filter(filter)).slice(0, limit);
}

function renderRail(grid, items, profile, emptyText = "Nada encontrado ainda.") {
  if (!grid) return;
  grid.innerHTML = items.length
    ? items.map((item) => renderStreamingCard(item, profile)).join("")
    : `<article class="empty-note">${emptyText}</article>`;
}

function renderHistory(profile) {
  const list = getProfileContinueItems(profile);
  if (!list.length) return `<article class="empty-note">Nenhum progresso salvo ainda.</article>`;

  return list
    .map(
      (entry) => `
      <article class="continue-card" data-progress-key="${escapeHtml(entry.key)}">
        <img class="continue-poster" src="${entry.logo || defaultAvatar(entry.title)}" alt="${escapeHtml(entry.title)}" />
        <div class="continue-body">
          <h4>${escapeHtml(entry.title)}</h4>
          <p>${escapeHtml(entry.subtitle || "Continua assistindo")}</p>
          <p class="continue-time">${formatTimeLabel(entry.currentTime)}${entry.duration ? ` de ${formatTimeLabel(entry.duration)}` : ""}</p>
          <div class="progress-meter"><span style="width:${getProgressPercent(entry)}%"></span></div>
          <div class="continue-actions">
            <button class="small-btn play-button" type="button" data-continue-progress="${escapeHtml(entry.key)}">Continuar</button>
            <button class="small-btn ghost-btn" type="button" data-restart-progress="${escapeHtml(entry.key)}">Do inicio</button>
          </div>
        </div>
      </article>
    `
    )
    .join("");
}

function renderCard(item, profile) {
  const isFavorite = profile.favorites.includes(item.id);
  const selected = item.id === selectedItemId;
  const primaryAction = item.type === "series" ? "Episodios" : "Assistir";
  return `
    <article class="media-card ${selected ? "selected" : ""}" data-item-id="${item.id}">
      <img class="poster" src="${item.logo || defaultAvatar(item.title)}" alt="${escapeHtml(item.title)}" />
      <div class="media-info">
        <span class="chip">${item.type === "series" ? "Series" : "Filme"}</span>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.group || "Geral")} · ${escapeHtml(item.source || "M3U")}</p>
      </div>
      <div class="card-actions">
        <button class="card-button play-button" type="button">${primaryAction}</button>
        <button class="card-button fav-button" type="button" data-favorite="${item.id}">${isFavorite ? "★" : "☆"}</button>
      </div>
    </article>
  `;
}

function renderStreamingCard(item, profile) {
  const isFavorite = profile.favorites.includes(item.id);
  const selected = item.id === selectedItemId;
  const primaryAction = item.type === "series" ? "Temporadas" : "Assistir";
  const poster = item.logo || defaultAvatar(item.title);
  return `
    <article class="media-card ${selected ? "selected" : ""}" data-item-id="${escapeHtml(item.id)}">
      <div class="poster-frame">
        <img class="poster" src="${poster}" alt="${escapeHtml(item.title)}" loading="lazy" />
        ${renderCardProgress(profile, item)}
        <span class="card-type">${getStreamingItemTypeLabel(item)}</span>
      </div>
      <div class="media-info">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.group || "M3UCINE")}</p>
      </div>
      <div class="card-actions">
        <button class="card-button play-button" type="button">${primaryAction}</button>
        <button class="card-button fav-button ${isFavorite ? "active" : ""}" type="button" data-favorite="${escapeHtml(item.id)}">${isFavorite ? "Salvo" : "Favoritar"}</button>
      </div>
    </article>
  `;
}

function renderEmptyState(profile) {
  if (!searchTerm.trim()) {
    return `
      <article class="media-card wide">
        <div class="media-info">
          <span class="chip">Pesquise para ver</span>
          <h4>Digite o nome de um filme ou série para mostrar os resultados.</h4>
          <p>A busca ignora maiúsculas, minúsculas e acentos.</p>
        </div>
      </article>
    `;
  }

  if (!profile.library.length) {
    return `
      <article class="media-card wide">
        <div class="media-info">
          <span class="chip">Catálogo vazio</span>
          <h4>O catálogo ainda está carregando.</h4>
          <p>Aguarde alguns segundos ou recarregue a página.</p>
        </div>
      </article>
    `;
  }

  return `
    <article class="media-card wide">
      <div class="media-info">
        <span class="chip">Sem resultados</span>
        <h4>Nada encontrado com esse filtro.</h4>
        <p>Tente mudar a busca ou a categoria.</p>
      </div>
    </article>
  `;
}

function renderSearchLimitNote(total, shown) {
  if (total <= shown) return "";
  return `
    <article class="media-card wide search-limit-note">
      <div class="media-info">
        <span class="chip">Busca otimizada</span>
        <h4>Mostrando ${shown} de ${total} resultados.</h4>
        <p>Digite mais letras para encontrar o título mais rápido.</p>
      </div>
    </article>
  `;
}

function getSeriesIdentity(item) {
  if (!item) return "";
  if (item.seriesId) return String(item.seriesId);
  if (item.id && String(item.id).startsWith("series-")) {
    return String(item.id).replace(/^series-/, "");
  }
  return "";
}

function getEpisodeIdentity(seriesId, episode) {
  return episode?.id || stableId(`${seriesId}|${episode?.title || episode?.fullTitle || ""}`);
}

function getSavedPlaybackEntry(profileId, item) {
  const progress = getProfileProgress(profileId);
  const key = buildPlaybackKey(item);
  return progress[key] || null;
}

function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "open");
  }
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function formatTimeLabel(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function readPositiveNumber(value) {
  if (value === undefined || value === null) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const direct = Number(text);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const compact = text.match(/^0*(\d{1,4})$/);
  if (compact) return Number(compact[1]);
  return 0;
}

function normalizeSeasonNumber(value, fallback = 1) {
  const direct = readPositiveNumber(value);
  if (direct > 0) return direct;
  const text = String(value || "");
  const seasonMatch = text.match(/(?:temporada|season|temp|t|s)\s*0*(\d{1,3})/i);
  if (seasonMatch) return Number(seasonMatch[1]);
  return fallback;
}

function normalizeEpisodeNumber(episode) {
  const candidates = [
    episode?.episodeNumber,
    episode?.episode_num,
    episode?.episode_number,
    episode?.episode,
    episode?.num,
    episode?.info?.episode_num,
    episode?.info?.episode_number,
  ];
  for (const candidate of candidates) {
    const numeric = readPositiveNumber(candidate);
    if (numeric > 0) return numeric;
  }

  const title = `${episode?.title || ""} ${episode?.name || ""} ${episode?.fullTitle || ""}`;
  const codedMatch = title.match(/s\d{1,3}\s*e\s*0*(\d{1,4})/i);
  if (codedMatch) return Number(codedMatch[1]);
  const episodeMatch = title.match(/(?:episodio|episódio|episode|ep|e)\s*0*(\d{1,4})/i);
  if (episodeMatch) return Number(episodeMatch[1]);
  return 0;
}

function resolveEpisodeSeasonNumber(entry, episode, fallbackSeason = 1) {
  const candidates = [
    entry?.seasonNumber,
    entry?.season,
    entry?.season_number,
    entry?.season_num,
    episode?.seasonNumber,
    episode?.season,
    episode?.season_number,
    episode?.season_num,
    episode?.info?.season,
    episode?.info?.season_number,
  ];
  for (const candidate of candidates) {
    const seasonNumber = normalizeSeasonNumber(candidate, 0);
    if (seasonNumber > 0) return seasonNumber;
  }

  const title = `${episode?.fullTitle || ""} ${episode?.title || ""} ${episode?.name || ""}`;
  return normalizeSeasonNumber(title, fallbackSeason);
}

function getRawEpisodeId(episode) {
  return String(
    episode?.episodeId ||
      episode?.episode_id ||
      episode?.stream_id ||
      episode?.id ||
      episode?.info?.tmdb_id ||
      ""
  );
}

function buildSeasonName(season, seasonNumber) {
  const rawName = season?.name || season?.title || "";
  if (rawName && !/^season\s*\d+$/i.test(rawName)) return rawName;
  return `Temporada ${seasonNumber || 1}`;
}

function normalizeSeriesPayload(payload, fallbackSeries) {
  const details = payload?.series || payload?.series_info || payload?.info || payload || {};
  const seasonsRaw = Array.isArray(details.seasons) ? details.seasons : Array.isArray(payload?.seasons) ? payload.seasons : [];
  const episodesRaw = payload?.episodes || details.episodes || {};
  const series = {
    seriesId: String(fallbackSeries.seriesId || details.series_id || payload?.series_id || ""),
    title: details.name || details.title || fallbackSeries.title || "Serie",
    logo: details.cover || details.cover_big || details.movie_image || details.logo || fallbackSeries.logo || "",
    plot: details.plot || fallbackSeries.plot || "",
    year: details.year || fallbackSeries.year || "",
    genre: details.genre || fallbackSeries.genre || "",
    rating: details.rating || fallbackSeries.rating || "",
    status: details.status || fallbackSeries.status || "",
    base: details.base || fallbackSeries.base || "",
  };

  const seasonMap = new Map();
  const episodeEntries = [];

  for (const [index, season] of seasonsRaw.entries()) {
    const seasonNumber = normalizeSeasonNumber(
      season.seasonNumber ?? season.season_number ?? season.season_num ?? season.season ?? season.id,
      index + 1
    );
    seasonMap.set(seasonNumber, {
      seasonNumber,
      name: buildSeasonName(season, seasonNumber),
      episodes: [],
    });

    if (Array.isArray(season.episodes)) {
      episodeEntries.push(
        ...season.episodes.map((episode) => ({
          seasonNumber,
          episode,
        }))
      );
    }
  }

  if (Array.isArray(episodesRaw)) {
    episodeEntries.push(
      ...episodesRaw.map((episode) => ({
        seasonNumber: resolveEpisodeSeasonNumber(null, episode, 1),
        episode,
      }))
    );
  } else {
    episodeEntries.push(
      ...Object.entries(episodesRaw).flatMap(([seasonKey, episodes]) => {
        const seasonNumber = normalizeSeasonNumber(seasonKey, 1);
        return (Array.isArray(episodes) ? episodes : []).map((episode) => ({ seasonNumber, episode }));
      })
    );
  }

  for (const entry of episodeEntries) {
    const episode = entry.episode || entry;
    const seasonNumber = resolveEpisodeSeasonNumber(entry, episode, entry.seasonNumber || 1);
    if (!seasonMap.has(seasonNumber)) {
      seasonMap.set(seasonNumber, {
        seasonNumber,
        name: `Temporada ${seasonNumber || 1}`,
        episodes: [],
      });
    }
    const ext = episode.container_extension || episode.containerExtension || "mp4";
    const episodeNumber = normalizeEpisodeNumber(episode);
    const rawEpisodeId = getRawEpisodeId(episode);
    const episodeId = String(episode.id || "").startsWith("series-")
      ? String(episode.id)
      : `series-${series.seriesId}-s${seasonNumber}-e${episodeNumber || rawEpisodeId || stableId(episode.title || episode.name || "")}`;
    const normalizedEpisode = {
      id: episodeId,
      kind: "episode",
      type: "series",
      title: episode.title || episode.name || `Episodio ${episodeNumber || episode.id}`,
      fullTitle: episode.fullTitle || `${series.title} - T${seasonNumber || 1} EP${episodeNumber || rawEpisodeId || ""}`,
      group: series.title,
      logo: episode.info?.movie_image || episode.cover || series.logo || "",
      source: "Xtream",
      base: episode.base || series.base,
      seriesId: series.seriesId,
      seasonNumber,
      episodeNumber,
      url: episode.url || (episode.streamUrl || ""),
      plot: episode.plot || episode.info?.plot || "",
      duration: episode.duration || episode.info?.duration || "",
      releaseDate: episode.releasedate || episode.release_date || "",
      episodeId: rawEpisodeId,
      extension: ext,
    };
    if (!seasonMap.get(seasonNumber).episodes.some((item) => item.id === normalizedEpisode.id)) {
      seasonMap.get(seasonNumber).episodes.push(normalizedEpisode);
    }
  }

  const seasons = Array.from(seasonMap.values())
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((season) => ({
      ...season,
      episodes: season.episodes.sort(
        (a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0) || a.title.localeCompare(b.title)
      ),
    }));

  return { series, seasons };
}

function renderEpisodeCard(episode, state) {
  const episodeNumber = episode.episodeNumber ? String(episode.episodeNumber).padStart(2, "0") : "--";
  const seasonNumber = episode.seasonNumber || 1;
  const poster = episode.logo || state.series?.logo || defaultAvatar(episode.title);
  const duration = episode.duration ? `<span>${escapeHtml(episode.duration)}</span>` : "";

  return `
    <article class="episode-card ${state.selectedEpisodeId === episode.id ? "active" : ""}" data-episode-id="${escapeHtml(episode.id)}">
      <img class="episode-poster" src="${poster}" alt="${escapeHtml(episode.fullTitle)}" />
      <div class="episode-copy">
        <div class="episode-topline">
          <span class="episode-index">EP ${episodeNumber}</span>
          <span class="chip">T${seasonNumber} · EP${episode.episodeNumber || ""}</span>
          ${duration}
        </div>
        <h4>${escapeHtml(episode.title)}</h4>
        <p>${escapeHtml(episode.plot || "Episodio disponivel para reproducao.")}</p>
        <div class="episode-actions">
          <button class="card-button play-episode-button" type="button" data-play-episode="${escapeHtml(episode.id)}">Assistir</button>
          <button class="card-button ghost-btn" type="button" data-queue-episode="${escapeHtml(episode.id)}">Continuar</button>
        </div>
      </div>
    </article>
  `;
}

function renderSeasonSection(season, state) {
  const isActive = season.seasonNumber === state.activeSeason;
  const countLabel = `${season.episodes.length} episodio${season.episodes.length === 1 ? "" : "s"}`;

  return `
    <section class="season-block ${isActive ? "active" : ""}" data-season-block="${season.seasonNumber}">
      <div class="season-block-head">
        <div>
          <span class="season-kicker">Temporada ${season.seasonNumber || 1}</span>
          <h4>${escapeHtml(season.name || `Temporada ${season.seasonNumber || 1}`)}</h4>
        </div>
        <span class="season-count">${countLabel}</span>
      </div>
      <div class="season-episode-list">
        ${
          season.episodes.length
            ? season.episodes.map((episode) => renderEpisodeCard(episode, state)).join("")
            : `<article class="empty-note">Nenhum episodio encontrado nesta temporada.</article>`
        }
      </div>
    </section>
  `;
}

function renderInlineEpisodeCard(episode, profile) {
  const episodeNumber = episode.episodeNumber ? String(episode.episodeNumber).padStart(2, "0") : "--";
  const poster = episode.logo || inlineSeriesState.seriesItem?.logo || defaultAvatar(episode.title);
  const progress = getSavedPlaybackEntry(profile.id, episode);
  const duration = episode.duration ? `<span>${escapeHtml(formatDurationText(episode.duration))}</span>` : "";
  return `
    <article class="inline-episode-card ${inlineSeriesState.selectedEpisodeId === episode.id ? "active" : ""}" data-episode-id="${escapeHtml(episode.id)}">
      <img class="inline-episode-poster" src="${poster}" alt="${escapeHtml(episode.fullTitle || episode.title)}" />
      <div class="inline-episode-copy">
        <div class="episode-topline">
          <span class="episode-index">${episodeNumber}</span>
          ${duration}
        </div>
        <h4>${escapeHtml(episode.title || `Episódio ${episodeNumber}`)}</h4>
        <p>${escapeHtml(episode.plot || "Episódio disponível para reprodução.")}</p>
        ${progress ? `<div class="progress-meter"><span style="width:${getProgressPercent(progress)}%"></span></div>` : ""}
      </div>
      <button class="episode-play-btn" type="button" data-play-inline-episode="${escapeHtml(episode.id)}">Assistir</button>
    </article>
  `;
}

function renderInlineSeriesDetails() {
  if (!els.playerSeasonsSection || !els.playerSeasonSelect || !els.playerEpisodeList) return;
  const profile = getActiveProfile();
  const details = inlineSeriesState.details;
  const seasons = details?.seasons || [];

  if (!inlineSeriesState.seriesItem) {
    els.playerSeasonsSection.hidden = true;
    els.playerEpisodeList.innerHTML = "";
    return;
  }

  els.playerSeasonsSection.hidden = false;

  if (inlineSeriesState.loading) {
    els.playerEpisodeList.innerHTML = `<article class="empty-note">Carregando temporadas...</article>`;
    return;
  }

  if (!seasons.length) {
    els.playerEpisodeList.innerHTML = `<article class="empty-note">Nenhuma temporada encontrada para esta série.</article>`;
    return;
  }

  const activeSeason = seasons.find((season) => season.seasonNumber === inlineSeriesState.activeSeason) || seasons[0];
  els.playerSeasonSelect.innerHTML = seasons
    .map(
      (season) =>
        `<option value="${season.seasonNumber}" ${season.seasonNumber === activeSeason.seasonNumber ? "selected" : ""}>${escapeHtml(
          season.name || `Temporada ${season.seasonNumber || 1}`
        )}</option>`
    )
    .join("");
  inlineSeriesState.activeSeason = activeSeason.seasonNumber;
  els.playerEpisodeList.innerHTML = activeSeason.episodes.length
    ? activeSeason.episodes.map((episode) => renderInlineEpisodeCard(episode, profile)).join("")
    : `<article class="empty-note">Nenhum episódio nesta temporada.</article>`;
}

async function loadInlineSeriesDetails(seriesItem) {
  if (!seriesItem || !getSeriesIdentity(seriesItem)) {
    inlineSeriesState = { loading: false, seriesItem: null, details: null, activeSeason: null, selectedEpisodeId: null };
    renderInlineSeriesDetails();
    return;
  }

  inlineSeriesState = {
    ...inlineSeriesState,
    loading: true,
    seriesItem,
    details: null,
    activeSeason: inlineSeriesState.seriesItem?.id === seriesItem.id ? inlineSeriesState.activeSeason : null,
    selectedEpisodeId: null,
  };
  renderInlineSeriesDetails();

  try {
    const details = await loadSeriesDetails(seriesItem);
    inlineSeriesState = {
      ...inlineSeriesState,
      loading: false,
      details,
      activeSeason: inlineSeriesState.activeSeason || details.seasons[0]?.seasonNumber || 1,
    };
  } catch {
    inlineSeriesState = { ...inlineSeriesState, loading: false, details: { series: seriesItem, seasons: [] } };
  }
  renderInlineSeriesDetails();
}

function renderSeriesDetailsLegacy() {
  if (!els.seriesModal || !els.seriesModalTitle || !els.seriesSeasonTabs || !els.seriesEpisodeGrid) return;
  const state = currentSeriesState;

  if (els.seriesModalTitle) {
    els.seriesModalTitle.textContent = state.series?.title || "Serie";
  }
  if (els.seriesModalMeta) {
    const seasonCount = state.details?.seasons?.length || 0;
    const episodeCount =
      state.details?.seasons?.reduce((sum, season) => sum + (season.episodes?.length || 0), 0) || 0;
    els.seriesModalMeta.textContent = state.series
      ? `${seasonCount} temporadas · ${episodeCount} episodios`
      : "Detalhes da série";
  }
  if (els.seriesModalPoster) {
    els.seriesModalPoster.src = state.series?.logo || defaultAvatar(state.series?.title || "Serie");
    els.seriesModalPoster.alt = state.series?.title || "Serie";
  }
  if (els.seriesModalOverview) {
    els.seriesModalOverview.textContent =
      state.series?.plot || "Escolha uma temporada e um episódio para assistir.";
  }
  if (els.seriesModalStatus) {
    els.seriesModalStatus.textContent = state.loading
      ? "Carregando temporadas e episódios..."
      : state.error || "Temporadas e episódios prontos.";
  }

  const seasons = state.details?.seasons || [];
  const activeSeason = seasons.find((season) => season.seasonNumber === state.activeSeason) || seasons[0];
  if (els.seriesSeasonTabs) {
    els.seriesSeasonTabs.innerHTML = seasons.length
      ? seasons
          .map(
            (season) => `
              <button class="season-pill ${season.seasonNumber === state.activeSeason ? "active" : ""}" type="button" data-season-number="${season.seasonNumber}">
                ${escapeHtml(season.name)}
                <span>${season.episodes.length}</span>
              </button>
            `
          )
          .join("")
      : `<div class="empty-note">Nenhuma temporada encontrada.</div>`;
  }

  if (els.seriesEpisodeGrid) {
    els.seriesEpisodeGrid.innerHTML = activeSeason?.episodes?.length
      ? activeSeason.episodes
          .map(
            (episode) => `
              <article class="episode-card ${state.selectedEpisodeId === episode.id ? "active" : ""}" data-episode-id="${episode.id}">
                <img class="episode-poster" src="${episode.logo || state.series.logo || defaultAvatar(episode.title)}" alt="${escapeHtml(episode.fullTitle)}" />
                <div class="episode-copy">
                  <span class="chip">T${episode.seasonNumber || 1} · EP${episode.episodeNumber || ""}</span>
                  <h4>${escapeHtml(episode.title)}</h4>
                  <p>${escapeHtml(episode.plot || "Episodio disponível para reprodução.")}</p>
                  <div class="episode-actions">
                    <button class="card-button play-episode-button" type="button" data-play-episode="${escapeHtml(episode.id)}">Assistir</button>
                    <button class="card-button ghost-btn" type="button" data-queue-episode="${escapeHtml(episode.id)}">Continuar</button>
                  </div>
                </div>
              </article>
            `
          )
          .join("")
      : `<article class="empty-note">Nenhum episódio encontrado nesta temporada.</article>`;
  }

}

function renderSeriesDetails() {
  if (!els.seriesModal || !els.seriesModalTitle || !els.seriesSeasonTabs || !els.seriesEpisodeGrid) return;
  const state = currentSeriesState;
  const seasons = state.details?.seasons || [];
  const activeSeason = seasons.find((season) => season.seasonNumber === state.activeSeason) || seasons[0];
  const episodeCount = seasons.reduce((sum, season) => sum + (season.episodes?.length || 0), 0);

  if (els.seriesModalTitle) {
    els.seriesModalTitle.textContent = state.series?.title || "Serie";
  }
  if (els.seriesModalMeta) {
    els.seriesModalMeta.textContent = state.series
      ? `${seasons.length} temporadas · ${episodeCount} episodios`
      : "Detalhes da serie";
  }
  if (els.seriesModalPoster) {
    els.seriesModalPoster.src = state.series?.logo || defaultAvatar(state.series?.title || "Serie");
    els.seriesModalPoster.alt = state.series?.title || "Serie";
  }
  if (els.seriesModalOverview) {
    els.seriesModalOverview.textContent =
      state.series?.plot || "Escolha uma temporada e um episodio para assistir.";
  }
  if (els.seriesModalStatus) {
    els.seriesModalStatus.textContent = state.loading
      ? "Carregando temporadas e episodios..."
      : state.error || "Temporadas e episodios organizados.";
  }

  if (els.seriesSeasonTabs) {
    els.seriesSeasonTabs.innerHTML = seasons.length
      ? seasons
          .map(
            (season) => `
              <button class="season-pill ${season.seasonNumber === state.activeSeason ? "active" : ""}" type="button" data-season-number="${season.seasonNumber}">
                ${escapeHtml(season.name || `Temporada ${season.seasonNumber || 1}`)}
                <span>${season.episodes.length}</span>
              </button>
            `
          )
          .join("")
      : `<div class="empty-note">Nenhuma temporada encontrada.</div>`;
  }

  if (els.seriesEpisodeGrid) {
    els.seriesEpisodeGrid.innerHTML = activeSeason
      ? renderSeasonSection(activeSeason, state)
      : `<article class="empty-note">Nenhum episodio encontrado nesta serie.</article>`;
  }

}

async function loadSeriesDetails(seriesItem, force = false) {
  const seriesId = getSeriesIdentity(seriesItem);
  if (!seriesId) throw new Error("Series ID indisponivel.");
  if (!force && seriesDetailsCache.has(seriesId)) return seriesDetailsCache.get(seriesId);
  if (seriesDetailsLoading.has(seriesId)) return seriesDetailsLoading.get(seriesId);

  const promise = (async () => {
    const url = `/api/series-info?seriesId=${encodeURIComponent(seriesId)}&base=${encodeURIComponent(seriesItem.base || "")}`;
    const response = await withTimeout(fetch(url, { cache: "no-store" }), 15000, "Tempo esgotado");
    if (!response.ok) throw new Error(`Falha ao carregar série (${response.status})`);
    const payload = await response.json();
    const normalized = normalizeSeriesPayload(payload, seriesItem);
    seriesDetailsCache.set(seriesId, normalized);
    return normalized;
  })();

  seriesDetailsLoading.set(seriesId, promise);
  try {
    return await promise;
  } finally {
    seriesDetailsLoading.delete(seriesId);
  }
}

function openSeriesModalForItem(seriesItem) {
  const seriesId = getSeriesIdentity(seriesItem);
  currentSeriesState = {
    open: true,
    loading: true,
    error: "",
    series: seriesItem,
    details: null,
    activeSeason: currentSeriesState.activeSeason || 1,
    selectedEpisodeId: null,
  };
  renderSeriesDetails();
  openDialog(els.seriesModal);
  loadSeriesDetails(seriesItem)
    .then((details) => {
      currentSeriesState = {
        ...currentSeriesState,
        loading: false,
        error: "",
        details,
        activeSeason: details.seasons[0]?.seasonNumber || 1,
      };
      seriesDetailsCache.set(seriesId, details);
      renderSeriesDetails();
    })
    .catch((error) => {
      currentSeriesState = {
        ...currentSeriesState,
        loading: false,
        error: error instanceof Error ? error.message : "Falha ao carregar a série.",
      };
      renderSeriesDetails();
    });
}

function closeSeriesModal() {
  currentSeriesState = {
    open: false,
    loading: false,
    error: "",
    series: null,
    details: null,
    activeSeason: null,
    selectedEpisodeId: null,
  };
  closeDialog(els.seriesModal);
}

function getSeasonEpisodeById(seriesDetails, episodeId) {
  for (const season of seriesDetails?.seasons || []) {
    const match = season.episodes.find((episode) => episode.id === episodeId);
    if (match) return { season, episode: match };
  }
  return null;
}

function playMediaItem(profile, item, options = {}) {
  if (!item || !item.url) return;
  const restore = Number(options.restoreTime || 0);
  clearTimeout(playbackSaveTimer);
  playbackSaveTimer = null;
  activePlayback = {
    ...item,
    profileId: profile.id,
    progressKey: buildPlaybackKey(item),
  };
  playbackRestoreTime = restore > 0 ? restore : 0;
  selectedItemId = item.id;
  rememberItem(item.id);
  updateStreamingHero(profile, item);
  updateStreamingPlayer(profile, item);
  render();
}

function openSeriesEpisode(profile, episode, seriesItem, options = {}) {
  const episodeItem = {
    ...episode,
    kind: "episode",
    title: episode.fullTitle || `${seriesItem.title} - ${episode.title}`,
    episodeTitle: episode.title || episode.name || `Episodio ${episode.episodeNumber || ""}`,
    group: seriesItem.title,
    seriesTitle: seriesItem.title,
    plot: episode.plot || seriesItem.plot || "",
    duration: episode.duration || "",
    releaseDate: episode.releaseDate || episode.releasedate || seriesItem.year || "",
    progressKey: buildPlaybackKey(episode),
  };
  const saved = getSavedPlaybackEntry(profile.id, episodeItem);
  const resumeTime = options.startTime ?? saved?.currentTime ?? 0;
  closeSeriesModal();
  inlineSeriesState = { ...inlineSeriesState, selectedEpisodeId: episode.id };
  playMediaItem(profile, episodeItem, { restoreTime: resumeTime });
}

function syncTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });
}

function resetHomeView() {
  window.clearTimeout(searchRenderTimer);
  activeTab = "all";
  activeGroup = "all";
  searchTerm = "";
  selectedItemId = null;
  inlineSeriesState = { loading: false, seriesItem: null, details: null, activeSeason: null, selectedEpisodeId: null };
  if (els.searchInput) els.searchInput.value = "";
  if (els.groupFilter) els.groupFilter.value = "all";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function exitToProfileGate() {
  window.clearTimeout(searchRenderTimer);
  activeTab = "all";
  searchTerm = "";
  if (els.searchInput) els.searchInput.value = "";
  openProfileGate();
}

function getCarouselTrack(targetId) {
  return targetId ? document.getElementById(targetId) : null;
}

function updateCarouselControls() {
  document.querySelectorAll(".carousel-wrapper").forEach((wrapper) => {
    const track = wrapper.querySelector(".carousel-track");
    const left = wrapper.querySelector('[data-carousel-dir="-1"]');
    const right = wrapper.querySelector('[data-carousel-dir="1"]');
    if (!track || !left || !right) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const canScroll = maxScroll > 4;
    left.disabled = !canScroll || track.scrollLeft <= 4;
    right.disabled = !canScroll || track.scrollLeft >= maxScroll - 4;
    wrapper.classList.toggle("is-scrollable", canScroll);
  });
}

function scrollCarousel(targetId, direction) {
  const track = getCarouselTrack(targetId);
  if (!track) return;
  track.scrollBy({
    left: track.clientWidth * 0.8 * direction,
    behavior: "smooth",
  });
  setTimeout(updateCarouselControls, 260);
}

function scheduleSearchRender() {
  window.clearTimeout(searchRenderTimer);
  searchRenderTimer = window.setTimeout(() => {
    searchTerm = els.searchInput?.value || "";
    if (searchTerm.trim()) {
      activeTab = "all";
    }
    render();
  }, SEARCH_RENDER_DELAY_MS);
}

function shouldPauseProfileMosaic() {
  return (
    document.hidden ||
    !document.body.classList.contains("profile-gate") ||
    document.body.classList.contains("light-mode") ||
    Boolean(document.querySelector(".profile-card:hover, .profile-card:focus-within"))
  );
}

function rotateProfileMosaics() {
  if (shouldPauseProfileMosaic()) return;
  document.querySelectorAll(".profile-card:not(.profile-create-card) .profile-mosaic").forEach((mosaic) => {
    const images = Array.from(mosaic.querySelectorAll(".profile-mosaic-img"));
    if (images.length < 3) return;
    mosaic.classList.add("is-swapping");
    window.setTimeout(() => {
      const first = images[0];
      const second = images[1];
      if (first) mosaic.append(first);
      if (second && images.length > 4) mosaic.append(second);
      mosaic.classList.remove("is-swapping");
    }, 260);
  });
}

function restartProfileMosaicRotation() {
  window.clearInterval(profileMosaicTimer);
  if (!document.body.classList.contains("profile-gate")) return;
  profileMosaicTimer = window.setInterval(rotateProfileMosaics, 8000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDurationText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const clock = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    const hours = clock[3] ? Number(clock[1]) : 0;
    const minutes = clock[3] ? Number(clock[2]) : Number(clock[1]);
    const total = hours * 60 + minutes;
    return total > 0 ? `${total} min` : text;
  }
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${Math.max(1, Math.round(numeric / 60))} min`;
  }
  return text;
}

function getItemYear(item) {
  const text = `${item?.year || ""} ${item?.releaseDate || ""} ${item?.title || ""}`;
  return text.match(/\b(19|20)\d{2}\b/)?.[0] || "";
}

function getHeroTitle(item) {
  if (!item) return "Biblioteca";
  if (item.kind === "episode") return item.seriesTitle || item.group || item.title || "Serie";
  return item.title || "Biblioteca";
}

function getEpisodeDisplayTitle(item) {
  if (!item) return "Escolha um conteudo para comecar";
  if (item.kind !== "episode") {
    return item.type === "series" ? "Escolha uma temporada" : item.group || "Pronto para assistir";
  }
  return item.episodeTitle || item.name || item.title || `Episodio ${item.episodeNumber || ""}`;
}

function getHeroMetaLine(item) {
  if (!item) return "Busque filmes, series e animes";
  const year = getItemYear(item);
  const duration = formatDurationText(item.duration);
  if (item.kind === "episode") {
    return [
      `Temporada ${item.seasonNumber || 1}`,
      `Episodio ${item.episodeNumber || 1}`,
      year,
      duration,
    ]
      .filter(Boolean)
      .join(" • ");
  }
  return [getStreamingItemTypeLabel(item), year, duration, item.group || ""].filter(Boolean).join(" • ");
}

function getHeroDescription(item) {
  if (!item) {
    return "Interface limpa, moderna e otimizada para buscar o que voce quer assistir.";
  }
  if (item.plot) return item.plot;
  if (item.kind === "episode") return "Episodio disponivel para reproducao. O progresso fica salvo neste perfil.";
  if (item.type === "series") return "Escolha uma temporada abaixo e veja os episodios organizados.";
  return "Continue assistindo, favorite ou abra as opcoes deste titulo.";
}

function getActiveLibraryItem(profile) {
  if (!profile) return null;
  return profile.library.find((item) => item.id === selectedItemId) || null;
}

function getCurrentHeroItem(profile) {
  return activePlayback && activePlayback.profileId === profile.id ? activePlayback : getActiveLibraryItem(profile);
}

function updateFeaturedBanner(profile) {
  if (!els.featuredTitle || !els.featuredDescription) return;
  const featured =
    getCurrentHeroItem(profile) ||
    profile.library.find((item) => item.logo && item.type === "movie") ||
    profile.library.find((item) => item.logo) ||
    null;
  if (!featured) {
    els.featuredTitle.textContent = "Sua biblioteca cinematografica";
    els.featuredDescription.textContent =
      "Pesquise, continue de onde parou e encontre filmes, series e animes em uma interface feita para maratonar.";
    els.featuredBanner?.style.removeProperty("--featured-image");
    return;
  }
  els.featuredTitle.textContent = getHeroTitle(featured);
  els.featuredDescription.textContent = getHeroDescription(featured);
  if (els.featuredBanner && featured.logo) {
    const safeUrl = String(featured.logo).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    els.featuredBanner.style.setProperty("--featured-image", `url("${safeUrl}")`);
  } else {
    els.featuredBanner?.style.removeProperty("--featured-image");
  }
}

function updateHomeRails(profile) {
  renderRail(els.recentGrid, uniqueItems(profile.library).slice(0, 18), profile, "O catalogo ainda esta carregando.");
  renderRail(
    els.popularMoviesGrid,
    pickRailItems(profile, (item) => item.type === "movie" && !isAnimeItem(item), 18),
    profile,
    "Nenhum filme encontrado ainda."
  );
  renderRail(
    els.seriesGrid,
    pickRailItems(profile, (item) => item.type === "series" && !isAnimeItem(item), 18),
    profile,
    "Nenhuma serie encontrada ainda."
  );
  renderRail(els.animeGrid, pickRailItems(profile, isAnimeItem, 18), profile, "Nenhum anime encontrado ainda.");
  renderRail(
    els.recommendedGrid,
    uniqueItems(profile.library.filter((item) => item.id !== selectedItemId)).slice(18, 36),
    profile,
    "Carregando recomendacoes."
  );
}

function updateSimilarRail(profile, selected) {
  if (!els.similarGrid) return;
  if (!selected) {
    renderRail(els.similarGrid, pickRailItems(profile, (item) => item.logo, 14), profile, "Selecione um conteudo para ver semelhantes.");
    return;
  }
  const selectedGroup = normalizeText(selected.group || selected.seriesTitle || "");
  const selectedType = selected.type || selected.kind;
  const similar = profile.library.filter((item) => {
    if (item.id === selected.id) return false;
    return (
      (selectedGroup && normalizeText(item.group || "").includes(selectedGroup)) ||
      item.type === selectedType ||
      (isAnimeItem(selected) && isAnimeItem(item))
    );
  });
  renderRail(els.similarGrid, uniqueItems(similar).slice(0, 14), profile, "Nenhum conteudo semelhante encontrado.");
}

function toggleFavorite(profile, itemId) {
  if (!profile || !itemId) return;
  const index = profile.favorites.indexOf(itemId);
  if (index >= 0) {
    profile.favorites.splice(index, 1);
  } else {
    profile.favorites.push(itemId);
  }
  rerender();
  queueProfileSync();
}

function updateHero(profile, item) {
  if (!els.heroHeadline || !els.heroMeta || !els.heroDescription) return;

  if (!item) {
    els.heroHeadline.textContent = "Biblioteca";
    els.heroMeta.textContent = "Pesquise para encontrar resultados.";
    els.heroDescription.textContent = "Interface limpa, moderna e otimizada para buscar o que você quer assistir.";
    return;
  }

  els.heroHeadline.textContent = item.title;
  els.heroMeta.textContent = `${item.group || "Geral"} · ${item.type === "series" ? "Series" : "Filme"}`;
  els.heroDescription.textContent =
    item.type === "series"
      ? "Abra a série para ver temporadas e episódios organizados."
      : "Clique para continuar a reprodução ou voltar do ponto salvo.";
}

function updatePlayer(profile, item) {
  if (!els.player || !els.playerEmpty) return;

  const playable = item && item.url && item.kind !== "series";
  if (!playable) {
    activePlayback = null;
    playbackRestoreTime = 0;
    lastPlaybackSaveAt = 0;
    els.player.removeAttribute("src");
    els.player.load();
    els.playerEmpty.style.display = "grid";
    els.playerEmpty.textContent = item && item.kind === "series" ? "Abra a série para escolher um episódio" : "Nenhuma midia selecionada";
    els.downloadLink.href = "#";
    els.downloadLink.textContent = "Baixar";
    els.downloadLink.setAttribute("aria-disabled", "true");
    els.openLink.onclick = null;
    return;
  }

  els.playerEmpty.style.display = "none";
  clearTimeout(playbackSaveTimer);
  playbackSaveTimer = null;
  activePlayback = {
    ...item,
    profileId: profile.id,
    progressKey: buildPlaybackKey(item),
  };
  lastPlaybackSaveAt = 0;
  els.player.src = item.url;
  els.player.load();
  els.downloadLink.href = item.url;
  els.downloadLink.textContent = "Baixar";
  els.downloadLink.removeAttribute("aria-disabled");
  els.openLink.onclick = () => window.open(item.url, "_blank", "noopener,noreferrer");
}

function selectItem(itemId, profile = getActiveProfile()) {
  const item = profile.library.find((entry) => entry.id === itemId);
  if (!item) return;
  if (item.kind === "series" || item.type === "series") {
    selectedItemId = item.id;
    updateHero(profile, item);
    updatePlayer(profile, null);
    render();
    openSeriesModalForItem(item);
    return;
  }
  selectedItemId = itemId;
  const saved = getSavedPlaybackEntry(profile.id, item);
  playbackRestoreTime = saved?.currentTime || 0;
  rememberItem(itemId);
  updateHero(profile, item);
  updatePlayer(profile, item);
  render();
}

function updateStreamingHero(profile, item) {
  if (!els.heroHeadline || !els.heroMeta || !els.heroDescription) return;

  if (!item) {
    els.heroHeadline.textContent = "Biblioteca";
    els.heroMeta.textContent = "Busque filmes, series e animes";
    if (els.heroEpisodeTitle) els.heroEpisodeTitle.textContent = "Escolha um conteudo para comecar";
    els.heroDescription.textContent = "Interface limpa, moderna e otimizada para buscar o que voce quer assistir.";
    if (els.heroContinueBtn) {
      els.heroContinueBtn.textContent = "Buscar agora";
      els.heroContinueBtn.disabled = false;
    }
    if (els.heroFavoriteBtn) {
      els.heroFavoriteBtn.textContent = "Favoritar";
      els.heroFavoriteBtn.disabled = true;
    }
    return;
  }

  const libraryItem = getActiveLibraryItem(profile);
  const favoriteTarget = libraryItem || (item.kind !== "episode" ? item : null);
  const isFavorite = favoriteTarget ? profile.favorites.includes(favoriteTarget.id) : false;

  els.heroHeadline.textContent = getHeroTitle(item);
  els.heroMeta.textContent = getHeroMetaLine(item);
  if (els.heroEpisodeTitle) els.heroEpisodeTitle.textContent = getEpisodeDisplayTitle(item);
  els.heroDescription.textContent = getHeroDescription(item);
  if (els.heroContinueBtn) {
    els.heroContinueBtn.textContent = item.kind === "series" || item.type === "series" ? "Escolher temporada" : "Continuar assistindo";
    els.heroContinueBtn.disabled = false;
  }
  if (els.heroFavoriteBtn) {
    els.heroFavoriteBtn.textContent = isFavorite ? "Remover favorito" : "Favoritar";
    els.heroFavoriteBtn.disabled = !favoriteTarget;
  }
}

function updateStreamingPlayer(profile, item) {
  if (!els.player || !els.playerEmpty) return;

  const playable = item && item.url && item.kind !== "series";
  if (!playable) {
    if (activePlayback && activePlayback.profileId === profile.id) saveActivePlaybackProgress();
    activePlayback = null;
    playbackRestoreTime = 0;
    lastPlaybackSaveAt = 0;
    els.player.removeAttribute("src");
    els.player.load();
    els.playerEmpty.style.display = "grid";
    els.playerEmpty.textContent = item && (item.kind === "series" || item.type === "series")
      ? "Escolha uma temporada e um episodio"
      : "Nenhuma midia selecionada";
    if (els.downloadLink) {
      els.downloadLink.href = "#";
      els.downloadLink.setAttribute("aria-disabled", "true");
    }
    if (els.openLink) els.openLink.onclick = null;
    return;
  }

  els.playerEmpty.style.display = "none";
  activePlayback = {
    ...item,
    profileId: profile.id,
    progressKey: buildPlaybackKey(item),
  };
  lastPlaybackSaveAt = 0;
  if (els.player.getAttribute("src") !== item.url) {
    clearTimeout(playbackSaveTimer);
    playbackSaveTimer = null;
    els.player.src = item.url;
    els.player.load();
  }
  if (els.downloadLink) {
    els.downloadLink.href = item.url;
    els.downloadLink.removeAttribute("aria-disabled");
  }
  if (els.openLink) {
    els.openLink.onclick = () => window.open(item.url, "_blank", "noopener,noreferrer");
  }
}

function selectStreamingItem(itemId, profile = getActiveProfile()) {
  const item = profile.library.find((entry) => entry.id === itemId);
  if (!item) return;
  selectedItemId = item.id;
  rememberItem(item.id);

  if (item.kind === "series" || item.type === "series") {
    activePlayback = null;
    playbackRestoreTime = 0;
    inlineSeriesState = {
      loading: true,
      seriesItem: item,
      details: null,
      activeSeason: null,
      selectedEpisodeId: null,
    };
    updateStreamingHero(profile, item);
    updateStreamingPlayer(profile, item);
    render();
    loadInlineSeriesDetails(item);
    els.playerSeasonsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  inlineSeriesState = { loading: false, seriesItem: null, details: null, activeSeason: null, selectedEpisodeId: null };
  const saved = getSavedPlaybackEntry(profile.id, item);
  playbackRestoreTime = saved?.currentTime || 0;
  updateStreamingHero(profile, item);
  updateStreamingPlayer(profile, item);
  render();
}

function render() {
  const profile = getActiveProfile();
  const library = profile.library;
  const favorites = library.filter((item) => profile.favorites.includes(item.id));
  const continueItems = getProfileContinueItems(profile);
  const visible = getVisibleItems(profile);
  const visibleForRender = visible.slice(0, MAX_SEARCH_RESULTS);
  const movieCount = library.filter((item) => item.type === "movie").length;
  const seriesCount = library.filter((item) => item.type === "series").length;
  const query = normalizeText(searchTerm);
  const hasQuery = query.length > 0;
  const titleTab = hasQuery && activeTab === "favorites" ? "all" : activeTab;
  const selected =
    library.find((item) => item.id === selectedItemId) ||
    (activePlayback && activePlayback.profileId === profile.id ? activePlayback : null);

  if (els.activeAvatar) {
    els.activeAvatar.src = renderAvatar(profile);
    els.activeAvatar.alt = `Foto de ${profile.name}`;
  }
  if (els.menuAvatar) {
    els.menuAvatar.src = renderAvatar(profile);
    els.menuAvatar.alt = `Foto de ${profile.name}`;
  }
  if (els.activeName) els.activeName.textContent = profile.name;
  if (els.activeMeta) {
    els.activeMeta.textContent = getStreamingProfileMeta(profile);
  }
  if (els.profileLibraryCount) {
    els.profileLibraryCount.textContent = `${library.length} titulos carregados`;
  }

  if (els.profileGrid) {
    const profileCards = state.profiles
      .map(
        (item, index) => `
          <button
            class="profile-card theme-${normalizeProfileTheme(item.theme, index)} ${item.id === profile.id ? "active" : ""}"
            data-profile-id="${item.id}"
            type="button"
            aria-label="${profileManageMode ? `Editar ${item.name}` : `Entrar no perfil ${item.name}`}"
          >
            <span class="profile-card-glow"></span>
            <span class="profile-avatar-wrap">
              <img class="profile-card-avatar" src="${renderAvatar(item)}" alt="${escapeHtml(item.name)}" loading="lazy" />
              ${item.id === profile.id ? `<span class="profile-check" aria-hidden="true">&#10003;</span>` : ""}
            </span>
            <span class="profile-card-copy">
              <strong>${escapeHtml(item.name)}</strong>
              <small>Seus favoritos</small>
            </span>
            <span class="profile-mosaic" aria-hidden="true">
              ${renderProfileMosaic(item, index)}
            </span>
            <span class="profile-card-footer">${profileManageMode ? "Editar perfil" : profileCardLabel(index, item, profile.id)}</span>
          </button>
        `
      )
      .join("");
    const createCard =
      profileManageMode && state.profiles.length < MAX_PROFILES
        ? `
          <button class="profile-card profile-create-card" data-create-profile type="button" aria-label="Criar novo perfil">
            <span class="profile-create-icon">+</span>
            <span class="profile-card-copy">
              <strong>Novo perfil</strong>
              <small>Criar universo</small>
            </span>
          </button>
        `
        : "";
    els.profileGrid.innerHTML = `${profileCards}${createCard}`;
  }
  document.body.classList.toggle("profile-manage-mode", profileManageMode);
  if (els.editProfileBtn) {
    els.editProfileBtn.innerHTML = profileManageMode ? "Concluir" : "&#9881; Gerenciar perfis";
  }

  if (els.statItems) els.statItems.textContent = String(library.length);
  if (els.statMovies) els.statMovies.textContent = String(movieCount);
  if (els.statSeries) els.statSeries.textContent = String(seriesCount);
  if (els.resultsCount) els.resultsCount.textContent = String(visible.length);
  if (els.libraryTitle) {
    els.libraryTitle.textContent =
      hasQuery
        ? titleTab === "all"
          ? "Resultados da busca"
          : titleTab === "movies"
            ? "Filmes encontrados"
            : titleTab === "series"
              ? "Series encontradas"
              : "Favoritos encontrados"
        : "Pesquise para ver resultados";
  }

  if (els.groupFilter) {
    els.groupFilter.innerHTML = buildGroupOptions(profile);
    els.groupFilter.value = activeGroup;
  }

  if (els.catalogStatus) {
    els.catalogStatus.textContent = profile.library.length > 0 ? "PLAYLIST FUNCIONANDO" : "PLAYLIST COM ERRO";
    els.catalogStatus.dataset.tone = profile.library.length > 0 ? "good" : "bad";
  }
  if (els.catalogSource) {
    els.catalogSource.textContent = profile.library.length > 0
      ? "A playlist está funcionando."
      : "A playlist não foi carregada.";
    els.catalogSource.dataset.tone = profile.library.length > 0 ? "good" : "bad";
  }
  if (els.activeAvatar) {
    els.activeAvatar.src = renderAvatar(profile);
  }
  if (els.activeMeta) {
    els.activeMeta.textContent = getProfileMeta(profile);
  }

  if (els.activeMeta) {
    els.activeMeta.textContent = getStreamingProfileMeta(profile);
  }
  if (els.catalogStatus) {
    els.catalogStatus.textContent = profile.library.length > 0 ? "Catálogo conectado" : "Catálogo desconectado";
    els.catalogStatus.dataset.tone = profile.library.length > 0 ? "good" : "bad";
  }
  if (els.catalogSource) {
    els.catalogSource.textContent = profile.library.length > 0 ? "Pronto" : "Aguardando";
    els.catalogSource.dataset.tone = profile.library.length > 0 ? "good" : "bad";
  }

  updateStreamingHero(profile, selected);
  updateStreamingPlayer(profile, selected);
  updateFeaturedBanner(profile);
  updateHomeRails(profile);
  updateSimilarRail(profile, selected);
  renderInlineSeriesDetails();

  if (els.libraryGrid) {
    els.libraryGrid.innerHTML = hasQuery
      ? visible.length
        ? `${visibleForRender.map((item) => renderStreamingCard(item, profile)).join("")}${renderSearchLimitNote(visible.length, visibleForRender.length)}`
        : renderEmptyState(profile)
      : renderEmptyState(profile);
  }
  if (els.favoriteGrid) {
    els.favoriteGrid.innerHTML = favorites.length
      ? favorites.map((item) => renderStreamingCard(item, profile)).join("")
      : `<article class="empty-note">Nenhum favorito salvo ainda.</article>`;
  }
  els.favoritesSection?.classList.toggle("is-empty", favorites.length === 0);
  if (els.continueGrid) els.continueGrid.innerHTML = renderHistory(profile);
  els.continueSection?.classList.toggle("is-empty", continueItems.length === 0);

  document.body.classList.toggle("search-mode", hasQuery);

  syncTabs();
  requestAnimationFrame(updateCarouselControls);
  restartProfileMosaicRotation();
}

function rerender() {
  saveState();
  render();
}

els.newProfileForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = toText(els.newProfileName.value);
  if (!name) {
    setStatus("Digite um nome para criar o perfil.");
    return;
  }
  const profile = createProfile(name);
  state.profiles.unshift(profile);
  state.activeProfileId = profile.id;
  els.newProfileName.value = "";
  setStatus(`Perfil "${name}" criado.`);
  rerender();
  queueProfileSync();
});

els.avatarInput?.addEventListener("change", async () => {
  const file = els.avatarInput.files?.[0];
  if (!file) return;
  const profile = getActiveProfile();
  try {
    profile.avatar = await fileToAvatarDataUrl(file, profile.name);
  } catch {
    profile.avatar = defaultAvatar(profile.name);
  }
  setStatus("Foto do perfil atualizada.");
  rerender();
  queueProfileSync();
  els.avatarInput.value = "";
});

els.profileGrid?.addEventListener("click", (event) => {
  const createButton = event.target.closest("[data-create-profile]");
  if (createButton) {
    createManagedProfile();
    return;
  }
  const button = event.target.closest("[data-profile-id]");
  if (!button) return;
  const profile = getProfileById(button.dataset.profileId);
  if (!profile) return;
  if (profileManageMode) {
    openProfileEditor(profile);
    return;
  }
  setActiveProfile(button.dataset.profileId);
});

els.editProfileBtn?.addEventListener("click", () => {
  profileManageMode = !profileManageMode;
  render();
});

els.exitBtn?.addEventListener("click", () => {
  exitToProfileGate();
});

els.quickExitBtn?.addEventListener("click", () => {
  exitToProfileGate();
});

els.closeProfileModal?.addEventListener("click", () => {
  closeProfileEditor();
});

els.profileEditForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const profile = getProfileById(els.profileModal?.dataset.profileId) || getActiveProfile();
  const name = toText(els.editProfileName?.value);
  if (name) profile.name = name;
  profile.theme = normalizeProfileTheme(els.editProfileTheme?.value, state.profiles.indexOf(profile));

  const file = els.editProfileAvatar?.files?.[0];
  if (file) {
    profile.avatar = await fileToAvatarDataUrl(file, profile.name);
  }

  closeProfileEditor();
  rerender();
  queueProfileSync();
});

els.editProfileAvatar?.addEventListener("change", async () => {
  const profile = getProfileById(els.profileModal?.dataset.profileId) || getActiveProfile();
  const file = els.editProfileAvatar.files?.[0];
  if (!els.editProfileAvatarPreview) return;
  if (!file) {
    els.editProfileAvatarPreview.src = renderAvatar(profile);
    return;
  }
  els.editProfileAvatarPreview.src = await fileToAvatarDataUrl(file, profile.name);
});

els.deleteProfileBtn?.addEventListener("click", () => {
  deleteProfile(els.profileModal?.dataset.profileId);
});

els.tabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  if (button.dataset.tab === "all") {
    resetHomeView();
    return;
  }
  activeTab = button.dataset.tab;
  render();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-carousel-target]");
  if (!button) return;
  scrollCarousel(button.dataset.carouselTarget, Number(button.dataset.carouselDir || 1));
});

document.addEventListener(
  "error",
  (event) => {
    const image = event.target?.closest?.("[data-profile-mosaic-img]");
    if (!image || image.dataset.fallbackApplied === "true") return;
    image.dataset.fallbackApplied = "true";
    image.src = image.dataset.fallback || fallbackPoster();
  },
  true
);

document.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) return;
  const button = event.target.closest?.("[data-carousel-target]");
  if (!button) return;
  event.preventDefault();
  const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : Number(button.dataset.carouselDir || 1);
  scrollCarousel(button.dataset.carouselTarget, direction);
});

document.addEventListener("keydown", (event) => {
  if (!document.body.classList.contains("profile-gate")) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const focusables = [...document.querySelectorAll(".profile-card, .manage-profiles-btn")].filter(
    (element) => !element.disabled
  );
  if (!focusables.length) return;
  const currentIndex = Math.max(0, focusables.indexOf(document.activeElement));
  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const nextIndex = (currentIndex + direction + focusables.length) % focusables.length;
  event.preventDefault();
  focusables[nextIndex]?.focus();
});

document.querySelectorAll(".carousel-track").forEach((track) => {
  track.addEventListener("scroll", () => requestAnimationFrame(updateCarouselControls), { passive: true });
});

window.addEventListener("resize", () => requestAnimationFrame(updateCarouselControls));

els.searchInput?.addEventListener("input", () => {
  scheduleSearchRender();
});

els.groupFilter?.addEventListener("change", () => {
  activeGroup = els.groupFilter.value;
  render();
});

els.profileMenuBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = !els.profileMenuPanel?.hidden;
  if (els.profileMenuPanel) els.profileMenuPanel.hidden = isOpen;
  els.profileMenuBtn.setAttribute("aria-expanded", String(!isOpen));
});

els.editProfileMenuBtn?.addEventListener("click", () => {
  if (els.profileMenuPanel) els.profileMenuPanel.hidden = true;
  els.profileMenuBtn?.setAttribute("aria-expanded", "false");
  openProfileEditor(getActiveProfile());
});

document.addEventListener("click", (event) => {
  if (!els.profileMenuPanel || els.profileMenuPanel.hidden) return;
  if (event.target.closest(".profile-menu")) return;
  els.profileMenuPanel.hidden = true;
  els.profileMenuBtn?.setAttribute("aria-expanded", "false");
});

document.querySelectorAll("[data-focus-search]").forEach((button) => {
  button.addEventListener("click", () => {
    els.searchInput?.focus();
    els.searchInput?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

document.querySelectorAll("[data-scroll-continue]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById("continue-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

els.heroFavoriteBtn?.addEventListener("click", () => {
  const profile = getActiveProfile();
  const item = getActiveLibraryItem(profile);
  if (!item) return;
  toggleFavorite(profile, item.id);
});

els.heroContinueBtn?.addEventListener("click", () => {
  const profile = getActiveProfile();
  const item = getCurrentHeroItem(profile);
  if (!item) {
    els.searchInput?.focus();
    return;
  }
  if (item.kind === "series" || item.type === "series") {
    if (!inlineSeriesState.seriesItem || inlineSeriesState.seriesItem.id !== item.id) loadInlineSeriesDetails(item);
    els.playerSeasonsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const saved = getSavedPlaybackEntry(profile.id, item);
  playMediaItem(profile, item, { restoreTime: saved?.currentTime || 0 });
});

els.playerSeasonSelect?.addEventListener("change", () => {
  const seasonNumber = Number(els.playerSeasonSelect.value || 0);
  if (!Number.isFinite(seasonNumber) || seasonNumber <= 0) return;
  inlineSeriesState = { ...inlineSeriesState, activeSeason: seasonNumber, selectedEpisodeId: null };
  renderInlineSeriesDetails();
});

els.playerEpisodeList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-play-inline-episode]");
  const card = event.target.closest("[data-episode-id]");
  const episodeId = button?.dataset.playInlineEpisode || card?.dataset.episodeId;
  if (!episodeId || !inlineSeriesState.details || !inlineSeriesState.seriesItem) return;
  const found = getSeasonEpisodeById(inlineSeriesState.details, episodeId);
  if (!found) return;
  inlineSeriesState = { ...inlineSeriesState, selectedEpisodeId: found.episode.id };
  const profile = getActiveProfile();
  const saved = getSavedPlaybackEntry(profile.id, found.episode);
  openSeriesEpisode(profile, found.episode, inlineSeriesState.seriesItem, {
    startTime: saved?.currentTime || 0,
  });
});

els.clearHistory?.addEventListener("click", () => {
  clearTimeout(playbackSaveTimer);
  playbackSaveTimer = null;
  activePlayback = null;
  playbackRestoreTime = 0;
  lastPlaybackSaveAt = 0;
  clearAllPlaybackProgress();
  clearAllHistoryStorage();
  render();
});

els.importForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isImporting) return;
  const profile = getActiveProfile();
  const url = toText(els.m3uUrl.value);

  isImporting = true;
  if (els.importButton) {
    els.importButton.disabled = true;
    els.importButton.textContent = "Carregando...";
  }
  setStatus("Carregando playlist automatica...");

  try {
    if (!url) {
      setStatus("Playlist automatica indisponivel.", "error");
      return;
    }

    const text = await fetchTextWithFallback(url);
    const items = parseM3U(text);
    if (!items.length) {
      setStatus("Nao encontrei filmes ou series validos nessa lista.", "error");
      return;
    }

    importItemsIntoProfile(profile, items);
    localStorage.setItem(LAST_M3U_URL_KEY, url);
    setStatus(`${profile.library.length} itens carregados com sucesso.`);
    rerender();
  } catch (error) {
    setStatus(
      `Nao foi possivel carregar esse link. ${error instanceof Error ? error.message : "Tente novamente."}`,
      "error"
    );
  } finally {
    isImporting = false;
    if (els.importButton) {
      els.importButton.disabled = false;
      els.importButton.textContent = "Carregar";
    }
  }
});

function handleMediaGridClick(event) {
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    const profile = getActiveProfile();
    const itemId = favoriteButton.dataset.favorite;
    toggleFavorite(profile, itemId);
    return;
  }

  const card = event.target.closest("[data-item-id]");
  if (card) {
      selectStreamingItem(card.dataset.itemId);
  }
}

els.libraryGrid?.addEventListener("click", handleMediaGridClick);
els.favoriteGrid?.addEventListener("click", handleMediaGridClick);
els.recentGrid?.addEventListener("click", handleMediaGridClick);
els.popularMoviesGrid?.addEventListener("click", handleMediaGridClick);
els.seriesGrid?.addEventListener("click", handleMediaGridClick);
els.animeGrid?.addEventListener("click", handleMediaGridClick);
els.recommendedGrid?.addEventListener("click", handleMediaGridClick);
els.similarGrid?.addEventListener("click", handleMediaGridClick);

els.libraryGrid?.addEventListener("dblclick", (event) => {
  const card = event.target.closest("[data-item-id]");
  if (!card) return;
  const profile = getActiveProfile();
  const item = profile.library.find((entry) => entry.id === card.dataset.itemId);
  if (item) window.open(item.url, "_blank", "noopener,noreferrer");
});

els.continueGrid?.addEventListener("click", (event) => {
  const continueButton = event.target.closest("[data-continue-progress]");
  if (continueButton) {
    const profile = getActiveProfile();
    const entry = getProfileProgress(profile.id)[continueButton.dataset.continueProgress];
    if (entry) playProgressEntry(profile, entry);
    return;
  }

  const restartButton = event.target.closest("[data-restart-progress]");
  if (restartButton) {
    const profile = getActiveProfile();
    const entry = getProfileProgress(profile.id)[restartButton.dataset.restartProgress];
    if (entry) playProgressEntry(profile, entry, { restart: true });
    return;
  }

  const progressCard = event.target.closest("[data-progress-key]");
  if (progressCard) {
    const profile = getActiveProfile();
    const entry = getProfileProgress(profile.id)[progressCard.dataset.progressKey];
    if (entry) playProgressEntry(profile, entry);
    return;
  }

  const card = event.target.closest("[data-item-id]");
  if (card) selectStreamingItem(card.dataset.itemId);
});

els.player?.addEventListener("error", () => {
  if (els.playerEmpty) {
    els.playerEmpty.style.display = "grid";
    els.playerEmpty.textContent = "O player nao conseguiu abrir essa midia.";
  }
});

els.player?.addEventListener("loadedmetadata", () => {
  if (!els.player || !activePlayback) return;
  if (playbackRestoreTime > 0) {
    const maxSeek = Math.max(0, Number(els.player.duration || 0) - 5);
    const restore = Math.min(playbackRestoreTime, maxSeek || playbackRestoreTime);
    if (restore > 0) {
      try {
        els.player.currentTime = restore;
      } catch {}
    }
    playbackRestoreTime = 0;
  }
});

els.player?.addEventListener("timeupdate", () => {
  if (!activePlayback || !els.player) return;
  const now = Date.now();
  if (now - lastPlaybackSaveAt >= PLAYBACK_SAVE_INTERVAL_MS) {
    saveActivePlaybackProgress();
    return;
  }
  clearTimeout(playbackSaveTimer);
  playbackSaveTimer = setTimeout(() => {
    saveActivePlaybackProgress();
  }, PLAYBACK_SAVE_INTERVAL_MS);
});

els.player?.addEventListener("pause", () => {
  if (!activePlayback || !els.player) return;
  clearTimeout(playbackSaveTimer);
  saveActivePlaybackProgress();
});

els.player?.addEventListener("seeked", () => {
  if (!activePlayback || !els.player) return;
  clearTimeout(playbackSaveTimer);
  saveActivePlaybackProgress();
});

els.player?.addEventListener("ended", () => {
  if (!activePlayback || !els.player) return;
  clearTimeout(playbackSaveTimer);
  saveActivePlaybackProgress({ completed: true });
});

window.addEventListener("pagehide", () => {
  clearTimeout(playbackSaveTimer);
  saveActivePlaybackProgress();
});

window.addEventListener("beforeunload", () => {
  clearTimeout(playbackSaveTimer);
  saveActivePlaybackProgress();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    clearTimeout(playbackSaveTimer);
    saveActivePlaybackProgress();
  } else if (!els.profileModal?.open) {
    loadProfileSync();
  }
});

window.addEventListener("focus", () => {
  if (els.profileModal?.open) return;
  loadProfileSync();
});

document.addEventListener("click", (event) => {
  const playButton = event.target.closest(".play-button");
  if (!playButton) return;
  const continueButton = event.target.closest("[data-continue-progress]");
  if (continueButton) {
    const profile = getActiveProfile();
    const entry = getProfileProgress(profile.id)[continueButton.dataset.continueProgress];
    if (entry) playProgressEntry(profile, entry);
    return;
  }
  const card = event.target.closest("[data-item-id]");
  if (card) selectStreamingItem(card.dataset.itemId);
});

els.closeSeriesModal?.addEventListener("click", () => {
  closeSeriesModal();
});

els.seriesModal?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSeriesModal();
});

els.seriesSeasonTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-season-number]");
  if (!button) return;
  const seasonNumber = Number(button.dataset.seasonNumber || 0);
  if (!Number.isFinite(seasonNumber)) return;
  currentSeriesState = { ...currentSeriesState, activeSeason: seasonNumber, selectedEpisodeId: null };
  renderSeriesDetails();
});

els.seriesEpisodeGrid?.addEventListener("click", (event) => {
  const playButton = event.target.closest("[data-play-episode]");
  const queueButton = event.target.closest("[data-queue-episode]");
  if (!playButton && !queueButton) return;

  const episodeId = playButton?.dataset.playEpisode || queueButton?.dataset.queueEpisode;
  const seriesDetails = currentSeriesState.details;
  const series = currentSeriesState.series;
  const found = getSeasonEpisodeById(seriesDetails, episodeId);
  if (!found || !series) return;

  currentSeriesState = { ...currentSeriesState, selectedEpisodeId: found.episode.id };
  renderSeriesDetails();

  const profile = getActiveProfile();
  const saved = getSavedPlaybackEntry(profile.id, found.episode);
  openSeriesEpisode(profile, found.episode, series, {
    startTime: queueButton ? saved?.currentTime || 0 : 0,
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && currentSeriesState.open) {
    closeSeriesModal();
  }
});

const savedUrl = localStorage.getItem(LAST_M3U_URL_KEY);
if (savedUrl && els.m3uUrl) {
  els.m3uUrl.value = savedUrl;
}

async function bootstrapLibrary() {
  const profile = getActiveProfile();
  if (profileCatalogLoading || profile.library.length > 0) return;

  profileCatalogLoading = true;
  setStatus("Carregando catalogo automatico...");

  const sources = [];
  if (savedUrl) sources.push({ kind: "m3u", url: savedUrl });
  sources.push({ kind: "default" });

  try {
    for (const source of sources) {
      try {
        if (source.kind === "m3u") {
          const text = await fetchTextWithFallback(source.url);
          const items = parseM3U(text);
          if (items.length) {
            importItemsIntoProfile(profile, items);
            setStatus(`${profile.library.length} itens restaurados automaticamente.`);
            rerender();
            return;
          }
        } else {
          const response = await withTimeout(fetch("/api/default-library", { cache: "no-store" }), LIBRARY_FETCH_TIMEOUT_MS, "Tempo esgotado");
          if (response.ok) {
            const items = await response.json();
            if (Array.isArray(items) && items.length) {
              importItemsIntoProfile(profile, items);
              setStatus(`${profile.library.length} itens carregados automaticamente.`);
              rerender();
              return;
            }
          }
        }
      } catch {}
    }
    setStatus("Nenhum catalogo automatico foi carregado.");
  } finally {
    profileCatalogLoading = false;
  }
}

saveState();
render();
loadProfileSync().finally(() => {
  bootstrapLibrary();
});
