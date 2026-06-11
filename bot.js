// ============================================================
//   BOT WHATSAPP TERMUX - FITUR LENGKAP
//   Dibuat dengan: @whiskeysockets/baileys
//   Node.js versi: 18+
// ============================================================

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const axios = require("axios");
const { exec } = require("child_process");
const qrcode = require("qrcode-terminal");
const os = require("os");
const path = require("path");
const fetch = require("node-fetch");
const FormData = require("form-data");

// ============================================================
// KONFIGURASI BOT
// ============================================================
const config = {
  prefix: "!",             // Ganti sesuai selera
  ownerNumber: "6285695433295",  // Ganti dengan nomor owner (format: 628xxx)
  botName: "TermuxBot",
  sessionFolder: "./auth_info",
  logFile: "./bot.log",
  maxRetry: 5,
  autoRead: true,         // Auto baca pesan
  autoTyping: true,       // Tampilkan "sedang mengetik"
};

// ============================================================
// LOGGER
// ============================================================
function log(msg) {
  const time = new Date().toLocaleString("id-ID");
  const line = `[${time}] ${msg}`;
  console.log(line);
  fs.appendFileSync(config.logFile, line + "\n");
}

// ============================================================
// UTILITAS
// ============================================================

// Ambil nomor dari JID
function getNum(jid) {
  return jid.split("@")[0].split(":")[0];
}

// Apakah owner?
const ownerList = [
  "6283890631974",
  "6285695433295",
  "42232480575496",
];

function isOwner(jid) {
  return ownerList.includes(getNum(jid));
}

// Jalankan perintah shell (khusus owner)
function runShell(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) reject(stderr || err.message);
      else resolve(stdout || "(tidak ada output)");
    });
  });
}

// Fetch teks dari URL
async function fetchText(url) {
  const res = await axios.get(url, { timeout: 10000 });
  return typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
}

// Fetch JSON dari URL
async function fetchJSON(url) {
  const res = await axios.get(url, { timeout: 10000 });
  return res.data;
}

// Konversi ukuran byte
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Uptime format
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}h ${h}j ${m}m ${s}d`;
}

// Tanggal & jam Indonesia
function getDateTime() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ============================================================
// DATA PENYIMPANAN SEDERHANA (JSON)
// ============================================================
const DB_FILE = "./data.json";

function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// STATE TAMBAHAN (IN-MEMORY)
// ============================================================
const tebakGame = {};   // { jid: { angka, coba } }
const pollStore = {};   // { pollId: { question, options, votes:{user:choice} } }
let botStats = { totalCmd: 0, startTime: Date.now() };
// ── Welcome Messages (Persistent) ────────────────────────
const WELCOME_FILE = "./welcome.json";

function loadWelcome() {
  if (!fs.existsSync(WELCOME_FILE)) fs.writeFileSync(WELCOME_FILE, JSON.stringify({}));
  return JSON.parse(fs.readFileSync(WELCOME_FILE, "utf8"));
}

function saveWelcome(data) {
  fs.writeFileSync(WELCOME_FILE, JSON.stringify(data, null, 2));
}

let welcomeMessages = loadWelcome(); // { groupJid: "pesan welcome" }

// ============================================================
// DAFTAR PERINTAH (HELP)
// ============================================================
const helpText = `╔══════════════════════════╗
║   🤖 *${config.botName} - MENU*   ║
╚══════════════════════════╝

📌 *PREFIX:* \`${config.prefix}\`

━━━ 🌐 *INFO & UMUM* ━━━
• \`${config.prefix}ping\` — Cek bot aktif
• \`${config.prefix}menu\` — Tampilkan menu ini
• \`${config.prefix}info\` — Info bot & sistem
• \`${config.prefix}jam\` — Jam & tanggal sekarang
• \`${config.prefix}uptime\` — Lama bot berjalan
• \`${config.prefix}profil\` — Lihat profil kamu
• \`${config.prefix}id\` — Lihat JID/nomor kamu
• \`${config.prefix}sysinfo\` — Info sistem (owner)
• \`${config.prefix}speedtest\` — Cek kecepatan bot

━━━ 👥 *MANAJEMEN GRUP* ━━━
• \`${config.prefix}tagall\` — Tag semua anggota
• \`${config.prefix}hidetag [teks]\` — Tag diam-diam
• \`${config.prefix}kick @user\` — Kick anggota
• \`${config.prefix}add [nomor]\` — Tambah anggota
• \`${config.prefix}promote @user\` — Jadikan admin
• \`${config.prefix}demote @user\` — Copot admin
• \`${config.prefix}groupinfo\` — Info grup
• \`${config.prefix}link\` — Ambil link invite
• \`${config.prefix}revokelink\` — Reset link grup
• \`${config.prefix}mute\` — Hanya admin bisa chat
• \`${config.prefix}unmute\` — Semua bisa chat
• \`${config.prefix}listadmin\` — Daftar admin
• \`${config.prefix}setdesc [teks]\` — Set deskripsi grup
• \`${config.prefix}setname [nama]\` — Ganti nama grup
• \`${config.prefix}setwelcome [teks]\` — Atur pesan welcome
• \`${config.prefix}delwelcome\` — Hapus pesan welcome
• \`${config.prefix}cekwelcome\` — Lihat pesan welcome
• \`${config.prefix}setbye [teks]\` — Atur pesan bye

━━━ 🌍 *INTERNET & API* ━━━
• \`${config.prefix}cuaca [kota]\` — Info cuaca
• \`${config.prefix}cuacadetail [kota]\` — Cuaca detail
• \`${config.prefix}berita\` — Berita terkini
• \`${config.prefix}kurs\` — Kurs mata uang
• \`${config.prefix}convert [n] [dari] [ke]\` — Konversi mata uang
• \`${config.prefix}quote\` — Kutipan motivasi
• \`${config.prefix}jokes\` — Lelucon random
• \`${config.prefix}wiki [keyword]\` — Wikipedia
• \`${config.prefix}crypto [koin]\` — Harga crypto
• \`${config.prefix}ip [alamat]\` — Info IP
• \`${config.prefix}npm [paket]\` — Info paket NPM
• \`${config.prefix}shorturl [url]\` — Persingkat URL
• \`${config.prefix}github [user]\` — Info GitHub
• \`${config.prefix}negara [nama]\` — Info negara
• \`${config.prefix}gempa\` — Gempa terkini (BMKG)
• \`${config.prefix}sholat [kota]\` — Jadwal sholat
• \`${config.prefix}resep [makanan]\` — Resep masakan
• \`${config.prefix}film [judul]\` — Info film
• \`${config.prefix}kamus [kata]\` — Kamus Inggris
• \`${config.prefix}sinonim [kata]\` — Sinonim kata
• \`${config.prefix}translate [teks]\` — Terjemah ke Indonesia
• \`${config.prefix}cekwa [nomor]\` — Cek nomor WA aktif

━━━ 🔢 *MATEMATIKA & TOOLS* ━━━
• \`${config.prefix}hitung [ekspresi]\` — Kalkulator
• \`${config.prefix}math [ekspresi]\` — Kalkulator scientific
• \`${config.prefix}luas [bentuk] [ukuran]\` — Hitung luas
• \`${config.prefix}bmi [bb] [tb]\` — Kalkulator BMI
• \`${config.prefix}kalori [makanan]\` — Info kalori
• \`${config.prefix}persen [a] [b]\` — Hitung persen
• \`${config.prefix}terbilang [angka]\` — Angka ke kata
• \`${config.prefix}roman [angka]\` — Angka Romawi
• \`${config.prefix}kgkelbs [kg]\` — Konversi berat
• \`${config.prefix}cmkaki [cm]\` — Konversi panjang
• \`${config.prefix}celcius [c]\` — Konversi suhu
• \`${config.prefix}suhu [val] [c/f/k]\` — Konversi suhu lengkap
• \`${config.prefix}timezone\` — Waktu dunia
• \`${config.prefix}countdown [dd/mm/yyyy]\` — Hitung mundur
• \`${config.prefix}umur [dd/mm/yyyy]\` — Hitung umur
• \`${config.prefix}cekhari [dd/mm/yyyy]\` — Cek nama hari
• \`${config.prefix}qr [teks]\` — Buat QR Code
• \`${config.prefix}password [panjang]\` — Generate password
• \`${config.prefix}random [min] [max]\` — Angka random
• \`${config.prefix}balik [teks]\` — Balik teks
• \`${config.prefix}upper/lower [teks]\` — Ubah huruf
• \`${config.prefix}encode/decode [teks]\` — Base64
• \`${config.prefix}binary/debinary [teks]\` — Binary
• \`${config.prefix}hex/dehex [teks]\` — Hexadecimal
• \`${config.prefix}caesar [n] [teks]\` — Caesar cipher
• \`${config.prefix}morse [teks]\` — Morse code
• \`${config.prefix}palindrom [teks]\` — Cek palindrom
• \`${config.prefix}hitungkata [teks]\` — Hitung kata
• \`${config.prefix}pilih [a|b|c]\` — Acak pilihan

━━━ 🎮 *HIBURAN & FUN* ━━━
• \`${config.prefix}tebak\` — Game tebak angka
• \`${config.prefix}tebakkata\` — Game tebak kata
• \`${config.prefix}kuis\` — Kuis matematika
• \`${config.prefix}dadu [n]\` — Lempar dadu
• \`${config.prefix}koin\` — Lempar koin
• \`${config.prefix}8ball [pertanyaan]\` — Magic 8 Ball
• \`${config.prefix}horoscope [zodiak]\` — Ramalan bintang
• \`${config.prefix}cekzodiak [dd/mm]\` — Cek zodiak lahir
• \`${config.prefix}fakta\` — Fakta unik
• \`${config.prefix}meme\` — Meme random
• \`${config.prefix}mutiara\` — Kata mutiara
• \`${config.prefix}pantun\` — Pantun random
• \`${config.prefix}puisi [tema]\` — Buat puisi
• \`${config.prefix}cerita\` — Cerita pendek
• \`${config.prefix}tts\` — Teka-teki
• \`${config.prefix}karir\` — Ramalan karir
• \`${config.prefix}cinta\` — Ramalan cinta
• \`${config.prefix}username\` — Generate username
• \`${config.prefix}acaknama\` — Nama random Indonesia
• \`${config.prefix}bisnis\` — Saran nama bisnis
• \`${config.prefix}emojify [teks]\` — Teks ke emoji
• \`${config.prefix}kalimat\` — Kalimat random
• \`${config.prefix}warna [hex]\` — Preview warna

━━━ 📥 *DOWNLOAD & MEDIA* ━━━
• \`${config.prefix}tiktok [url]\` — Download video TikTok
• \`${config.prefix}tiktokfoto [url]\` — Download foto/slide TikTok
• \`${config.prefix}yt [url]\` — Download video YouTube
• \`${config.prefix}ytshorts [url]\` — Download YouTube Shorts
• \`${config.prefix}ig [url]\` — Download foto/video Instagram
• \`${config.prefix}stiker\` — Buat stiker dari foto (reply foto)
• \`${config.prefix}stikerteks [teks]\` — Buat stiker dari teks
• \`${config.prefix}ytinfo [url]\` — Info video YouTube
• \`${config.prefix}spotifyinfo [lagu]\` — Cari lagu
• \`${config.prefix}film [judul]\` — Info film
• \`${config.prefix}pp [@user]\` — Foto profil WA

━━━ 💾 *CATATAN & PRODUKTIVITAS* ━━━
• \`${config.prefix}save [key] [value]\` — Simpan catatan
• \`${config.prefix}get [key]\` — Ambil catatan
• \`${config.prefix}del [key]\` — Hapus catatan
• \`${config.prefix}list\` — Lihat semua catatan
• \`${config.prefix}todo [teks]\` — Tambah todo
• \`${config.prefix}todos\` — Lihat semua todo
• \`${config.prefix}donetodo [no]\` — Tandai selesai
• \`${config.prefix}deltodo [no]\` — Hapus todo
• \`${config.prefix}biodata [nama|usia|hobi|asal]\` — Simpan biodata
• \`${config.prefix}poll [pertanyaan|op1|op2]\` — Buat polling
• \`${config.prefix}vote [id] [no]\` — Vote polling
• \`${config.prefix}remind [menit] [pesan]\` — Pengingat

━━━ 👑 *KHUSUS OWNER* ━━━
• \`${config.prefix}shell [perintah]\` — Jalankan terminal
• \`${config.prefix}broadcast [pesan]\` — Kirim ke semua chat
• \`${config.prefix}restart\` — Restart bot
• \`${config.prefix}log\` — Lihat log terakhir
• \`${config.prefix}setprefix [char]\` — Ganti prefix
• \`${config.prefix}clearlog\` — Bersihkan log
• \`${config.prefix}stats\` — Statistik bot
• \`${config.prefix}sysinfo\` — Info sistem
• \`${config.prefix}listchat\` — Daftar grup bot
• \`${config.prefix}setbotname [nama]\` — Ganti nama bot
• \`${config.prefix}maintenance\` — Toggle mode maintenance
• \`${config.prefix}block [nomor]\` — Blokir user dari bot
• \`${config.prefix}unblock [nomor]\` — Unblokir user

━━━━━━━━━━━━━━━━━━━━
_Bot aktif 24 jam_ ⚡`;

// ============================================================
// HANDLER PESAN UTAMA
// ============================================================
async function handleMessage(sock, msg) {
  try {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");
    const sender = isGroup ? msg.key.participant : msg.key.remoteJid;
    const isMe = msg.key.fromMe;

    // Abaikan pesan dari diri sendiri
    if (isMe) return;

    // Ambil isi pesan
    const msgType = Object.keys(msg.message || {})[0];
    let body = "";

    if (msgType === "conversation") body = msg.message.conversation;
    else if (msgType === "extendedTextMessage") body = msg.message.extendedTextMessage.text;
    else if (msgType === "imageMessage") body = msg.message.imageMessage.caption || "";
    else if (msgType === "videoMessage") body = msg.message.videoMessage.caption || "";
    else if (msgType === "buttonsResponseMessage") body = msg.message.buttonsResponseMessage.selectedButtonId;
    else if (msgType === "listResponseMessage") body = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
    else body = "";

    body = body.trim();

    // Auto read
    if (config.autoRead) {
      await sock.readMessages([msg.key]);
    }

    // Cek prefix
    if (!body.startsWith(config.prefix)) return;

    // Auto typing indicator
    if (config.autoTyping) {
      await sock.sendPresenceUpdate("composing", from);
    }

    const args = body.slice(config.prefix.length).trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    const text = args.slice(1).join(" ");

    log(`[CMD] ${getNum(sender)} → ${config.prefix}${cmd} ${text}`);

    // Cek user diblokir
    const dbCheck = loadDB();
    if (dbCheck._blocked?.includes(getNum(sender)) && !isOwner(sender)) return;

    // Cek mode maintenance
    if (dbCheck._maintenance && !isOwner(sender)) {
      return await sock.sendMessage(from, { text: "🔧 *Bot sedang dalam mode maintenance.*\nCoba lagi nanti." }, { quoted: msg });
    }

    // ─── Fungsi balas ───
    const reply = async (content) => {
      await sock.sendMessage(from, { text: content }, { quoted: msg });
    };

    // ─── Fungsi balas gambar ───
    const replyImage = async (url, caption = "") => {
      await sock.sendMessage(from, { image: { url }, caption }, { quoted: msg });
    };

    // ============================================================
    // PERINTAH-PERINTAH
    // ============================================================

    // ── PING ──────────────────────────────────────────────────
    if (cmd === "ping") {
      const start = Date.now();
      await reply("🏓 Mengukur ping...");
      const latency = Date.now() - start;
      return reply(`✅ *Pong!*\n⚡ Latency: *${latency}ms*`);
    }

    // ── MENU ──────────────────────────────────────────────────
    if (cmd === "menu" || cmd === "help" || cmd === "?") {
      return reply(helpText);
    }

    // ── INFO ──────────────────────────────────────────────────
    if (cmd === "info") {
      const mem = process.memoryUsage();
      return reply(
        `╔══ 🤖 *INFO BOT* ══╗\n` +
        `║ Nama     : ${config.botName}\n` +
        `║ Prefix   : ${config.prefix}\n` +
        `║ Platform : Termux / Node.js\n` +
        `║ RAM      : ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}\n` +
        `║ Uptime   : ${formatUptime(process.uptime())}\n` +
        `║ Library  : @whiskeysockets/baileys\n` +
        `╚═══════════════════╝`
      );
    }

    // ── JAM ───────────────────────────────────────────────────
    if (cmd === "jam" || cmd === "waktu") {
      return reply(`🕐 *Waktu Sekarang*\n${getDateTime()} WIB`);
    }

    // ── UPTIME ────────────────────────────────────────────────
    if (cmd === "uptime") {
      return reply(`⏱️ *Uptime Bot*\n${formatUptime(process.uptime())}`);
    }

    // ── CUACA ─────────────────────────────────────────────────
    if (cmd === "cuaca") {
      if (!text) return reply("⚠️ Contoh: `!cuaca Jakarta`");
      try {
        const url = `https://wttr.in/${encodeURIComponent(text)}?format=j1`;
        const data = await fetchJSON(url);
        const current = data.current_condition[0];
        const area = data.nearest_area[0];
        const namaKota = area.areaName[0].value + ", " + area.country[0].value;
        const suhu = current.temp_C;
        const feels = current.FeelsLikeC;
        const humidity = current.humidity;
        const desc = current.weatherDesc[0].value;
        const wind = current.windspeedKmph;
        return reply(
          `🌤️ *Cuaca di ${namaKota}*\n\n` +
          `🌡️ Suhu       : ${suhu}°C (terasa ${feels}°C)\n` +
          `💧 Kelembaban : ${humidity}%\n` +
          `🌬️ Angin      : ${wind} km/h\n` +
          `📝 Kondisi    : ${desc}`
        );
      } catch (e) {
        return reply("❌ Gagal mengambil data cuaca. Coba lagi nanti.");
      }
    }

    // ── KURS ──────────────────────────────────────────────────
    if (cmd === "kurs") {
      try {
        const data = await fetchJSON("https://open.er-api.com/v6/latest/USD");
        const idr = data.rates.IDR;
        const eur = data.rates.EUR;
        const sgd = data.rates.SGD;
        const myr = data.rates.MYR;
        const jpy = data.rates.JPY;
        return reply(
          `💱 *Kurs Mata Uang* (Base: USD)\n\n` +
          `🇮🇩 IDR : Rp ${idr.toLocaleString("id-ID")}\n` +
          `🇪🇺 EUR : €${eur.toFixed(4)}\n` +
          `🇸🇬 SGD : S$${sgd.toFixed(4)}\n` +
          `🇲🇾 MYR : RM${myr.toFixed(4)}\n` +
          `🇯🇵 JPY : ¥${jpy.toFixed(2)}\n\n` +
          `_Update: ${new Date().toLocaleString("id-ID")}_`
        );
      } catch (e) {
        return reply("❌ Gagal mengambil data kurs.");
      }
    }

    // ── QUOTE ─────────────────────────────────────────────────
    if (cmd === "quote" || cmd === "motivasi") {
      try {
        const data = await fetchJSON("https://zenquotes.io/api/random");
        const q = data[0];
        return reply(`💬 *Quote of the moment*\n\n_"${q.q}"_\n\n— *${q.a}*`);
      } catch (e) {
        const fallback = [
          "Kesuksesan bukan milik orang yang tidak pernah gagal, tetapi milik orang yang tidak pernah berhenti mencoba.",
          "Jangan hitung harinya, buat setiap hari berharga.",
          "Mulailah dari mana kamu berada. Gunakan apa yang kamu punya. Lakukan apa yang kamu bisa.",
        ];
        return reply(`💬 *Motivasi*\n\n_"${fallback[Math.floor(Math.random() * fallback.length)]}"_`);
      }
    }

    // ── JOKES ─────────────────────────────────────────────────
    if (cmd === "jokes" || cmd === "joke") {
      try {
        const data = await fetchJSON("https://v2.jokeapi.dev/joke/Any?lang=en&blacklistFlags=nsfw,racist,sexist");
        if (data.type === "single") return reply(`😂 *Joke*\n\n${data.joke}`);
        return reply(`😂 *Joke*\n\n${data.setup}\n\n*${data.delivery}*`);
      } catch (e) {
        return reply("❌ Gagal mengambil joke.");
      }
    }

    // ── BERITA ────────────────────────────────────────────────
    if (cmd === "berita") {
      try {
        // Menggunakan API publik berita RSS-to-JSON
        const data = await fetchJSON(
          "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Frss.detik.com%2Findex.php%3Frss%3Ddetikcom"
        );
        const items = data.items.slice(0, 5);
        let out = `📰 *Berita Terkini*\n\n`;
        items.forEach((item, i) => {
          out += `${i + 1}. *${item.title}*\n   🔗 ${item.link}\n\n`;
        });
        return reply(out.trim());
      } catch (e) {
        return reply("❌ Gagal mengambil berita.");
      }
    }

    // ── HITUNG (KALKULATOR) ───────────────────────────────────
    if (cmd === "hitung" || cmd === "calc") {
      if (!text) return reply("⚠️ Contoh: `!hitung 10 + 5 * 2`");
      try {
        // Bersihkan ekspresi (hanya angka dan operator)
        const expr = text.replace(/[^0-9+\-*/().%\s]/g, "");
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${expr})`)();
        return reply(`🔢 *Kalkulator*\n\n${text} = *${result}*`);
      } catch (e) {
        return reply("❌ Ekspresi matematika tidak valid.");
      }
    }

    // ── QR CODE ───────────────────────────────────────────────
    if (cmd === "qr") {
      if (!text) return reply("⚠️ Contoh: `!qr Halo dunia!`");
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`;
      return replyImage(qrUrl, `📷 *QR Code*\n${text}`);
    }

    // ── PASSWORD GENERATOR ────────────────────────────────────
    if (cmd === "password" || cmd === "pass") {
      const len = parseInt(args[1]) || 16;
      if (len < 4 || len > 64) return reply("⚠️ Panjang password antara 4–64.");
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      let pass = "";
      for (let i = 0; i < len; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return reply(`🔐 *Password Baru (${len} karakter)*\n\`${pass}\`\n\n⚠️ _Jangan bagikan ke siapapun!_`);
    }

    // ── RANDOM ANGKA ──────────────────────────────────────────
    if (cmd === "random" || cmd === "rand") {
      const min = parseInt(args[1]) || 1;
      const max = parseInt(args[2]) || 100;
      if (min >= max) return reply("⚠️ Min harus lebih kecil dari Max.");
      const result = Math.floor(Math.random() * (max - min + 1)) + min;
      return reply(`🎲 *Angka Random*\n\nRange: ${min} – ${max}\nHasil: *${result}*`);
    }

    // ── BALIK TEKS ────────────────────────────────────────────
    if (cmd === "balik") {
      if (!text) return reply("⚠️ Contoh: `!balik Halo`");
      return reply(`🔄 *${text.split("").reverse().join("")}*`);
    }

    // ── ULANG TEKS ────────────────────────────────────────────
    if (cmd === "ulang") {
      const n = parseInt(args[1]) || 3;
      const t = args.slice(2).join(" ");
      if (!t) return reply("⚠️ Contoh: `!ulang 3 Halo`");
      if (n > 20) return reply("⚠️ Maksimal 20 kali pengulangan.");
      return reply(Array(n).fill(t).join("\n"));
    }

    // ── UPPER ─────────────────────────────────────────────────
    if (cmd === "upper") {
      if (!text) return reply("⚠️ Contoh: `!upper halo dunia`");
      return reply(text.toUpperCase());
    }

    // ── LOWER ─────────────────────────────────────────────────
    if (cmd === "lower") {
      if (!text) return reply("⚠️ Contoh: `!lower HALO DUNIA`");
      return reply(text.toLowerCase());
    }

    // ── SIMPAN CATATAN ────────────────────────────────────────
    if (cmd === "save") {
      const key = args[1];
      const val = args.slice(2).join(" ");
      if (!key || !val) return reply("⚠️ Contoh: `!save wifi PasswordWifi123`");
      const db = loadDB();
      const user = getNum(sender);
      if (!db[user]) db[user] = {};
      db[user][key] = val;
      saveDB(db);
      return reply(`✅ Catatan *${key}* berhasil disimpan!`);
    }

    // ── AMBIL CATATAN ─────────────────────────────────────────
    if (cmd === "get") {
      const key = args[1];
      if (!key) return reply("⚠️ Contoh: `!get wifi`");
      const db = loadDB();
      const user = getNum(sender);
      const val = db[user]?.[key];
      if (!val) return reply(`❌ Catatan *${key}* tidak ditemukan.`);
      return reply(`📝 *${key}*\n${val}`);
    }

    // ── HAPUS CATATAN ─────────────────────────────────────────
    if (cmd === "del") {
      const key = args[1];
      if (!key) return reply("⚠️ Contoh: `!del wifi`");
      const db = loadDB();
      const user = getNum(sender);
      if (!db[user]?.[key]) return reply(`❌ Catatan *${key}* tidak ditemukan.`);
      delete db[user][key];
      saveDB(db);
      return reply(`🗑️ Catatan *${key}* berhasil dihapus.`);
    }

    // ── LIST CATATAN ──────────────────────────────────────────
    if (cmd === "list") {
      const db = loadDB();
      const user = getNum(sender);
      const keys = Object.keys(db[user] || {});
      if (keys.length === 0) return reply("📭 Belum ada catatan tersimpan.\n\nGunakan `!save key value` untuk menyimpan.");
      return reply(`📋 *Daftar Catatan*\n\n${keys.map((k, i) => `${i + 1}. ${k}`).join("\n")}\n\n_Gunakan \`!get [nama]\` untuk melihat isi._`);
    }

    // ============================================================
    // PERINTAH OWNER
    // ============================================================
    if (!isOwner(sender)) {
      if (["shell", "broadcast", "restart", "log"].includes(cmd)) {
        return reply("⛔ Perintah ini hanya untuk *Owner*.");
      }
    }

    // ── SHELL ─────────────────────────────────────────────────
    if (cmd === "shell" || cmd === "exec") {
      if (!text) return reply("⚠️ Contoh: `!shell ls -la`");
      try {
        const output = await runShell(text);
        return reply(`💻 *Shell Output*\n\`\`\`\n${output.slice(0, 3000)}\n\`\`\``);
      } catch (e) {
        return reply(`❌ *Error*\n\`\`\`\n${String(e).slice(0, 2000)}\n\`\`\``);
      }
    }

    // ── BROADCAST ─────────────────────────────────────────────
    if (cmd === "broadcast" || cmd === "bc") {
      if (!text) return reply("⚠️ Contoh: `!broadcast Halo semua!`");
      const chats = [];
      let sent = 0;
      for (const jid of chats) {
        try {
          await sock.sendMessage(jid, { text: `📢 *Broadcast*\n\n${text}` });
          sent++;
          await new Promise((r) => setTimeout(r, 500));
        } catch (_) {}
      }
      return reply(`✅ Broadcast terkirim ke *${sent}* chat.`);
    }

    // ── RESTART ───────────────────────────────────────────────
    if (cmd === "restart") {
      await reply("🔄 Bot sedang restart...");
      log("[RESTART] Restart diminta oleh owner.");
      setTimeout(() => process.exit(0), 1000);
      return;
    }

    // ── LOG ───────────────────────────────────────────────────
    if (cmd === "log") {
      try {
        const logContent = fs.readFileSync(config.logFile, "utf8");
        const lines = logContent.trim().split("\n").slice(-30).join("\n");
        return reply(`📜 *Log Terakhir (30 baris)*\n\`\`\`\n${lines}\n\`\`\``);
      } catch (e) {
        return reply("❌ Log kosong atau tidak ditemukan.");
      }
    }

    // ============================================================
    // FITUR BARU (50 FITUR TAMBAHAN)
    // ============================================================

    // ── 1. PROFIL ─────────────────────────────────────────────
    if (cmd === "profil") {
      const num = getNum(sender);
      const db = loadDB();
      const catatan = Object.keys(db[num] || {}).length;
      return reply(
        `👤 *Profil Kamu*\n\n` +
        `📱 Nomor  : +${num}\n` +
        `📝 Catatan: ${catatan} tersimpan\n` +
        `🤖 Bot    : ${config.botName}\n` +
        `🕐 Waktu  : ${getDateTime()} WIB`
      );
    }

    // ── 2. ID ─────────────────────────────────────────────────
    if (cmd === "id") {
      return reply(`🔍 *Info ID*\n\nJID Pengirim : \`${sender}\`\nJID Chat     : \`${from}\`\nNomor        : +${getNum(sender)}\nGrup         : ${isGroup ? "Ya" : "Tidak"}`);
    }

    // ── 3. TAGALL ─────────────────────────────────────────────
    if (cmd === "tagall") {
      if (!isGroup) return reply("⚠️ Perintah ini hanya untuk grup.");
      const groupMeta = await sock.groupMetadata(from);
      const members = groupMeta.participants;
      let mentions = members.map((m) => m.id);
      let teks = `📢 *Tag Semua Anggota*\n\n${text || "Halo semuanya!"}\n\n`;
      teks += members.map((m) => `@${getNum(m.id)}`).join(" ");
      await sock.sendMessage(from, { text: teks, mentions }, { quoted: msg });
      return;
    }

    // ── 4. HIDETAG ────────────────────────────────────────────
    if (cmd === "hidetag") {
      if (!isGroup) return reply("⚠️ Perintah ini hanya untuk grup.");
      const groupMeta = await sock.groupMetadata(from);
      const mentions = groupMeta.participants.map((m) => m.id);
      await sock.sendMessage(from, { text: text || "📢 Perhatian!", mentions }, { quoted: msg });
      return;
    }

    // ── 5. WIKIPEDIA ──────────────────────────────────────────
    if (cmd === "wiki" || cmd === "wikipedia") {
      if (!text) return reply("⚠️ Contoh: `!wiki Soekarno`");
      try {
        const query = encodeURIComponent(text);
        const data = await fetchJSON(`https://id.wikipedia.org/api/rest_v1/page/summary/${query}`);
        if (data.type === "disambiguation") return reply(`⚠️ Kata "${text}" ambigu. Coba lebih spesifik.`);
        const ringkasan = data.extract?.slice(0, 600) || "Tidak ada ringkasan.";
        return reply(`📖 *Wikipedia: ${data.title}*\n\n${ringkasan}\n\n🔗 ${data.content_urls?.desktop?.page || ""}`);
      } catch (e) {
        return reply("❌ Artikel tidak ditemukan di Wikipedia.");
      }
    }

    // ── 6. CRYPTO ─────────────────────────────────────────────
    if (cmd === "crypto" || cmd === "kripto") {
      const koin = (args[1] || "bitcoin").toLowerCase();
      try {
        const data = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${koin}&vs_currencies=usd,idr&include_24hr_change=true`);
        if (!data[koin]) return reply(`❌ Koin "${koin}" tidak ditemukan.`);
        const harga = data[koin];
        return reply(
          `💰 *${koin.toUpperCase()}*\n\n` +
          `💵 USD  : $${harga.usd?.toLocaleString()}\n` +
          `🇮🇩 IDR  : Rp ${harga.idr?.toLocaleString("id-ID")}\n` +
          `📈 24h  : ${harga.usd_24h_change?.toFixed(2)}%`
        );
      } catch (e) {
        return reply("❌ Gagal mengambil data crypto.");
      }
    }

    // ── 7. INFO IP ────────────────────────────────────────────
    if (cmd === "ip") {
      const alamat = args[1] || "";
      try {
        const url = alamat ? `http://ip-api.com/json/${alamat}` : `http://ip-api.com/json/`;
        const data = await fetchJSON(url);
        if (data.status !== "success") return reply("❌ IP tidak valid atau tidak ditemukan.");
        return reply(
          `🌐 *Info IP*\n\n` +
          `🔢 IP       : ${data.query}\n` +
          `🏳️ Negara  : ${data.country}\n` +
          `🏙️ Kota    : ${data.city}\n` +
          `📡 ISP      : ${data.isp}\n` +
          `🗺️ Region  : ${data.regionName}\n` +
          `📍 Koordinat: ${data.lat}, ${data.lon}\n` +
          `⏰ Timezone : ${data.timezone}`
        );
      } catch (e) {
        return reply("❌ Gagal mengambil info IP.");
      }
    }

    // ── 8. NPM INFO ───────────────────────────────────────────
    if (cmd === "npm") {
      if (!text) return reply("⚠️ Contoh: `!npm axios`");
      try {
        const data = await fetchJSON(`https://registry.npmjs.org/${encodeURIComponent(text)}/latest`);
        return reply(
          `📦 *NPM: ${data.name}*\n\n` +
          `📝 Deskripsi : ${data.description || "-"}\n` +
          `🏷️ Versi     : ${data.version}\n` +
          `👤 Author    : ${typeof data.author === "object" ? data.author?.name : data.author || "-"}\n` +
          `📜 Lisensi   : ${data.license || "-"}\n` +
          `🔗 NPM       : https://npmjs.com/package/${data.name}`
        );
      } catch (e) {
        return reply("❌ Paket NPM tidak ditemukan.");
      }
    }

    // ── 9. SHORT URL ──────────────────────────────────────────
    if (cmd === "shorturl" || cmd === "short") {
      if (!text) return reply("⚠️ Contoh: `!shorturl https://example.com`");
      try {
        const data = await fetchJSON(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`);
        return reply(`🔗 *Short URL*\n\nAsli  : ${text}\nPendek: ${data}`);
      } catch (e) {
        return reply("❌ Gagal mempersingkat URL.");
      }
    }

    // ── 10. ENCODE BASE64 ─────────────────────────────────────
    if (cmd === "encode") {
      if (!text) return reply("⚠️ Contoh: `!encode Halo Dunia`");
      const encoded = Buffer.from(text).toString("base64");
      return reply(`🔒 *Base64 Encode*\n\nInput  : ${text}\nOutput : \`${encoded}\``);
    }

    // ── 11. DECODE BASE64 ─────────────────────────────────────
    if (cmd === "decode") {
      if (!text) return reply("⚠️ Contoh: `!decode SGFsbyBEdW5pYQ==`");
      try {
        const decoded = Buffer.from(text, "base64").toString("utf8");
        return reply(`🔓 *Base64 Decode*\n\nInput  : ${text}\nOutput : \`${decoded}\``);
      } catch {
        return reply("❌ Teks bukan Base64 yang valid.");
      }
    }

    // ── 12. TEKS KE BINARY ────────────────────────────────────
    if (cmd === "binary") {
      if (!text) return reply("⚠️ Contoh: `!binary Halo`");
      const bin = text.split("").map((c) => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
      return reply(`💻 *Teks → Binary*\n\nInput  : ${text}\nOutput : \`${bin.slice(0, 500)}\``);
    }

    // ── 13. BINARY KE TEKS ────────────────────────────────────
    if (cmd === "debinary") {
      if (!text) return reply("⚠️ Contoh: `!debinary 01001000 01100001 01101100 01101111`");
      try {
        const result = text.split(" ").map((b) => String.fromCharCode(parseInt(b, 2))).join("");
        return reply(`💻 *Binary → Teks*\n\nInput  : ${text.slice(0, 100)}\nOutput : \`${result}\``);
      } catch {
        return reply("❌ Format binary tidak valid.");
      }
    }

    // ── 14. TEKS KE HEX ──────────────────────────────────────
    if (cmd === "hex") {
      if (!text) return reply("⚠️ Contoh: `!hex Halo`");
      const hexOut = Buffer.from(text).toString("hex").match(/.{1,2}/g).join(" ");
      return reply(`🔡 *Teks → Hex*\n\nInput  : ${text}\nOutput : \`${hexOut.slice(0, 500)}\``);
    }

    // ── 15. HEX KE TEKS ──────────────────────────────────────
    if (cmd === "dehex") {
      if (!text) return reply("⚠️ Contoh: `!dehex 48 61 6c 6f`");
      try {
        const clean = text.replace(/\s+/g, "");
        const result = Buffer.from(clean, "hex").toString("utf8");
        return reply(`🔡 *Hex → Teks*\n\nInput  : ${text}\nOutput : \`${result}\``);
      } catch {
        return reply("❌ Format hex tidak valid.");
      }
    }

    // ── 16. CAESAR CIPHER ─────────────────────────────────────
    if (cmd === "caesar") {
      const shift = parseInt(args[1]);
      const plaintext = args.slice(2).join(" ");
      if (isNaN(shift) || !plaintext) return reply("⚠️ Contoh: `!caesar 3 Halo Dunia`");
      const encrypted = plaintext.replace(/[a-zA-Z]/g, (c) => {
        const base = c >= "a" ? 97 : 65;
        return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26 + 26) % 26 + base);
      });
      return reply(`🔐 *Caesar Cipher (shift ${shift})*\n\nInput   : ${plaintext}\nOutput  : \`${encrypted}\``);
    }

    // ── 17. HITUNG PERSEN ─────────────────────────────────────
    if (cmd === "persen") {
      const a = parseFloat(args[1]);
      const b = parseFloat(args[2]);
      if (isNaN(a) || isNaN(b) || b === 0) return reply("⚠️ Contoh: `!persen 25 200` → 25% dari 200");
      const result = (a / 100) * b;
      const pct = ((a / b) * 100).toFixed(2);
      return reply(`📊 *Kalkulator Persen*\n\n${a}% dari ${b} = *${result}*\n${a} dari ${b} = *${pct}%*`);
    }

    // ── 18. KG KE LBS ─────────────────────────────────────────
    if (cmd === "kgkelbs") {
      const kg = parseFloat(args[1]);
      if (isNaN(kg)) return reply("⚠️ Contoh: `!kgkelbs 70`");
      return reply(`⚖️ *Konversi Berat*\n\n${kg} kg = *${(kg * 2.20462).toFixed(3)} lbs*`);
    }

    // ── 19. CM KE KAKI ────────────────────────────────────────
    if (cmd === "cmkaki") {
      const cm = parseFloat(args[1]);
      if (isNaN(cm)) return reply("⚠️ Contoh: `!cmkaki 170`");
      const feet = Math.floor(cm / 30.48);
      const inches = ((cm % 30.48) / 2.54).toFixed(1);
      return reply(`📏 *Konversi Panjang*\n\n${cm} cm = *${feet} kaki ${inches} inci*`);
    }

    // ── 20. CELCIUS KE FAHRENHEIT ─────────────────────────────
    if (cmd === "celcius" || cmd === "suhu") {
      const c = parseFloat(args[1]);
      if (isNaN(c)) return reply("⚠️ Contoh: `!celcius 30`");
      const f = (c * 9 / 5 + 32).toFixed(2);
      const k = (c + 273.15).toFixed(2);
      return reply(`🌡️ *Konversi Suhu*\n\n${c}°C = *${f}°F* = *${k}K*`);
    }

    // ── 21. COUNTDOWN ─────────────────────────────────────────
    if (cmd === "countdown" || cmd === "hitung mundur") {
      if (!text) return reply("⚠️ Contoh: `!countdown 25/12/2025`");
      const parts = text.split("/");
      if (parts.length !== 3) return reply("⚠️ Format: `dd/mm/yyyy`");
      const target = new Date(`${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}T00:00:00+07:00`);
      if (isNaN(target)) return reply("❌ Tanggal tidak valid.");
      const now = new Date();
      const diff = target - now;
      if (diff < 0) return reply("⚠️ Tanggal sudah lewat!");
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return reply(`⏳ *Countdown ke ${text}*\n\n⏰ ${days} hari ${hours} jam ${mins} menit lagi`);
    }

    // ── 22. TEBAK ANGKA (MULAI / TEBAK) ──────────────────────
    if (cmd === "tebak") {
      if (!text) {
        // Mulai game
        const angka = Math.floor(Math.random() * 100) + 1;
        tebakGame[from] = { angka, coba: 0 };
        return reply(`🎮 *Game Tebak Angka Dimulai!*\n\nSaya sudah memilih angka antara 1–100.\nGunakan \`!tebak [angka]\` untuk menebak.\n💡 Kamu punya 7 kesempatan!`);
      } else {
        const game = tebakGame[from];
        if (!game) return reply("⚠️ Belum ada game aktif. Ketik `!tebak` untuk memulai.");
        const tebakan = parseInt(text);
        if (isNaN(tebakan)) return reply("⚠️ Masukkan angka yang valid.");
        game.coba++;
        if (tebakan === game.angka) {
          delete tebakGame[from];
          return reply(`🎉 *BENAR!* Angkanya adalah *${game.angka}*!\nKamu menebak dalam *${game.coba}* kali percobaan. 🏆`);
        }
        if (game.coba >= 7) {
          const jawaban = game.angka;
          delete tebakGame[from];
          return reply(`😢 *Game Over!* Angkanya adalah *${jawaban}*.\nCoba lagi dengan \`!tebak\``);
        }
        const hint = tebakan < game.angka ? "📈 Terlalu kecil!" : "📉 Terlalu besar!";
        return reply(`${hint}\nPercobaan ke-${game.coba}/7. Coba lagi!`);
      }
    }

    // ── 23. DADU ──────────────────────────────────────────────
    if (cmd === "dadu" || cmd === "dice") {
      const sisi = parseInt(args[1]) || 6;
      if (sisi < 2 || sisi > 1000) return reply("⚠️ Sisi dadu antara 2–1000.");
      const hasil = Math.floor(Math.random() * sisi) + 1;
      return reply(`🎲 *Lempar Dadu ${sisi} Sisi*\n\nHasil: *${hasil}*`);
    }

    // ── 24. KOIN ──────────────────────────────────────────────
    if (cmd === "koin" || cmd === "coin") {
      const hasil = Math.random() < 0.5 ? "👑 HEADS (Gambar)" : "🪙 TAILS (Angka)";
      return reply(`🪙 *Lempar Koin*\n\nHasil: *${hasil}*`);
    }

    // ── 25. MAGIC 8 BALL ─────────────────────────────────────
    if (cmd === "8ball") {
      if (!text) return reply("⚠️ Contoh: `!8ball Apakah hari ini mujur?`");
      const jawaban = [
        "✅ Pasti iya!", "✅ Tentu saja!", "✅ Ya, sudah pasti.",
        "🤔 Kemungkinan besar iya.", "🤔 Coba tanyakan lagi nanti.",
        "❌ Tidak sepertinya.", "❌ Pasti tidak!", "❌ Jangan bergantung pada itu.",
        "😕 Tidak bisa dipastikan sekarang.", "🌀 Tanda-tandanya tidak jelas."
      ];
      const pilihan = jawaban[Math.floor(Math.random() * jawaban.length)];
      return reply(`🎱 *Magic 8 Ball*\n\n❓ ${text}\n\n🔮 ${pilihan}`);
    }

    // ── 26. WARNA HEX PREVIEW ─────────────────────────────────
    if (cmd === "warna" || cmd === "color") {
      const hex = (args[1] || "").replace("#", "");
      if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return reply("⚠️ Contoh: `!warna FF5733`");
      const r = parseInt(hex.slice(0,2), 16);
      const g = parseInt(hex.slice(2,4), 16);
      const b = parseInt(hex.slice(4,6), 16);
      const imgUrl = `https://via.placeholder.com/200x200/${hex}/${hex}.png`;
      return replyImage(imgUrl, `🎨 *Warna #${hex.toUpperCase()}*\n\nR: ${r} | G: ${g} | B: ${b}`);
    }

    // ── 27. HOROSCOPE ─────────────────────────────────────────
    if (cmd === "horoscope" || cmd === "zodiak" || cmd === "bintang") {
      const zodiak = (args[1] || "").toLowerCase();
      const daftarZodiak = ["aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn","aquarius","pisces"];
      if (!zodiak || !daftarZodiak.includes(zodiak)) {
        return reply(`⚠️ Masukkan nama zodiak.\nContoh: \`!horoscope aries\`\n\n📋 Zodiak: ${daftarZodiak.join(", ")}`);
      }
      try {
        const data = await fetchJSON(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${zodiak}&day=TODAY`);
        return reply(`♈ *Ramalan ${zodiak.charAt(0).toUpperCase() + zodiak.slice(1)} Hari Ini*\n\n${data.data?.horoscope_data || "Tidak tersedia."}`);
      } catch {
        const fallback = ["Hari ini penuh dengan kemungkinan. Ambil kesempatan dengan bijak.",
          "Energi positif mengelilingimu. Jaga fokus dan semangat!",
          "Hati-hati dalam mengambil keputusan hari ini. Pikir dua kali."];
        return reply(`♈ *Ramalan ${zodiak}*\n\n${fallback[Math.floor(Math.random() * fallback.length)]}`);
      }
    }

    // ── 28. FAKTA UNIK ────────────────────────────────────────
    if (cmd === "fakta" || cmd === "fact") {
      try {
        const data = await fetchJSON("https://uselessfacts.jsph.pl/random.json?language=en");
        return reply(`💡 *Fakta Unik*\n\n${data.text}`);
      } catch {
        const fakta = [
          "Seekor siput bisa tidur selama 3 tahun berturut-turut.",
          "Ikan piranha lebih takut pada manusia daripada sebaliknya.",
          "Honey tidak pernah kadaluarsa. Madu berusia 3000 tahun ditemukan di piramida Mesir masih bisa dimakan.",
          "Gurita punya 3 jantung dan darahnya berwarna biru.",
          "Sidik jari koala sangat mirip dengan manusia sehingga bisa mengecoh polisi.",
        ];
        return reply(`💡 *Fakta Unik*\n\n${fakta[Math.floor(Math.random() * fakta.length)]}`);
      }
    }

    // ── 29. MEME RANDOM ───────────────────────────────────────
    if (cmd === "meme") {
      try {
        const data = await fetchJSON("https://meme-api.com/gimme");
        if (!data.url) throw new Error();
        return replyImage(data.url, `😂 *${data.title}*\n\n👍 ${data.ups} upvotes`);
      } catch {
        return reply("❌ Gagal mengambil meme. Coba lagi nanti.");
      }
    }

    // ── 30. TODO: TAMBAH ──────────────────────────────────────
    if (cmd === "todo") {
      if (!text) return reply("⚠️ Contoh: `!todo Belajar Node.js`");
      const db = loadDB();
      const user = getNum(sender);
      if (!db[user]) db[user] = {};
      if (!db[user]._todos) db[user]._todos = [];
      db[user]._todos.push({ task: text, done: false, time: new Date().toLocaleString("id-ID") });
      saveDB(db);
      return reply(`✅ Todo ditambahkan:\n📝 ${text}`);
    }

    // ── 31. TODO: LIHAT ───────────────────────────────────────
    if (cmd === "todos") {
      const db = loadDB();
      const user = getNum(sender);
      const todos = db[user]?._todos || [];
      if (todos.length === 0) return reply("📭 Belum ada todo. Tambahkan dengan `!todo [tugas]`");
      let out = `📋 *Daftar Todo*\n\n`;
      todos.forEach((t, i) => {
        out += `${i + 1}. ${t.done ? "✅" : "⬜"} ${t.task}\n`;
      });
      out += `\n_!donetodo [no] untuk selesai | !deltodo [no] untuk hapus_`;
      return reply(out);
    }

    // ── 32. TODO: SELESAI ─────────────────────────────────────
    if (cmd === "donetodo") {
      const no = parseInt(args[1]) - 1;
      const db = loadDB();
      const user = getNum(sender);
      const todos = db[user]?._todos || [];
      if (isNaN(no) || no < 0 || no >= todos.length) return reply("⚠️ Nomor todo tidak valid.");
      todos[no].done = true;
      saveDB(db);
      return reply(`✅ Todo #${no + 1} ditandai selesai:\n_${todos[no].task}_`);
    }

    // ── 33. TODO: HAPUS ───────────────────────────────────────
    if (cmd === "deltodo") {
      const no = parseInt(args[1]) - 1;
      const db = loadDB();
      const user = getNum(sender);
      const todos = db[user]?._todos || [];
      if (isNaN(no) || no < 0 || no >= todos.length) return reply("⚠️ Nomor todo tidak valid.");
      const [removed] = todos.splice(no, 1);
      saveDB(db);
      return reply(`🗑️ Todo dihapus:\n_${removed.task}_`);
    }

    // ── 34. BUAT POLLING ──────────────────────────────────────
    if (cmd === "poll") {
      const parts = text.split("|").map((s) => s.trim());
      if (parts.length < 3) return reply("⚠️ Contoh: `!poll Makan siang?|Nasi|Mie|Soto`");
      const [question, ...options] = parts;
      const pollId = Date.now().toString(36);
      pollStore[pollId] = { question, options, votes: {}, creator: getNum(sender) };
      let out = `📊 *Polling Dibuat!*\n\nID: \`${pollId}\`\n❓ ${question}\n\n`;
      options.forEach((o, i) => { out += `${i + 1}. ${o}\n`; });
      out += `\n_Gunakan \`!vote ${pollId} [no]\` untuk memilih_`;
      return reply(out);
    }

    // ── 35. VOTE POLLING ──────────────────────────────────────
    if (cmd === "vote") {
      const pollId = args[1];
      const pilihanNo = parseInt(args[2]) - 1;
      if (!pollId || isNaN(pilihanNo)) return reply("⚠️ Contoh: `!vote abc123 1`");
      const poll = pollStore[pollId];
      if (!poll) return reply("❌ Polling tidak ditemukan. Mungkin sudah berakhir atau ID salah.");
      if (pilihanNo < 0 || pilihanNo >= poll.options.length) return reply("⚠️ Nomor pilihan tidak valid.");
      poll.votes[getNum(sender)] = pilihanNo;
      // Hitung hasil
      const tally = Array(poll.options.length).fill(0);
      Object.values(poll.votes).forEach((v) => tally[v]++);
      const total = Object.keys(poll.votes).length;
      let out = `✅ Votemu tercatat!\n\n📊 *${poll.question}*\n\n`;
      poll.options.forEach((o, i) => {
        const bar = "█".repeat(Math.round((tally[i] / (total || 1)) * 10)) + "░".repeat(10 - Math.round((tally[i] / (total || 1)) * 10));
        out += `${i + 1}. ${o}\n   ${bar} ${tally[i]} suara\n`;
      });
      out += `\n👥 Total: ${total} voter`;
      return reply(out);
    }

    // ── 36. SETPREFIX (OWNER) ─────────────────────────────────
    if (cmd === "setprefix") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      if (!args[1] || args[1].length > 2) return reply("⚠️ Contoh: `!setprefix /`");
      config.prefix = args[1];
      return reply(`✅ Prefix berhasil diubah ke: \`${config.prefix}\``);
    }

    // ── 37. SETWELCOME (OWNER) ────────────────────────────────
    if (cmd === "setwelcome") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!text) return reply("⚠️ Contoh: `!setwelcome Halo @name, selamat datang di @group!`");
      welcomeMessages[from] = text;
      saveWelcome(welcomeMessages);
      return reply(`✅ Pesan welcome diatur:\n_${text}_\n\n_Gunakan @name untuk nama anggota, @group untuk nama grup._`);
    }

    // ── 38. CLEARLOG (OWNER) ──────────────────────────────────
    if (cmd === "clearlog") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      fs.writeFileSync(config.logFile, "");
      log("[LOG] Log dibersihkan oleh owner.");
      return reply("🗑️ Log berhasil dibersihkan.");
    }

    // ── 39. STATS (OWNER) ─────────────────────────────────────
    if (cmd === "stats") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const uptime = Math.floor((Date.now() - botStats.startTime) / 1000);
      return reply(
        `📊 *Statistik Bot*\n\n` +
        `🔢 Total Perintah : ${botStats.totalCmd}\n` +
        `⏱️ Uptime          : ${formatUptime(uptime)}\n` +
        `💾 Active Polls    : ${Object.keys(pollStore).length}\n` +
        `🎮 Active Games    : ${Object.keys(tebakGame).length}\n` +
        `🕐 ${getDateTime()} WIB`
      );
    }

    // ── 40. TRANSLATE (TERJEMAH) ──────────────────────────────
    if (cmd === "translate" || cmd === "terjemah") {
      if (!text) return reply("⚠️ Contoh: `!terjemah Hello World`");
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|id`;
        const data = await fetchJSON(url);
        const result = data.responseData?.translatedText;
        if (!result) throw new Error();
        return reply(`🌏 *Terjemahan*\n\n🇺🇸 ${text}\n🇮🇩 ${result}`);
      } catch {
        return reply("❌ Gagal menerjemahkan. Coba lagi nanti.");
      }
    }

    // ── 41. GITHUB USER ───────────────────────────────────────
    if (cmd === "github" || cmd === "gh") {
      if (!text) return reply("⚠️ Contoh: `!github torvalds`");
      try {
        const data = await fetchJSON(`https://api.github.com/users/${encodeURIComponent(text)}`);
        return reply(
          `🐙 *GitHub: ${data.login}*\n\n` +
          `👤 Nama        : ${data.name || "-"}\n` +
          `📝 Bio         : ${data.bio || "-"}\n` +
          `📦 Repo Publik : ${data.public_repos}\n` +
          `👥 Followers   : ${data.followers}\n` +
          `🏙️ Lokasi      : ${data.location || "-"}\n` +
          `🔗 Profil      : ${data.html_url}`
        );
      } catch {
        return reply("❌ User GitHub tidak ditemukan.");
      }
    }

    // ── 42. CEK DOMAIN ────────────────────────────────────────
    if (cmd === "domain" || cmd === "cekdomain") {
      if (!text) return reply("⚠️ Contoh: `!domain google.com`");
      try {
        const data = await fetchJSON(`https://api.domainsdb.info/v1/domains/search?domain=${encodeURIComponent(text)}&zone=com`);
        const found = data.domains?.length > 0;
        return reply(`🌐 *Cek Domain*\n\nDomain : ${text}\nStatus : ${found ? "❌ Sudah terdaftar" : "✅ Tersedia!"}\n\n_Catatan: Cek langsung ke registrar untuk konfirmasi._`);
      } catch {
        return reply("❌ Gagal cek domain.");
      }
    }

    // ── 43. CEK INTERNET ──────────────────────────────────────
    if (cmd === "ceknet" || cmd === "internet") {
      const start = Date.now();
      try {
        await fetchJSON("https://api64.ipify.org?format=json");
        const latency = Date.now() - start;
        return reply(`🌐 *Cek Koneksi Internet*\n\n✅ Internet aktif!\n⚡ Latency: ${latency}ms\n🕐 ${getDateTime()} WIB`);
      } catch {
        return reply("❌ Internet tidak tersedia atau lambat.");
      }
    }

    // ── 44. ROMAN NUMERAL ─────────────────────────────────────
    if (cmd === "roman") {
      const num = parseInt(args[1]);
      if (isNaN(num) || num < 1 || num > 3999) return reply("⚠️ Contoh: `!roman 2024` (1–3999)");
      const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
      const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
      let result = "", n = num;
      for (let i = 0; i < vals.length; i++) {
        while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
      }
      return reply(`🏛️ *Angka Romawi*\n\n${num} = *${result}*`);
    }

    // ── 45. GENERATE USERNAME ─────────────────────────────────
    if (cmd === "username" || cmd === "namauser") {
      const kata1 = ["cool","dark","flash","ninja","shadow","storm","ultra","hyper","mega","neo"];
      const kata2 = ["wolf","lion","eagle","dragon","fox","shark","hawk","tiger","blade","storm"];
      const num2 = Math.floor(Math.random() * 9999);
      const username = `${kata1[Math.floor(Math.random() * kata1.length)]}${kata2[Math.floor(Math.random() * kata2.length)]}${num2}`;
      return reply(`✨ *Username Generator*\n\nSaran username:\n• \`${username}\`\n• \`${username}_id\`\n• \`${username.toUpperCase()}\``);
    }

    // ── 46. HITUNG BMI ────────────────────────────────────────
    if (cmd === "bmi") {
      const bb = parseFloat(args[1]);
      const tb = parseFloat(args[2]);
      if (isNaN(bb) || isNaN(tb) || tb <= 0) return reply("⚠️ Contoh: `!bmi 65 170` (berat kg, tinggi cm)");
      const tbm = tb / 100;
      const bmi = (bb / (tbm * tbm)).toFixed(2);
      let kategori = "";
      if (bmi < 18.5) kategori = "⚠️ Kekurangan berat badan";
      else if (bmi < 25) kategori = "✅ Normal / Ideal";
      else if (bmi < 30) kategori = "⚠️ Kelebihan berat badan";
      else kategori = "❌ Obesitas";
      return reply(`⚖️ *Kalkulator BMI*\n\nBerat  : ${bb} kg\nTinggi : ${tb} cm\nBMI    : *${bmi}*\nStatus : ${kategori}`);
    }

    // ── 47. ACAK NAMA ─────────────────────────────────────────
    if (cmd === "acaknama" || cmd === "randomname") {
      const namaDepan = ["Andi","Budi","Citra","Dewi","Eko","Fajar","Gita","Hani","Indra","Joko","Kartika","Lena"];
      const namaBelakang = ["Santoso","Wijaya","Kusuma","Putra","Sari","Nugroho","Pratama","Hidayat","Susanto","Lestari"];
      const nama = `${namaDepan[Math.floor(Math.random() * namaDepan.length)]} ${namaBelakang[Math.floor(Math.random() * namaBelakang.length)]}`;
      return reply(`👤 *Random Nama Indonesia*\n\n${nama}`);
    }

    // ── 48. EMOJI TEKS ────────────────────────────────────────
    if (cmd === "emojify") {
      if (!text) return reply("⚠️ Contoh: `!emojify Halo`");
      const emojiMap = {
        a:"🅰️",b:"🅱️",c:"©️",d:"↩️",e:"📧",f:"🎏",g:"🌀",h:"♓",i:"ℹ️",
        j:"🗾",k:"🎋",l:"🕒",m:"〽️",n:"♑",o:"🅾️",p:"🅿️",q:"🔎",r:"®️",
        s:"💲",t:"✝️",u:"⛎",v:"✌️",w:"〰️",x:"❌",y:"💹",z:"💤"
      };
      const result = text.toLowerCase().split("").map((c) => emojiMap[c] || c).join(" ");
      return reply(`✨ *Emojify*\n\n${result}`);
    }

    // ── 49. SARAN NAMA BISNIS ─────────────────────────────────
    if (cmd === "bisnis" || cmd === "namabisnis") {
      const prefix = ["Prima","Maju","Jaya","Karya","Cipta","Nusa","Buana","Artha","Gemilang","Harapan"];
      const suffix = ["Mandiri","Abadi","Sejahtera","Utama","Lestari","Perkasa","Nusantara","Indonesia","Digital","Teknik"];
      const suggestions = Array.from({length: 5}, () =>
        `${prefix[Math.floor(Math.random() * prefix.length)]} ${suffix[Math.floor(Math.random() * suffix.length)]}`
      );
      return reply(`💼 *Saran Nama Bisnis*\n\n${suggestions.map((s,i) => `${i+1}. ${s}`).join("\n")}`);
    }

    // ── 50. MORSE CODE ────────────────────────────────────────
    if (cmd === "morse") {
      if (!text) return reply("⚠️ Contoh: `!morse Halo`");
      const morseMap = {
        a:".-",b:"-...",c:"-.-.",d:"-..",e:".",f:"..-.",g:"--.",h:"....",i:"..",
        j:".---",k:"-.-",l:".-..",m:"--",n:"-.",o:"---",p:".--.",q:"--.-",r:".-.",
        s:"...",t:"-",u:"..-",v:"...-",w:".--",x:"-..-",y:"-.--",z:"--..",
        "0":"-----","1":".----","2":"..---","3":"...--","4":"....-","5":".....",
        "6":"-....","7":"--...","8":"---..","9":"----."
      };
      const morse = text.toLowerCase().split("").map((c) => c === " " ? "/" : (morseMap[c] || "?")).join(" ");
      return reply(`📡 *Morse Code*\n\nInput : ${text}\nMorse : \`${morse}\``);
    }

    // ============================================================
    // FITUR GRUP BARU
    // ============================================================

    // ── G1. KICK ANGGOTA ──────────────────────────────────────
    if (cmd === "kick") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        || (args[1] ? args[1].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) return reply("⚠️ Tag atau sebut nomor anggota. Contoh: `!kick @anggota`");
      try {
        await sock.groupParticipantsUpdate(from, [target], "remove");
        return reply(`✅ @${getNum(target)} berhasil dikick dari grup.`, [target]);
      } catch {
        return reply("❌ Gagal kick. Pastikan bot adalah admin.");
      }
    }

    // ── G2. ADD ANGGOTA ───────────────────────────────────────
    if (cmd === "add") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const nomor = (args[1] || "").replace(/[^0-9]/g, "");
      if (!nomor) return reply("⚠️ Contoh: `!add 6281234567890`");
      const jidTarget = nomor + "@s.whatsapp.net";
      try {
        await sock.groupParticipantsUpdate(from, [jidTarget], "add");
        return reply(`✅ ${nomor} berhasil ditambahkan ke grup.`);
      } catch {
        return reply("❌ Gagal menambahkan. Pastikan bot adalah admin dan nomor valid.");
      }
    }

    // ── G3. PROMOTE ADMIN ─────────────────────────────────────
    if (cmd === "promote") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        || (args[1] ? args[1].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) return reply("⚠️ Tag anggota. Contoh: `!promote @anggota`");
      try {
        await sock.groupParticipantsUpdate(from, [target], "promote");
        return reply(`⭐ @${getNum(target)} berhasil dijadikan admin.`, [target]);
      } catch {
        return reply("❌ Gagal promote. Pastikan bot adalah admin.");
      }
    }

    // ── G4. DEMOTE ADMIN ──────────────────────────────────────
    if (cmd === "demote") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        || (args[1] ? args[1].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) return reply("⚠️ Tag anggota. Contoh: `!demote @admin`");
      try {
        await sock.groupParticipantsUpdate(from, [target], "demote");
        return reply(`🔽 @${getNum(target)} berhasil dicopot dari admin.`, [target]);
      } catch {
        return reply("❌ Gagal demote. Pastikan bot adalah admin.");
      }
    }

    // ── G5. INFO GRUP ─────────────────────────────────────────
    if (cmd === "groupinfo" || cmd === "infogroup" || cmd === "gc") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      try {
        const meta = await sock.groupMetadata(from);
        const admins = meta.participants.filter(p => p.admin).map(p => `+${getNum(p.id)}`).join(", ");
        return reply(
          `👥 *Info Grup*\n\n` +
          `📛 Nama      : ${meta.subject}\n` +
          `🆔 ID        : ${from}\n` +
          `👤 Anggota   : ${meta.participants.length}\n` +
          `👑 Admin     : ${admins}\n` +
          `📅 Dibuat    : ${new Date(meta.creation * 1000).toLocaleDateString("id-ID")}\n` +
          `📝 Deskripsi : ${meta.desc || "-"}`
        );
      } catch {
        return reply("❌ Gagal mengambil info grup.");
      }
    }

    // ── G6. LINK GRUP ─────────────────────────────────────────
    if (cmd === "link" || cmd === "linkgrup") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      try {
        const code = await sock.groupInviteCode(from);
        return reply(`🔗 *Link Invite Grup*\n\nhttps://chat.whatsapp.com/${code}`);
      } catch {
        return reply("❌ Gagal ambil link. Pastikan bot adalah admin.");
      }
    }

    // ── G7. REVOKE LINK ───────────────────────────────────────
    if (cmd === "revokelink" || cmd === "resetlink") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      try {
        await sock.groupRevokeInvite(from);
        const newCode = await sock.groupInviteCode(from);
        return reply(`✅ Link lama sudah direset!\n\n🔗 Link baru:\nhttps://chat.whatsapp.com/${newCode}`);
      } catch {
        return reply("❌ Gagal reset link.");
      }
    }

    // ── G8. MUTE GRUP ─────────────────────────────────────────
    if (cmd === "mute" || cmd === "closegc") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      try {
        await sock.groupSettingUpdate(from, "announcement");
        return reply("🔇 Grup dimute! Hanya admin yang bisa kirim pesan.");
      } catch {
        return reply("❌ Gagal mute grup.");
      }
    }

    // ── G9. UNMUTE GRUP ───────────────────────────────────────
    if (cmd === "unmute" || cmd === "opengc") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      try {
        await sock.groupSettingUpdate(from, "not_announcement");
        return reply("🔊 Grup dibuka! Semua anggota bisa kirim pesan.");
      } catch {
        return reply("❌ Gagal unmute grup.");
      }
    }

    // ── G10. DAFTAR ADMIN ─────────────────────────────────────
    if (cmd === "listadmin" || cmd === "admins") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      try {
        const meta = await sock.groupMetadata(from);
        const admins = meta.participants.filter(p => p.admin);
        if (admins.length === 0) return reply("⚠️ Tidak ada admin di grup ini.");
        let out = `👑 *Daftar Admin Grup*\n\n`;
        admins.forEach((a, i) => {
          out += `${i+1}. @${getNum(a.id)} ${a.admin === "superadmin" ? "👑" : "⭐"}\n`;
        });
        await sock.sendMessage(from, { text: out, mentions: admins.map(a => a.id) }, { quoted: msg });
        return;
      } catch {
        return reply("❌ Gagal ambil daftar admin.");
      }
    }

    // ── G11. SETDESC GRUP ─────────────────────────────────────
    if (cmd === "setdesc" || cmd === "setdeskripsi") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      if (!text) return reply("⚠️ Contoh: `!setdesc Ini grup gaming kita`");
      try {
        await sock.groupUpdateDescription(from, text);
        return reply(`✅ Deskripsi grup berhasil diubah:\n_${text}_`);
      } catch {
        return reply("❌ Gagal ubah deskripsi.");
      }
    }

    // ── G12. SETNAME GRUP ─────────────────────────────────────
    if (cmd === "setname" || cmd === "namagrup") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      if (!text) return reply("⚠️ Contoh: `!setname Nama Grup Baru`");
      try {
        await sock.groupUpdateSubject(from, text);
        return reply(`✅ Nama grup berhasil diubah ke: *${text}*`);
      } catch {
        return reply("❌ Gagal ubah nama grup.");
      }
    }

    // ── G13. HAPUS WELCOME ────────────────────────────────────
    if (cmd === "delwelcome" || cmd === "hapuswelcome") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      delete welcomeMessages[from];
      saveWelcome(welcomeMessages);
      return reply("✅ Pesan welcome dihapus. Tidak ada lagi pesan otomatis saat member baru masuk.");
    }

    // ── G14. CEK WELCOME ─────────────────────────────────────
    if (cmd === "cekwelcome") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      const wMsg = welcomeMessages[from];
      if (!wMsg) return reply("❌ Belum ada pesan welcome di grup ini.\nGunakan `!setwelcome [pesan]` untuk mengatur.");
      return reply(`✅ *Pesan Welcome Saat Ini:*\n\n${wMsg}`);
    }

    // ── G15. LEAVE BYE ────────────────────────────────────────
    if (cmd === "setbye" || cmd === "setleave") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      if (!text) return reply("⚠️ Contoh: `!setbye Sampai jumpa @name!`");
      const db = loadDB();
      if (!db._bye) db._bye = {};
      db._bye[from] = text;
      saveDB(db);
      return reply(`✅ Pesan bye diatur:\n_${text}_\n\n_Gunakan @name untuk nama anggota._`);
    }

    // ============================================================
    // FITUR DOWNLOAD
    // ============================================================

    // ── D1. YOUTUBE INFO ──────────────────────────────────────
    if (cmd === "ytinfo" || cmd === "youtubeinfo") {
      if (!text) return reply("⚠️ Contoh: `!ytinfo https://youtube.com/watch?v=xxx`");
      try {
        const videoId = text.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        if (!videoId) return reply("❌ URL YouTube tidak valid.");
        const data = await fetchJSON(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        return reply(
          `🎬 *YouTube Info*\n\n` +
          `📛 Judul    : ${data.title}\n` +
          `👤 Channel  : ${data.author_name}\n` +
          `🔗 URL      : https://youtu.be/${videoId}\n\n` +
          `_Gunakan website seperti y2mate.com atau ssyoutube.com untuk download_`
        );
      } catch {
        return reply("❌ Gagal ambil info video.");
      }
    }

    // ── D2. TIKTOK INFO ───────────────────────────────────────
    if (cmd === "tiktokinfo" || cmd === "ttinfo") {
      if (!text) return reply("⚠️ Contoh: `!tiktokinfo https://tiktok.com/@user/video/xxx`");
      return reply(
        `🎵 *TikTok Downloader*\n\n` +
        `Untuk download video TikTok tanpa watermark, gunakan:\n` +
        `• https://snaptik.app\n` +
        `• https://musicaldown.com\n` +
        `• https://tikmate.online\n\n` +
        `_Paste link TikTok kamu di salah satu website di atas_`
      );
    }

    // ── D3. INSTAGRAM INFO ────────────────────────────────────
    if (cmd === "iginfo" || cmd === "instagraminfo") {
      if (!text) return reply("⚠️ Contoh: `!iginfo https://instagram.com/p/xxx`");
      return reply(
        `📸 *Instagram Downloader*\n\n` +
        `Untuk download foto/video Instagram, gunakan:\n` +
        `• https://snapinsta.app\n` +
        `• https://igdownloader.app\n` +
        `• https://instafinsta.com\n\n` +
        `_Paste link Instagram kamu di salah satu website di atas_`
      );
    }

    // ── D4. SPOTIFY INFO ──────────────────────────────────────
    if (cmd === "spotifyinfo" || cmd === "spinfo") {
      if (!text) return reply("⚠️ Contoh: `!spotifyinfo nama lagu`");
      try {
        const data = await fetchJSON(`https://api.deezer.com/search?q=${encodeURIComponent(text)}&limit=5`);
        if (!data.data?.length) return reply("❌ Lagu tidak ditemukan.");
        let out = `🎵 *Hasil Pencarian: "${text}"*\n\n`;
        data.data.slice(0, 5).forEach((track, i) => {
          out += `${i+1}. *${track.title}*\n   👤 ${track.artist.name}\n   💿 ${track.album.title}\n   ⏱️ ${Math.floor(track.duration/60)}:${String(track.duration%60).padStart(2,"0")}\n\n`;
        });
        return reply(out);
      } catch {
        return reply("❌ Gagal mencari lagu.");
      }
    }

    // ── D5. CARI FILM ─────────────────────────────────────────
    if (cmd === "film" || cmd === "movie") {
      if (!text) return reply("⚠️ Contoh: `!film Avengers`");
      try {
        const data = await fetchJSON(`https://www.omdbapi.com/?s=${encodeURIComponent(text)}&apikey=trilogy`);
        if (data.Response === "False") return reply(`❌ Film "${text}" tidak ditemukan.`);
        const film = data.Search?.[0];
        if (!film) return reply("❌ Tidak ada hasil.");
        const detail = await fetchJSON(`https://www.omdbapi.com/?i=${film.imdbID}&apikey=trilogy`);
        return reply(
          `🎬 *${detail.Title} (${detail.Year})*\n\n` +
          `⭐ Rating  : ${detail.imdbRating}/10\n` +
          `🎭 Genre   : ${detail.Genre}\n` +
          `⏱️ Durasi  : ${detail.Runtime}\n` +
          `🌍 Bahasa  : ${detail.Language}\n` +
          `🎬 Sutradara: ${detail.Director}\n` +
          `📝 Sinopsis: ${detail.Plot?.slice(0, 200)}...`
        );
      } catch {
        return reply("❌ Gagal mencari film.");
      }
    }

    // ============================================================
    // 40 FITUR BARU TAMBAHAN
    // ============================================================

    // ── N1. KALKULATOR SCIENTIFIC ─────────────────────────────
    if (cmd === "math") {
      if (!text) return reply("⚠️ Contoh: `!math sqrt(144)` atau `!math 2^10`");
      try {
        const expr = text.replace(/\^/g, "**").replace(/sqrt/g, "Math.sqrt").replace(/sin/g, "Math.sin").replace(/cos/g, "Math.cos").replace(/tan/g, "Math.tan").replace(/log/g, "Math.log10").replace(/pi/gi, "Math.PI").replace(/e/g, "Math.E");
        const result = eval(expr);
        return reply(`🧮 *Kalkulator*\n\n${text} = *${result}*`);
      } catch {
        return reply("❌ Ekspresi tidak valid.");
      }
    }

    // ── N2. KONVERSI WAKTU ────────────────────────────────────
    if (cmd === "timezone" || cmd === "wib") {
      const zones = [
        { nama: "🇮🇩 WIB (Jakarta)", tz: "Asia/Jakarta" },
        { nama: "🇮🇩 WITA (Makassar)", tz: "Asia/Makassar" },
        { nama: "🇮🇩 WIT (Jayapura)", tz: "Asia/Jayapura" },
        { nama: "🇸🇬 Singapura", tz: "Asia/Singapore" },
        { nama: "🇯🇵 Jepang", tz: "Asia/Tokyo" },
        { nama: "🇺🇸 New York", tz: "America/New_York" },
        { nama: "🇬🇧 London", tz: "Europe/London" },
      ];
      let out = `🕐 *Waktu Dunia Sekarang*\n\n`;
      zones.forEach(z => {
        out += `${z.nama}: ${new Date().toLocaleTimeString("id-ID", { timeZone: z.tz, hour: "2-digit", minute: "2-digit" })}\n`;
      });
      return reply(out);
    }

    // ── N3. KONVERSI MATA UANG ────────────────────────────────
    if (cmd === "convert" || cmd === "konversi") {
      const amount = parseFloat(args[1]);
      const from2 = (args[2] || "").toUpperCase();
      const to2 = (args[3] || "").toUpperCase();
      if (isNaN(amount) || !from2 || !to2) return reply("⚠️ Contoh: `!convert 100 USD IDR`");
      try {
        const data = await fetchJSON(`https://api.exchangerate-api.com/v4/latest/${from2}`);
        if (!data.rates[to2]) return reply(`❌ Mata uang ${to2} tidak ditemukan.`);
        const result = (amount * data.rates[to2]).toFixed(2);
        return reply(`💱 *Konversi Mata Uang*\n\n${amount} ${from2} = *${parseFloat(result).toLocaleString("id-ID")} ${to2}*`);
      } catch {
        return reply("❌ Gagal konversi. Cek kode mata uang (contoh: USD, IDR, EUR).");
      }
    }

    // ── N4. CUACA DETAIL ──────────────────────────────────────
    if (cmd === "cuacadetail") {
      if (!text) return reply("⚠️ Contoh: `!cuacadetail Jakarta`");
      try {
        const data = await fetchJSON(`https://wttr.in/${encodeURIComponent(text)}?format=j1`);
        const c = data.current_condition[0];
        const area = data.nearest_area[0];
        return reply(
          `🌤️ *Cuaca Detail: ${area.areaName[0].value}*\n\n` +
          `🌡️ Suhu      : ${c.temp_C}°C (terasa ${c.FeelsLikeC}°C)\n` +
          `💧 Kelembapan: ${c.humidity}%\n` +
          `🌬️ Angin     : ${c.windspeedKmph} km/h\n` +
          `👁️ Jarak pandang: ${c.visibility} km\n` +
          `☁️ Kondisi   : ${c.weatherDesc[0].value}\n` +
          `💨 Tekanan   : ${c.pressure} hPa`
        );
      } catch {
        return reply("❌ Gagal ambil data cuaca.");
      }
    }

    // ── N5. KAMUS INGGRIS-INDONESIA ───────────────────────────
    if (cmd === "kamus" || cmd === "dict") {
      if (!text) return reply("⚠️ Contoh: `!kamus hello`");
      try {
        const data = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
        const entry = data[0];
        const def = entry.meanings[0]?.definitions[0];
        return reply(
          `📖 *Kamus: ${entry.word}*\n\n` +
          `🔊 Pengucapan: ${entry.phonetic || "-"}\n` +
          `📝 Jenis kata : ${entry.meanings[0]?.partOfSpeech || "-"}\n` +
          `📌 Definisi  : ${def?.definition || "-"}\n` +
          `💡 Contoh    : ${def?.example || "-"}`
        );
      } catch {
        return reply("❌ Kata tidak ditemukan.");
      }
    }

    // ── N6. SINONIM KATA ──────────────────────────────────────
    if (cmd === "sinonim" || cmd === "synonym") {
      if (!text) return reply("⚠️ Contoh: `!sinonim happy`");
      try {
        const data = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
        const synonyms = data[0]?.meanings?.flatMap(m => m.synonyms || []).slice(0, 10);
        if (!synonyms?.length) return reply(`❌ Tidak ada sinonim untuk "${text}".`);
        return reply(`🔤 *Sinonim: ${text}*\n\n${synonyms.join(", ")}`);
      } catch {
        return reply("❌ Kata tidak ditemukan.");
      }
    }

    // ── N7. ZODIAK HARI INI ───────────────────────────────────
    if (cmd === "cekzodiak") {
      if (!text) return reply("⚠️ Contoh: `!cekzodiak 15/08` (tanggal lahir dd/mm)");
      const parts = text.split("/");
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      if (isNaN(day) || isNaN(month)) return reply("⚠️ Format: dd/mm. Contoh: `!cekzodiak 15/08`");
      const zodEmoji = {Aries:"♈",Taurus:"♉",Gemini:"♊",Cancer:"♋",Leo:"♌",Virgo:"♍",Libra:"♎",Scorpio:"♏",Sagittarius:"♐",Capricorn:"♑",Aquarius:"♒",Pisces:"♓"};
      let zodiak = "Capricorn";
      if ((month===12&&day>=22)||(month===1&&day<=19)) zodiak="Capricorn";
      else if ((month===1&&day>=20)||(month===2&&day<=18)) zodiak="Aquarius";
      else if ((month===2&&day>=19)||(month===3&&day<=20)) zodiak="Pisces";
      else if ((month===3&&day>=21)||(month===4&&day<=19)) zodiak="Aries";
      else if ((month===4&&day>=20)||(month===5&&day<=20)) zodiak="Taurus";
      else if ((month===5&&day>=21)||(month===6&&day<=20)) zodiak="Gemini";
      else if ((month===6&&day>=21)||(month===7&&day<=22)) zodiak="Cancer";
      else if ((month===7&&day>=23)||(month===8&&day<=22)) zodiak="Leo";
      else if ((month===8&&day>=23)||(month===9&&day<=22)) zodiak="Virgo";
      else if ((month===9&&day>=23)||(month===10&&day<=22)) zodiak="Libra";
      else if ((month===10&&day>=23)||(month===11&&day<=21)) zodiak="Scorpio";
      else zodiak="Sagittarius";
      return reply(`${zodEmoji[zodiak]} *Zodiak kamu: ${zodiak}*\n\nLahir: ${day}/${month}`);
    }

    // ── N8. HITUNG UMUR ───────────────────────────────────────
    if (cmd === "umur" || cmd === "age") {
      if (!text) return reply("⚠️ Contoh: `!umur 15/08/2000`");
      const parts = text.split("/");
      if (parts.length !== 3) return reply("⚠️ Format: dd/mm/yyyy");
      const lahir = new Date(`${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`);
      if (isNaN(lahir)) return reply("❌ Tanggal tidak valid.");
      const now = new Date();
      let years = now.getFullYear() - lahir.getFullYear();
      let months = now.getMonth() - lahir.getMonth();
      let days = now.getDate() - lahir.getDate();
      if (days < 0) { months--; days += 30; }
      if (months < 0) { years--; months += 12; }
      const totalDays = Math.floor((now - lahir) / 86400000);
      return reply(`🎂 *Kalkulator Umur*\n\nTanggal lahir : ${text}\nUmur saat ini : *${years} tahun ${months} bulan ${days} hari*\nTotal hari    : ${totalDays.toLocaleString("id-ID")} hari`);
    }

    // ── N9. CEK HARI ──────────────────────────────────────────
    if (cmd === "cekhari") {
      if (!text) return reply("⚠️ Contoh: `!cekhari 17/08/1945`");
      const parts = text.split("/");
      if (parts.length !== 3) return reply("⚠️ Format: dd/mm/yyyy");
      const tgl = new Date(`${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`);
      if (isNaN(tgl)) return reply("❌ Tanggal tidak valid.");
      const haris = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const bulans = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      return reply(`📅 *Cek Hari*\n\n${tgl.getDate()} ${bulans[tgl.getMonth()]} ${tgl.getFullYear()} adalah hari *${haris[tgl.getDay()]}*`);
    }

    // ── N10. WAKTUSHOLAT ──────────────────────────────────────
    if (cmd === "sholat" || cmd === "jadwalsholat") {
      const kota = text || "Jakarta";
      try {
        const today = new Date();
        const data = await fetchJSON(`https://api.aladhan.com/v1/timingsByCity/${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}?city=${encodeURIComponent(kota)}&country=Indonesia&method=11`);
        const t = data.data.timings;
        return reply(
          `🕌 *Jadwal Sholat ${kota}*\n📅 ${getDateTime()}\n\n` +
          `🌅 Subuh   : ${t.Fajr}\n` +
          `☀️ Dzuhur  : ${t.Dhuhr}\n` +
          `🌤️ Ashar   : ${t.Asr}\n` +
          `🌇 Maghrib : ${t.Maghrib}\n` +
          `🌙 Isya    : ${t.Isha}`
        );
      } catch {
        return reply("❌ Gagal ambil jadwal sholat.");
      }
    }

    // ── N11. RESEP MASAKAN ────────────────────────────────────
    if (cmd === "resep") {
      if (!text) return reply("⚠️ Contoh: `!resep pasta`");
      try {
        const data = await fetchJSON(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(text)}`);
        if (!data.meals) return reply(`❌ Resep "${text}" tidak ditemukan.`);
        const meal = data.meals[0];
        const instruksi = meal.strInstructions?.slice(0, 400) || "-";
        return reply(
          `🍳 *Resep: ${meal.strMeal}*\n\n` +
          `🌍 Asal   : ${meal.strArea}\n` +
          `🏷️ Kategori: ${meal.strCategory}\n\n` +
          `📝 *Cara memasak:*\n${instruksi}...`
        );
      } catch {
        return reply("❌ Gagal ambil resep.");
      }
    }

    // ── N12. CEK NOMOR WA ─────────────────────────────────────
    if (cmd === "cekwa" || cmd === "cekwа") {
      const nomor = (args[1] || "").replace(/[^0-9]/g, "");
      if (!nomor) return reply("⚠️ Contoh: `!cekwa 6281234567890`");
      try {
        const [result] = await sock.onWhatsApp(nomor + "@s.whatsapp.net");
        if (result?.exists) {
          return reply(`✅ Nomor *+${nomor}* terdaftar di WhatsApp!`);
        } else {
          return reply(`❌ Nomor *+${nomor}* tidak terdaftar di WhatsApp.`);
        }
      } catch {
        return reply("❌ Gagal cek nomor.");
      }
    }

    // ── N13. STICKER TEXT ─────────────────────────────────────
    if (cmd === "stickertext" || cmd === "stxt") {
      if (!text) return reply("⚠️ Contoh: `!stickertext Halo Dunia`");
      return reply(`🎨 *Sticker Text*\n\n_Fitur ini membutuhkan library tambahan (canvas/sharp). Untuk sekarang, gunakan website:_\n• https://stickermaker.app\n• https://photosticker.io\n\nTeks kamu: *${text}*`);
    }

    // ── N14. INFO NEGARA ──────────────────────────────────────
    if (cmd === "negara" || cmd === "country") {
      if (!text) return reply("⚠️ Contoh: `!negara Indonesia`");
      try {
        const data = await fetchJSON(`https://restcountries.com/v3.1/name/${encodeURIComponent(text)}`);
        const n = data[0];
        const currency = Object.values(n.currencies || {})[0];
        const lang = Object.values(n.languages || {}).join(", ");
        return reply(
          `🌍 *Info Negara: ${n.name.common}*\n\n` +
          `🏳️ Nama resmi : ${n.name.official}\n` +
          `🏙️ Ibukota    : ${n.capital?.[0] || "-"}\n` +
          `🌎 Benua      : ${n.continents?.[0] || "-"}\n` +
          `👥 Penduduk   : ${n.population?.toLocaleString("id-ID")}\n` +
          `💰 Mata uang  : ${currency?.name || "-"} (${currency?.symbol || "-"})\n` +
          `🗣️ Bahasa     : ${lang}\n` +
          `📞 Kode telp  : +${n.idd?.root?.replace("+","")}${n.idd?.suffixes?.[0] || ""}`
        );
      } catch {
        return reply("❌ Negara tidak ditemukan.");
      }
    }

    // ── N15. GEMPA TERKINI ────────────────────────────────────
    if (cmd === "gempa") {
      try {
        const data = await fetchJSON("https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json");
        const g = data.Infogempa.gempa;
        return reply(
          `🌋 *Gempa Terkini (BMKG)*\n\n` +
          `📅 Waktu     : ${g.Tanggal} ${g.Jam}\n` +
          `💥 Magnitudo : ${g.Magnitude} SR\n` +
          `📍 Lokasi    : ${g.Wilayah}\n` +
          `🌊 Kedalaman : ${g.Kedalaman}\n` +
          `⚠️ Potensi   : ${g.Potensi}`
        );
      } catch {
        return reply("❌ Gagal ambil data gempa.");
      }
    }

    // ── N16. RAMALAN CUACA BMKG ───────────────────────────────
    if (cmd === "bmkg") {
      try {
        const data = await fetchJSON("https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json");
        const g = data.Infogempa.gempa;
        return reply(`🌋 *Info Gempa Terakhir BMKG*\n\n📍 ${g.Wilayah}\n💥 M${g.Magnitude} - ${g.Kedalaman}\n📅 ${g.Tanggal} ${g.Jam}\n⚠️ ${g.Potensi}`);
      } catch {
        return reply("❌ Gagal ambil data BMKG.");
      }
    }

    // ── N17. GENERATOR PUISI ──────────────────────────────────
    if (cmd === "puisi") {
      const tema = text || "cinta";
      const puisi = [
        `Di balik ${tema} yang mendalam\nAku temukan makna sejati\nSeperti bintang di langit malam\nBersinar abadi tak terganti`,
        `${tema.charAt(0).toUpperCase()+tema.slice(1)} adalah cahaya hatiku\nMenerangi jalan yang gelap\nBersama kita melangkah maju\nTiada halang tiada harap`,
        `Dalam ${tema} kutemukan diri\nYang selama ini kucari\nBagaikan embun di pagi hari\nMenyejukkan jiwa dan hati`
      ];
      return reply(`📜 *Puisi: ${tema}*\n\n${puisi[Math.floor(Math.random() * puisi.length)]}`);
    }

    // ── N18. PANTUN ───────────────────────────────────────────
    if (cmd === "pantun") {
      const pantuns = [
        "Buah pepaya buah mangga\nDimakan sambil bersantai\nKalau kamu ingin bahagia\nJangan lupa tersenyum cerai",
        "Pergi ke pasar beli ikan\nIkan segar harga murah\nIlmu bukan untuk disombongkan\nTapi untuk diamalkan sudah",
        "Pohon kelapa di tepi pantai\nAnginnya sepoi-sepoi basah\nKalau belajar dengan sungguh\nPasti sukses tiada salah",
        "Bunga melati harum wangi\nDitanam di depan rumah\nJaga hati jaga diri\nHidup ini penuh amanah"
      ];
      return reply(`🎭 *Pantun*\n\n${pantuns[Math.floor(Math.random() * pantuns.length)]}`);
    }

    // ── N19. TEKA-TEKI ────────────────────────────────────────
    if (cmd === "tts" || cmd === "tekateki") {
      const tekateki = [
        { soal: "Semakin diisi semakin ringan, apa itu?", jawab: "Balon" },
        { soal: "Punya tangan tapi tidak bisa memegang, apa itu?", jawab: "Jam dinding" },
        { soal: "Semakin tua semakin muda, apa itu?", jawab: "Lilin" },
        { soal: "Berjalan tanpa kaki, berlari tanpa nafas, apa itu?", jawab: "Waktu" },
        { soal: "Ada kepala tapi tidak ada leher, apa itu?", jawab: "Paku" },
        { soal: "Makin banyak diambil makin besar, apa itu?", jawab: "Lubang" },
      ];
      const pilihan = tekateki[Math.floor(Math.random() * tekateki.length)];
      return reply(`🤔 *Teka-Teki*\n\n❓ ${pilihan.soal}\n\n_Jawaban: ||${pilihan.jawab}||_`);
    }

    // ── N20. KATA MUTIARA ─────────────────────────────────────
    if (cmd === "mutiara" || cmd === "wisdom") {
      const mutiara = [
        "Jangan takut gagal, takutlah tidak pernah mencoba.",
        "Kesuksesan adalah hasil dari persiapan, kerja keras, dan belajar dari kegagalan.",
        "Orang yang tidak pernah membuat kesalahan adalah orang yang tidak pernah mencoba hal baru.",
        "Hidup bukan tentang menunggu badai berlalu, tapi tentang belajar menari di tengah hujan.",
        "Jangan bandingkan perjalananmu dengan orang lain, setiap orang punya waktunya masing-masing.",
        "Mimpi tidak akan berhasil jika kamu hanya bermimpi.",
        "Hari ini sulit, hari esok lebih sulit, tapi lusa akan sangat indah.",
      ];
      return reply(`💎 *Kata Mutiara*\n\n_"${mutiara[Math.floor(Math.random() * mutiara.length)]}"_`);
    }

    // ── N21. KUIS MATEMATIKA ──────────────────────────────────
    if (cmd === "kuis") {
      const a = Math.floor(Math.random() * 50) + 1;
      const b = Math.floor(Math.random() * 50) + 1;
      const ops = ["+", "-", "*"];
      const op = ops[Math.floor(Math.random() * ops.length)];
      let jawab;
      if (op === "+") jawab = a + b;
      else if (op === "-") jawab = a - b;
      else jawab = a * b;
      const db = loadDB();
      if (!db._kuis) db._kuis = {};
      db._kuis[from] = { jawab, time: Date.now() };
      saveDB(db);
      return reply(`🧠 *Kuis Matematika*\n\nBerapa hasil dari:\n*${a} ${op} ${b} = ?*\n\nBalas dengan \`!jawab [angka]\``);
    }

    // ── N22. JAWAB KUIS ───────────────────────────────────────
    if (cmd === "jawab") {
      const db = loadDB();
      const kuis = db._kuis?.[from];
      if (!kuis) return reply("⚠️ Belum ada kuis aktif. Ketik `!kuis` untuk mulai.");
      if (Date.now() - kuis.time > 60000) {
        delete db._kuis[from];
        saveDB(db);
        return reply(`⏰ Waktu habis! Jawabannya adalah *${kuis.jawab}*`);
      }
      const tebakan = parseInt(text);
      if (isNaN(tebakan)) return reply("⚠️ Masukkan angka.");
      delete db._kuis[from];
      saveDB(db);
      if (tebakan === kuis.jawab) return reply("🎉 *BENAR!* Kamu hebat! 🏆");
      return reply(`❌ Salah! Jawabannya adalah *${kuis.jawab}*`);
    }

    // ── N23. CERITA RANDOM ────────────────────────────────────
    if (cmd === "cerita") {
      const cerita = [
        "Suatu hari ada seekor semut yang ingin memindahkan gunung. Semua hewan menertawakannya. Tapi setiap hari, sedikit demi sedikit, ia terus bekerja. Bertahun-tahun kemudian, gunung itu pun berpindah. Moral: Ketekunan mengalahkan segalanya.",
        "Seorang anak bertanya pada ayahnya, 'Ayah, apa rahasia kesuksesan?' Sang ayah menjawab, 'Bangun lebih awal dari masalahmu.' Anak itu bingung. Bertahun-tahun kemudian ia paham: bersiap sebelum masalah datang adalah kunci.",
        "Ada dua biji benih ditanam berdampingan. Yang pertama berkata, 'Aku takut akarku tidak kuat.' Yang kedua berkata, 'Aku akan tumbuh dan melihat matahari.' Yang kedua menjadi pohon besar. Moral: Keberanian dimulai dari dalam.",
      ];
      return reply(`📚 *Cerita Pendek*\n\n${cerita[Math.floor(Math.random() * cerita.length)]}`);
    }

    // ── N24. RAMALAN KARIR ────────────────────────────────────
    if (cmd === "karir") {
      const ramalan = [
        "💼 Hari ini cocok untuk negosiasi dan presentasi. Kepercayaan dirimu tinggi!",
        "📈 Peluang baru akan datang minggu ini. Jangan lewatkan kesempatan!",
        "🤝 Kerja sama tim akan membawa hasil yang luar biasa hari ini.",
        "💡 Ide kreatifmu akan diapresiasi. Jangan ragu untuk berbicara!",
        "⚠️ Hati-hati dalam mengambil keputusan besar hari ini. Pertimbangkan baik-baik.",
      ];
      return reply(`💼 *Ramalan Karir Hari Ini*\n\n${ramalan[Math.floor(Math.random() * ramalan.length)]}`);
    }

    // ── N25. RAMALAN CINTA ────────────────────────────────────
    if (cmd === "cinta" || cmd === "love") {
      const ramalan = [
        "❤️ Seseorang spesial sedang memikirkanmu saat ini.",
        "💕 Hari ini adalah waktu yang tepat untuk mengungkapkan perasaan.",
        "💔 Sabar, jodoh terbaik sedang dalam perjalanan menuju kamu.",
        "🌹 Hubunganmu akan semakin kuat jika kamu lebih terbuka.",
        "✨ Pertemuan tak terduga hari ini bisa mengubah hidupmu.",
      ];
      return reply(`❤️ *Ramalan Cinta Hari Ini*\n\n${ramalan[Math.floor(Math.random() * ramalan.length)]}`);
    }

    // ── N26. GENERATE BIODATA ─────────────────────────────────
    if (cmd === "biodata") {
      const db = loadDB();
      const user = getNum(sender);
      if (text) {
        // Simpan biodata
        const parts = text.split("|").map(s => s.trim());
        if (!db[user]) db[user] = {};
        db[user]._bio = { nama: parts[0], usia: parts[1], hobi: parts[2], asal: parts[3] };
        saveDB(db);
        return reply("✅ Biodata disimpan!");
      }
      const bio = db[user]?._bio;
      if (!bio) return reply("⚠️ Belum ada biodata.\nIsi dengan: `!biodata Nama|Usia|Hobi|Asal`");
      return reply(`📋 *Biodataku*\n\n👤 Nama  : ${bio.nama || "-"}\n🎂 Usia  : ${bio.usia || "-"}\n🎯 Hobi  : ${bio.hobi || "-"}\n📍 Asal  : ${bio.asal || "-"}`);
    }

    // ── N27. TEBAK KATA ───────────────────────────────────────
    if (cmd === "tebakkata") {
      const kata = ["APEL","MOBIL","RUMAH","BUKU","LANGIT","BUNGA","MEJA","KURSI","PINTU","POHON"];
      const pilihan = kata[Math.floor(Math.random() * kata.length)];
      const acak = pilihan.split("").sort(() => Math.random() - 0.5).join("");
      const db = loadDB();
      if (!db._tebakkata) db._tebakkata = {};
      db._tebakkata[from] = pilihan;
      saveDB(db);
      return reply(`🔤 *Tebak Kata*\n\nSusun huruf ini menjadi kata yang benar:\n*${acak}*\n\nBalas dengan \`!jawabkata [jawaban]\``);
    }

    // ── N28. JAWAB TEBAK KATA ─────────────────────────────────
    if (cmd === "jawabkata") {
      const db = loadDB();
      const kata = db._tebakkata?.[from];
      if (!kata) return reply("⚠️ Belum ada game aktif. Ketik `!tebakkata` untuk mulai.");
      delete db._tebakkata[from];
      saveDB(db);
      if (text.toUpperCase() === kata) return reply(`🎉 *BENAR!* Kata yang tepat adalah *${kata}*! 🏆`);
      return reply(`❌ Salah! Kata yang benar adalah *${kata}*`);
    }

    // ── N29. HITUNG KALORI ────────────────────────────────────
    if (cmd === "kalori") {
      const makanan = {
        "nasi": 175, "ayam": 215, "telur": 77, "roti": 79, "mie": 220,
        "pizza": 266, "burger": 295, "kentang": 77, "ikan": 136, "tempe": 193,
        "tahu": 76, "sayur": 25, "buah": 60, "susu": 61, "kopi": 5
      };
      if (!text) {
        return reply(`🍽️ *Kalkulator Kalori*\n\nContoh: \`!kalori nasi\`\n\nMakanan tersedia:\n${Object.keys(makanan).join(", ")}`);
      }
      const kal = makanan[text.toLowerCase()];
      if (!kal) return reply(`❌ "${text}" tidak ada di database.\n\nMakanan tersedia: ${Object.keys(makanan).join(", ")}`);
      return reply(`🍽️ *Info Kalori*\n\n${text.charAt(0).toUpperCase()+text.slice(1)}: *${kal} kkal* per 100g`);
    }

    // ── N30. KONVERSI ANGKA ───────────────────────────────────
    if (cmd === "terbilang") {
      const angka = parseInt(args[1]);
      if (isNaN(angka) || angka < 0 || angka > 999999999) return reply("⚠️ Contoh: `!terbilang 1500` (0 - 999.999.999)");
      const satuan = ["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];
      function terbilang(n) {
        if (n < 12) return satuan[n];
        if (n < 20) return satuan[n-10] + " belas";
        if (n < 100) return satuan[Math.floor(n/10)] + " puluh" + (n%10 ? " " + satuan[n%10] : "");
        if (n < 200) return "seratus" + (n%100 ? " " + terbilang(n%100) : "");
        if (n < 1000) return satuan[Math.floor(n/100)] + " ratus" + (n%100 ? " " + terbilang(n%100) : "");
        if (n < 2000) return "seribu" + (n%1000 ? " " + terbilang(n%1000) : "");
        if (n < 1000000) return terbilang(Math.floor(n/1000)) + " ribu" + (n%1000 ? " " + terbilang(n%1000) : "");
        if (n < 1000000000) return terbilang(Math.floor(n/1000000)) + " juta" + (n%1000000 ? " " + terbilang(n%1000000) : "");
        return String(n);
      }
      return reply(`🔢 *Terbilang*\n\n${angka.toLocaleString("id-ID")} = *${terbilang(angka)}*`);
    }

    // ── N31. CEK PALINDROM ────────────────────────────────────
    if (cmd === "palindrom") {
      if (!text) return reply("⚠️ Contoh: `!palindrom kasur rusak`");
      const clean = text.toLowerCase().replace(/\s/g, "");
      const isPalin = clean === clean.split("").reverse().join("");
      return reply(`🔄 *Cek Palindrom*\n\n"${text}"\n\n${isPalin ? "✅ Ya, ini adalah palindrom!" : "❌ Bukan palindrom."}`);
    }

    // ── N32. HITUNG KATA ──────────────────────────────────────
    if (cmd === "hitungkata" || cmd === "wordcount") {
      if (!text) return reply("⚠️ Contoh: `!hitungkata Halo dunia ini adalah contoh`");
      const words = text.trim().split(/\s+/).length;
      const chars = text.length;
      const charsNoSpace = text.replace(/\s/g, "").length;
      return reply(`📊 *Hitung Kata*\n\n📝 Kata       : ${words}\n🔤 Karakter   : ${chars}\n✂️ Tanpa spasi: ${charsNoSpace}`);
    }

    // ── N33. ACAK PILIHAN ─────────────────────────────────────
    if (cmd === "pilih" || cmd === "choose") {
      if (!text) return reply("⚠️ Contoh: `!pilih nasi|mie|lontong`");
      const opsi = text.split("|").map(s => s.trim()).filter(Boolean);
      if (opsi.length < 2) return reply("⚠️ Minimal 2 pilihan, pisahkan dengan |");
      const pilihan = opsi[Math.floor(Math.random() * opsi.length)];
      return reply(`🎯 *Acak Pilihan*\n\nPilihan: ${opsi.join(" | ")}\n\n🎲 Terpilih: *${pilihan}*`);
    }

    // ── N34. HITUNG LUAS & KELILING ───────────────────────────
    if (cmd === "luas") {
      const bentuk = (args[1] || "").toLowerCase();
      if (!bentuk) return reply("⚠️ Contoh:\n`!luas lingkaran 7`\n`!luas persegi 5`\n`!luas segitiga 6 8`\n`!luas persegipanjang 4 6`");
      if (bentuk === "lingkaran") {
        const r = parseFloat(args[2]);
        if (isNaN(r)) return reply("⚠️ Masukkan jari-jari.");
        return reply(`⭕ *Lingkaran (r=${r})*\n\nLuas     : ${(Math.PI * r * r).toFixed(4)}\nKeliling : ${(2 * Math.PI * r).toFixed(4)}`);
      }
      if (bentuk === "persegi") {
        const s = parseFloat(args[2]);
        if (isNaN(s)) return reply("⚠️ Masukkan sisi.");
        return reply(`⬛ *Persegi (s=${s})*\n\nLuas     : ${s * s}\nKeliling : ${4 * s}`);
      }
      if (bentuk === "segitiga") {
        const a = parseFloat(args[2]), t = parseFloat(args[3]);
        if (isNaN(a) || isNaN(t)) return reply("⚠️ Masukkan alas dan tinggi.");
        return reply(`📐 *Segitiga (a=${a}, t=${t})*\n\nLuas : ${0.5 * a * t}`);
      }
      if (bentuk === "persegipanjang") {
        const p = parseFloat(args[2]), l = parseFloat(args[3]);
        if (isNaN(p) || isNaN(l)) return reply("⚠️ Masukkan panjang dan lebar.");
        return reply(`▬ *Persegi Panjang (p=${p}, l=${l})*\n\nLuas     : ${p * l}\nKeliling : ${2 * (p + l)}`);
      }
      return reply("❌ Bentuk tidak dikenal. Gunakan: lingkaran, persegi, segitiga, persegipanjang");
    }

    // ── N35. KONVERSI SUHU LENGKAP ────────────────────────────
    if (cmd === "suhu") {
      const val = parseFloat(args[1]);
      const dari = (args[2] || "c").toLowerCase();
      if (isNaN(val)) return reply("⚠️ Contoh: `!suhu 100 c` (dari Celsius)\n`!suhu 212 f` (dari Fahrenheit)\n`!suhu 373 k` (dari Kelvin)");
      let c, f, k;
      if (dari === "c") { c = val; f = c * 9/5 + 32; k = c + 273.15; }
      else if (dari === "f") { f = val; c = (f - 32) * 5/9; k = c + 273.15; }
      else if (dari === "k") { k = val; c = k - 273.15; f = c * 9/5 + 32; }
      else return reply("❌ Satuan tidak valid. Gunakan: c, f, atau k");
      return reply(`🌡️ *Konversi Suhu*\n\n°C : ${c.toFixed(2)}\n°F : ${f.toFixed(2)}\nK  : ${k.toFixed(2)}`);
    }

    // ── N36. NOTIFIKASI PENGINGAT ─────────────────────────────
    if (cmd === "remind" || cmd === "ingatkan") {
      const menit = parseInt(args[1]);
      const pesan = args.slice(2).join(" ");
      if (isNaN(menit) || !pesan) return reply("⚠️ Contoh: `!remind 5 Minum obat` (dalam menit)");
      if (menit > 60) return reply("⚠️ Maksimal 60 menit.");
      reply(`⏰ Oke! Saya akan mengingatkanmu tentang:\n*${pesan}*\nDalam ${menit} menit.`);
      setTimeout(async () => {
        try {
          await sock.sendMessage(from, { text: `⏰ *PENGINGAT!*\n\n${pesan}\n\n_dari ${menit} menit yang lalu_` });
        } catch {}
      }, menit * 60 * 1000);
      return;
    }

    // ── N37. GENERATE KALIMAT ─────────────────────────────────
    if (cmd === "kalimat" || cmd === "sentence") {
      const subjek = ["Anak kecil itu","Seorang petani","Kucing hitam itu","Ibu guru","Anak muda itu"];
      const predikat = ["berlari dengan cepat","makan siang bersama","bermain di taman","belajar dengan giat","bernyanyi merdu"];
      const ket = ["di pagi hari","setiap hari Minggu","di bawah pohon rindang","bersama keluarga","dengan penuh semangat"];
      const kalimat = `${subjek[Math.floor(Math.random()*subjek.length)]} ${predikat[Math.floor(Math.random()*predikat.length)]} ${ket[Math.floor(Math.random()*ket.length)]}.`;
      return reply(`✍️ *Kalimat Random*\n\n${kalimat}`);
    }

    // ── N38. LIHAT PROFIL WA ──────────────────────────────────
    if (cmd === "pp" || cmd === "fotoprofil") {
      const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || sender;
      try {
        const ppUrl = await sock.profilePictureUrl(target, "image");
        await replyImage(ppUrl, `📸 Foto profil @${getNum(target)}`);
        return;
      } catch {
        return reply("❌ Foto profil tidak ditemukan atau disembunyikan.");
      }
    }

    // ── N39. KECEPATAN INTERNET ───────────────────────────────
    if (cmd === "speedtest" || cmd === "speed") {
      reply("⏳ Mengukur kecepatan...");
      const start = Date.now();
      try {
        await fetchJSON("https://speed.cloudflare.com/cdn-cgi/trace");
        const latency = Date.now() - start;
        return reply(
          `⚡ *Speedtest Bot*\n\n` +
          `📡 Latency : ${latency}ms\n` +
          `🟢 Status  : ${latency < 200 ? "Sangat Cepat" : latency < 500 ? "Normal" : "Lambat"}\n` +
          `🕐 Waktu   : ${getDateTime()} WIB`
        );
      } catch {
        return reply("❌ Gagal mengukur kecepatan.");
      }
    }

    // ── N40. SISTEM INFO LENGKAP ──────────────────────────────
    if (cmd === "sysinfo" || cmd === "system") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
      const freeMem = (os.freemem() / 1024 / 1024).toFixed(0);
      const usedMem = (os.totalmem() - os.freemem());
      const usedPct = ((usedMem / os.totalmem()) * 100).toFixed(1);
      const uptimeSec = Math.floor(os.uptime());
      const cpus = os.cpus();
      const nodeVer = process.version;
      const pid = process.pid;
      return reply(
        `💻 *System Info*\n\n` +
        `🖥️ Platform  : ${os.platform()} (${os.arch()})\n` +
        `⚙️ CPU       : ${cpus[0]?.model || "Unknown"}\n` +
        `🔢 Core CPU  : ${cpus.length}\n` +
        `💾 RAM Total : ${totalMem} MB\n` +
        `📊 RAM Pakai : ${usedMem > 0 ? (usedMem/1024/1024).toFixed(0) : "?"} MB (${usedPct}%)\n` +
        `✅ RAM Bebas : ${freeMem} MB\n` +
        `⏱️ Uptime OS : ${formatUptime(uptimeSec)}\n` +
        `🟢 Node.js   : ${nodeVer}\n` +
        `🔢 PID Bot   : ${pid}\n` +
        `📁 Path Bot  : ${process.cwd()}`
      );
    }

    // ── OWNER: LISTCHAT ───────────────────────────────────────
    if (cmd === "listchat") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      try {
        const chats = await sock.groupFetchAllParticipating();
        const groups = Object.values(chats);
        if (groups.length === 0) return reply("📭 Bot tidak ada di grup manapun.");
        let out = `📋 *Daftar Grup Bot*\n\n`;
        groups.slice(0, 20).forEach((g, i) => {
          out += `${i+1}. *${g.subject}*\n   👥 ${g.participants.length} anggota\n`;
        });
        if (groups.length > 20) out += `\n_...dan ${groups.length - 20} grup lainnya_`;
        out += `\n\n📊 Total: ${groups.length} grup`;
        return reply(out);
      } catch {
        return reply("❌ Gagal ambil daftar grup.");
      }
    }

    // ── OWNER: SETBOTNAME ─────────────────────────────────────
    if (cmd === "setbotname") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      if (!text) return reply("⚠️ Contoh: `!setbotname NamaBot`");
      config.botName = text;
      return reply(`✅ Nama bot berhasil diubah ke: *${text}*`);
    }

    // ── OWNER: MAINTENANCE ────────────────────────────────────
    if (cmd === "maintenance") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const db = loadDB();
      db._maintenance = !db._maintenance;
      saveDB(db);
      const status = db._maintenance ? "🔴 ON" : "🟢 OFF";
      return reply(`🔧 *Mode Maintenance: ${status}*\n\n${db._maintenance ? "Bot tidak akan merespons perintah dari non-owner." : "Bot kembali normal."}`);
    }

    // ── OWNER: BLOCK USER ─────────────────────────────────────
    if (cmd === "block") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const nomor = (args[1] || "").replace(/[^0-9]/g, "");
      if (!nomor) return reply("⚠️ Contoh: `!block 6281234567890`");
      const db = loadDB();
      if (!db._blocked) db._blocked = [];
      if (db._blocked.includes(nomor)) return reply(`⚠️ Nomor ${nomor} sudah diblokir.`);
      db._blocked.push(nomor);
      saveDB(db);
      return reply(`🚫 Nomor *${nomor}* berhasil diblokir dari menggunakan bot.`);
    }

    // ── OWNER: UNBLOCK USER ───────────────────────────────────
    if (cmd === "unblock") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const nomor = (args[1] || "").replace(/[^0-9]/g, "");
      if (!nomor) return reply("⚠️ Contoh: `!unblock 6281234567890`");
      const db = loadDB();
      if (!db._blocked) db._blocked = [];
      const idx = db._blocked.indexOf(nomor);
      if (idx === -1) return reply(`⚠️ Nomor ${nomor} tidak ada di daftar blokir.`);
      db._blocked.splice(idx, 1);
      saveDB(db);
      return reply(`✅ Nomor *${nomor}* berhasil diunblokir.`);
    }

    // ============================================================
    // FITUR DOWNLOAD & STIKER
    // ============================================================

    // ── TIKTOK DOWNLOAD ───────────────────────────────────────
    if (cmd === "tiktok" || cmd === "tt") {
      if (!text) return reply("⚠️ Contoh: `!tiktok https://vm.tiktok.com/xxx`");
      reply("⏳ Mengunduh video TikTok...");
      try {
        // API TikTok downloader tanpa watermark
        const res = await axios.get(`https://api.tikmate.app/api/lookup?url=${encodeURIComponent(text)}`, {
          timeout: 15000,
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        const data = res.data;
        if (!data || data.code !== "0") throw new Error("Gagal");
        const videoUrl = `https://tikmate.app/download/${data.token}/${data.id}.mp4`;
        await sock.sendMessage(from, {
          video: { url: videoUrl },
          caption: `🎵 *${data.author || "TikTok"}*\n📝 ${(data.text || "").slice(0, 100)}\n\n_Download by ${config.botName}_`
        }, { quoted: msg });
        return;
      } catch {
        // Fallback API kedua
        try {
          const res2 = await axios.post("https://www.tikwm.com/api/", {
            url: text,
            hd: 1
          }, { timeout: 15000 });
          const d = res2.data?.data;
          if (!d || !d.play) throw new Error("Gagal");
          await sock.sendMessage(from, {
            video: { url: d.play },
            caption: `🎵 *${d.author?.nickname || "TikTok"}*\n📝 ${(d.title || "").slice(0, 100)}\n👍 ${d.digg_count || 0} | 💬 ${d.comment_count || 0}\n\n_Download by ${config.botName}_`
          }, { quoted: msg });
          return;
        } catch {
          return reply("❌ Gagal download TikTok. Pastikan link valid.\nContoh: https://vm.tiktok.com/xxx");
        }
      }
    }

    // ── TIKTOK FOTO/SLIDE ─────────────────────────────────────
    if (cmd === "tiktokfoto" || cmd === "ttfoto") {
      if (!text) return reply("⚠️ Contoh: `!tiktokfoto https://vm.tiktok.com/xxx`");
      reply("⏳ Mengunduh foto TikTok...");
      try {
        const res = await axios.post("https://www.tikwm.com/api/", { url: text, hd: 1 }, { timeout: 15000 });
        const d = res.data?.data;
        if (!d) throw new Error("Gagal");
        if (d.images && d.images.length > 0) {
          // Kirim foto satu per satu (max 5)
          const fotos = d.images.slice(0, 5);
          for (let i = 0; i < fotos.length; i++) {
            await sock.sendMessage(from, {
              image: { url: fotos[i] },
              caption: i === 0 ? `📸 *${d.author?.nickname || "TikTok"}* (${i+1}/${fotos.length})\n📝 ${(d.title || "").slice(0, 80)}` : `📸 Foto ${i+1}/${fotos.length}`
            }, { quoted: i === 0 ? msg : undefined });
            await new Promise(r => setTimeout(r, 500));
          }
          return;
        } else if (d.play) {
          return reply("⚠️ Ini bukan postingan foto. Gunakan `!tiktok` untuk download videonya.");
        }
        throw new Error("Tidak ada foto");
      } catch {
        return reply("❌ Gagal download foto TikTok. Pastikan link adalah postingan foto/slide.");
      }
    }

    // ── YOUTUBE DOWNLOAD (INFO + LINK) ────────────────────────
    if (cmd === "yt" || cmd === "ytdl") {
      if (!text) return reply("⚠️ Contoh: `!yt https://youtu.be/xxx`");
      reply("⏳ Mengambil info video YouTube...");
      try {
        const videoId = text.match(/(?:v=|youtu\.be\/|shorts\/)([^&\n?#]+)/)?.[1];
        if (!videoId) return reply("❌ Link YouTube tidak valid.");
        const data = await fetchJSON(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        return reply(
          `🎬 *${data.title}*\n` +
          `👤 ${data.author_name}\n\n` +
          `📥 *Link Download:*\n` +
          `🎬 Video MP4: https://www.y2mate.com/youtube/${videoId}\n` +
          `🎵 Audio MP3: https://mp3download.to/en16/youtube/${videoId}\n` +
          `📱 Mobile: https://ssyoutube.com/watch?v=${videoId}\n\n` +
          `_Buka link di browser untuk download_`
        );
      } catch {
        return reply("❌ Gagal ambil info YouTube. Pastikan link valid.");
      }
    }

    // ── YOUTUBE SHORTS DOWNLOAD ───────────────────────────────
    if (cmd === "ytshorts" || cmd === "shorts") {
      if (!text) return reply("⚠️ Contoh: `!ytshorts https://youtube.com/shorts/xxx`");
      reply("⏳ Memproses YouTube Shorts...");
      try {
        const videoId = text.match(/shorts\/([^?&\n]+)/)?.[1] || text.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        if (!videoId) return reply("❌ Link Shorts tidak valid.");
        const data = await fetchJSON(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        return reply(
          `🩳 *YouTube Shorts*\n\n` +
          `📛 Judul: ${data.title}\n` +
          `👤 Channel: ${data.author_name}\n\n` +
          `📥 *Link Download:*\n` +
          `• https://ssyoutube.com/shorts/${videoId}\n` +
          `• https://www.y2mate.com/youtube/${videoId}\n\n` +
          `_Buka link di browser untuk download_`
        );
      } catch {
        return reply("❌ Gagal memproses Shorts.");
      }
    }

    // ── INSTAGRAM DOWNLOAD ────────────────────────────────────
    if (cmd === "ig" || cmd === "igdl") {
      if (!text) return reply("⚠️ Contoh: `!ig https://instagram.com/p/xxx`");
      reply("⏳ Memproses link Instagram...");
      try {
        const res = await axios.get(`https://api.insta-downloader.app/v2/?url=${encodeURIComponent(text)}`, {
          timeout: 15000,
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        const d = res.data;
        if (d && d.url) {
          const isVideo = d.type === "video" || d.url.includes(".mp4");
          if (isVideo) {
            await sock.sendMessage(from, {
              video: { url: d.url },
              caption: `📸 *Instagram*\n_Download by ${config.botName}_`
            }, { quoted: msg });
          } else {
            await sock.sendMessage(from, {
              image: { url: d.url },
              caption: `📸 *Instagram*\n_Download by ${config.botName}_`
            }, { quoted: msg });
          }
          return;
        }
        throw new Error("Gagal");
      } catch {
        return reply(
          `📸 *Instagram Downloader*\n\n` +
          `Gagal download otomatis. Gunakan website:\n` +
          `• https://snapinsta.app\n` +
          `• https://igdownloader.app\n\n` +
          `_Paste link Instagram kamu di salah satu website di atas_`
        );
      }
    }

    // ── BUAT STIKER DARI FOTO ─────────────────────────────────
    if (cmd === "sticker" || cmd === "stiker" || cmd === "s") {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const imgMsg = msg.message?.imageMessage || quoted?.imageMessage;
      if (!imgMsg) return reply("⚠️ Reply foto dengan `!stiker` untuk membuat stiker.");
      reply("⏳ Membuat stiker...");
      try {
        const sharp = require("sharp");
        // Download gambar
        const stream = await sock.downloadMediaMessage(
          imgMsg === msg.message?.imageMessage ? msg : { message: quoted },
          "buffer"
        );
        // Convert ke WebP
        const webpBuf = await sharp(stream)
          .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer();
        // Kirim sebagai stiker
        await sock.sendMessage(from, {
          sticker: webpBuf,
          mimetype: "image/webp",
          isAnimated: false
        }, { quoted: msg });
        return;
      } catch (e) {
        return reply(`❌ Gagal buat stiker: ${e.message}`);
      }
    }

    // ── BUAT STIKER TEKS ──────────────────────────────────────
    if (cmd === "stikerteks" || cmd === "stxt") {
      if (!text) return reply("⚠️ Contoh: `!stikerteks Halo Dunia`");
      reply("⏳ Membuat stiker teks...");
      try {
        const sharp = require("sharp");
        const lines = text.slice(0, 80).match(/.{1,15}/g) || [text];
        const fontSize = lines.length > 3 ? 48 : 60;
        const lineH = fontSize + 16;
        const svgHeight = Math.max(200, lines.length * lineH + 80);
        const svgLines = lines.map((l, i) =>
          `<text x="256" y="${80 + i * lineH}" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" stroke="black" stroke-width="4">${l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</text>`
        ).join("\n");
        const svg = `<svg width="512" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="512" height="${svgHeight}" fill="transparent"/>
          ${svgLines}
        </svg>`;
        const webpBuf = await sharp(Buffer.from(svg))
          .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer();
        await sock.sendMessage(from, {
          sticker: webpBuf,
          mimetype: "image/webp",
          isAnimated: false
        }, { quoted: msg });
        return;
      } catch (e) {
        return reply(`❌ Gagal buat stiker teks: ${e.message}`);
      }
    }

    // ── PERINTAH TIDAK DIKENAL ────────────────────────────────
    return reply(`❓ Perintah \`${config.prefix}${cmd}\` tidak dikenal.\nKetik \`${config.prefix}menu\` untuk melihat daftar perintah.`);

  } catch (err) {
    log(`[ERROR] ${err.message}`);
    console.error(err);
  }
}

// ============================================================
// KONEKSI UTAMA
// ============================================================
let retryCount = 0;

async function connectBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

  log(`[BOT] Versi Baileys: ${version.join(".")}`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["TermuxBot", "Chrome", "20.0"],
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    defaultQueryTimeoutMs: 30000,
    printQRInTerminal: false,
  });

  // ── PAIRING CODE LOGIN ─────────────────────────────────────
  if (!sock.authState.creds.registered) {
    const nomor = config.ownerNumber.replace(/[^0-9]/g, "");
    log(`[PAIRING] Meminta pairing code untuk nomor: ${nomor}`);
    await new Promise(r => setTimeout(r, 3000));
    try {
      const code = await sock.requestPairingCode(nomor);
      log(`[PAIRING CODE] ===========================`);
      log(`[PAIRING CODE] Kode kamu: ${code}`);
      log(`[PAIRING CODE] ===========================`);
      log(`[PAIRING CODE] Buka WhatsApp → Perangkat Tertaut → Tautkan dengan nomor telepon → Masukkan kode di atas`);
    } catch (e) {
      log(`[PAIRING ERROR] ${e.message}`);
    }
  }

  // ── KONEKSI UPDATE ─────────────────────────────────────────
  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      log(`[DISCONNECT] Kode: ${code} | Reconnect: ${shouldReconnect}`);
      if (shouldReconnect && retryCount < config.maxRetry) {
        retryCount++;
        log(`[RETRY] Mencoba reconnect ke-${retryCount}...`);
        setTimeout(connectBot, 5000);
      } else if (code === DisconnectReason.loggedOut) {
        log("[LOGOUT] Sesi dihapus. Hapus folder auth_info dan jalankan ulang.");
        process.exit(1);
      } else {
        log("[STOP] Batas retry tercapai. Bot berhenti.");
        process.exit(1);
      }
    }

    if (connection === "open") {
      retryCount = 0;
      log(`[CONNECTED] ✅ Bot berhasil terhubung!`);
      const ownerJid = config.ownerNumber + "@s.whatsapp.net";
      try {
        await sock.sendMessage(ownerJid, {
          text: `✅ *${config.botName} Online!*\n\n🕐 ${getDateTime()} WIB\n⚡ Ketik \`${config.prefix}menu\` untuk melihat fitur.`,
        });
      } catch (_) {}
    }
  });

  // ── SAVE CREDENTIALS ──────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ── HANDLE MESSAGES ───────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message) continue;
      botStats.totalCmd++;
      await handleMessage(sock, msg);
    }
  });

  // ── WELCOME ANGGOTA BARU ───────────────────────────────────
  sock.ev.on("group-participants.update", async ({ id, participants, action }) => {
    if (action !== "add") return;
    const welcomeTpl = welcomeMessages[id];
    if (!welcomeTpl) return;
    try {
      const groupMeta = await sock.groupMetadata(id);
      for (const jid of participants) {
        const jidStr = typeof jid === "string" ? jid : (jid.id || jid.jid || String(jid));
        const nama = jidStr.split("@")[0];
        const pesan = welcomeTpl
          .replace(/@name/gi, `@${nama}`)
          .replace(/@group/gi, groupMeta.subject);
        await sock.sendMessage(id, { text: pesan, mentions: [jidStr] });
      }
    } catch (e) {
      log(`[WELCOME ERROR] ${e.message}`);
    }
  });

  return sock;
}

// ============================================================
// JALANKAN BOT
// ============================================================
log(`[START] Memulai ${config.botName}...`);
connectBot().catch((err) => {
  log(`[FATAL] ${err.message}`);
  process.exit(1);
});
