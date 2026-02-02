import { NextResponse } from "next/server";
import { getSession, getAdmin, getUser } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Oturum bulunamadı" },
        { status: 401 }
      );
    }

    // Admin ise
    if (session.role === "admin") {
      // Impersonation kontrolü
      if (session.impersonatingUserId) {
        const targetUser = await getUser(session.impersonatingUserId);
        const admin = await getAdmin(session.userId);

        if (!targetUser) {
          return NextResponse.json(
            { error: "Hedef kullanıcı bulunamadı" },
            { status: 404 }
          );
        }

        // Banlı kullanıcı kontrolü
        if (targetUser.isBanned) {
          return NextResponse.json(
            {
              error: "Hedef kullanıcı askıya alınmış",
              bannedReason: targetUser.bannedReason
            },
            { status: 403 }
          );
        }

        const fullName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ") || null;

        return NextResponse.json({
          user: {
            id: targetUser.id,
            username: targetUser.username,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            fullName,
            telegramId: targetUser.telegramId ? targetUser.telegramId.toString() : null,
            telegramUsername: targetUser.telegramUsername,
            photoUrl: targetUser.photoUrl,
            lastSeen: targetUser.lastSeen,
            isActive: targetUser.isActive,
            isBanned: targetUser.isBanned,
            bannedReason: targetUser.bannedReason,
            botEnabled: targetUser.botEnabled,
            role: "user",
            isImpersonating: true,
            realUser: admin ? {
              id: admin.id,
              username: admin.username,
              role: "admin",
            } : null,
          },
        });
      }

      // Normal admin
      const admin = await getAdmin(session.userId);

      if (!admin) {
        return NextResponse.json(
          { error: "Admin bulunamadı" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        user: {
          id: admin.id,
          username: admin.username,
          role: "admin",
          isImpersonating: false,
          realUser: null,
        },
      });
    }

    // User ise
    const user = await getUser(session.userId);

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    // Banlı kullanıcıyı bilgilendir
    if (user.isBanned) {
      return NextResponse.json(
        {
          error: "Hesabınız askıya alınmış",
          bannedReason: user.bannedReason
        },
        { status: 403 }
      );
    }

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName,
        telegramId: user.telegramId ? user.telegramId.toString() : null,
        telegramUsername: user.telegramUsername,
        photoUrl: user.photoUrl,
        lastSeen: user.lastSeen,
        isActive: user.isActive,
        isBanned: user.isBanned,
        bannedReason: user.bannedReason,
        botEnabled: user.botEnabled,
        role: "user",
        isImpersonating: false,
        realUser: null,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
