interface Env {
  ENVIRONMENT: string;
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

type Platform = "twitch" | "youtube" | "kick";
type Route = "viewers" | "followers" | "subs";

type ApiPayload = {
  count: number;
  cached: boolean;
  channel?: string;
  demo?: boolean;
  error?: string;
  platform?: string;
};

type JsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type TwitchTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type TwitchUsersResponse = {
  data?: Array<{ id?: string }>;
};

type TwitchStreamsResponse = {
  data?: Array<{ viewer_count?: number }>;
};

type TwitchFollowersResponse = {
  total?: number;
};

type KickChannelResponse = {
  followers_count?: number;
  livestream?: {
    viewer_count?: number;
  } | null;
};

const CACHE_TTL_SECONDS = 60;
const CACHE_NAME = "pulse-api-cache";
const TWITCH_TOKEN_CACHE_KEY = "https://pulse-api.internal/cache/twitch-token";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export default {
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return jsonResponse({ count: 0, cached: false, error: "method_not_allowed" });
    }

    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      return jsonResponse({
        count: 0,
        cached: false,
        error: normalizeError(error),
      });
    }
  },
};

async function handleRequest(
  request: Request,
  env: Env,
  ctx: WorkerExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const route = getRoute(url.pathname);

  if (!route) {
    return jsonResponse({ count: 0, cached: false, error: "not_found" });
  }

  const platformValue = url.searchParams.get("platform");
  const channel = url.searchParams.get("channel")?.trim();

  if (!isPlatform(platformValue)) {
    return jsonResponse({
      count: 0,
      cached: false,
      channel: channel ?? "",
      error: "invalid_platform",
      platform: platformValue ?? "",
    });
  }

  if (!channel) {
    return jsonResponse({
      count: 0,
      cached: false,
      channel: "",
      error: "missing_channel",
      platform: platformValue,
    });
  }

  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    const payload = (await cachedResponse.json()) as ApiPayload;
    return jsonResponse({ ...payload, cached: true });
  }

  const payload = await getRoutePayload(route, platformValue, channel, env);
  const response = jsonResponse(payload);

  ctx.waitUntil(
    cache.put(
      cacheKey,
      jsonResponse({ ...payload, cached: false }, CACHE_TTL_SECONDS),
    ),
  );

  return response;
}

async function getRoutePayload(
  route: Route,
  platform: Platform,
  channel: string,
  env: Env,
): Promise<ApiPayload> {
  if (route === "subs") {
    return {
      count: 0,
      cached: false,
      channel,
      error: "requires_oauth",
      platform,
    };
  }

  if (route === "viewers" && platform === "youtube") {
    return {
      count: 0,
      cached: false,
      channel,
      error: "youtube_not_implemented",
      platform,
    };
  }

  if (platform === "twitch") {
    if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
      return {
        count: randomDemoCount(),
        cached: false,
        channel,
        demo: true,
        platform,
      };
    }

    if (route === "viewers") {
      return getTwitchViewers(channel, env);
    }

    return getTwitchFollowers(channel, env);
  }

  if (platform === "kick") {
    const kickChannel = await getKickChannel(channel);

    if (!kickChannel.ok) {
      return {
        count: 0,
        cached: false,
        channel,
        error: kickChannel.error,
        platform,
      };
    }

    if (route === "viewers") {
      return {
        count: kickChannel.data.livestream?.viewer_count ?? 0,
        cached: false,
        channel,
        platform,
      };
    }

    return {
      count: kickChannel.data.followers_count ?? 0,
      cached: false,
      channel,
      platform,
    };
  }

  return {
    count: 0,
    cached: false,
    channel,
    error: "unsupported_platform",
    platform,
  };
}

async function getTwitchViewers(channel: string, env: Env): Promise<ApiPayload> {
  const tokenResult = await getTwitchAccessToken(env);

  if (!tokenResult.ok) {
    return {
      count: 0,
      cached: false,
      channel,
      error: tokenResult.error,
      platform: "twitch",
    };
  }

  const streamResult = await fetchJson<TwitchStreamsResponse>(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
    {
      headers: twitchHeaders(env, tokenResult.data),
    },
  );

  if (!streamResult.ok) {
    return {
      count: 0,
      cached: false,
      channel,
      error: streamResult.error,
      platform: "twitch",
    };
  }

  return {
    count: streamResult.data.data?.[0]?.viewer_count ?? 0,
    cached: false,
    channel,
    platform: "twitch",
  };
}

async function getTwitchFollowers(channel: string, env: Env): Promise<ApiPayload> {
  const tokenResult = await getTwitchAccessToken(env);

  if (!tokenResult.ok) {
    return {
      count: 0,
      cached: false,
      channel,
      error: tokenResult.error,
      platform: "twitch",
    };
  }

  const userResult = await fetchJson<TwitchUsersResponse>(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`,
    {
      headers: twitchHeaders(env, tokenResult.data),
    },
  );

  if (!userResult.ok) {
    return {
      count: 0,
      cached: false,
      channel,
      error: userResult.error,
      platform: "twitch",
    };
  }

  const broadcasterId = userResult.data.data?.[0]?.id;

  if (!broadcasterId) {
    return {
      count: 0,
      cached: false,
      channel,
      error: "channel_not_found",
      platform: "twitch",
    };
  }

  const followersResult = await fetchJson<TwitchFollowersResponse>(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
    {
      headers: twitchHeaders(env, tokenResult.data),
    },
  );

  if (!followersResult.ok) {
    return {
      count: 0,
      cached: false,
      channel,
      error: followersResult.error,
      platform: "twitch",
    };
  }

  return {
    count: followersResult.data.total ?? 0,
    cached: false,
    channel,
    platform: "twitch",
  };
}

async function getKickChannel(channel: string): Promise<JsonResult<KickChannelResponse>> {
  return fetchJson<KickChannelResponse>(
    `https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`,
  );
}

async function getTwitchAccessToken(env: Env): Promise<JsonResult<string>> {
  const cache = await caches.open(CACHE_NAME);
  const cachedTokenResponse = await cache.match(TWITCH_TOKEN_CACHE_KEY);

  if (cachedTokenResponse) {
    const cachedToken = await cachedTokenResponse.text();

    if (cachedToken) {
      return { ok: true, data: cachedToken };
    }
  }

  const tokenUrl = new URL("https://id.twitch.tv/oauth2/token");
  tokenUrl.searchParams.set("client_id", env.TWITCH_CLIENT_ID ?? "");
  tokenUrl.searchParams.set("client_secret", env.TWITCH_CLIENT_SECRET ?? "");
  tokenUrl.searchParams.set("grant_type", "client_credentials");

  const tokenResult = await fetchJson<TwitchTokenResponse>(tokenUrl.toString(), {
    method: "POST",
  });

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const accessToken = tokenResult.data.access_token;

  if (!accessToken) {
    return { ok: false, error: "missing_twitch_access_token" };
  }

  const tokenTtlSeconds = Math.max(
    CACHE_TTL_SECONDS,
    Math.min((tokenResult.data.expires_in ?? 0) - 300, 60 * 24 * 60 * 60),
  );

  await cache.put(
    TWITCH_TOKEN_CACHE_KEY,
    new Response(accessToken, {
      headers: {
        "Cache-Control": `public, max-age=${tokenTtlSeconds}`,
      },
    }),
  );

  return { ok: true, data: accessToken };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<JsonResult<T>> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }

  if (!response.ok) {
    return { ok: false, error: `upstream_${response.status}` };
  }

  try {
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

function getRoute(pathname: string): Route | null {
  switch (pathname) {
    case "/api/viewers":
      return "viewers";
    case "/api/followers":
      return "followers";
    case "/api/subs":
      return "subs";
    default:
      return null;
  }
}

function isPlatform(value: string | null): value is Platform {
  return value === "twitch" || value === "youtube" || value === "kick";
}

function twitchHeaders(env: Env, token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Client-Id": env.TWITCH_CLIENT_ID ?? "",
  };
}

function jsonResponse(payload: ApiPayload, maxAgeSeconds?: number): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": corsHeaders["Access-Control-Allow-Origin"],
      "Access-Control-Allow-Methods": corsHeaders["Access-Control-Allow-Methods"],
      "Cache-Control": maxAgeSeconds
        ? `public, max-age=${maxAgeSeconds}`
        : "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "unknown_error";
}

function randomDemoCount(): number {
  return Math.floor(Math.random() * 4901) + 100;
}
