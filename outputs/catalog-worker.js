const MAX_LIBRARY_ITEMS = 350000;

function stableId(value) {
  let hash = 0;
  for (const ch of String(value || "")) {
    hash = (hash << 5) - hash + ch.charCodeAt(0);
    hash |= 0;
  }
  return `m3u-${Math.abs(hash).toString(36)}`;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compactText(value) {
  return normalizeText(value)
    .replace(/[\[\](){}]/g, " ")
    .replace(/[._]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCatalogNoise(value) {
  return String(value || "")
    .replace(/\[[^\]]*(?:2160p|1080p|720p|480p|4k|uhd|hdr|web[-\s]?dl|bluray|blu[-\s]?ray|hdtv|x264|x265|hevc|aac|dublado|legendado|dual|multi|netflix|disney|prime|hbo|max|amzn)[^\]]*\]/gi, " ")
    .replace(/\([^)]*(?:2160p|1080p|720p|480p|4k|uhd|hdr|web[-\s]?dl|bluray|blu[-\s]?ray|hdtv|x264|x265|hevc|aac|dublado|legendado|dual|multi|netflix|disney|prime|hbo|max|amzn)[^)]*\)/gi, " ")
    .replace(/\b(?:2160p|1080p|720p|480p|4k|uhd|hdr|web[-\s]?dl|bluray|blu[-\s]?ray|hdtv|x264|x265|hevc|aac|dublado|legendado|dual\s+audio|multi\s+audio|pt[-\s]?br|mp4|mkv|avi)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupSeriesBaseTitle(value) {
  return stripCatalogNoise(value)
    .replace(/^[\s._\-–—:|]+|[\s._\-–—:|]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(text) {
  const attrs = {};
  const regex = /([a-z0-9-]+)="([^"]*)"/gi;
  let match;
  while ((match = regex.exec(text))) attrs[match[1].toLowerCase()] = match[2];
  return attrs;
}

function looksLikeSeriesContext(title, group, item = {}) {
  const haystack = compactText(`${title} ${group} ${item.source || ""} ${item.stream_type || ""}`);
  return /\b(series|serie|seriado|temporada|season|episode|episodio|capitulo|anime|animes|desenho|desenhos|cartoon|dorama|novela)\b/.test(haystack);
}

function detectType(title, group) {
  const haystack = compactText(`${title} ${group}`);
  const hasMediaHint = /\b(filme|filmes|movie|movies|vod|cinema|serie|series|seriado|temporada|season|episode|episodio|episodios|show|capitulo|anime|animes|desenho|desenhos|dorama|novela)\b/i.test(haystack);
  const hasChannelHint = /\b(canal|canais|live|ao vivo|channel|iptv|tv ao vivo|broadcast|24h|24 horas|noticias|jornal|esporte ao vivo|futebol ao vivo|ppv|premiere|globo|record|sbt|band|rede tv|cnn|fox sports|espn|sportv)\b/i.test(haystack);
  if (hasChannelHint && !hasMediaHint) return null;
  if (/(serie|series|season|episode|episodio|episodios|show|capitulo)/i.test(haystack)) return "series";
  if (/(filme|filmes|movie|movies|vod|cinema)/i.test(haystack)) return "movie";
  return "movie";
}

function getTitleEpisodeInfo(title, group = "", item = {}) {
  const rawTitle = stripCatalogNoise(title || "");
  const normalizedSeparators = rawTitle.replace(/[._]+/g, " ");
  const patterns = [
    /(?:^|[\s\-–—:|])s(?:eason)?\s*0*(\d{1,3})\s*[\s\-–—:|]*e(?:p(?:isode)?)?\s*0*(\d{1,4})(?:\b|$)/i,
    /(?:^|[\s\-–—:|])t\s*0*(\d{1,3})\s*[\s\-–—:|]*e(?:p)?\s*0*(\d{1,4})(?:\b|$)/i,
    /(?:^|[\s\-–—:|])0*(\d{1,3})\s*x\s*0*(\d{1,4})(?:\b|$)/i,
    /(?:temporada|temp|season)\s*0*(\d{1,3}).{0,28}?(?:epis[oó]dio|episodio|episode|ep|cap[ií]tulo|capitulo)\s*0*(\d{1,4})/i,
  ];
  for (const regex of patterns) {
    const match = normalizedSeparators.match(regex);
    if (!match) continue;
    const base = cleanupSeriesBaseTitle(normalizedSeparators.slice(0, match.index));
    const tail = cleanupSeriesBaseTitle(normalizedSeparators.slice((match.index || 0) + match[0].length));
    return {
      baseTitle: base || cleanupSeriesBaseTitle(group) || rawTitle,
      episodeTitle: tail || `Episodio ${Number(match[2]) || match[2]}`,
      seasonNumber: Number(match[1]) || 1,
      episodeNumber: Number(match[2]) || 0,
      confidence: "strong",
    };
  }
  const episodeOnly = normalizedSeparators.match(/(?:^|[\s\-–—:|])(?:ep(?:isode)?|epis[oó]dio|episodio|cap[ií]tulo|capitulo)\s*0*(\d{1,4})(?:\b|$)/i);
  if (episodeOnly && looksLikeSeriesContext(title, group, item)) {
    const base = cleanupSeriesBaseTitle(normalizedSeparators.slice(0, episodeOnly.index)) || cleanupSeriesBaseTitle(group);
    const tail = cleanupSeriesBaseTitle(normalizedSeparators.slice((episodeOnly.index || 0) + episodeOnly[0].length));
    return {
      baseTitle: base || cleanupSeriesBaseTitle(group) || rawTitle,
      episodeTitle: tail || `Episodio ${Number(episodeOnly[1]) || episodeOnly[1]}`,
      seasonNumber: 1,
      episodeNumber: Number(episodeOnly[1]) || 0,
      confidence: "contextual",
    };
  }
  return null;
}

function normalizeCatalogTitle(item) {
  const title = item?.title || item?.name || "";
  const group = item?.group || item?.category_name || "";
  const parsed = getTitleEpisodeInfo(title, group, item);
  const baseTitle = cleanupSeriesBaseTitle(parsed?.baseTitle || title || group || "Sem titulo");
  return {
    baseTitle,
    groupingKey: compactText(baseTitle),
    episodeTitle: parsed?.episodeTitle || "",
    seasonNumber: parsed?.seasonNumber || 0,
    episodeNumber: parsed?.episodeNumber || 0,
    confidence: parsed?.confidence || "none",
  };
}

function parseM3U(text) {
  const lines = String(text || "").split(/\r?\n/);
  const items = [];
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const commaIndex = line.indexOf(",");
      const rawMeta = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const title = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "";
      const attrs = parseAttributes(rawMeta);
      const finalTitle = title || attrs["tvg-name"] || "Sem titulo";
      const group = attrs["group-title"] || "Geral";
      const type = detectType(finalTitle, group);
      current = type
        ? { id: "", kind: type === "series" ? "episode" : "movie", title: finalTitle, group, type, url: "", logo: attrs["tvg-logo"] || "", source: "M3U" }
        : null;
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

function addEpisodeToSeason(seriesItem, episode, audit) {
  const seasonNumber = Number.isFinite(episode.seasonNumber) ? episode.seasonNumber : 1;
  let season = seriesItem.localSeasons.find((entry) => entry.seasonNumber === seasonNumber);
  if (!season) {
    season = { seasonNumber, name: seasonNumber === 0 ? "Especiais" : `Temporada ${seasonNumber || 1}`, episodes: [] };
    seriesItem.localSeasons.push(season);
  }
  const duplicateIndex = season.episodes.findIndex((entry) => (episode.url && entry.url === episode.url) || (episode.episodeNumber && entry.episodeNumber === episode.episodeNumber && compactText(entry.fullTitle) === compactText(episode.fullTitle)));
  if (duplicateIndex >= 0) {
    audit.duplicatesRemoved += 1;
    return;
  }
  season.episodes.push(episode);
}

function auditAndOrganizeCatalog(rawItems) {
  const audit = { input: rawItems.length, movies: 0, series: 0, seasons: 0, episodes: 0, movieEpisodesFixed: 0, duplicatesRemoved: 0, uncertain: 0 };
  const movies = [];
  const movieKeys = new Set();
  const seriesMap = new Map();
  rawItems.slice(0, MAX_LIBRARY_ITEMS).forEach((item, index) => {
    const titleInfo = normalizeCatalogTitle(item);
    const isEpisode = item.kind === "episode" || titleInfo.confidence === "strong" || (titleInfo.confidence === "contextual" && (item.type === "series" || looksLikeSeriesContext(item.title, item.group, item)));
    if (!isEpisode) {
      const key = item.id || item.url || compactText(`${item.title}|${item.group}`);
      if (movieKeys.has(key)) {
        audit.duplicatesRemoved += 1;
        return;
      }
      movieKeys.add(key);
      movies.push({ ...item, kind: item.kind || "movie", type: "movie", originalIndex: index });
      return;
    }
    if (item.type === "movie" || item.kind === "movie") audit.movieEpisodesFixed += 1;
    const baseTitle = titleInfo.baseTitle || item.group || item.title || "Serie";
    const groupingKey = titleInfo.groupingKey || compactText(baseTitle);
    const seriesId = `local-${stableId(groupingKey)}`;
    let seriesItem = seriesMap.get(groupingKey);
    if (!seriesItem) {
      seriesItem = { id: `series-${seriesId}`, kind: "series", title: baseTitle, group: item.group || "Series", type: "series", url: "", logo: item.logo || "", source: item.source || "M3U", seriesId, localSeasons: [], originalIndex: index };
      seriesMap.set(groupingKey, seriesItem);
    }
    const seasonNumber = titleInfo.seasonNumber || 1;
    const episodeNumber = titleInfo.episodeNumber || 0;
    addEpisodeToSeason(seriesItem, {
      ...item,
      id: item.id || stableId(`${seriesId}|${seasonNumber}|${episodeNumber}|${item.url || item.title}`),
      kind: "episode",
      type: "series",
      title: titleInfo.episodeTitle || `Episodio ${episodeNumber || ""}`.trim(),
      fullTitle: item.title,
      group: seriesItem.title,
      seriesTitle: seriesItem.title,
      seriesId,
      seasonNumber,
      episodeNumber,
      progressKey: item.progressKey || item.id,
    }, audit);
  });
  const seriesItems = Array.from(seriesMap.values()).map((seriesItem) => {
    seriesItem.localSeasons = seriesItem.localSeasons
      .sort((a, b) => a.seasonNumber - b.seasonNumber)
      .map((season) => ({ ...season, episodes: season.episodes.sort((a, b) => (a.episodeNumber || 99999) - (b.episodeNumber || 99999) || String(a.fullTitle || a.title).localeCompare(String(b.fullTitle || b.title))) }));
    seriesItem.localEpisodeCount = seriesItem.localSeasons.reduce((total, season) => total + season.episodes.length, 0);
    seriesItem.searchText = `${seriesItem.title} ${seriesItem.group}`;
    return seriesItem;
  });
  audit.movies = movies.length;
  audit.series = seriesItems.length;
  audit.seasons = seriesItems.reduce((total, item) => total + item.localSeasons.length, 0);
  audit.episodes = seriesItems.reduce((total, item) => total + item.localEpisodeCount, 0);
  return { items: [...movies, ...seriesItems].sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0)), audit };
}

self.onmessage = async (event) => {
  try {
    const { url, defaultM3u } = event.data || {};
    const endpoint = defaultM3u ? "/api/default-m3u" : `/api/fetch-m3u?url=${encodeURIComponent(url || "")}`;
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`Falha ao carregar M3U (${response.status})`);
    self.postMessage({ type: "progress", message: "Organizando catálogo..." });
    const text = await response.text();
    const parsed = parseM3U(text);
    const organized = auditAndOrganizeCatalog(parsed);
    self.postMessage({ type: "done", ...organized });
  } catch (error) {
    self.postMessage({ type: "error", message: error?.message || "Falha ao processar catálogo" });
  }
};
