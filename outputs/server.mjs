import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 10000);
const upstreamTimeoutMs = 5000;
const appName = process.env.APP_NAME || "M3UCINE";
const xtreamUser = process.env.XTREAM_USER || "50971241";
const xtreamPassword = process.env.XTREAM_PASSWORD || "91170499";
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
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function contentTypeFor(filePath) {
  return types.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
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

async function fetchText(target) {
  const response = await fetchM3u(target);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
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
        return { response, target };
      }
      errors.push(`${target} -> HTTP ${response.status}`);
    } catch (error) {
      errors.push(`${target} -> ${error && error.name === "AbortError" ? "timeout" : "falhou"}`);
    }
  }

  return { response: null, target: null, errors };
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

  if (Array.isArray(movies)) {
    items.push(...movies.slice(0, 2000).map((stream) => normalizeMovie(base, stream)));
  }

  if (Array.isArray(series)) {
    items.push(
      ...series.slice(0, 2000).map((show) => normalizeSeriesShow(base, show))
    );
  }

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

  return items;
}

async function fetchXtreamSeriesInfoFromBase(base, seriesId) {
  const auth = `username=${encodeURIComponent(xtreamUser)}&password=${encodeURIComponent(xtreamPassword)}`;
  const url = `${base}/player_api.php?${auth}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;
  const payload = await fetchJson(url);
  return normalizeSeriesInfo(base, seriesId, payload);
}

async function fetchFirstWorkingXtreamLibrary() {
  const errors = [];

  for (const base of xtreamBases) {
    try {
      const items = await fetchXtreamLibraryFromBase(base);
      if (items.length) {
        return { items, base };
      }
      errors.push(`${base} -> sem itens`);
    } catch (error) {
      errors.push(`${base} -> ${error.message || "falhou"}`);
    }
  }

  return { items: [], base: null, errors };
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

    if (requestUrl.pathname === "/api/default-m3u" || requestUrl.pathname === "/api/fetch-m3u") {
      const targets =
        requestUrl.pathname === "/api/default-m3u"
          ? defaultM3uUrls
          : [requestUrl.searchParams.get("url")].filter(Boolean);
      if (!targets.length) {
        return send(res, 400, "Missing url parameter");
      }

      const result = await fetchFirstWorkingM3u(targets);
      if (!result.response) {
        return send(res, 502, `No M3U source worked: ${result.errors.join("; ")}`);
      }

      const text = await result.response.text();
      return send(res, 200, text, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-M3UCINE-Source": result.target,
      });
    }

    if (requestUrl.pathname === "/api/default-library") {
      const result = await fetchFirstWorkingXtreamLibrary();
      if (!result.items.length) {
        return send(res, 502, `No Xtream source worked: ${result.errors.join("; ")}`);
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
