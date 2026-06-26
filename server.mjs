import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 8787);
const upstreamTimeoutMs = 5000;
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
        "User-Agent": "Mozilla/5.0 NebulaPlayIPTV/1.0",
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
    title: stream.name || stream.title || "Filme sem titulo",
    group: stream.category_name || stream.categoryName || "Filmes",
    type: "movie",
    url: makeMovieUrl(base, stream),
    logo: stream.stream_icon || stream.cover || "",
    source: "Xtream",
  };
}

function normalizeEpisode(base, series, episode, seasonName) {
  return {
    id: `series-${episode.id}`,
    title: `${series.name || "Serie"} - ${episode.title || episode.name || seasonName || "Episodio"}`,
    group: series.name || "Series",
    type: "series",
    url: makeSeriesUrl(base, episode),
    logo: episode.info?.movie_image || series.cover || series.cover_big || "",
    source: "Xtream",
  };
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
      ...series.slice(0, 2000).map((show) => ({
        id: `series-${show.series_id}`,
        title: show.name || "Serie sem titulo",
        group: "Series",
        type: "series",
        url: `${base}/series/${xtreamUser}/${xtreamPassword}/${show.series_id}.mp4`,
        logo: show.cover || show.cover_big || "",
        source: "Xtream",
      }))
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
        "X-Nebula-Source": result.target,
      });
    }

    if (requestUrl.pathname === "/api/default-library") {
      const result = await fetchFirstWorkingXtreamLibrary();
      if (!result.items.length) {
        return send(res, 502, `No Xtream source worked: ${result.errors.join("; ")}`);
      }

      return send(res, 200, JSON.stringify(result.items), {
        "Content-Type": "application/json; charset=utf-8",
        "X-Nebula-Source": result.base,
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
  console.log(`Nebula Play listening on http://0.0.0.0:${port}/`);
});
