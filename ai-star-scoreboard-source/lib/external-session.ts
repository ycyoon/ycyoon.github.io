import type { ChatGPTUser } from "../app/chatgpt-auth";

type ExternalTokenKind = "bootstrap" | "session";

type ExternalTokenPayload = {
  version: 1;
  kind: ExternalTokenKind;
  email: string;
  displayName: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

const TOKEN_PREFIX = "v1";
const BOOTSTRAP_LIFETIME_SECONDS = 5 * 60;
const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

export async function createBootstrapToken(user: ChatGPTUser) {
  return createToken("bootstrap", user, BOOTSTRAP_LIFETIME_SECONDS);
}

export async function createExternalSessionToken(user: ChatGPTUser) {
  return createToken("session", user, SESSION_LIFETIME_SECONDS);
}

export async function verifyBootstrapToken(token: string) {
  return verifyToken(token, "bootstrap");
}

export async function verifyExternalSessionToken(token: string) {
  return verifyToken(token, "session");
}

async function createToken(
  kind: ExternalTokenKind,
  user: ChatGPTUser,
  lifetimeSeconds: number,
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: ExternalTokenPayload = {
    version: 1,
    kind,
    email: user.email.trim().toLowerCase(),
    displayName: user.displayName.slice(0, 200),
    issuedAt,
    expiresAt: issuedAt + lifetimeSeconds,
    nonce: randomToken(18),
  };
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signedValue = `${TOKEN_PREFIX}.${encodedPayload}`;
  const signature = await sign(signedValue);
  return `${signedValue}.${bytesToBase64Url(signature)}`;
}

async function verifyToken(token: string, expectedKind: ExternalTokenKind) {
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;

  try {
    const signedValue = `${parts[0]}.${parts[1]}`;
    const signature = base64UrlToBytes(parts[2]);
    if (!(await verifySignature(signedValue, signature))) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(parts[1])),
    ) as Partial<ExternalTokenPayload>;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.version !== 1 ||
      payload.kind !== expectedKind ||
      typeof payload.email !== "string" ||
      !payload.email.includes("@") ||
      typeof payload.displayName !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.issuedAt > now + 60 ||
      payload.expiresAt <= now
    ) {
      return null;
    }

    return {
      displayName: payload.displayName,
      email: payload.email.trim().toLowerCase(),
      fullName: payload.displayName,
    } satisfies ChatGPTUser;
  } catch {
    return null;
  }
}

async function sign(value: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return new Uint8Array(signature);
}

async function verifySignature(value: string, signature: Uint8Array) {
  const key = await getSigningKey();
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(value),
  );
}

async function getSigningKey() {
  const { env } = await import("cloudflare:workers");
  const secret = env.EXTERNAL_SESSION_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("EXTERNAL_SESSION_SECRET is not configured.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function randomToken(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
