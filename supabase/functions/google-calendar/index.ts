const encoder = new TextEncoder();
const decoder = new TextDecoder();
const API_ORIGIN = "https://www.googleapis.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};
type GoogleTokenBundle = { access_token?: string; refresh_token: string };
type GoogleCalendarEventBody = {
  summary: string;
  location?: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  recurrence?: string[];
};
type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};
type GoogleApiResult = GoogleCalendarEvent & {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  error?: { message?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function sessionSecret(): string {
  const value = requiredEnv("APP_SESSION_SECRET");
  if (value.length < 32) throw new Error("APP_SESSION_SECRET must contain at least 32 characters.");
  return value;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64(value: string): Uint8Array {
  const standard = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(standard + "=".repeat((4 - standard.length % 4) % 4)), (character) => character.charCodeAt(0));
}

async function sha256(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function sign(value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function createSession(googleUserId: string): Promise<string> {
  const payload = base64Url(encoder.encode(JSON.stringify({
    sub: googleUserId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  })));
  return `${payload}.${base64Url(await sign(payload))}`;
}

async function verifySession(request: Request): Promise<string> {
  const value = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!value) throw new Response("Google Calendar session is missing.", { status: 401 });
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra || payload.length > 4096 ||
    !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) {
    throw new Response("Google Calendar session is invalid.", { status: 401 });
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let valid = false;
  try {
    valid = await crypto.subtle.verify("HMAC", key, fromBase64(signature), encoder.encode(payload));
  } catch {
    throw new Response("Google Calendar session is invalid.", { status: 401 });
  }
  if (!valid) throw new Response("Google Calendar session is invalid.", { status: 401 });
  let claims: { sub?: string; exp?: number };
  try {
    claims = JSON.parse(decoder.decode(fromBase64(payload)));
  } catch {
    throw new Response("Google Calendar session is invalid.", { status: 401 });
  }
  if (!claims.sub || !claims.exp || claims.exp <= Date.now() / 1000) {
    throw new Response("Google Calendar session has expired.", { status: 401 });
  }
  return claims.sub;
}

async function encryptedTokenBundle(value: string): Promise<string> {
  const rawKey = fromBase64(requiredEnv("GOOGLE_TOKEN_ENCRYPTION_KEY"));
  if (rawKey.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

async function decryptTokenBundle(value: string): Promise<string> {
  const [encodedIv, encodedCiphertext] = value.split(".");
  const rawKey = fromBase64(requiredEnv("GOOGLE_TOKEN_ENCRYPTION_KEY"));
  if (rawKey.length !== 32 || !encodedIv || !encodedCiphertext) throw new Error("Stored Google token could not be decrypted.");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(encodedIv) },
    key,
    fromBase64(encodedCiphertext),
  );
  return decoder.decode(plaintext);
}

function corsHeaders(request: Request): Headers {
  const allowedOrigin = requiredEnv("APP_ORIGIN").replace(/\/$/, "");
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Vary": "Origin",
  });
  if (origin === allowedOrigin) headers.set("Access-Control-Allow-Origin", allowedOrigin);
  return headers;
}

function json(request: Request, body: unknown, status = 200): Response {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
}

function supabaseUrl(path: string): URL {
  return new URL(`/rest/v1/${path}`, requiredEnv("SUPABASE_URL"));
}

async function database<T = unknown>(
  table: string,
  method: string,
  params: Record<string, string>,
  body?: unknown,
  prefer?: string,
): Promise<T | null> {
  const url = supabaseUrl(table);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const headers = new Headers({ apikey: serviceKey, Authorization: `Bearer ${serviceKey}` });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (prefer) headers.set("Prefer", prefer);
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Calendar database request failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) as T : null;
}

async function googleTokenRequest(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result: GoogleTokenResponse = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.error || "Google OAuth token request failed.");
  if (!result.access_token) throw new Error("Google OAuth response did not include an access token.");
  return result;
}

function validCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validGoogleEventBody(body: unknown): body is GoogleCalendarEventBody {
  if (!isRecord(body) || typeof body.summary !== "string" || !body.summary.trim()) return false;
  const start = body.start;
  const end = body.end;
  if (!isRecord(start) || !isRecord(end)) return false;
  const startDate = start.date;
  const endDate = end.date;
  const startDateTime = start.dateTime;
  const endDateTime = end.dateTime;
  let startValue: number;
  let endValue: number;
  if (typeof startDate === "string" && typeof endDate === "string") {
    if (!validCalendarDate(startDate) || !validCalendarDate(endDate)) return false;
    startValue = Date.parse(`${startDate}T00:00:00Z`);
    endValue = Date.parse(`${endDate}T00:00:00Z`);
  } else if (typeof startDateTime === "string" && typeof endDateTime === "string" &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(startDateTime) && /(?:Z|[+-]\d{2}:\d{2})$/.test(endDateTime)) {
    startValue = Date.parse(startDateTime);
    endValue = Date.parse(endDateTime);
  } else {
    return false;
  }
  const recurrence = body.recurrence;
  if (recurrence !== undefined && (
    !Array.isArray(recurrence) ||
    recurrence.length !== 1 ||
    typeof recurrence[0] !== "string" ||
    !/^RRULE:FREQ=(DAILY|WEEKLY|MONTHLY)(?:;UNTIL=\d{8}(?:T\d{6}Z)?)?$/.test(recurrence[0])
  )) return false;
  return Number.isFinite(startValue) && Number.isFinite(endValue) && endValue > startValue;
}

async function googleApi(
  googleUserId: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<GoogleApiResult | null> {
  const rows = await database<Array<{ email: string; token_bundle_enc: string; token_expires_at: string }>>("google_calendar_connections", "GET", {
    select: "email,token_bundle_enc,token_expires_at",
    google_user_id: `eq.${googleUserId}`,
    limit: "1",
  });
  const connection = rows?.[0];
  if (!connection) throw new Response("Google Calendar is no longer connected. Connect it again in Renova.", { status: 401 });

  let bundle = JSON.parse(await decryptTokenBundle(connection.token_bundle_enc)) as GoogleTokenBundle;
  let expiresAt = new Date(connection.token_expires_at).getTime();
  if (!bundle.access_token || expiresAt <= Date.now() + 60_000) {
    if (!bundle.refresh_token) throw new Response("Google refresh token is missing. Disconnect and reconnect Google Calendar.", { status: 401 });
    let refreshed: GoogleTokenResponse;
    try {
      refreshed = await googleTokenRequest(new URLSearchParams({
        client_id: requiredEnv("GOOGLE_CLIENT_ID"),
        client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
        refresh_token: bundle.refresh_token,
        grant_type: "refresh_token",
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes("invalid_grant")) {
        throw new Response("Google authorization expired or was revoked. Disconnect and reconnect Google Calendar.", { status: 401 });
      }
      throw error;
    }
    bundle = { ...bundle, access_token: refreshed.access_token };
    expiresAt = Date.now() + Number(refreshed.expires_in || 3600) * 1000;
    await database("google_calendar_connections", "PATCH", {
      google_user_id: `eq.${googleUserId}`,
    }, {
      token_bundle_enc: await encryptedTokenBundle(JSON.stringify(bundle)),
      token_expires_at: new Date(expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const response = await fetch(new URL(path, API_ORIGIN), {
    method,
    headers: {
      Authorization: `Bearer ${bundle.access_token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const result: GoogleApiResult | null = text ? JSON.parse(text) as GoogleApiResult : null;
  if (!response.ok) {
    const message = result?.error?.message || `Google Calendar request failed (${response.status}).`;
    throw new Response(message, { status: response.status === 404 ? 404 : 502 });
  }
  return result;
}

function safeCallbackUrl(): string {
  return `${requiredEnv("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/google-calendar`;
}

function validDate(value: string | null): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ||
    (request.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error")) ? "callback" : "");

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });

  if (request.method === "GET" && action === "connect") {
    const expirationCutoff = new Date().toISOString();
    await database("google_calendar_oauth_states", "DELETE", { expires_at: `lt.${expirationCutoff}` }, undefined, "return=minimal");
    await database("google_calendar_tickets", "DELETE", { expires_at: `lt.${expirationCutoff}` }, undefined, "return=minimal");
    const state = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    await database("google_calendar_oauth_states", "POST", {}, {
      state_hash: await sha256(state),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    }, "return=minimal");
    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.search = new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      redirect_uri: safeCallbackUrl(),
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString();
    return redirect(authorization.toString());
  }

  if (request.method === "GET" && action === "callback") {
    const appOrigin = requiredEnv("APP_ORIGIN").replace(/\/$/, "");
    try {
      if (url.searchParams.get("error")) throw new Error("Google authorization was cancelled.");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) throw new Error("Google authorization response is incomplete.");
      const consumed = await database<Array<{ state_hash: string }>>("google_calendar_oauth_states", "DELETE", {
        state_hash: `eq.${await sha256(state)}`,
        expires_at: `gt.${new Date().toISOString()}`,
      }, undefined, "return=representation");
      if (!consumed?.length) throw new Error("Google authorization expired or was already used.");

      const tokens = await googleTokenRequest(new URLSearchParams({
        code,
        client_id: requiredEnv("GOOGLE_CLIENT_ID"),
        client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
        redirect_uri: safeCallbackUrl(),
        grant_type: "authorization_code",
      }));
      const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!userResponse.ok) throw new Error("Google account details could not be verified.");
      const user = await userResponse.json() as { sub?: string; email?: string };
      if (!user.sub || !user.email) throw new Error("Google did not return a verified account.");

      const existing = await database<Array<{ token_bundle_enc: string }>>("google_calendar_connections", "GET", {
        select: "token_bundle_enc",
        google_user_id: `eq.${user.sub}`,
        limit: "1",
      });
      let refreshToken = tokens.refresh_token;
      if (!refreshToken && existing?.[0]?.token_bundle_enc) {
        refreshToken = (JSON.parse(await decryptTokenBundle(existing[0].token_bundle_enc)) as GoogleTokenBundle).refresh_token;
      }
      if (!refreshToken) throw new Error("Google did not issue a refresh token. Remove Renova from your Google account's connected apps, then reconnect.");

      await database("google_calendar_connections", "POST", { on_conflict: "google_user_id" }, {
        google_user_id: user.sub,
        email: user.email,
        token_bundle_enc: await encryptedTokenBundle(JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: refreshToken,
        })),
        token_expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, "resolution=merge-duplicates,return=minimal");

      const ticket = base64Url(crypto.getRandomValues(new Uint8Array(32)));
      await database("google_calendar_tickets", "POST", {}, {
        ticket_hash: await sha256(ticket),
        google_user_id: user.sub,
        email: user.email,
        expires_at: new Date(Date.now() + 2 * 60_000).toISOString(),
      }, "return=minimal");
      return redirect(`${appOrigin}/?gcal_ticket=${encodeURIComponent(ticket)}#calendar`);
    } catch (error) {
      console.error("Google Calendar OAuth callback failed:", error);
      const message = url.searchParams.get("error")
        ? "Google authorization was cancelled."
        : "Google Calendar connection failed. Check server configuration and try again.";
      return redirect(`${appOrigin}/?gcal_error=${encodeURIComponent(message)}#calendar`);
    }
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== requiredEnv("APP_ORIGIN").replace(/\/$/, "")) {
    return json(request, { error: "Request origin is not allowed." }, 403);
  }

  try {
    if (action === "exchange" && request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json(request, { error: "A valid JSON OAuth ticket is required." }, 400);
      }
      if (!isRecord(body) || typeof body.ticket !== "string") return json(request, { error: "OAuth handoff ticket is required." }, 400);
      const tickets = await database<Array<{ google_user_id: string; email: string }>>("google_calendar_tickets", "DELETE", {
        ticket_hash: `eq.${await sha256(body.ticket)}`,
        expires_at: `gt.${new Date().toISOString()}`,
      }, undefined, "return=representation");
      const ticket = tickets?.[0];
      if (!ticket) return json(request, { error: "Google Calendar connection link expired or was already used." }, 401);
      return json(request, {
        token: await createSession(ticket.google_user_id),
        email: ticket.email,
      });
    }

    if (action === "events" && request.method === "GET") {
      const googleUserId = await verifySession(request);
      const timeMin = url.searchParams.get("timeMin");
      const timeMax = url.searchParams.get("timeMax");
      if (!validDate(timeMin) || !validDate(timeMax) || Date.parse(timeMax!) <= Date.parse(timeMin!)) {
        return json(request, { error: "A valid event date range is required." }, 400);
      }
      const events: unknown[] = [];
      let pageToken = "";
      do {
        const query = new URLSearchParams({
          timeMin: timeMin!,
          timeMax: timeMax!,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "2500",
        });
        if (pageToken) query.set("pageToken", pageToken);
        const page = await googleApi(googleUserId, `/calendar/v3/calendars/primary/events?${query}`);
        events.push(...(page?.items || []));
        pageToken = page?.nextPageToken || "";
      } while (pageToken);
      return json(request, { events });
    }

    if (action === "events" && request.method === "POST") {
      const googleUserId = await verifySession(request);
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json(request, { error: "A valid JSON event is required." }, 400);
      }
      if (!validGoogleEventBody(body)) return json(request, { error: "A title and valid event start/end are required." }, 400);
      return json(request, await googleApi(googleUserId, "/calendar/v3/calendars/primary/events", "POST", body), 201);
    }

    if (action === "event" && (request.method === "PATCH" || request.method === "DELETE")) {
      const googleUserId = await verifySession(request);
      const eventId = url.searchParams.get("id");
      if (!eventId || eventId.length > 1024) return json(request, { error: "A valid Google event ID is required." }, 400);
      const path = `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
      if (request.method === "DELETE") {
        await googleApi(googleUserId, path, "DELETE");
        return json(request, { deleted: true });
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json(request, { error: "A valid JSON event is required." }, 400);
      }
      if (!validGoogleEventBody(body)) return json(request, { error: "A title and valid event start/end are required." }, 400);
      return json(request, await googleApi(googleUserId, path, "PATCH", body));
    }

    if (action === "disconnect" && request.method === "DELETE") {
      const googleUserId = await verifySession(request);
      await database("google_calendar_connections", "DELETE", {
        google_user_id: `eq.${googleUserId}`,
      }, undefined, "return=minimal");
      return json(request, { disconnected: true });
    }

    return json(request, { error: "Unsupported Google Calendar operation." }, 404);
  } catch (error) {
    if (error instanceof Response) {
      return json(request, { error: await error.text() }, error.status);
    }
    const message = error instanceof Error ? error.message : "Google Calendar request failed.";
    console.error(message);
    return json(request, { error: "Google Calendar operation failed. Check Supabase function logs for details." }, 500);
  }
});
