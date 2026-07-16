import http from "node:http";
import { Readable } from "node:stream";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 10000);
const upstreamTimeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS || 25000);
const appName = process.env.APP_NAME || "M3UCINE";
const xtreamUser = process.env.XTREAM_USER || "50971241";
const xtreamPassword = process.env.XTREAM_PASSWORD || "91170499";
const maxTotalLibraryItems = Number(process.env.MAX_TOTAL_LIBRARY_ITEMS || 350000);
const maxMovieItems = Number(process.env.MAX_MOVIE_ITEMS || 350000);
const maxSeriesItems = Number(process.env.MAX_SERIES_ITEMS || 350000);
const profileStateFile = process.env.PROFILE_STATE_FILE || path.join(root, "..", ".m3ucine-profile-state.json");
const profileThemes = new Set(["blue", "pink", "violet", "green"]);
const xtreamBases = (
  process.env.XTREAM_BASE_URLS ||
  ["http://ph1.fun", "http://topcar123.com.br", "http://phspr.pro"].join("|")
)
  .split("|")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);
const defaultM3uUrls = (
  process.env.DEFAULT_M3U_URLS ||
  [
    "http://ph1.fun/get.php?username=50971241&password=91170499&type=m3u_plus&output=ts",
    "http://topcar123.com.br/get.php?username=50971241&password=91170499&type=m3u_plus&output=mpegts",
    "http://phspr.pro/get.php?username=50971241&password=91170499&type=m3u_plus&output=ts",
  ].join("|")
)
  .split("|")
  .map((url) => url.trim())
  .filter(Boolean);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function emptyProfileState() {
  return { profiles: [], updatedAt: 0 };
}

function sanitizeProfileState(input) {
  const sourceProfiles = Array.isArray(input?.profiles) ? input.profiles : [];
  const safeProfiles = sourceProfiles.length ? sourceProfiles.slice(0, 4) : [];
  const profiles = safeProfiles.map((profile, index) => {
    const id = String(profile.id || "").trim().slice(0, 80);
    const name = String(profile.name || `Perfil ${index + 1}`).trim().slice(0, 24);
    const avatar = typeof profile.avatar === "string" && profile.avatar.startsWith("data:image/")
      ? profile.avatar.slice(0, 1800000)
      : "";
    const theme = profileThemes.has(profile.theme) ? profile.theme : ["blue", "pink", "violet", "green"][index % 4];
    const favorites = Array.isArray(profile.favorites)
      ? Array.from(new Set(profile.favorites.map((item) => String(item || "").trim()).filter(Boolean))).slice(0, 1000)
      : [];

    return { id, name, avatar, theme, favorites };
  });

  return { profiles, updatedAt: Date.now() };
}

async function readRequestBody(req, maxBytes = 4500000) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error("Payload too large");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function loadProfileState() {
  try {
    const raw = await readFile(profileStateFile, "utf8");
    return sanitizeProfileState(JSON.parse(raw));
  } catch {
    return emptyProfileState();
  }
}

async function saveProfileState(input) {
  const sanitized = sanitizeProfileState(input);
  await mkdir(path.dirname(profileStateFile), { recursive: true });
  await writeFile(profileStateFile, JSON.stringify(sanitized), "utf8");
  return sanitized;
}

function contentTypeFor(filePath) {
  return types.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function isHttpUrl(value) {
  try {
    const target = new URL(value);
    return target.protocol === "http:" || target.protocol === "https:";
  } catch {
    return false;
  }
}

function mediaContentType(target, upstreamType = "") {
  if (upstreamType) return upstreamType;
  const extension = path.extname(new URL(target).pathname).toLowerCase();
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".m3u8") return "application/vnd.apple.mpegurl";
  if (extension === ".ts" || extension === ".mpegts") return "video/mp2t";
  if (extension === ".mkv") return "video/x-matroska";
  if (extension === ".avi") return "video/x-msvideo";
  return "application/octet-stream";
}

async function proxyMediaStream(req, res, target) {
  if (!isHttpUrl(target)) {
    return send(res, 400, "Invalid media url");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), upstreamTimeoutMs * 2);

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 M3UCINE/1.0",
      Accept: "*/*",
    };
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const upstream = await fetch(target, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text().catch(() => "");
      return send(res, upstream.status || 502, text || `Media HTTP ${upstream.status}`);
    }

    const responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
      "Cache-Control": "no-store",
      "Content-Type": mediaContentType(target, upstream.headers.get("content-type") || ""),
    };

    for (const header of ["content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders[header] = value;
    }

    if (!responseHeaders["accept-ranges"]) {
      responseHeaders["Accept-Ranges"] = "bytes";
    }

    res.writeHead(req.method === "HEAD" ? 200 : upstream.status, responseHeaders);
    if (req.method === "HEAD") {
      return res.end();
    }

    if (!upstream.body) {
      return res.end();
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      return send(res, 502, error && error.name === "AbortError" ? "Media timeout" : "Media proxy failed");
    }
    res.destroy(error);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchM3u(target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    return await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 M3UCINE/1.0",
        Accept: "text/plain,application/x-mpegURL,application/vnd.apple.mpegurl,*/*",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeM3u(text) {
  const source = String(text || "");
  return /^#EXTM3U/im.test(source) && /#EXTINF:/i.test(source) && /^https?:\/\//im.test(source);
}

function hasInvalidCredentials(text) {
  return /INVALID_CREDENTIALS|Username or password is invalid|user.*password.*invalid/i.test(String(text || ""));
}

async function fetchText(target) {
  const response = await fetchM3u(target);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const text = await response.text();
  if (hasInvalidCredentials(text)) {
    throw new Error("credenciais invalidas");
  }
  return text;
}

async function fetchJson(target) {
  const text = await fetchText(target);
  return JSON.parse(text);
}

async function fetchFirstWorkingM3u(targets) {
  const errors = [];

  for (const target of targets) {
    try {
      const response = await fetchM3u(target);
      if (response.ok) {
        const text = await response.text();
        if (looksLikeM3u(text)) {
          return { text, target };
        }
        if (hasInvalidCredentials(text)) {
          errors.push(`${target} -> credenciais invalidas`);
          continue;
        }
        errors.push(`${target} -> resposta sem M3U`);
        continue;
      }
      errors.push(`${target} -> HTTP ${response.status}`);
    } catch (error) {
      errors.push(`${target} -> ${error && error.name === "AbortError" ? "timeout" : "falhou"}`);
    }
  }

  return { text: "", target: null, errors };
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || `${item.type}-${item.title}-${item.url || item.seriesId || item.streamId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stableId(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
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

function parseAttributes(text) {
  const attrs = {};
  const regex = /([a-z0-9-]+)="([^"]*)"/gi;
  let match;
  while ((match = regex.exec(text))) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function detectM3uType(title, group) {
  const haystack = normalizeText(`${title} ${group}`);
  if (/(canal|canais|live|ao vivo|channel|iptv|tv ao vivo|broadcast)/i.test(haystack)) return null;
  if (/(serie|series|season|episode|episodio|episodios|show|capitulo)/i.test(haystack)) return "series";
  if (/(filme|filmes|movie|movies|vod|cinema)/i.test(haystack)) return "movie";
  return "movie";
}

function parseM3uLibrary(text, sourceUrl = "") {
  const lines = String(text || "").split(/\r?\n/);
  const items = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const commaIndex = line.indexOf(",");
      const rawMeta = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const rawTitle = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "";
      const attrs = parseAttributes(rawMeta);
      const title = rawTitle || attrs["tvg-name"] || "Sem titulo";
      const group = attrs["group-title"] || "Geral";
      const type = detectM3uType(title, group);
      current = type
        ? {
            id: "",
            kind: type === "series" ? "episode" : "movie",
            title,
            group,
            type,
            url: "",
            logo: attrs["tvg-logo"] || "",
            source: "M3U",
            base: sourceUrl,
          }
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

  return uniqueById(items).slice(0, maxTotalLibraryItems);
}

function makeMovieUrl(base, stream) {
  const ext = stream.container_extension || stream.containerExtension || "mp4";
  return `${base}/movie/${xtreamUser}/${xtreamPassword}/${stream.stream_id}.${ext}`;
}

function makeSeriesUrl(base, episode) {
  const ext = episode.container_extension || episode.containerExtension || "mp4";
  return `${base}/series/${xtreamUser}/${xtreamPassword}/${episode.id}.${ext}`;
}

function normalizeMovie(base, stream) {
  return {
    id: `movie-${stream.stream_id}`,
    kind: "movie",
    title: stream.name || stream.title || "Filme sem titulo",
    group: stream.category_name || stream.categoryName || "Filmes",
    type: "movie",
    url: makeMovieUrl(base, stream),
    logo: stream.stream_icon || stream.cover || "",
    source: "Xtream",
    base,
    streamId: String(stream.stream_id || ""),
  };
}

function normalizeSeriesShow(base, show) {
  return {
    id: `series-${show.series_id}`,
    kind: "series",
    title: show.name || "Serie sem titulo",
    group: show.category_name || "Series",
    type: "series",
    url: "",
    logo: show.cover || show.cover_big || show.stream_icon || "",
    source: "Xtream",
    base,
    seriesId: String(show.series_id || ""),
    plot: show.plot || "",
    year: show.year || "",
    genre: show.genre || "",
    rating: show.rating || "",
  };
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
    episode.episodeNumber,
    episode.episode_num,
    episode.episode_number,
    episode.episode,
    episode.num,
    episode.info?.episode_num,
    episode.info?.episode_number,
  ];
  for (const candidate of candidates) {
    const numeric = readPositiveNumber(candidate);
    if (numeric > 0) return numeric;
  }
  const title = `${episode.title || ""} ${episode.name || ""} ${episode.fullTitle || ""}`;
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

function normalizeEpisodeEntry(base, series, episode, seasonNumber) {
  const episodeNumber = normalizeEpisodeNumber(episode);
  const ext = episode.container_extension || episode.containerExtension || "mp4";
  const rawEpisodeId = String(episode.episodeId || episode.episode_id || episode.stream_id || episode.id || "");
  return {
    id: `series-${series.seriesId}-s${seasonNumber}-e${episodeNumber || rawEpisodeId}`,
    kind: "episode",
    title: episode.title || episode.name || `Episodio ${episodeNumber || episode.id}`,
    fullTitle: `${series.title} - T${seasonNumber} EP${episodeNumber || rawEpisodeId}`,
    group: series.title,
    type: "series",
    url: episode.url || `${base}/series/${xtreamUser}/${xtreamPassword}/${rawEpisodeId}.${ext}`,
    logo: episode.info?.movie_image || episode.cover || series.logo || "",
    source: "Xtream",
    base,
    seriesId: series.seriesId,
    seasonNumber,
    episodeNumber,
    episodeId: rawEpisodeId,
    plot: episode.plot || episode.info?.plot || "",
    duration: episode.duration || episode.info?.duration || "",
    releaseDate: episode.releasedate || episode.release_date || "",
  };
}

function normalizeSeriesInfo(base, seriesId, payload) {
  const seriesInfo = payload?.series_info || payload?.info || payload || {};
  const rawSeasons = Array.isArray(seriesInfo.seasons)
    ? seriesInfo.seasons
    : Array.isArray(payload?.seasons)
      ? payload.seasons
      : [];
  const rawEpisodes = payload?.episodes || seriesInfo.episodes || {};
  const series = {
    seriesId: String(seriesId),
    title: seriesInfo.name || payload?.name || "Serie sem titulo",
    logo: seriesInfo.cover || seriesInfo.cover_big || seriesInfo.movie_image || payload?.cover || "",
    plot: seriesInfo.plot || payload?.plot || "",
    year: seriesInfo.year || payload?.year || "",
    genre: seriesInfo.genre || payload?.genre || "",
    rating: seriesInfo.rating || payload?.rating || "",
    status: seriesInfo.status || payload?.status || "",
    base,
  };

  const seasonMap = new Map();
  for (const [index, season] of rawSeasons.entries()) {
    const seasonNumber = normalizeSeasonNumber(
      season.seasonNumber ?? season.season_number ?? season.season_num ?? season.season ?? season.id,
      index + 1
    );
    if (!seasonMap.has(seasonNumber)) {
      seasonMap.set(seasonNumber, {
        seasonNumber,
        name: season.name || `Temporada ${seasonNumber || 1}`,
        episodes: [],
      });
    }
  }

  const episodeGroups = Array.isArray(rawEpisodes)
    ? rawEpisodes.map((episode) => ({
        seasonNumber: resolveEpisodeSeasonNumber(null, episode, 1),
        episode,
      }))
    : Object.entries(rawEpisodes).flatMap(([seasonKey, episodes]) => {
        const seasonNumber = normalizeSeasonNumber(seasonKey, 1);
        return (Array.isArray(episodes) ? episodes : []).map((episode) => ({ seasonNumber, episode }));
      });

  for (const entry of episodeGroups) {
    const episode = entry.episode || entry;
    const seasonNumber = resolveEpisodeSeasonNumber(entry, episode, entry.seasonNumber || 1);
    const normalized = normalizeEpisodeEntry(base, { ...series, title: series.title, seriesId }, episode, seasonNumber);
    if (!seasonMap.has(seasonNumber)) {
      seasonMap.set(seasonNumber, {
        seasonNumber,
        name: `Temporada ${seasonNumber || 1}`,
        episodes: [],
      });
    }
    seasonMap.get(seasonNumber).episodes.push(normalized);
  }

  const seasons = Array.from(seasonMap.values())
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((season) => ({
      ...season,
      episodes: season.episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0) || a.title.localeCompare(b.title)),
    }));

  return { series, seasons };
}

async function fetchXtreamLibraryFromBase(base) {
  const auth = `username=${encodeURIComponent(xtreamUser)}&password=${encodeURIComponent(xtreamPassword)}`;
  const moviesUrl = `${base}/player_api.php?${auth}&action=get_vod_streams`;
  const seriesUrl = `${base}/player_api.php?${auth}&action=get_series`;
  const [moviesResult, seriesResult] = await Promise.allSettled([
    fetchJson(moviesUrl),
    fetchJson(seriesUrl),
  ]);
  const movies = moviesResult.status === "fulfilled" ? moviesResult.value : [];
  const series = seriesResult.status === "fulfilled" ? seriesResult.value : [];
  const items = [];
  const selectedSeries = Array.isArray(series)
    ? uniqueById(series.map((show) => normalizeSeriesShow(base, show))).slice(0, maxSeriesItems)
    : [];
  const selectedMovies = Array.isArray(movies)
    ? uniqueById(movies.map((stream) => normalizeMovie(base, stream))).slice(0, maxMovieItems)
    : [];

  for (const item of selectedMovies) items.push(item);
  for (const item of selectedSeries) items.push(item);

  if (!items.length) {
    throw new Error(
      [
        moviesResult.status === "rejected" ? `filmes: ${moviesResult.reason.message}` : "",
        seriesResult.status === "rejected" ? `series: ${seriesResult.reason.message}` : "",
      ]
        .filter(Boolean)
        .join(", ") || "sem itens"
    );
  }

  return uniqueById(items).slice(0, maxTotalLibraryItems);
}

async function fetchXtreamSeriesInfoFromBase(base, seriesId) {
  const auth = `username=${encodeURIComponent(xtreamUser)}&password=${encodeURIComponent(xtreamPassword)}`;
  const url = `${base}/player_api.php?${auth}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;
  const payload = await fetchJson(url);
  return normalizeSeriesInfo(base, seriesId, payload);
}

async function fetchFirstWorkingXtreamLibrary() {
  const errors = [];
  const mergedItems = [];
  const workingBases = [];

  for (const base of xtreamBases) {
    try {
      const items = await fetchXtreamLibraryFromBase(base);
      if (items.length) {
        for (const item of items) mergedItems.push(item);
        workingBases.push(base);
        if (mergedItems.length >= maxTotalLibraryItems) break;
        continue;
      }
      errors.push(`${base} -> sem itens`);
    } catch (error) {
      errors.push(`${base} -> ${error.message || "falhou"}`);
    }
  }

  const items = uniqueById(mergedItems).slice(0, maxTotalLibraryItems);
  return { items, base: workingBases.join("|") || null, errors };
}

async function fetchFirstWorkingM3uLibrary() {
  const result = await fetchFirstWorkingM3u(defaultM3uUrls);
  if (!result.text) {
    return { items: [], base: null, errors: result.errors };
  }

  return {
    items: parseM3uLibrary(result.text, result.target),
    base: result.target,
    errors: [],
  };
}

async function fetchMaximumDefaultLibrary() {
  const [m3uResult, xtreamResult] = await Promise.allSettled([
    fetchFirstWorkingM3uLibrary(),
    fetchFirstWorkingXtreamLibrary(),
  ]);
  const m3u = m3uResult.status === "fulfilled" ? m3uResult.value : { items: [], base: null, errors: [m3uResult.reason?.message || "M3U falhou"] };
  const xtream = xtreamResult.status === "fulfilled" ? xtreamResult.value : { items: [], base: null, errors: [xtreamResult.reason?.message || "Xtream falhou"] };
  const merged = [];

  for (const item of m3u.items || []) merged.push(item);
  for (const item of (xtream.items || []).filter((item) => item.type === "series" && item.kind === "series")) merged.push(item);
  if (!m3u.items?.length) {
    for (const item of xtream.items || []) merged.push(item);
  }

  return {
    items: uniqueById(merged).slice(0, maxTotalLibraryItems),
    base: [m3u.base, xtream.base].filter(Boolean).join("|") || null,
    errors: [...(m3u.errors || []), ...(xtream.errors || [])],
  };
}

async function fetchFirstWorkingSeriesInfo(seriesId, baseHint) {
  const bases = baseHint ? [baseHint, ...xtreamBases.filter((base) => base !== baseHint)] : xtreamBases;
  const errors = [];

  for (const base of bases) {
    try {
      return await fetchXtreamSeriesInfoFromBase(base, seriesId);
    } catch (error) {
      errors.push(`${base} -> ${error.message || "falhou"}`);
    }
  }

  throw new Error(errors.join("; ") || "sem serie");
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      return send(res, 204, "");
    }

    if (requestUrl.pathname === "/api/profile-state") {
      if (req.method === "GET") {
        return send(res, 200, JSON.stringify(await loadProfileState()), {
          "Content-Type": "application/json; charset=utf-8",
        });
      }

      if (req.method === "POST") {
        const body = await readRequestBody(req);
        const payload = body ? JSON.parse(body) : {};
        return send(res, 200, JSON.stringify(await saveProfileState(payload)), {
          "Content-Type": "application/json; charset=utf-8",
        });
      }

      return send(res, 405, "Method not allowed");
    }

    if (requestUrl.pathname === "/api/default-m3u" || requestUrl.pathname === "/api/fetch-m3u") {
      const targets =
        requestUrl.pathname === "/api/default-m3u"
          ? defaultM3uUrls
          : [requestUrl.searchParams.get("url")].filter(Boolean);
      if (!targets.length) {
        return send(res, 400, "Missing url parameter");
      }

      const result = await fetchFirstWorkingM3u(targets);
      if (!result.text) {
        const authError = result.errors.some((error) => /credenciais invalidas/i.test(error));
        return send(
          res,
          authError ? 401 : 502,
          authError ? "Credenciais da playlist invalidas" : `No M3U source worked: ${result.errors.join("; ")}`
        );
      }

      return send(res, 200, result.text, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-M3UCINE-Source": result.target,
      });
    }

    if (requestUrl.pathname === "/api/stream") {
      const target = requestUrl.searchParams.get("url") || "";
      if (!target) {
        return send(res, 400, "Missing url parameter");
      }
      return proxyMediaStream(req, res, target);
    }

    if (requestUrl.pathname === "/api/default-library") {
      const result = await fetchFirstWorkingXtreamLibrary();
      if (!result.items.length) {
        const authError = result.errors.some((error) => /credenciais invalidas/i.test(error));
        return send(
          res,
          authError ? 401 : 502,
          authError ? "Credenciais da playlist invalidas" : `No Xtream source worked: ${result.errors.join("; ")}`
        );
      }

      return send(res, 200, JSON.stringify(result.items), {
        "Content-Type": "application/json; charset=utf-8",
        "X-M3UCINE-Source": result.base,
      });
    }

    if (requestUrl.pathname === "/api/series-info") {
      const seriesId = requestUrl.searchParams.get("seriesId") || requestUrl.searchParams.get("id");
      if (!seriesId) {
        return send(res, 400, "Missing seriesId parameter");
      }
      const baseHint = requestUrl.searchParams.get("base") || "";
      const result = await fetchFirstWorkingSeriesInfo(seriesId, baseHint || null);
      return send(res, 200, JSON.stringify(result), {
        "Content-Type": "application/json; charset=utf-8",
        "X-M3UCINE-Source": baseHint || xtreamBases[0] || "",
      });
    }

    const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = path.normalize(path.join(root, pathname));

    if (!filePath.startsWith(root)) {
      return send(res, 403, "Forbidden");
    }

    const data = await readFile(filePath);
    return send(res, 200, data, { "Content-Type": contentTypeFor(filePath) });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return send(res, 404, "Not found");
    }
    console.error(error);
    return send(res, 500, "Internal server error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`${appName} listening on http://0.0.0.0:${port}/`);
});
