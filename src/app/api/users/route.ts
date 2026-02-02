import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

// GET - Tüm kullanıcıları listele (admin only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
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
        updatedAt: true,
        _count: {
          select: { channels: true, adminLinks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // BigInt'leri string'e çevir ve fullName ekle
    const formattedUsers = users.map((user) => ({
      ...user,
      telegramId: user.telegramId ? user.telegramId.toString() : null,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// POST - Yeni kullanıcı oluştur (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, telegramId, telegramUsername, firstName, lastName } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Kullanıcı adı ve şifre gerekli" },
        { status: 400 }
      );
    }

    // Kullanıcı adı kontrolü
    const existing = await prisma.user.findUnique({
      where: { username },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu kullanıcı adı zaten kullanılıyor" },
        { status: 400 }
      );
    }

    // Telegram ID kontrolü (eğer verilmişse)
    if (telegramId) {
      const existingTelegram = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
      });

      if (existingTelegram) {
        return NextResponse.json(
          { error: "Bu Telegram ID zaten başka bir kullanıcıya bağlı" },
          { status: 400 }
        );
      }
    }

    // Şifreyi hash'le
    const hashedPassword = await hashPassword(password);

    // Kullanıcı oluştur
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        telegramId: telegramId ? BigInt(telegramId) : null,
        telegramUsername: telegramUsername || null,
        firstName: firstName || null,
        lastName: lastName || null,
        isActive: true,
        isBanned: false,
        botEnabled: false, // Bot varsayılan KAPALI - admin açmalı
      },
      select: {
        id: true,
        username: true,
        telegramId: true,
        telegramUsername: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isBanned: true,
        botEnabled: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...user,
      telegramId: user.telegramId ? user.telegramId.toString() : null,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
