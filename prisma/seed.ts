import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Çevre değişkenlerinden veya varsayılan değerler
  const adminUsername = process.env.SUPER_ADMIN_USERNAME || "Semhkaramn";
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || "Abuzittin74.";

  // Süper admin hesabı oluştur (Admin tablosuna)
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const superAdmin = await prisma.admin.upsert({
    where: { username: adminUsername },
    update: {
      password: hashedPassword,
    },
    create: {
      username: adminUsername,
      password: hashedPassword,
    },
  });

  console.log("✅ Süper admin oluşturuldu (Admin tablosu):", superAdmin.username);

  console.log("\n📋 Kurulum tamamlandı!");
  console.log(`   Giriş: ${adminUsername}`);
  console.log(`   Şifre: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
