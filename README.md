# 🤖 WhatsApp Group Notifier Bot

Bot WhatsApp berbasis **whatsapp-web.js** untuk mengirim notifikasi terjadwal ke grup dengan dua mode:
- **Visible Mode**: Mention semua member di grup (terlihat)
- **DM Mode**: Kirim pesan langsung ke setiap member (tanpa mention di grup)

Bot menggunakan **RemoteAuth + MongoDB** untuk persistensi sesi, sehingga cocok untuk deploy di platform seperti **Railway**, **Render**, atau **Fly.io** yang tidak memiliki persistent filesystem.

---

## ✨ Fitur

✅ **Notifikasi Terjadwal** dengan `node-cron` (timezone Asia/Jakarta)  
✅ **Dua Mode Notifikasi**:
   - `visible`: Mention semua member di grup
   - `dm`: Kirim DM ke setiap member secara personal  
✅ **RemoteAuth + MongoDB**: Sesi WhatsApp disimpan di database  
✅ **Pembatasan Grup**: Hanya aktif di 1 grup yang ditentukan  
✅ **Rate Limiting**: Mencegah spam saat kirim DM massal  
✅ **Admin Commands**: Kontrol bot via WhatsApp  
✅ **Health Endpoint**: Monitoring status bot  
✅ **Docker Support**: Siap deploy dengan Docker/Railway/Render  

---

## 🛠️ Tech Stack

- **Node.js 20+** (ESM)
- **whatsapp-web.js** - WhatsApp Web API wrapper
- **MongoDB** - Remote session storage
- **Express** - HTTP server untuk health check
- **node-cron** - Penjadwalan notifikasi
- **Pino** - Logging
- **p-queue** - Rate limiting untuk DM
- **Puppeteer** - Browser automation
- **Zod** - Environment validation

---

## 📦 Instalasi

### 1️⃣ Clone Repository

```bash
git clone https://github.com/username/whatsapp-notifier-bot.git
cd whatsapp-notifier-bot