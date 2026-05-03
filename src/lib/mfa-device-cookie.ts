const encoder = new TextEncoder();

function getSecret() {
  return (
    process.env.MFA_COOKIE_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

async function hmacHex(data: string) {
  const secret = getSecret();
  if (!secret) return "";

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createMfaDeviceCookieValue(userId: string, role: string) {
  const issuedAt = Date.now();
  const payload = `${issuedAt}.${userId}.${role}`;
  const signature = await hmacHex(payload);
  return `${payload}.${signature}`;
}

export async function verifyMfaDeviceCookieValue(
  value: string | undefined,
  userId: string,
  role: string
) {
  if (!value) return null;

  const [issuedAtRaw, cookieUserId, cookieRole, signature] = value.split(".");
  if (!issuedAtRaw || !cookieUserId || !cookieRole || !signature) return null;
  if (cookieUserId !== userId || cookieRole !== role) return null;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return null;

  const expected = await hmacHex(`${issuedAtRaw}.${cookieUserId}.${cookieRole}`);
  if (!expected || expected !== signature) return null;

  return { issuedAt };
}
