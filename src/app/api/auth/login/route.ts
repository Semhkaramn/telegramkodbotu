import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { checkRateLimit, incrementRateLimit, resetRateLimit, getClientIP } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    // Rate limit kontrolü - sadece kontrol, sayaç artırmaz
    const rateLimitResult = checkRateLimit(clientIP);

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Cok fazla basarisiz deneme. ${Math.ceil(retryAfter / 60)} dakika sonra tekrar deneyin.`,
          retryAfter
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          }
        }
      );
    }

    const body = await request.json();
    const { username, password, type = "user" } = body; // type: "admin" veya "user"

    if (!username || !password) {
      return NextResponse.json(
        { error: "Kullanici adi ve sifre gerekli" },
        { status: 400 }
      );
    }

    // Admin girişi
    if (type === "admin") {
      const admin = await prisma.admin.findFirst({
        where: {
          username: {
            equals: username,
            mode: 'insensitive'
          }
        },
      });

      if (!admin) {
        incrementRateLimit(clientIP);
        return NextResponse.json(
          { error: "Kullanici adi veya sifre hatali" },
          { status: 401 }
        );
      }

      const isValid = await verifyPassword(password, admin.password);
      if (!isValid) {
        incrementRateLimit(clientIP);
        return NextResponse.json(
          { error: "Kullanici adi veya sifre hatali" },
          { status: 401 }
        );
      }

      // Admin session oluştur
      await createSession({
        userId: admin.id,
        username: admin.username,
        role: "admin",
      });

      resetRateLimit(clientIP);

      return NextResponse.json({
        success: true,
        user: {
          id: admin.id,
          username: admin.username,
          role: "admin",
        },
      });
    }

    // User girişi (varsayılan)
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive'
        }
      },
    });

    if (!user) {
      incrementRateLimit(clientIP);
      return NextResponse.json(
        { error: "Kullanici adi veya sifre hatali" },
        { status: 401 }
      );
    }

    // Kullanıcı aktif mi kontrol et
    if (!user.isActive) {
      incrementRateLimit(clientIP);
      return NextResponse.json(
        { error: "Hesabiniz devre disi birakilmis. Yonetici ile iletisime gecin." },
        { status: 403 }
      );
    }

    // Kullanıcı banlı mı kontrol et
    if (user.isBanned) {
      incrementRateLimit(clientIP);
      const reason = user.bannedReason ? ` Sebep: ${user.bannedReason}` : "";
      return NextResponse.json(
        { error: `Hesabiniz askiya alinmis.${reason} Yonetici ile iletisime gecin.` },
        { status: 403 }
      );
    }

    // Şifre kontrolü
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      incrementRateLimit(clientIP);
      return NextResponse.json(
        { error: "Kullanici adi veya sifre hatali" },
        { status: 401 }
      );
    }

    // User session oluştur
    await createSession({
      userId: user.id,
      username: user.username,
      role: "user",
    });

    resetRateLimit(clientIP);

    // Kullanıcının tam adını oluştur
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName,
        telegramUsername: user.telegramUsername,
        photoUrl: user.photoUrl,
        role: "user",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Sunucu hatasi" },
      { status: 500 }
    );
  }
}
