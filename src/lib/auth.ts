import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

// Issue #13 fix: Fallback secret kaldırıldı - production'da JWT_SECRET zorunlu
const jwtSecretValue = process.env.JWT_SECRET;
if (!jwtSecretValue) {
  console.error("❌ KRİTİK HATA: JWT_SECRET environment variable tanımlanmamış!");
  // Development'ta uyarı ver ama çalışmaya devam et
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production environment");
  }
}
const JWT_SECRET = new TextEncoder().encode(
  jwtSecretValue || "dev-only-fallback-DO-NOT-USE-IN-PRODUCTION"
);

export interface SessionPayload {
  userId: number;
  username: string;
  role: "admin" | "user"; // Artık sadece admin veya user
  impersonatingUserId?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

// Admin tablosundan admin bilgisi al
export async function getAdmin(adminId: number) {
  return prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      username: true,
      createdAt: true,
    },
  });
}

// User tablosundan kullanıcı bilgisi al
export async function getUser(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      telegramId: true,
      telegramUsername: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      lastSeen: true,
      isActive: true,
      isBanned: true,
      bannedAt: true,
      bannedReason: true,
      botEnabled: true,
      createdAt: true,
    },
  });
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  if (session.role === "admin") {
    const admin = await getAdmin(session.userId);
    if (!admin) return null;
    return {
      ...admin,
      role: "admin" as const,
    };
  }

  const user = await getUser(session.userId);
  if (!user) return null;
  return {
    ...user,
    role: "user" as const,
  };
}

export async function setImpersonation(targetUserId: number): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "Yetkisiz erişim" };
  }

  // Issue #9 fix: Hedef kullanıcının var olduğunu kontrol et
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, isActive: true, isBanned: true },
  });

  if (!targetUser) {
    return { success: false, error: "Hedef kullanıcı bulunamadı" };
  }

  if (!targetUser.isActive) {
    return { success: false, error: "Hedef kullanıcı aktif değil" };
  }

  if (targetUser.isBanned) {
    return { success: false, error: "Hedef kullanıcı yasaklı" };
  }

  await createSession({
    ...session,
    impersonatingUserId: targetUserId,
  });

  return { success: true };
}

export async function clearImpersonation(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { impersonatingUserId: _removed, ...rest } = session;
  await createSession(rest);
}

export async function getEffectiveUser() {
  const session = await getSession();
  if (!session) return null;

  // Admin ise ve impersonation yapıyorsa
  if (session.impersonatingUserId && session.role === "admin") {
    const targetUser = await getUser(session.impersonatingUserId);

    if (targetUser) {
      const admin = await getAdmin(session.userId);
      return {
        ...targetUser,
        role: "user" as const,
        isImpersonating: true,
        realUser: admin ? {
          id: admin.id,
          username: admin.username,
          role: "admin" as const,
        } : null,
      };
    }
  }

  const currentUser = await getCurrentUser();
  return currentUser ? { ...currentUser, isImpersonating: false } : null;
}
