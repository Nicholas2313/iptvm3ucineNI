const APP_NAME = "M3UCINE";
const STORAGE_KEY = "m3ucine-state-v1";
const LEGACY_STORAGE_KEY = "calicine-iptv-v1";
const HISTORY_KEY = "m3ucine-history-v1";
const LEGACY_HISTORY_KEY = "calicine-iptv-history-v1";
const PROGRESS_KEY = "m3ucine-progress-v1";
const LAST_M3U_URL_KEY = "m3ucine-last-m3u-url";
const LEGACY_LAST_M3U_URL_KEY = "calicine-iptv-last-m3u-url";

const els = {
  activeAvatar: document.getElementById("active-avatar"),
  activeName: document.getElementById("active-name"),
  activeMeta: document.getElementById("active-meta"),
  profileGrid: document.getElementById("profile-grid"),
  editProfileBtn: document.getElementById("edit-profile-btn"),
  openProfileBtn: document.getElementById("open-profile-btn"),
  profileModal: document.getElementById("profile-modal"),
  profileEditForm: document.getElementById("profile-edit-form"),
  profileModalTitle: document.getElementById("profile-modal-title"),
  editProfileName: document.getElementById("edit-profile-name"),
  editProfileAvatar: document.getElementById("edit-profile-avatar"),
  editProfileAvatarPreview: document.getElementById("edit-profile-avatar-preview"),
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
  playFirstEpisode: document.getElementById("play-first-episode"),
  avatarInput: document.getElementById("avatar-input"),
  newProfileForm: document.getElementById("new-profile-form"),
  newProfileName: document.getElementById("new-profile-name"),
  m3uUrl: document.getElementById("m3u-url"),
  importForm: document.getElementById("import-form"),
  importStatus: document.getElementById("import-status"),
  importButton: document.querySelector("#import-form button[type='submit']"),
  tabs: document.getElementById("tabs"),
  searchInput: document.getElementById("search-input"),
  groupFilter: document.getElementById("group-filter"),
  libraryTitle: document.getElementById("library-title"),
  libraryGrid: document.getElementById("library-grid"),
  resultsCount: document.getElementById("results-count"),
  statItems: document.getElementById("stat-items"),
  statFavorites: document.getElementById("stat-favorites"),
  statMovies: document.getElementById("stat-movies"),
  statSeries: document.getElementById("stat-series"),
  heroHeadline: document.getElementById("hero-headline"),
  heroMeta: document.getElementById("hero-meta"),
  heroDescription: document.getElementById("hero-description"),
  heroPlay: document.getElementById("hero-play"),
  player: document.getElementById("player"),
  playerEmpty: document.getElementById("player-empty"),
  downloadLink: document.getElementById("download-link"),
  openLink: document.getElementById("open-link"),
  continueGrid: document.getElementById("continue-grid"),
  movieCategories: document.getElementById("movie-categories"),
  seriesCategories: document.getElementById("series-categories"),
  catalogStatus: document.getElementById("catalog-status"),
  catalogSource: document.getElementById("catalog-source"),
  catalogCount: document.getElementById("catalog-count"),
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
let activePlayback = null;
let playbackRestoreTime = 0;
let playbackSaveTimer = null;
const seriesDetailsCache = new Map();
const seriesDetailsLoading = new Map();
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
  const initials = (name || "P")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  const hue = ((name || "P").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) * 17) % 360;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="hsl(${hue}, 100%, 72%)" />
          <stop offset="100%" stop-color="hsl(${(hue + 50) % 360}, 100%, 52%)" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="48" fill="url(#g)"/>
      <circle cx="120" cy="98" r="58" fill="rgba(255,255,255,0.14)"/>
      <text x="50%" y="56%" text-anchor="middle" font-family="Arial, sans-serif" font-size="68" font-weight="700" fill="#03111f">${initials}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function profileCardLabel(index, profile, activeId) {
  return profile.id === activeId ? "Perfil ativo" : "Toque para selecionar";
}

function openProfileEditor(profile) {
  if (!els.profileModal || !els.profileModalTitle || !els.editProfileName || !els.editProfileAvatarPreview) return;
  els.profileModalTitle.textContent = profile.name;
  els.editProfileName.value = profile.name;
  els.editProfileAvatar.value = "";
  els.editProfileAvatarPreview.src = renderAvatar(profile);
  els.profileModal.dataset.profileId = profile.id;
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

function openProfileGate() {
  profileGateOpen = false;
  document.body.classList.add("profile-gate");
  closeProfileEditor();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function createProfile(name) {
  return {
    id: uid(),
    name,
    avatar: defaultAvatar(name),
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
      createProfile("Perfil 1"),
      createProfile("Perfil 2"),
      createProfile("Perfil 3"),
      createProfile("Perfil 4"),
    ],
  });
}

function normalizeState(input) {
  const sourceProfiles = Array.isArray(input.profiles) ? input.profiles : [];
  const profiles = Array.from({ length: 4 }, (_, index) => {
    const profile = sourceProfiles[index];
    const fallbackName = `Perfil ${index + 1}`;
    return {
      id: profile?.id || uid(),
      name: profile?.name || fallbackName,
      avatar: profile?.avatar || defaultAvatar(profile?.name || fallbackName),
      library: Array.isArray(profile?.library) ? profile.library : [],
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
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

  progress[key] = makeProgressEntry(profileId, item, currentTime, duration);
  saveProgressState();
}

function clearPlaybackProgress(profileId) {
  if (!profileId || !progressState[profileId]) return;
  progressState[profileId] = {};
  saveProgressState();
}

function getProfileContinueItems(profile) {
  const progress = getProfileProgress(profile.id);
  return Object.values(progress)
    .filter(Boolean)
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
  updateHero(profile, playable);
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
  profile.library = items;
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

function getVisibleItems(profile) {
  const library = getCurrentLibrary(profile);
  const query = normalizeText(searchTerm);
  if (!query) return [];

  return library.filter((item) => {
    const haystack = normalizeText(`${item.title} ${item.group} ${item.type} ${item.source || ""}`);
    const matchesSearch = haystack.includes(query);
    const isFavorite = profile.favorites.includes(item.id);
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "favorites" && isFavorite) ||
      (activeTab === "movies" && item.type === "movie") ||
      (activeTab === "series" && item.type === "series");
    return matchesSearch && matchesTab && matchesGroupFilter(item);
  });
}

function setStatus(message, tone = "info") {
  if (!els.importStatus) return;
  els.importStatus.textContent = message;
  els.importStatus.dataset.tone = tone;
}

function renderAvatar(profile) {
  return profile.avatar || defaultAvatar(profile.name);
}

function buildGroupOptions(profile) {
  const groups = Array.from(new Set(profile.library.map((item) => item.group || "Geral"))).sort();
  return [
    `<option value="all">Todas as categorias</option>`,
    ...groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`),
  ].join("");
}

function buildCategoryCards(profile, type) {
  const library = profile.library.filter((item) => item.type === type);
  const groups = Array.from(new Set(library.map((item) => item.group || "Geral")));
  if (!groups.length) return `<article class="empty-note">Nenhuma categoria encontrada.</article>`;

  return groups
    .slice(0, 10)
    .map((group) => {
      const count = library.filter((item) => (item.group || "Geral") === group).length;
      return `
        <button class="category-card" type="button" data-group="${escapeHtml(group)}">
          <span class="category-mark">◆</span>
          <strong>${escapeHtml(group)}</strong>
          <small>${count} titulos</small>
          <span class="category-cta">${type === "movie" ? "Ver filmes" : "Ver series"}</span>
        </button>
      `;
    })
    .join("");
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

function normalizeSeriesPayload(payload, fallbackSeries) {
  const details = payload?.series || payload?.series_info || payload?.info || payload || {};
  const seasonsRaw = Array.isArray(details.seasons) ? details.seasons : Array.isArray(payload?.seasons) ? payload.seasons : [];
  const episodesRaw = payload?.episodes || details.episodes || {};
  const series = {
    seriesId: String(fallbackSeries.seriesId || details.series_id || payload?.series_id || ""),
    title: details.name || fallbackSeries.title || "Serie",
    logo: details.cover || details.cover_big || details.movie_image || fallbackSeries.logo || "",
    plot: details.plot || fallbackSeries.plot || "",
    year: details.year || fallbackSeries.year || "",
    genre: details.genre || fallbackSeries.genre || "",
    rating: details.rating || fallbackSeries.rating || "",
    status: details.status || fallbackSeries.status || "",
    base: fallbackSeries.base || "",
  };

  const seasonMap = new Map();
  for (const season of seasonsRaw) {
    const seasonNumber = normalizeSeasonNumber(season.season_number ?? season.season_num ?? season.season);
    seasonMap.set(seasonNumber, {
      seasonNumber,
      name: season.name || `Temporada ${seasonNumber || 1}`,
      episodes: [],
    });
  }

  const episodeEntries = Array.isArray(episodesRaw)
    ? episodesRaw.map((episode) => ({ seasonNumber: normalizeSeasonNumber(episode.season), episode }))
    : Object.entries(episodesRaw).flatMap(([seasonKey, episodes]) => {
        const seasonNumber = normalizeSeasonNumber(seasonKey);
        return (Array.isArray(episodes) ? episodes : []).map((episode) => ({ seasonNumber, episode }));
      });

  for (const entry of episodeEntries) {
    const seasonNumber = normalizeSeasonNumber(entry.seasonNumber ?? entry.episode?.season);
    const episode = entry.episode || entry;
    if (!seasonMap.has(seasonNumber)) {
      seasonMap.set(seasonNumber, {
        seasonNumber,
        name: `Temporada ${seasonNumber || 1}`,
        episodes: [],
      });
    }
    const ext = episode.container_extension || episode.containerExtension || "mp4";
    const episodeNumber = normalizeEpisodeNumber(episode);
    const normalizedEpisode = {
      id: `series-${series.seriesId}-s${seasonNumber}-e${episodeNumber || episode.id}`,
      kind: "episode",
      type: "series",
      title: episode.title || episode.name || `Episodio ${episodeNumber || episode.id}`,
      fullTitle: `${series.title} - T${seasonNumber || 1} EP${episodeNumber || episode.id}`,
      group: series.title,
      logo: episode.info?.movie_image || episode.cover || series.logo || "",
      source: "Xtream",
      base: series.base,
      seriesId: series.seriesId,
      seasonNumber,
      episodeNumber,
      url: `${series.base}/series/${encodeURIComponent(xtreamUser)}/${encodeURIComponent(xtreamPassword)}/${episode.id}.${ext}`,
      plot: episode.plot || episode.info?.plot || "",
      duration: episode.duration || episode.info?.duration || "",
      releaseDate: episode.releasedate || episode.release_date || "",
      episodeId: String(episode.id || ""),
    };
    seasonMap.get(seasonNumber).episodes.push(normalizedEpisode);
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

function renderSeriesDetails() {
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

  const activeSeason = seasons.find((season) => season.seasonNumber === state.activeSeason) || seasons[0];
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

  if (els.playFirstEpisode) {
    els.playFirstEpisode.disabled = !(activeSeason?.episodes?.length);
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
  updateHero(profile, item);
  updatePlayer(profile, item);
  render();
}

function openSeriesEpisode(profile, episode, seriesItem, options = {}) {
  const episodeItem = {
    ...episode,
    kind: "episode",
    title: episode.fullTitle || `${seriesItem.title} - ${episode.title}`,
    group: seriesItem.title,
    seriesTitle: seriesItem.title,
    progressKey: buildPlaybackKey(episode),
  };
  const saved = getSavedPlaybackEntry(profile.id, episodeItem);
  const resumeTime = options.startTime ?? saved?.currentTime ?? 0;
  closeSeriesModal();
  playMediaItem(profile, episodeItem, { restoreTime: resumeTime });
}

function syncTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateHero(profile, item) {
  if (!els.heroHeadline || !els.heroMeta || !els.heroDescription) return;

  if (!item) {
    els.heroHeadline.textContent = APP_NAME;
    els.heroMeta.textContent = "Pesquise para encontrar filmes e series.";
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

function render() {
  const profile = getActiveProfile();
  const library = profile.library;
  const visible = getVisibleItems(profile);
  const favoriteCount = profile.favorites.length;
  const movieCount = library.filter((item) => item.type === "movie").length;
  const seriesCount = library.filter((item) => item.type === "series").length;
  const query = normalizeText(searchTerm);
  const hasQuery = query.length > 0;
  const selected =
    library.find((item) => item.id === selectedItemId) ||
    (activePlayback && activePlayback.profileId === profile.id ? activePlayback : null);

  if (els.activeAvatar) {
    els.activeAvatar.src = renderAvatar(profile);
    els.activeAvatar.alt = `Foto de ${profile.name}`;
  }
  if (els.activeName) els.activeName.textContent = profile.name;
  if (els.activeMeta) {
    els.activeMeta.textContent = profile.library.length > 0 ? `${profile.library.length} titulos carregados` : "Catálogo em espera";
  }

  if (els.profileGrid) {
    els.profileGrid.innerHTML = state.profiles
      .map(
        (item, index) => `
          <button class="profile-card ${item.id === profile.id ? "active" : ""}" data-profile-id="${item.id}" type="button">
            <span class="profile-card-ring"></span>
            <img class="profile-card-avatar" src="${renderAvatar(item)}" alt="${escapeHtml(item.name)}" />
            <strong>${escapeHtml(item.name)}</strong>
            <small>${profileCardLabel(index, item, profile.id)}</small>
          </button>
        `
      )
      .join("");
  }

  if (els.statItems) els.statItems.textContent = String(library.length);
  if (els.statFavorites) els.statFavorites.textContent = String(favoriteCount);
  if (els.statMovies) els.statMovies.textContent = String(movieCount);
  if (els.statSeries) els.statSeries.textContent = String(seriesCount);
  if (els.resultsCount) els.resultsCount.textContent = String(visible.length);
  if (els.libraryTitle) {
    els.libraryTitle.textContent =
      hasQuery
        ? activeTab === "all"
          ? "Resultados da busca"
          : activeTab === "movies"
            ? "Filmes encontrados"
            : activeTab === "series"
              ? "Series encontradas"
              : "Favoritos encontrados"
        : "Pesquise para ver resultados";
  }

  if (els.groupFilter) {
    els.groupFilter.innerHTML = buildGroupOptions(profile);
    els.groupFilter.value = activeGroup;
  }

  if (els.catalogCount) els.catalogCount.textContent = String(library.length);
  if (els.catalogStatus) {
    els.catalogStatus.textContent = profile.library.length > 0 ? "Catalogo pronto" : "Aguardando catalogo";
  }
  if (els.catalogSource) {
    els.catalogSource.textContent = profile.library.length > 0
      ? "O catálogo foi carregado para este perfil."
      : "O catálogo sera carregado automaticamente ou por M3U.";
  }
  if (els.activeAvatar) {
    els.activeAvatar.src = renderAvatar(profile);
  }
  if (els.activeMeta) {
    els.activeMeta.textContent = profile.library.length > 0 ? `${profile.library.length} titulos carregados` : "Catálogo em espera";
  }

  updateHero(profile, selected);
  updatePlayer(profile, selected);

  if (els.libraryGrid) {
    els.libraryGrid.innerHTML = hasQuery
      ? visible.length
        ? visible.map((item) => renderCard(item, profile)).join("")
        : renderEmptyState(profile)
      : renderEmptyState(profile);
  }
  if (els.continueGrid) els.continueGrid.innerHTML = renderHistory(profile);
  if (els.movieCategories) els.movieCategories.innerHTML = hasQuery ? buildCategoryCards(profile, "movie") : "";
  if (els.seriesCategories) els.seriesCategories.innerHTML = hasQuery ? buildCategoryCards(profile, "series") : "";

  document.body.classList.toggle("search-mode", hasQuery);

  syncTabs();
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
});

els.avatarInput?.addEventListener("change", async () => {
  const file = els.avatarInput.files?.[0];
  if (!file) return;
  const profile = getActiveProfile();
  try {
    profile.avatar = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || defaultAvatar(profile.name)));
      reader.onerror = () => resolve(defaultAvatar(profile.name));
      reader.readAsDataURL(file);
    });
  } catch {
    profile.avatar = defaultAvatar(profile.name);
  }
  setStatus("Foto do perfil atualizada.");
  rerender();
  els.avatarInput.value = "";
});

els.profileGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile-id]");
  if (button) setActiveProfile(button.dataset.profileId);
});

els.editProfileBtn?.addEventListener("click", () => {
  openProfileEditor(getActiveProfile());
});

els.openProfileBtn?.addEventListener("click", () => {
  openProfileGate();
});

els.closeProfileModal?.addEventListener("click", () => {
  closeProfileEditor();
});

els.profileEditForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const profile = getActiveProfile();
  const name = toText(els.editProfileName?.value);
  if (name) profile.name = name;

  const file = els.editProfileAvatar?.files?.[0];
  if (file) {
    profile.avatar = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || defaultAvatar(profile.name)));
      reader.onerror = () => resolve(defaultAvatar(profile.name));
      reader.readAsDataURL(file);
    });
  }

  closeProfileEditor();
  rerender();
});

els.editProfileAvatar?.addEventListener("change", async () => {
  const profile = getActiveProfile();
  const file = els.editProfileAvatar.files?.[0];
  if (!els.editProfileAvatarPreview) return;
  if (!file) {
    els.editProfileAvatarPreview.src = renderAvatar(profile);
    return;
  }
  els.editProfileAvatarPreview.src = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || defaultAvatar(profile.name)));
    reader.onerror = () => resolve(defaultAvatar(profile.name));
    reader.readAsDataURL(file);
  });
});

els.tabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  activeTab = button.dataset.tab;
  render();
});

els.searchInput?.addEventListener("input", () => {
  searchTerm = els.searchInput.value;
  render();
});

els.groupFilter?.addEventListener("change", () => {
  activeGroup = els.groupFilter.value;
  render();
});

els.clearHistory?.addEventListener("click", () => {
  recentHistory.splice(0, recentHistory.length);
  saveHistory();
  render();
});

els.heroPlay?.addEventListener("click", () => {
  const profile = getActiveProfile();
  const target = selectedItemId ? profile.library.find((item) => item.id === selectedItemId) : profile.library[0];
  if (target) selectItem(target.id, profile);
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
  setStatus("Carregando link do M3U...");

  try {
    if (!url) {
      setStatus("Cole o link do M3U para carregar.", "error");
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
    setStatus(`${items.length} itens carregados com sucesso.`);
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

els.libraryGrid?.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    const profile = getActiveProfile();
    const itemId = favoriteButton.dataset.favorite;
    const index = profile.favorites.indexOf(itemId);
    if (index >= 0) {
      profile.favorites.splice(index, 1);
    } else {
      profile.favorites.push(itemId);
    }
    rerender();
    return;
  }

  const card = event.target.closest("[data-item-id]");
  if (card) {
    selectItem(card.dataset.itemId);
  }
});

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
  if (card) selectItem(card.dataset.itemId);
});

els.movieCategories?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-group]");
  if (!button) return;
  activeGroup = button.dataset.group;
  if (els.groupFilter) els.groupFilter.value = activeGroup;
  render();
});

els.seriesCategories?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-group]");
  if (!button) return;
  activeGroup = button.dataset.group;
  if (els.groupFilter) els.groupFilter.value = activeGroup;
  render();
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
  clearTimeout(playbackSaveTimer);
  playbackSaveTimer = setTimeout(() => {
    if (!activePlayback || !els.player) return;
    savePlaybackProgress(
      activePlayback.profileId,
      activePlayback,
      Number(els.player.currentTime || 0),
      Number(els.player.duration || 0)
    );
  }, 600);
});

els.player?.addEventListener("pause", () => {
  if (!activePlayback || !els.player) return;
  clearTimeout(playbackSaveTimer);
  savePlaybackProgress(
    activePlayback.profileId,
    activePlayback,
    Number(els.player.currentTime || 0),
    Number(els.player.duration || 0)
  );
});

els.player?.addEventListener("seeked", () => {
  if (!activePlayback || !els.player) return;
  clearTimeout(playbackSaveTimer);
  savePlaybackProgress(
    activePlayback.profileId,
    activePlayback,
    Number(els.player.currentTime || 0),
    Number(els.player.duration || 0)
  );
});

els.player?.addEventListener("ended", () => {
  if (!activePlayback || !els.player) return;
  clearTimeout(playbackSaveTimer);
  savePlaybackProgress(
    activePlayback.profileId,
    activePlayback,
    Number(els.player.duration || 0),
    Number(els.player.duration || 0),
    { completed: true }
  );
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
  if (card) selectItem(card.dataset.itemId);
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

els.playFirstEpisode?.addEventListener("click", () => {
  const seriesDetails = currentSeriesState.details;
  const series = currentSeriesState.series;
  const activeSeason = seriesDetails?.seasons?.find((season) => season.seasonNumber === currentSeriesState.activeSeason) || seriesDetails?.seasons?.[0];
  const firstEpisode = activeSeason?.episodes?.[0];
  if (!firstEpisode || !series) return;
  const profile = getActiveProfile();
  openSeriesEpisode(profile, firstEpisode, series, { startTime: 0 });
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
            setStatus(`${items.length} itens restaurados automaticamente.`);
            rerender();
            return;
          }
        } else {
          const response = await withTimeout(fetch("/api/default-library", { cache: "no-store" }), 15000, "Tempo esgotado");
          if (response.ok) {
            const items = await response.json();
            if (Array.isArray(items) && items.length) {
              importItemsIntoProfile(profile, items);
              setStatus(`${items.length} itens carregados automaticamente.`);
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

render();
bootstrapLibrary();
