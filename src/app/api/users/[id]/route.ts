import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

// GET - Tek kullanıcı detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    const user = await prisma.user.findUnique({
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
        updatedAt: true,
        channels: {
          include: {
            channel: true,
          },
        },
        adminLinks: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      telegramId: user.telegramId ? user.telegramId.toString() : null,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      channels: user.channels.map((uc) => ({
        ...uc,
        channelId: uc.channelId.toString(),
        channel: {
          ...uc.channel,
          channelId: uc.channel.channelId.toString(),
        },
      })),
      adminLinks: user.adminLinks.map((link) => ({
        ...link,
        channelId: link.channelId.toString(),
      })),
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// PATCH - Kullanıcı güncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);
    const body = await request.json();
    const {
      username,
      password,
      telegramId,
      telegramUsername,
      firstName,
      lastName,
      photoUrl,
      isActive,
      isBanned,
      bannedReason,
      botEnabled
    } = body;

    // Güncelleme verisi hazırla
    const updateData: Record<string, unknown> = {};

    if (username !== undefined) updateData.username = username;
    if (telegramUsername !== undefined) updateData.telegramUsername = telegramUsername;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (botEnabled !== undefined) updateData.botEnabled = botEnabled;

    // Telegram ID güncelleme
    if (telegramId !== undefined) {
      updateData.telegramId = telegramId ? BigInt(telegramId) : null;
    }

    // Ban işlemi
    if (isBanned !== undefined) {
      updateData.isBanned = isBanned;
      if (isBanned) {
        updateData.bannedAt = new Date();
        updateData.bannedReason = bannedReason || null;
        // Banlanan kullanıcının bot'unu da kapat
        updateData.botEnabled = false;
      } else {
        updateData.bannedAt = null;
        updateData.bannedReason = null;
      }
    }

    if (password) {
      updateData.password = await hashPassword(password);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        telegramId: true,
        telegramUsername: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        isActive: true,
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
        botEnabled: true,
        updatedAt: true,
      },
    });

    // Eğer kullanıcı banlandıysa veya devre dışı bırakıldıysa, tüm kanallarını durdur
    if (isBanned === true || isActive === false) {
      await prisma.userChannel.updateMany({
        where: { userId },
        data: { paused: true },
      });
    }

    // Cache'i invalidate et - kullanıcı durumu değişti (botEnabled, isBanned, isActive)
    // Bot aktif kanalları yenilemeli
    await invalidateCache();

    return NextResponse.json({
      ...user,
      telegramId: user.telegramId ? user.telegramId.toString() : null,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// DELETE - Kullanıcı sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    await prisma.user.delete({
      where: { id: userId },
    });

    // Cache'i invalidate et - kullanıcı silindi, aktif kanallar değişebilir
    await invalidateCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
