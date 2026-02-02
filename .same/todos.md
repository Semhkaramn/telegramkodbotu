# Telegram Kod Botu - Geliştirme Planı

## Proje Durumu: Planlama Aşaması
Son Güncelleme: 2026-02-02

---

## 📊 BÖLÜM 1: VERİTABANI DEĞİŞİKLİKLERİ

### 1.1 SuperAdmin Ayrı Tabloya Taşıma
- [ ] `Admin` modeli oluştur (ayrı tablo)
  ```prisma
  model Admin {
    id        Int      @id @default(autoincrement())
    username  String   @unique
    password  String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
  }
  ```
- [ ] `User` tablosundan `role` ve `displayName` alanlarını kaldır
- [ ] Seed dosyasını güncelle (Admin tablosuna ekle)
- [ ] Auth sistemini güncelle (Admin ve User ayrı kontrol)

### 1.2 Kullanıcı Telegram Bilgileri
- [ ] `User` modeline Telegram alanları ekle:
  ```prisma
  telegramId     BigInt?   @unique @map("telegram_id")
  telegramUsername String? @map("telegram_username")
  firstName      String?   @map("first_name")
  lastName       String?   @map("last_name")
  photoUrl       String?   @map("photo_url")
  lastSeen       DateTime? @map("last_seen")
  ```

### 1.3 İstatistik Tabloları
- [ ] `CodeLog` modeli (kod gönderim geçmişi):
  ```prisma
  model CodeLog {
    id            Int      @id @default(autoincrement())
    code          String
    link          String
    sourceChannel BigInt   @map("source_channel")
    sourceName    String?  @map("source_name")
    createdAt     DateTime @default(now())

    deliveries    CodeDelivery[]
  }
  ```
- [ ] `CodeDelivery` modeli (her kanala gönderim):
  ```prisma
  model CodeDelivery {
    id          Int      @id @default(autoincrement())
    codeLogId   Int      @map("code_log_id")
    userId      Int      @map("user_id")
    channelId   BigInt   @map("channel_id")
    sentAt      DateTime @default(now())

    codeLog     CodeLog  @relation(...)
  }
  ```
- [ ] `DailyStat` modeli (özet istatistikler):
  ```prisma
  model DailyStat {
    id          Int      @id @default(autoincrement())
    date        DateTime @db.Date
    userId      Int      @map("user_id")
    channelId   BigInt   @map("channel_id")
    totalCodes  Int      @default(0)

    @@unique([date, userId, channelId])
  }
  ```

### 1.4 Bot Yönetici Kontrolü
- [ ] `UserChannel` modeline bot admin kontrolü ekle:
  ```prisma
  isBotAdmin     Boolean   @default(false) @map("is_bot_admin")
  lastAdminCheck DateTime? @map("last_admin_check")
  adminError     String?   @map("admin_error")
  ```

---

## 🤖 BÖLÜM 2: BOT DEĞİŞİKLİKLERİ (Python)

### 2.1 Telegram Bot Komutları
- [ ] `/start` komutu ekle:
  - Kullanıcıyı telegram_id ile eşleştir
  - Kanal admin durumunu kontrol et
  - Hoşgeldin mesajı gönder
  - Eğer bot admin değilse uyarı butonu göster
- [ ] `/durum` komutu: Kullanıcının istatistiklerini göster
- [ ] `/kanallar` komutu: Kanalları listele ve durumlarını göster
- [ ] `/durdur` komutu: Tüm kanalları durdur
- [ ] `/baslat` komutu: Tüm kanalları başlat

### 2.2 Bot Admin Kontrolü
- [ ] Kanal eklendiğinde bot admin mi kontrol et
- [ ] Periyodik admin kontrolü (her 1 saat)
- [ ] Admin olmadığında kullanıcıya bildirim gönder
- [ ] Admin olunduğunda otomatik mesaj at

### 2.3 İstatistik Kaydetme
- [ ] Her kod gönderiminde `CodeLog` tablosuna kaydet
- [ ] Her kanala gönderimde `CodeDelivery` tablosuna kaydet
- [ ] Gece yarısı `DailyStat` özet tablosunu güncelle

### 2.4 Kullanıcı Bilgisi Çekme
- [ ] Telegram ID'den kullanıcı bilgisi çek
- [ ] Kullanıcı adından ID çek
- [ ] Profil fotoğrafı URL'i al

---

## 🔌 BÖLÜM 3: API DEĞİŞİKLİKLERİ

### 3.1 Auth API Güncelleme
- [ ] `/api/auth/login`: Admin ve User ayrı kontrol
- [ ] `/api/auth/me`: Admin için ayrı response
- [ ] Admin middleware oluştur

### 3.2 Kullanıcı API Güncelleme
- [ ] `POST /api/users`: Telegram ID/username ile oluşturma
  - Telegram API'den bilgi çek
  - Otomatik ID kaydet
  - Profil bilgilerini kaydet
- [ ] `PATCH /api/users/[id]`: Telegram bilgisi güncelleme
- [ ] `GET /api/users`: Telegram bilgileri dahil et

### 3.3 İstatistik API'leri
- [ ] `GET /api/stats/user/[id]`:
  - Günlük/haftalık/aylık/toplam kod sayısı
  - Kanal bazlı dağılım
  - Son 7/30 günlük trend
- [ ] `GET /api/stats/admin`:
  - Sistem geneli istatistikler
  - En aktif kullanıcılar
  - En aktif kanallar
  - Kaynak kanal dağılımı
- [ ] `GET /api/stats/codes`:
  - Son gönderilen kodlar listesi
  - Filtreleme (tarih, kanal, kullanıcı)

### 3.4 Admin Link API Güncelleme
- [ ] `PATCH /api/admin-links/[id]`: Link düzenleme
- [ ] Liste görünümü için pagination

### 3.5 Bot Kontrolü API
- [ ] `GET /api/bot/status`: Bot durumu
- [ ] `POST /api/bot/check-admin`: Kanal admin kontrolü tetikle
- [ ] Webhook endpoint for bot notifications

---

## 🎨 BÖLÜM 4: FRONTEND - ADMIN PANELİ

### 4.1 Admin Dashboard (Yeni)
- [ ] Sistem geneli istatistik kartları:
  - Bugün gelen kod sayısı
  - Bu hafta / Bu ay / Toplam
  - Aktif kullanıcı sayısı
  - Aktif kanal sayısı
- [ ] Grafikler:
  - Son 7 gün kod trendi (çizgi grafik)
  - Kaynak kanal dağılımı (pasta grafik)
- [ ] Son gelen kodlar listesi (canlı akış)
- [ ] Bot durumu göstergesi

### 4.2 Kullanıcı Yönetimi Sayfası Güncelleme
- [ ] Kullanıcı ekleme formunu güncelle:
  - Telegram ID veya @username input
  - "Bilgi Çek" butonu
  - Telegram'dan çekilen bilgileri göster (ad, foto)
  - Otomatik ID kaydetme
- [ ] Kullanıcı listesinde:
  - Baş harf yerine profil fotoğrafı veya tam isim
  - Telegram username göster
  - Last seen bilgisi
- [ ] Kullanıcı detay sayfası:
  - Telegram bilgileri
  - Kanalları
  - İstatistikleri
  - Link özelleştirmeleri

### 4.3 Kanal Yönetimi Sayfası Güncelleme
- [ ] Kanal kartlarında:
  - Atanan kullanıcının TAM İSMİ (baş harf değil)
  - Bot admin durumu (yeşil/kırmızı badge)
- [ ] Bot admin değilse uyarı göster
- [ ] "Admin Kontrol Et" butonu

### 4.4 Link Yönetimi (Admin Görünümü)
- [ ] Tüm kullanıcıların linklerini görüntüleme
- [ ] Kullanıcı bazlı filtreleme
- [ ] Toplu link yönetimi

---

## 🎨 BÖLÜM 5: FRONTEND - KULLANICI PANELİ

### 5.1 Dashboard Güncelleme
- [ ] İstatistik kartları:
  - Bugün gelen kod sayısı
  - Bu hafta / Bu ay / Toplam
- [ ] Mini grafik (son 7 gün)
- [ ] Son gelen kodlar listesi (son 10)
- [ ] Kanal durumları özeti

### 5.2 İstatistikler Sayfası (Yeni)
- [ ] Detaylı istatistik sayfası
- [ ] Tarih aralığı seçimi
- [ ] Kanal bazlı filtreleme
- [ ] Kod arama
- [ ] Grafik görünümleri:
  - Günlük trend
  - Haftalık trend
  - Kanal dağılımı

### 5.3 Link Özelleştirme Güncelleme
- [ ] Link listesi görünümü (tablo formatı)
- [ ] Inline düzenleme
- [ ] Link kodu ve URL düzenleme
- [ ] Sürükle-bırak sıralama (opsiyonel)

### 5.4 Ayarlar Sayfası
- [ ] Telegram hesabı bağlama
- [ ] Bot'a /start gönder butonu
- [ ] Bildirim tercihleri

---

## 📱 BÖLÜM 6: BOT-KULLANICI ETKİLEŞİMİ

### 6.1 Bot Mesajları
- [ ] Hoşgeldin mesajı (/start)
- [ ] Kanal eklendi bildirimi
- [ ] Bot admin oldu bildirimi
- [ ] Bot admin değil uyarısı (butonlu)
- [ ] Günlük özet mesajı (opsiyonel)

### 6.2 Inline Butonlar
- [ ] "Kanala Git" butonu
- [ ] "Admin Yap" butonu (yönlendirme)
- [ ] "Panele Git" butonu
- [ ] "Yardım" butonu

---

## 🔄 BÖLÜM 7: UYGULAMA SIRASI

### Faz 1: Veritabanı Hazırlığı
1. [ ] Admin tablosu oluştur
2. [ ] User tablosunu güncelle
3. [ ] İstatistik tablolarını oluştur
4. [ ] Migration yap
5. [ ] Seed güncelle

### Faz 2: Bot Güncellemesi
1. [ ] Komutları ekle
2. [ ] Admin kontrolü ekle
3. [ ] İstatistik kaydetme ekle
4. [ ] Kullanıcı bilgisi çekme ekle

### Faz 3: API Güncellemesi
1. [ ] Auth sistemini güncelle
2. [ ] User API güncelle
3. [ ] İstatistik API'leri ekle
4. [ ] Admin link API güncelle

### Faz 4: Frontend - Admin
1. [ ] Dashboard güncelle
2. [ ] Kullanıcı yönetimi güncelle
3. [ ] Kanal yönetimi güncelle

### Faz 5: Frontend - Kullanıcı
1. [ ] Dashboard güncelle
2. [ ] İstatistik sayfası ekle
3. [ ] Link yönetimi güncelle

### Faz 6: Test ve İyileştirme
1. [ ] Tüm özellikleri test et
2. [ ] Hata düzeltmeleri
3. [ ] Performans optimizasyonu

---

## 📝 NOTLAR

### Mevcut Yapıda Kaldırılacaklar
- `displayName` alanı (User tablosu)
- `role` alanı (User tablosu - Admin ayrı tabloda)
- Superadmin'in User tablosunda olması

### Önemli Noktalar
- Bot Python'da çalışıyor (Heroku)
- Web paneli Next.js (Netlify)
- Veritabanı PostgreSQL
- İstatistik takibi şu an YOK
- Telegram bilgisi çekme YOK

### Telegram API Kullanımı
- Kullanıcı bilgisi çekme: Bot API ile getChat
- Admin kontrolü: Bot API ile getChatAdministrators
- Profil fotoğrafı: getUserProfilePhotos

---

## ✅ TAMAMLANAN GÖREVLER
(Henüz yok)
