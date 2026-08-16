import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

const STAFF_COOKIE = "kintai_staff";
const ADMIN_COOKIE = "kintai_admin";

const STAFF_MAX_AGE = 60 * 60 * 24 * 180; // 180 days
const ADMIN_MAX_AGE = 60 * 60 * 12; // 12 hours

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

async function sign(payload: Record<string, unknown>, maxAgeSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .sign(getSecretKey());
}

async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as T;
  } catch {
    return null;
  }
}

export async function setStaffCookie(staffId: string) {
  const token = await sign({ staffId }, STAFF_MAX_AGE);
  const store = await cookies();
  store.set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STAFF_MAX_AGE,
    path: "/",
  });
}

export async function getStaffId(): Promise<string | null> {
  const store = await cookies();
  const payload = await verify<{ staffId: string }>(
    store.get(STAFF_COOKIE)?.value
  );
  return payload?.staffId ?? null;
}

export async function clearStaffCookie() {
  const store = await cookies();
  store.delete(STAFF_COOKIE);
}

export async function setAdminCookie() {
  const token = await sign({ admin: true }, ADMIN_MAX_AGE);
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_MAX_AGE,
    path: "/",
  });
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const payload = await verify<{ admin: boolean }>(
    store.get(ADMIN_COOKIE)?.value
  );
  return payload?.admin === true;
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    redirect("/admin/gate");
  }
}
