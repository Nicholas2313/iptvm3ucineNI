const STORAGE_KEY = "calicine-iptv-v1";
const HISTORY_KEY = "calicine-iptv-history-v1";
const LAST_M3U_URL_KEY = "calicine-iptv-last-m3u-url";

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
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
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
}

function getActiveProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0];
}

function setActiveProfile(id) {
  state.activeProfileId = id;
  selectedItemId = null;
  profileGateOpen = true;
  document.body.classList.remove("profile-gate");
  saveState();
  render();
}

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(recentHistory.slice(0, 12)));
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
  selectedItemId = profile.library[0]?.id || null;
}

function getCurrentLibrary(profile) {
  return profile.library;
}

function matchesGroupFilter(item) {
  return activeGroup === "all" || (item.group || "").toLowerCase() === activeGroup.toLowerCase();
}

function getVisibleItems(profile) {
  const library = getCurrentLibrary(profile);
  const query = searchTerm.toLowerCase();

  return library.filter((item) => {
    const matchesSearch = !query || `${item.title} ${item.group} ${item.type}`.toLowerCase().includes(query);
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
  const recent = recentHistory
    .map((id) => profile.library.find((item) => item.id === id))
    .filter(Boolean)
    .slice(0, 8);
  const list = recent.length ? recent : profile.library.slice(0, 8);

  if (!list.length) return `<article class="empty-note">Sem itens recentes ainda.</article>`;

  return list
    .map(
      (item) => `
      <article class="continue-card" data-item-id="${item.id}">
        <img class="continue-poster" src="${item.logo || defaultAvatar(item.title)}" alt="${escapeHtml(item.title)}" />
        <div class="continue-body">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.group || "Geral")} | ${item.type === "series" ? "Series" : "Filme"}${
            profile.favorites.includes(item.id) ? " | Favorito" : ""
          }</p>
          <div class="continue-actions">
            <button class="small-btn play-button" type="button">Continuar</button>
            <button class="small-btn ghost-btn" type="button" data-restart="${item.id}">Do inicio</button>
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
  return `
    <article class="media-card ${selected ? "selected" : ""}" data-item-id="${item.id}">
      <img class="poster" src="${item.logo || defaultAvatar(item.title)}" alt="${escapeHtml(item.title)}" />
      <div class="media-info">
        <span class="chip">${item.type === "series" ? "Series" : "Filme"}</span>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.group || "Geral")} · ${escapeHtml(item.source || "M3U")}</p>
      </div>
      <div class="card-actions">
        <button class="card-button play-button" type="button">Assistir</button>
        <button class="card-button fav-button" type="button" data-favorite="${item.id}">${isFavorite ? "★" : "☆"}</button>
      </div>
    </article>
  `;
}

function renderEmptyState(profile) {
  if (!profile.library.length) {
    return `
      <article class="media-card wide">
        <div class="media-info">
          <span class="chip">Sem catalogo</span>
          <h4>Cole um link de M3U para carregar os filmes e series.</h4>
          <p>Depois de colar o link, clique em Carregar.</p>
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
    els.heroHeadline.textContent = "Calicine";
    els.heroMeta.textContent = "Cole o link do M3U para comecar.";
    els.heroDescription.textContent = "Uma interface simples, azul escuro, focada em carregar sua lista M3U.";
    return;
  }

  els.heroHeadline.textContent = item.title;
  els.heroMeta.textContent = `${item.group || "Geral"} · ${item.type === "series" ? "Series" : "Filme"}`;
  els.heroDescription.textContent = "Clique em outro titulo ou use os botoes abaixo para navegar pelo catalogo.";
}

function updatePlayer(profile, item) {
  if (!els.player || !els.playerEmpty) return;

  if (!item) {
    els.player.removeAttribute("src");
    els.player.load();
    els.playerEmpty.style.display = "grid";
    els.playerEmpty.textContent = "Nenhuma midia selecionada";
    els.downloadLink.href = "#";
    els.downloadLink.textContent = "Baixar";
    els.downloadLink.setAttribute("aria-disabled", "true");
    els.openLink.onclick = null;
    return;
  }

  els.playerEmpty.style.display = "none";
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
  selectedItemId = itemId;
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
  const selected = library.find((item) => item.id === selectedItemId) || library[0] || null;

  if (selected && !selectedItemId) selectedItemId = selected.id;

  if (els.activeAvatar) {
    els.activeAvatar.src = renderAvatar(profile);
    els.activeAvatar.alt = `Foto de ${profile.name}`;
  }
  if (els.activeName) els.activeName.textContent = profile.name;
  if (els.activeMeta) {
    els.activeMeta.textContent = profile.library.length > 0 ? `${profile.library.length} titulos carregados` : "Pronto para carregar";
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
      activeTab === "all" ? "Todos os titulos" : activeTab === "movies" ? "Filmes" : activeTab === "series" ? "Series" : "Favoritos";
  }

  if (els.groupFilter) {
    els.groupFilter.innerHTML = buildGroupOptions(profile);
    els.groupFilter.value = activeGroup;
  }

  if (els.catalogCount) els.catalogCount.textContent = String(library.length);
  if (els.catalogStatus) {
    els.catalogStatus.textContent = profile.library.length > 0 ? "Catalogo carregado" : "Aguardando M3U";
  }
  if (els.catalogSource) {
    els.catalogSource.textContent = profile.library.length > 0
      ? "A lista foi carregada para este perfil."
      : "Cole o link do M3U e clique em Carregar.";
  }
  if (els.activeAvatar) {
    els.activeAvatar.src = renderAvatar(profile);
  }
  if (els.activeMeta) {
    els.activeMeta.textContent = profile.library.length > 0 ? `${profile.library.length} titulos carregados` : "Pronto para carregar";
  }

  updateHero(profile, selected);
  updatePlayer(profile, selected);

  if (els.libraryGrid) {
    els.libraryGrid.innerHTML = visible.length ? visible.map((item) => renderCard(item, profile)).join("") : renderEmptyState(profile);
  }
  if (els.continueGrid) els.continueGrid.innerHTML = renderHistory(profile);
  if (els.movieCategories) els.movieCategories.innerHTML = buildCategoryCards(profile, "movie");
  if (els.seriesCategories) els.seriesCategories.innerHTML = buildCategoryCards(profile, "series");

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
  const restartButton = event.target.closest("[data-restart]");
  if (restartButton) {
    const profile = getActiveProfile();
    const item = profile.library.find((entry) => entry.id === restartButton.dataset.restart);
    if (item) selectItem(item.id, profile);
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

document.addEventListener("click", (event) => {
  const playButton = event.target.closest(".play-button");
  if (!playButton) return;
  const card = event.target.closest("[data-item-id]");
  if (card) selectItem(card.dataset.itemId);
});

const savedUrl = localStorage.getItem(LAST_M3U_URL_KEY);
if (savedUrl && els.m3uUrl) {
  els.m3uUrl.value = savedUrl;
}

render();
