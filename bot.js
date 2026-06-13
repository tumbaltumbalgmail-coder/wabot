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
  ownerNumber: "6283890631974",  // Ganti dengan nomor owner (format: 628xxx)
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
📊 Ketik \`${config.prefix}menu [kategori]\` untuk detail

━━━ 🌐 *INFO & UMUM* ━━━
• \`${config.prefix}ping\` — Cek bot aktif
• \`${config.prefix}menu\` — Tampilkan menu ini
• \`${config.prefix}info\` — Info bot & sistem
• \`${config.prefix}jam\` — Jam & tanggal sekarang
• \`${config.prefix}uptime\` — Lama bot berjalan
• \`${config.prefix}profil\` — Lihat profil kamu
• \`${config.prefix}id\` — Lihat JID/nomor kamu
• \`${config.prefix}speedtest\` — Cek kecepatan bot
• \`${config.prefix}semangatpagi\` — Kata semangat pagi
• \`${config.prefix}tips\` — Tips random bermanfaat

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
• \`${config.prefix}delbye\` — Hapus pesan bye
• \`${config.prefix}cekbye\` — Lihat pesan bye

━━━ 🌍 *INTERNET & API* ━━━
• \`${config.prefix}cuaca [kota]\` — Info cuaca
• \`${config.prefix}cuacadetail [kota]\` — Cuaca detail
• \`${config.prefix}cuacaminggu [kota]\` — Prakiraan cuaca 3 hari
• \`${config.prefix}berita\` — Berita terkini
• \`${config.prefix}kurs\` — Kurs mata uang
• \`${config.prefix}convert [n] [dari] [ke]\` — Konversi mata uang
• \`${config.prefix}quote\` — Kutipan motivasi
• \`${config.prefix}jokes\` — Lelucon random
• \`${config.prefix}wiki [keyword]\` — Wikipedia
• \`${config.prefix}crypto [koin]\` — Harga crypto
• \`${config.prefix}emas\` — Harga emas hari ini
• \`${config.prefix}saham [kode]\` — Cek harga saham
• \`${config.prefix}ip [alamat]\` — Info IP
• \`${config.prefix}npm [paket]\` — Info paket NPM
• \`${config.prefix}shorturl [url]\` — Persingkat URL
• \`${config.prefix}github [user]\` — Info GitHub
• \`${config.prefix}negara [nama]\` — Info negara
• \`${config.prefix}provinsi\` — Daftar provinsi Indonesia
• \`${config.prefix}gempa\` — Gempa terkini (BMKG)
• \`${config.prefix}bmkg\` — Info BMKG terkini
• \`${config.prefix}sholat [kota]\` — Jadwal sholat
• \`${config.prefix}resep [makanan]\` — Resep masakan
• \`${config.prefix}film [judul]\` — Info film
• \`${config.prefix}kamus [kata]\` — Kamus Inggris
• \`${config.prefix}sinonim [kata]\` — Sinonim kata
• \`${config.prefix}translate [teks]\` — Terjemah ke Indonesia
• \`${config.prefix}detectlang [teks]\` — Deteksi bahasa
• \`${config.prefix}cekwa [nomor]\` — Cek nomor WA aktif
• \`${config.prefix}infonomor [nomor]\` — Info operator nomor
• \`${config.prefix}domain [url]\` — Cek domain tersedia
• \`${config.prefix}ceknet\` — Cek koneksi internet
• \`${config.prefix}lirik [judul - artis]\` — Cari lirik lagu
• \`${config.prefix}kodepos [kota]\` — Cari kode pos Indonesia
• \`${config.prefix}spotifyinfo [lagu]\` — Cari info lagu
• \`${config.prefix}pin [query]\` — Cari & kirim foto random
• \`${config.prefix}pin [query] #N\` — Cari & kirim N foto (maks 10)
• \`${config.prefix}searchtt [query]\` — Cari video TikTok & kirim link

━━━ 🔢 *MATEMATIKA & TOOLS* ━━━
• \`${config.prefix}hitung [ekspresi]\` — Kalkulator
• \`${config.prefix}math [ekspresi]\` — Kalkulator scientific
• \`${config.prefix}average [angka...]\` — Hitung rata-rata & statistik
• \`${config.prefix}luas [bentuk] [ukuran]\` — Hitung luas
• \`${config.prefix}bmi [bb] [tb]\` — Kalkulator BMI
• \`${config.prefix}kalori [makanan]\` — Info kalori
• \`${config.prefix}persen [a] [b]\` — Hitung persen
• \`${config.prefix}diskon [harga] [persen]\` — Kalkulator diskon
• \`${config.prefix}cicilan [harga] [dp%] [bunga%] [bln]\` — Kalkulator cicilan
• \`${config.prefix}tabungan [modal] [bunga%] [thn]\` — Simulasi tabungan
• \`${config.prefix}belanja [item,harga,qty|...]\` — Kalkulator belanja
• \`${config.prefix}terbilang [angka]\` — Angka ke kata
• \`${config.prefix}roman [angka]\` — Angka Romawi
• \`${config.prefix}kgkelbs [kg]\` — Konversi berat
• \`${config.prefix}cmkaki [cm]\` — Konversi panjang
• \`${config.prefix}celcius [c]\` — Konversi suhu
• \`${config.prefix}suhu [val] [c/f/k]\` — Konversi suhu lengkap
• \`${config.prefix}konversiwaktu [detik]\` — Konversi waktu
• \`${config.prefix}ukuran [S/M/L/XL]\` — Tabel ukuran pakaian
• \`${config.prefix}timezone\` — Waktu dunia
• \`${config.prefix}countdown [dd/mm/yyyy]\` — Hitung mundur
• \`${config.prefix}umur [dd/mm/yyyy]\` — Hitung umur
• \`${config.prefix}cekhari [dd/mm/yyyy]\` — Cek nama hari
• \`${config.prefix}qr [teks]\` — Buat QR Code
• \`${config.prefix}otp [panjang]\` — Generate kode OTP
• \`${config.prefix}password [panjang]\` — Generate password
• \`${config.prefix}random [min] [max]\` — Angka random
• \`${config.prefix}balik [teks]\` — Balik teks
• \`${config.prefix}balikkata [teks]\` — Balik urutan kata
• \`${config.prefix}ulang [n] [teks]\` — Ulangi teks N kali
• \`${config.prefix}kapital [teks]\` — Huruf kapital semua
• \`${config.prefix}upper [teks]\` — Huruf besar
• \`${config.prefix}lower [teks]\` — Huruf kecil
• \`${config.prefix}encode [teks]\` — Encode Base64
• \`${config.prefix}decode [teks]\` — Decode Base64
• \`${config.prefix}binary [teks]\` — Teks ke binary
• \`${config.prefix}debinary [teks]\` — Binary ke teks
• \`${config.prefix}hex [teks]\` — Teks ke hexadecimal
• \`${config.prefix}dehex [teks]\` — Hex ke teks
• \`${config.prefix}caesar [n] [teks]\` — Caesar cipher
• \`${config.prefix}morse [teks]\` — Morse code
• \`${config.prefix}palindrom [teks]\` — Cek palindrom
• \`${config.prefix}hitungkata [teks]\` — Hitung kata & karakter
• \`${config.prefix}pilih [a|b|c]\` — Acak pilihan
• \`${config.prefix}plat [kode]\` — Info kode plat nomor
• \`${config.prefix}kesehatan\` — Tips kesehatan random
• \`${config.prefix}sunatau [teks]\` — Generator hashtag
• \`${config.prefix}hitungmundur [menit]\` — Timer hitung mundur

━━━ 🎮 *HIBURAN & FUN* ━━━
• \`${config.prefix}tebak\` — Game tebak angka
• \`${config.prefix}tebakkata\` — Game tebak kata
• \`${config.prefix}tebakfilm\` — Tebak judul film
• \`${config.prefix}kuis\` — Kuis matematika
• \`${config.prefix}kuisumum\` — Kuis pengetahuan umum
• \`${config.prefix}kuisnegara\` — Kuis ibu kota negara
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
• \`${config.prefix}tts\` — Teka-teki silang
• \`${config.prefix}karir\` — Ramalan karir
• \`${config.prefix}cinta\` — Ramalan cinta
• \`${config.prefix}username\` — Generate username
• \`${config.prefix}acaknama\` — Nama random Indonesia
• \`${config.prefix}namalucu\` — Generate nama lucu
• \`${config.prefix}namabisnis\` — Generator nama bisnis
• \`${config.prefix}slogan [brand]\` — Generator slogan
• \`${config.prefix}emojify [teks]\` — Teks ke emoji
• \`${config.prefix}gaul [teks]\` — Konversi bahasa gaul
• \`${config.prefix}kalimatacak\` — Kalimat random Indonesia
• \`${config.prefix}caption [tema]\` — Generator caption medsos
• \`${config.prefix}salam [nama]\` — Kirim salam spesial
• \`${config.prefix}roulette\` — Roulette angka
• \`${config.prefix}haikugen [tema]\` — Generate haiku
• \`${config.prefix}akrostik [nama]\` — Puisi akrostik
• \`${config.prefix}warna [hex]\` — Preview warna
• \`${config.prefix}randomwarna\` — Warna random

━━━ 📥 *DOWNLOAD & MEDIA* ━━━
• \`${config.prefix}tiktok [url]\` — Download video TikTok
• \`${config.prefix}tiktokfoto [url]\` — Download foto TikTok
• \`${config.prefix}yt [url]\` — Download video YouTube
• \`${config.prefix}ytshorts [url]\` — Download YouTube Shorts
• \`${config.prefix}ytinfo [url]\` — Info video YouTube
• \`${config.prefix}ig [url]\` — Download foto/video Instagram
• \`${config.prefix}stiker\` — Buat stiker (reply foto)
• \`${config.prefix}stikerteks [teks]\` — Buat stiker dari teks
• \`${config.prefix}pp [@user]\` — Foto profil WA
• \`${config.prefix}searchyt [judul]\` — Cari video YouTube & kirim link
• \`${config.prefix}mp3yt [judul/url]\` — Download MP3 YouTube

━━━ 💾 *CATATAN & PRODUKTIVITAS* ━━━
• \`${config.prefix}save [key] [value]\` — Simpan catatan
• \`${config.prefix}get [key]\` — Ambil catatan
• \`${config.prefix}del [key]\` — Hapus catatan
• \`${config.prefix}list\` — Lihat semua catatan
• \`${config.prefix}todo [teks]\` — Tambah todo
• \`${config.prefix}todos\` — Lihat semua todo
• \`${config.prefix}donetodo [no]\` — Tandai todo selesai
• \`${config.prefix}deltodo [no]\` — Hapus todo
• \`${config.prefix}biodata [nama|usia|hobi|asal]\` — Simpan biodata
• \`${config.prefix}cekbio\` — Lihat biodata tersimpan
• \`${config.prefix}poll [pertanyaan|op1|op2]\` — Buat polling
• \`${config.prefix}vote [id] [no]\` — Vote polling
• \`${config.prefix}remind [menit] [pesan]\` — Pengingat
• \`${config.prefix}hutang [nama|jumlah|ket]\` — Catat hutang
• \`${config.prefix}bayarhutang [no]\` — Lunas hutang
• \`${config.prefix}jadwal [nama|hari|jam]\` — Tambah jadwal rutin
• \`${config.prefix}listjadwal\` — Lihat daftar jadwal
• \`${config.prefix}tabungan [modal] [bunga%] [thn]\` — Simulasi tabungan
• \`${config.prefix}belanja [item,harga,qty|...]\` — Kalkulator belanja
• \`${config.prefix}pin [teks]\` — Pin pesan penting
• \`${config.prefix}lihatpesan\` — Lihat semua pesan tersimpan
• \`${config.prefix}hapuspesan [no]\` — Hapus pesan tersimpan

━━━ ☪️ *ISLAMI* ━━━
• \`${config.prefix}quran [surah] [ayat]\` — Ayat Al-Quran
• \`${config.prefix}hadis\` — Hadis random
• \`${config.prefix}doa [nama]\` — Do'a harian
• \`${config.prefix}asmaul [no]\` — Asmaul Husna
• \`${config.prefix}namaislami [l/p]\` — Nama islami + arti
• \`${config.prefix}zakat [penghasilan]\` — Kalkulator zakat & fitrah
• \`${config.prefix}hijriah\` — Konversi kalender hijriah
• \`${config.prefix}sholat [kota]\` — Jadwal sholat
• \`${config.prefix}tafsir [surah:ayat]\` — Tafsir ayat
• \`${config.prefix}kalimatbaik\` — Kata-kata bijak Islami

━━━ 👑 *KHUSUS OWNER* ━━━
• \`${config.prefix}shell [perintah]\` — Jalankan terminal
• \`${config.prefix}broadcast [pesan]\` — Kirim ke semua chat
• \`${config.prefix}restart\` — Restart bot
• \`${config.prefix}log\` — Lihat log terakhir
• \`${config.prefix}setprefix [char]\` — Ganti prefix
• \`${config.prefix}clearlog\` — Bersihkan log
• \`${config.prefix}stats\` — Statistik bot
• \`${config.prefix}sysinfo\` — Info sistem
• \`${config.prefix}listchat\` — Daftar semua chat bot
• \`${config.prefix}setbotname [nama]\` — Ganti nama bot
• \`${config.prefix}maintenance\` — Toggle mode maintenance
• \`${config.prefix}block [nomor]\` — Blokir user
• \`${config.prefix}unblock [nomor]\` — Unblokir user
• \`${config.prefix}listblock\` — Daftar user yang diblokir
• \`${config.prefix}allcmd\` — Lihat semua perintah

━━━━━━━━━━━━━━━━━━━━
_Bot aktif 24 jam_ ⚡
_Ketik \`${config.prefix}menuall\` untuk menu per kategori_`;

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

    // ─── Cek apakah sender adalah admin grup ───
    const isGroupAdmin = async () => {
      if (!isGroup) return false;
      try {
        const meta = await sock.groupMetadata(from);
        return meta.participants.some(
          (p) => p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
        );
      } catch {
        return false;
      }
    };

    // ─── Cek apakah sender boleh pakai fitur grup (admin grup ATAU owner bot) ───
    const canManageGroup = async () => {
      return isOwner(sender) || (await isGroupAdmin());
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
      const sumber = [
        {
          nama: "CNN Indonesia",
          url: "https://berita-indo-api-next.vercel.app/api/cnn-news",
          parse: (d) => (d?.data?.posts || []).slice(0, 5).map(i => ({ title: i.title, link: i.link }))
        },
        {
          nama: "Detik.com",
          url: "https://berita-indo-api-next.vercel.app/api/detik-news",
          parse: (d) => (d?.data?.posts || []).slice(0, 5).map(i => ({ title: i.title, link: i.link }))
        },
        {
          nama: "Antara",
          url: "https://berita-indo-api-next.vercel.app/api/antara-news",
          parse: (d) => (d?.data?.posts || []).slice(0, 5).map(i => ({ title: i.title, link: i.link }))
        },
        {
          nama: "Republika",
          url: "https://berita-indo-api-next.vercel.app/api/republika-news",
          parse: (d) => (d?.data?.posts || []).slice(0, 5).map(i => ({ title: i.title, link: i.link }))
        },
      ];
      let berhasil = false;
      for (const src of sumber) {
        try {
          const data = await fetchJSON(src.url);
          const items = src.parse(data);
          if (!items || items.length === 0) continue;
          let out = `📰 *Berita Terkini (${src.nama})*\n\n`;
          items.forEach((item, i) => {
            out += `${i + 1}. *${item.title}*\n   🔗 ${item.link}\n\n`;
          });
          await reply(out.trim());
          berhasil = true;
          break;
        } catch (_) { continue; }
      }
      if (!berhasil) return reply(
        "❌ Semua sumber berita sedang tidak tersedia.\n\n" +
        "Cek langsung:\n" +
        "• https://www.cnnindonesia.com\n" +
        "• https://www.detik.com\n" +
        "• https://www.antaranews.com"
      );
      return;
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
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
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
      if (!text) return reply("⚠️ Contoh: `!setbye Sampai jumpa @name!`");
      const db = loadDB();
      if (!db._bye) db._bye = {};
      db._bye[from] = text;
      saveDB(db);
      return reply(`✅ Pesan bye diatur:\n_${text}_\n\n_Gunakan @name untuk nama anggota._`);
    }

    if (cmd === "delbye" || cmd === "hapusbye") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      if (!(await canManageGroup())) return reply("⛔ Perintah ini hanya untuk *admin grup* atau *owner bot*.");
      const db = loadDB();
      if (!db._bye || !db._bye[from]) return reply("❌ Belum ada pesan bye di grup ini.");
      delete db._bye[from];
      saveDB(db);
      return reply("✅ Pesan bye dihapus. Tidak ada lagi pesan saat member keluar.");
    }

    if (cmd === "cekbye") {
      if (!isGroup) return reply("⚠️ Hanya di grup.");
      const db = loadDB();
      const byeMsg = db._bye && db._bye[from];
      if (!byeMsg) return reply("❌ Belum ada pesan bye di grup ini.\nGunakan `!setbye [pesan]` untuk mengatur.");
      return reply(`✅ *Pesan Bye Saat Ini:*\n\n${byeMsg}`);
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
    // (handler ini digabung ke N26 bawah, skip agar tidak duplikat)

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
        const { downloadMediaMessage } = require("@whiskeysockets/baileys");
        const fs = require("fs");
        const path = require("path");
        const os = require("os");

        const msgToDownload = imgMsg === msg.message?.imageMessage
          ? msg
          : { key: msg.key, message: quoted };

        const buffer = await downloadMediaMessage(
          msgToDownload, "buffer", {},
          { logger: require("pino")({ level: "silent" }), reuploadRequest: sock.updateMediaMessage }
        );

        if (!buffer || buffer.length === 0) {
          return reply("❌ Gagal download gambar. Coba lagi.");
        }

        // Simpan file sementara
        const tmpIn = path.join(os.tmpdir(), `stiker_in_${Date.now()}.jpg`);
        const tmpOut = path.join(os.tmpdir(), `stiker_out_${Date.now()}.webp`);
        fs.writeFileSync(tmpIn, buffer);

        // Convert ke WebP pakai ffmpeg (support Android Termux)
        await new Promise((resolve, reject) => {
          require("child_process").exec(
            `ffmpeg -i "${tmpIn}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -c:v libwebp -quality 80 -y "${tmpOut}"`,
            (err, stdout, stderr) => {
              if (err) reject(new Error(stderr || err.message));
              else resolve();
            }
          );
        });

        const webpBuf = fs.readFileSync(tmpOut);

        // Hapus file sementara
        try { fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut); } catch(_) {}

        await sock.sendMessage(from, { sticker: webpBuf }, { quoted: msg });
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
        const Jimp = require("jimp");
        const os = require("os");
        const path = require("path");
        const fs = require("fs");
        const { execSync } = require("child_process");

        const label = text.slice(0, 50);

        // Buat gambar 512x512 background hitam
        const image = new Jimp(512, 512, 0x000000ff);

        // Load font bawaan Jimp
        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);

        // Cetak teks di tengah dengan word wrap
        image.print(
          font,
          0,
          0,
          {
            text: label,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
          },
          512,
          512
        );

        // Simpan PNG sementara
        const tmpPng = path.join(os.tmpdir(), `stiker_${Date.now()}.png`);
        const tmpWebp = path.join(os.tmpdir(), `stiker_${Date.now()}.webp`);
        await image.writeAsync(tmpPng);

        // Konversi PNG ke WebP pakai ffmpeg
        execSync(`ffmpeg -y -i "${tmpPng}" -vf scale=512:512 "${tmpWebp}"`, { timeout: 15000 });

        const webpBuf = fs.readFileSync(tmpWebp);

        // Hapus file sementara
        try { fs.unlinkSync(tmpPng); fs.unlinkSync(tmpWebp); } catch(_) {}

        await sock.sendMessage(from, {
          sticker: webpBuf,
        }, { quoted: msg });
        return;
      } catch (e) {
        return reply(`❌ Gagal buat stiker teks: ${e.message}`);
      }
    }

    // ============================================================
    // 20 FITUR BARU TAMBAHAN
    // ============================================================

    // ── F1. KALKULATOR UANG/HUTANG ────────────────────────────
    if (cmd === "hutang") {
      const db = loadDB();
      const user = getNum(sender);
      if (!db[user]) db[user] = {};
      if (!db[user]._hutang) db[user]._hutang = [];
      if (text) {
        const parts = text.split("|").map(s => s.trim());
        const nama = parts[0];
        const jumlah = parseInt(parts[1]?.replace(/\D/g, ""));
        const ket = parts[2] || "";
        if (!nama || isNaN(jumlah)) return reply("⚠️ Format: `!hutang Nama|Jumlah|Keterangan`\nContoh: `!hutang Budi|50000|Makan siang`");
        db[user]._hutang.push({ nama, jumlah, ket, tgl: new Date().toLocaleDateString("id-ID") });
        saveDB(db);
        return reply(`✅ Hutang dicatat!\n👤 ${nama}: Rp ${jumlah.toLocaleString("id-ID")}\n📝 ${ket}`);
      }
      const list = db[user]._hutang;
      if (!list?.length) return reply("📭 Belum ada catatan hutang.\nTambah: `!hutang Nama|Jumlah|Keterangan`");
      const total = list.reduce((a, b) => a + b.jumlah, 0);
      let out = `💰 *Catatan Hutang*\n\n`;
      list.forEach((h, i) => out += `${i+1}. *${h.nama}* — Rp ${h.jumlah.toLocaleString("id-ID")}\n   📝 ${h.ket || "-"} | 📅 ${h.tgl}\n`);
      out += `\n💵 Total: *Rp ${total.toLocaleString("id-ID")}*`;
      return reply(out);
    }

    // ── F2. HAPUS HUTANG ──────────────────────────────────────
    if (cmd === "bayarhutang") {
      const no = parseInt(args[1]) - 1;
      const db = loadDB();
      const user = getNum(sender);
      const list = db[user]?._hutang || [];
      if (isNaN(no) || no < 0 || no >= list.length) return reply("⚠️ Contoh: `!bayarhutang 1`");
      const [removed] = list.splice(no, 1);
      saveDB(db);
      return reply(`✅ Hutang *${removed.nama}* (Rp ${removed.jumlah.toLocaleString("id-ID")}) telah lunas! 🎉`);
    }

    // ── F3. CARI HADIS ────────────────────────────────────────
    if (cmd === "hadis" || cmd === "hadith") {
      try {
        const books = ["abu-dawud", "muslim", "bukhari"];
        const book = books[Math.floor(Math.random() * books.length)];
        const num = Math.floor(Math.random() * 200) + 1;
        const data = await fetchJSON(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${book}/${num}.json`);
        const hadis = data.hadith?.[0];
        if (!hadis) throw new Error();
        return reply(`📖 *Hadis (${book.replace("-"," ")} #${num})*\n\n${hadis.text?.slice(0, 500) || "-"}`);
      } catch {
        const hadis = [
          "Sesungguhnya setiap amalan tergantung pada niatnya. (HR. Bukhari)",
          "Senyummu kepada saudaramu adalah sedekah. (HR. Tirmidzi)",
          "Barangsiapa beriman kepada Allah dan hari akhir, hendaklah ia berkata baik atau diam. (HR. Bukhari)",
        ];
        return reply(`📖 *Hadis*\n\n${hadis[Math.floor(Math.random() * hadis.length)]}`);
      }
    }

    // ── F4. AYAT AL-QURAN ─────────────────────────────────────
    if (cmd === "quran") {
      const surah = parseInt(args[1]) || Math.floor(Math.random() * 114) + 1;
      const ayat = parseInt(args[2]) || 1;
      try {
        const data = await fetchJSON(`https://api.alquran.cloud/v1/ayah/${surah}:${ayat}/id.indonesian`);
        const d = data.data;
        const arab = await fetchJSON(`https://api.alquran.cloud/v1/ayah/${surah}:${ayat}`);
        return reply(
          `📖 *Al-Quran ${d.surah.englishName} (${d.surah.name}) : ${ayat}*\n\n` +
          `${arab.data.text}\n\n` +
          `_${d.text}_`
        );
      } catch {
        return reply("❌ Gagal ambil ayat. Contoh: `!quran 2 255` (Surah:Ayat)");
      }
    }

    // ── F5. DO'A HARIAN ───────────────────────────────────────
    if (cmd === "doa") {
      const doas = [
        { nama: "Doa Makan", arab: "بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ", latin: "Bismillahi wa 'ala barakatillah", arti: "Dengan nama Allah dan atas berkah Allah" },
        { nama: "Doa Tidur", arab: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا", latin: "Bismika Allahumma amuutu wa ahyaa", arti: "Dengan nama-Mu ya Allah aku mati dan hidup" },
        { nama: "Doa Bangun Tidur", arab: "اَلْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا", latin: "Alhamdulillahilladzi ahyaana ba'da maa amaatanaa", arti: "Segala puji bagi Allah yang menghidupkan kami setelah mematikan kami" },
        { nama: "Doa Masuk Kamar Mandi", arab: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبْثِ وَالْخَبَائِثِ", latin: "Allahumma inni a'udzu bika minal khubutsi wal khabaaits", arti: "Ya Allah, aku berlindung kepada-Mu dari setan laki-laki dan perempuan" },
        { nama: "Doa Keluar Rumah", arab: "بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ", latin: "Bismillahi tawakkaltu 'alallah", arti: "Dengan nama Allah, aku bertawakkal kepada Allah" },
      ];
      const pilihan = text ? doas.find(d => d.nama.toLowerCase().includes(text.toLowerCase())) || doas[0] : doas[Math.floor(Math.random() * doas.length)];
      return reply(`🤲 *${pilihan.nama}*\n\n${pilihan.arab}\n\n_${pilihan.latin}_\n\n📌 ${pilihan.arti}`);
    }

    // ── F6. KALKULATOR ZAKAT ──────────────────────────────────
    if (cmd === "zakat") {
      const penghasilan = parseFloat((args[1] || "").replace(/\D/g, ""));
      if (isNaN(penghasilan)) return reply("⚠️ Contoh: `!zakat 5000000` (penghasilan per bulan)");
      const nisab = 6500000; // estimasi nisab 2024
      const zakatMal = penghasilan * 0.025;
      const status = penghasilan >= nisab ? "✅ Wajib zakat" : "❌ Belum wajib zakat";
      return reply(
        `🕌 *Kalkulator Zakat*\n\n` +
        `💰 Penghasilan : Rp ${penghasilan.toLocaleString("id-ID")}\n` +
        `📊 Nisab       : Rp ${nisab.toLocaleString("id-ID")}\n` +
        `📌 Status      : ${status}\n` +
        `💵 Zakat 2.5%  : Rp ${zakatMal.toLocaleString("id-ID")}`
      );
    }

    // ── F7. NAMA ISLAMI ───────────────────────────────────────
    if (cmd === "namaislami" || cmd === "islamicname") {
      const namaLaki = [
        {nama:"Ahmad",arti:"Terpuji"},{nama:"Muhammad",arti:"Yang dipuji"},{nama:"Ibrahim",arti:"Bapak bangsa-bangsa"},
        {nama:"Yusuf",arti:"Allah akan menambah"},{nama:"Ali",arti:"Tinggi, mulia"},{nama:"Omar",arti:"Berumur panjang"},
        {nama:"Hasan",arti:"Baik, tampan"},{nama:"Zaid",arti:"Pertumbuhan"}
      ];
      const namaPerempuan = [
        {nama:"Fatimah",arti:"Yang berpantang"},{nama:"Aisyah",arti:"Hidup, bersemangat"},{nama:"Khadijah",arti:"Lahir prematur"},
        {nama:"Maryam",arti:"Pelayan Tuhan"},{nama:"Zahra",arti:"Bersinar, bunga"},{nama:"Nadia",arti:"Penuh harapan"},
        {nama:"Sara",arti:"Putri, mulia"},{nama:"Laila",arti:"Malam yang indah"}
      ];
      const gender = (args[1] || "").toLowerCase();
      const list = gender === "p" ? namaPerempuan : namaLaki;
      const pilihan = list[Math.floor(Math.random() * list.length)];
      return reply(`☪️ *Nama Islami*\n\n👤 Nama  : *${pilihan.nama}*\n📌 Arti  : ${pilihan.arti}\n\n_Ketik \`!namaislami p\` untuk nama perempuan_`);
    }

    // ── F8. CEK TANGGAL HIJRIAH ───────────────────────────────
    if (cmd === "hijriah" || cmd === "kalenderislam") {
      try {
        const today = new Date();
        const data = await fetchJSON(`https://api.aladhan.com/v1/gToH/${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}`);
        const h = data.data.hijri;
        return reply(`📅 *Kalender Hijriah*\n\n🗓️ Masehi  : ${today.toLocaleDateString("id-ID", {weekday:"long",day:"numeric",month:"long",year:"numeric"})}\n☪️ Hijriah : ${h.day} ${h.month.en} ${h.year} H\n📌 Hari    : ${h.weekday.en}`);
      } catch {
        return reply("❌ Gagal ambil kalender hijriah.");
      }
    }

    // ── F9. ASMAUL HUSNA ──────────────────────────────────────
    if (cmd === "asmaul" || cmd === "asmaulhusna") {
      const asmaul = [
        {no:1,nama:"Ar-Rahman",arti:"Yang Maha Pengasih"},{no:2,nama:"Ar-Rahim",arti:"Yang Maha Penyayang"},
        {no:3,nama:"Al-Malik",arti:"Yang Maha Raja"},{no:4,nama:"Al-Quddus",arti:"Yang Maha Suci"},
        {no:5,nama:"As-Salam",arti:"Yang Maha Memberi Keselamatan"},{no:6,nama:"Al-Mu'min",arti:"Yang Maha Memberi Keamanan"},
        {no:7,nama:"Al-Muhaymin",arti:"Yang Maha Memelihara"},{no:8,nama:"Al-Aziz",arti:"Yang Maha Perkasa"},
        {no:9,nama:"Al-Jabbar",arti:"Yang Maha Kuasa"},{no:10,nama:"Al-Mutakabbir",arti:"Yang Maha Megah"},
      ];
      const no = parseInt(args[1]);
      if (!isNaN(no) && no >= 1 && no <= 99) {
        const a = asmaul.find(x => x.no === no) || asmaul[Math.floor(Math.random() * asmaul.length)];
        return reply(`☪️ *Asmaul Husna #${a.no}*\n\n*${a.nama}*\n📌 ${a.arti}`);
      }
      const pilihan = asmaul[Math.floor(Math.random() * asmaul.length)];
      return reply(`☪️ *Asmaul Husna #${pilihan.no}*\n\n*${pilihan.nama}*\n📌 ${pilihan.arti}\n\n_Ketik \`!asmaul [1-99]\` untuk nomor tertentu_`);
    }

    // ── F10. GENERATOR CAPTION ────────────────────────────────
    if (cmd === "caption") {
      if (!text) return reply("⚠️ Contoh: `!caption pantai`");
      const captions = [
        `✨ ${text} vibes 🌊\n.\n.\n#${text.replace(/\s+/g,"")} #aesthetic #vibes`,
        `Life is better with ${text} 🌟\n.\n.\n#${text.replace(/\s+/g,"")} #lifestyle #happy`,
        `Not all those who wander are lost ✈️\n${text} calling my name~\n.\n#${text.replace(/\s+/g,"")} #explore`,
        `${text.charAt(0).toUpperCase()+text.slice(1)} is always a good idea 💫\n.\n.\n#${text.replace(/\s+/g,"")} #goodvibes`,
      ];
      return reply(`📝 *Caption Generator*\n\n${captions[Math.floor(Math.random() * captions.length)]}`);
    }

    // ── F11. KONVERSI UKURAN PAKAIAN ──────────────────────────
    if (cmd === "ukuran" || cmd === "size") {
      const ukuran = {
        "XS": {EU:"32-34", US:"0-2", UK:"4-6"},
        "S":  {EU:"36-38", US:"4-6", UK:"8-10"},
        "M":  {EU:"38-40", US:"8-10", UK:"12-14"},
        "L":  {EU:"40-42", US:"12-14", UK:"16-18"},
        "XL": {EU:"44-46", US:"16-18", UK:"20-22"},
        "XXL":{EU:"48-50", US:"20-22", UK:"24-26"},
      };
      const uk = (args[1] || "").toUpperCase();
      if (!uk || !ukuran[uk]) {
        return reply(`👕 *Konversi Ukuran Pakaian*\n\nUkuran tersedia: ${Object.keys(ukuran).join(", ")}\n\nContoh: \`!ukuran M\``);
      }
      const u = ukuran[uk];
      return reply(`👕 *Ukuran ${uk}*\n\n🇪🇺 EU  : ${u.EU}\n🇺🇸 US  : ${u.US}\n🇬🇧 UK  : ${u.UK}`);
    }

    // ── F12. RAMALAN KESEHATAN ────────────────────────────────
    if (cmd === "kesehatan" || cmd === "health") {
      const tips = [
        "💧 Minum 8 gelas air putih hari ini untuk menjaga tubuh tetap terhidrasi.",
        "🚶 Berjalan kaki 30 menit sehari bisa mengurangi risiko penyakit jantung.",
        "🥗 Konsumsi lebih banyak sayur dan buah untuk meningkatkan imunitas tubuh.",
        "😴 Tidur 7-8 jam per malam membantu pemulihan tubuh dan meningkatkan konsentrasi.",
        "🧘 Luangkan 10 menit untuk meditasi guna mengurangi stres dan kecemasan.",
        "🚭 Hindari rokok dan alkohol untuk menjaga kesehatan paru-paru dan hati.",
        "☀️ Berjemur 15 menit di pagi hari untuk mendapatkan vitamin D alami.",
        "🍌 Konsumsi pisang untuk energi alami dan menjaga kadar gula darah stabil.",
      ];
      return reply(`💊 *Tips Kesehatan Hari Ini*\n\n${tips[Math.floor(Math.random() * tips.length)]}`);
    }

    // ── F13. GENERATOR SALAM ──────────────────────────────────
    if (cmd === "salam") {
      const nama = text || "Sobat";
      const salam = [
        `Halo ${nama}! 👋 Semoga harimu menyenangkan dan penuh semangat! 🌟`,
        `Hai ${nama}! 😊 Jangan lupa tersenyum hari ini, kamu luar biasa! ✨`,
        `Selamat datang ${nama}! 🎉 Semoga semua urusanmu lancar hari ini! 💪`,
        `Hey ${nama}! 🌈 Hari ini adalah hari yang indah untukmu! Semangat! 🚀`,
      ];
      return reply(salam[Math.floor(Math.random() * salam.length)]);
    }

    // ── F14. LIRIK LAGU ───────────────────────────────────────
    if (cmd === "lirik") {
      if (!text) return reply("⚠️ Contoh: `!lirik judul lagu`");
      try {
        const parts = text.split("-").map(s => s.trim());
        const artist = parts[1] || "";
        const title = parts[0];
        const data = await fetchJSON(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist || title)}/${encodeURIComponent(title)}`);
        if (!data.lyrics) throw new Error();
        const lirik = data.lyrics.slice(0, 500);
        return reply(`🎵 *Lirik: ${text}*\n\n${lirik}...\n\n_Gunakan format: !lirik judul - artis_`);
      } catch {
        return reply(`❌ Lirik tidak ditemukan.\nFormat: \`!lirik Judul - Artis\`\nContoh: \`!lirik Shallow - Lady Gaga\``);
      }
    }

    // ── F15. RANDOM WARNA ─────────────────────────────────────
    if (cmd === "randomwarna" || cmd === "randomcolor") {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      const hex = `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`.toUpperCase();
      return reply(`🎨 *Warna Random*\n\nHEX : \`${hex}\`\nRGB : rgb(${r}, ${g}, ${b})\n\n_Gunakan \`!warna ${hex.replace("#","")}\` untuk preview_`);
    }

    // ── F16. KONVERSI WAKTU ───────────────────────────────────
    if (cmd === "konversiwaktu") {
      const detik = parseInt(args[1]);
      if (isNaN(detik)) return reply("⚠️ Contoh: `!konversiwaktu 3600` (dalam detik)");
      const jam = Math.floor(detik / 3600);
      const menit = Math.floor((detik % 3600) / 60);
      const sisa = detik % 60;
      return reply(`⏱️ *Konversi Waktu*\n\n${detik} detik =\n⏰ ${jam} jam ${menit} menit ${sisa} detik`);
    }

    // ── F17. GENERATOR NOMORPLAT ──────────────────────────────
    if (cmd === "plat" || cmd === "nomorplat") {
      if (!text) return reply("⚠️ Contoh: `!plat B` atau `!plat D`");
      const platMap = {
        "A":"Banten","B":"Jakarta","D":"Bandung","E":"Cirebon","F":"Bogor",
        "G":"Pekalongan","H":"Semarang","K":"Pati","L":"Surabaya","M":"Madura",
        "N":"Malang","P":"Besuki","R":"Banyumas","S":"Bojonegoro","T":"Karawang",
        "V":"Madiun","W":"Gresik","Z":"Sumedang","AB":"Yogyakarta","AD":"Solo",
        "AE":"Madiun","AG":"Kediri","B":"DKI Jakarta"
      };
      const kode = text.toUpperCase();
      const daerah = platMap[kode];
      if (!daerah) return reply(`❌ Kode plat "${kode}" tidak ditemukan.\nContoh kode: ${Object.keys(platMap).join(", ")}`);
      return reply(`🚗 *Info Plat Nomor*\n\nKode : ${kode}\nDaerah: ${daerah}`);
    }

    // ── F18. HARGA EMAS ───────────────────────────────────────
    if (cmd === "emas" || cmd === "goldprice") {
      try {
        const data = await fetchJSON("https://api.metals.live/v1/spot/gold");
        const hargaUSD = data[0]?.price || 0;
        const kurs = await fetchJSON("https://api.exchangerate-api.com/v4/latest/USD");
        const idr = kurs.rates?.IDR || 15000;
        const hargaIDR = (hargaUSD * idr / 31.1035).toFixed(0);
        return reply(
          `🥇 *Harga Emas Hari Ini*\n\n` +
          `💵 Per troy oz : $${hargaUSD.toFixed(2)}\n` +
          `🇮🇩 Per gram    : Rp ${parseInt(hargaIDR).toLocaleString("id-ID")}\n` +
          `🕐 Update      : ${getDateTime()} WIB`
        );
      } catch {
        return reply("❌ Gagal ambil harga emas. Coba lagi nanti.");
      }
    }

    // ── F19. KUIS PENGETAHUAN UMUM ────────────────────────────
    if (cmd === "kuisumum") {
      try {
        const data = await fetchJSON("https://opentdb.com/api.php?amount=1&type=multiple&difficulty=easy");
        const q = data.results?.[0];
        if (!q) throw new Error();
        const semua = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
        const db = loadDB();
        if (!db._kuisumum) db._kuisumum = {};
        db._kuisumum[from] = { jawab: q.correct_answer, time: Date.now() };
        saveDB(db);
        let out = `🧠 *Kuis Pengetahuan Umum*\n\n`;
        out += `❓ ${q.question.replace(/&quot;/g,'"').replace(/&#039;/g,"'")}\n\n`;
        semua.forEach((o, i) => out += `${["A","B","C","D"][i]}. ${o}\n`);
        out += `\nBalas dengan \`!jawabumum A/B/C/D\``;
        return reply(out);
      } catch {
        return reply("❌ Gagal ambil soal. Coba lagi nanti.");
      }
    }

    // ── F20. JAWAB KUIS UMUM ──────────────────────────────────
    if (cmd === "jawabumum") {
      const db = loadDB();
      const kuis = db._kuisumum?.[from];
      if (!kuis) return reply("⚠️ Belum ada kuis. Ketik `!kuisumum` untuk mulai.");
      if (Date.now() - kuis.time > 60000) {
        delete db._kuisumum[from];
        saveDB(db);
        return reply(`⏰ Waktu habis! Jawabannya: *${kuis.jawab}*`);
      }
      const huruf = (args[1] || "").toUpperCase();
      if (!["A","B","C","D"].includes(huruf)) return reply("⚠️ Jawab dengan A, B, C, atau D");
      delete db._kuisumum[from];
      saveDB(db);
      return reply(`✅ Kamu menjawab: *${huruf}*\n\nJawaban benar: *${kuis.jawab}*\n\n${huruf ? "🎉 Cek apakah jawabanmu benar!" : ""}`);
    }

    // ============================================================
    // FITUR MENU KATEGORI
    // ============================================================

    // ── MENUALL ───────────────────────────────────────────────
    if (cmd === "menuall" || cmd === "daftarmenu") {
      return reply(
        `╔══════════════════════════╗\n` +
        `║   🤖 *${config.botName}* - MENU   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `📌 *PREFIX:* \`${config.prefix}\`\n\n` +
        `Pilih kategori menu:\n\n` +
        `🌐 \`!menuinfo\` — Info & Internet\n` +
        `👥 \`!menugrup\` — Manajemen Grup\n` +
        `📥 \`!menudownload\` — Download & Media\n` +
        `🎮 \`!menufun\` — Hiburan & Fun\n` +
        `🔢 \`!menutools\` — Tools & Kalkulator\n` +
        `☪️ \`!menuislam\` — Islami\n` +
        `💾 \`!menucatatan\` — Catatan & Produktivitas\n` +
        `👑 \`!menuowner\` — Khusus Owner\n\n` +
        `📋 \`!allcmd\` — Semua perintah (owner)\n\n` +
        `_Total: 200+ fitur aktif_ ⚡`
      );
    }

    // ── MENUINFO ──────────────────────────────────────────────
    if (cmd === "menuinfo") {
      return reply(
        `╔══════════════════════════╗\n` +
        `║   🌐  INFO & UMUM   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `• \`!ping\` — Cek bot aktif\n` +
        `• \`!info\` — Info bot & sistem\n` +
        `• \`!jam\` — Jam & tanggal\n` +
        `• \`!uptime\` — Lama bot berjalan\n` +
        `• \`!profil\` — Profil kamu\n` +
        `• \`!id\` — Lihat JID/nomor\n` +
        `• \`!speedtest\` — Cek kecepatan bot\n` +
        `• \`!cuaca [kota]\` — Info cuaca\n` +
        `• \`!cuacadetail [kota]\` — Cuaca detail\n` +
        `• \`!berita\` — Berita terkini\n` +
        `• \`!kurs\` — Kurs mata uang\n` +
        `• \`!convert [n] [dari] [ke]\` — Konversi mata uang\n` +
        `• \`!crypto [koin]\` — Harga crypto\n` +
        `• \`!emas\` — Harga emas\n` +
        `• \`!gempa\` — Gempa terkini\n` +
        `• \`!sholat [kota]\` — Jadwal sholat\n` +
        `• \`!hijriah\` — Kalender hijriah\n` +
        `• \`!wiki [kata]\` — Wikipedia\n` +
        `• \`!translate [teks]\` — Terjemah\n` +
        `• \`!kamus [kata]\` — Kamus Inggris\n` +
        `• \`!sinonim [kata]\` — Sinonim kata\n` +
        `• \`!ip [alamat]\` — Info IP\n` +
        `• \`!github [user]\` — Info GitHub\n` +
        `• \`!negara [nama]\` — Info negara\n` +
        `• \`!domain [url]\` — Cek domain\n` +
        `• \`!cekwa [nomor]\` — Cek nomor WA\n` +
        `• \`!ceknet\` — Cek koneksi internet\n` +
        `• \`!npm [paket]\` — Info NPM\n` +
        `• \`!prakiraan [kota]\` — Prakiraan cuaca 3 hari\n` +
        `• \`!infoplat [kode]\` — Info plat daerah\n` +
        `• \`!infonomor [nomor]\` — Info nomor HP\n` +
        `• \`!cekoperator [nomor]\` — Cek operator HP\n` +
        `• \`!saham [kode]\` — Harga saham\n` +
        `• \`!cuacaminggu [kota]\` — Cuaca mingguan\n` +
        `• \`!bmkg\` — Info gempa BMKG\n` +
        `• \`!timezone\` — Waktu dunia\n\n` +
        `_Ketik \`!menuall\` untuk kembali_ 🔙`
      );
    }

    // ── MENUGRUP ──────────────────────────────────────────────
    if (cmd === "menugrup") {
      return reply(
        `╔══════════════════════════╗\n` +
        `║   👥  MENU GRUP   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `_Khusus Admin Grup & Owner_\n\n` +
        `• \`!tagall\` — Tag semua anggota\n` +
        `• \`!hidetag [teks]\` — Tag diam-diam\n` +
        `• \`!kick @user\` — Kick anggota\n` +
        `• \`!add [nomor]\` — Tambah anggota\n` +
        `• \`!promote @user\` — Jadikan admin\n` +
        `• \`!demote @user\` — Copot admin\n` +
        `• \`!groupinfo\` — Info grup\n` +
        `• \`!link\` — Link invite grup\n` +
        `• \`!revokelink\` — Reset link grup\n` +
        `• \`!mute\` — Hanya admin bisa chat\n` +
        `• \`!unmute\` — Semua bisa chat\n` +
        `• \`!listadmin\` — Daftar admin\n` +
        `• \`!setdesc [teks]\` — Set deskripsi\n` +
        `• \`!setname [nama]\` — Ganti nama grup\n` +
        `• \`!setwelcome [teks]\` — Pesan welcome\n` +
        `• \`!delwelcome\` — Hapus welcome\n` +
        `• \`!cekwelcome\` — Lihat welcome\n` +
        `• \`!setbye [teks]\` — Atur pesan bye\n` +
        `• \`!delbye\` — Hapus pesan bye\n` +
        `• \`!cekbye\` — Lihat pesan bye\n` +
        `• \`!listadmin\` — Daftar admin (alias: !admins)\n` +
        `• \`!infogroup\` — Info grup (alias: !groupinfo)\n` +
        `• \`!linkgrup\` — Link grup (alias: !link)\n\n` +
        `_Ketik \`!menuall\` untuk kembali_ 🔙`
      );
    }

    // ── MENUDOWNLOAD ──────────────────────────────────────────
    if (cmd === "menudownload" || cmd === "menudl") {
      return reply(
        `╔══════════════════════════╗\n` +
        `║   📥  MENU DOWNLOAD & MEDIA   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `• \`!tiktok [url]\` — Download video TikTok\n` +
        `• \`!tiktokfoto [url]\` — Download foto/slide TikTok\n` +
        `• \`!yt [url]\` — Download video YouTube\n` +
        `• \`!ytshorts [url]\` — Download YouTube Shorts\n` +
        `• \`!ig [url]\` — Download foto/video Instagram\n` +
        `• \`!stiker\` — Buat stiker dari foto (reply foto)\n` +
        `• \`!stikerteks [teks]\` — Buat stiker dari teks\n` +
        `• \`!ytinfo [url]\` — Info video YouTube\n` +
        `• \`!spotifyinfo [lagu]\` — Cari lagu\n` +
        `• \`!film [judul]\` — Info film\n` +
        `• \`!pp [@user]\` — Foto profil WA (alias: !fotoprofil)\n` +
        `• \`!iginfo [url]\` — Info Instagram\n` +
        `• \`!pin [query]\` — Cari & kirim foto random\n` +
        `• \`!pin [query] #N\` — Cari & kirim N foto (maks 10)\n` +
        `• \`!searchtt [query]\` — Cari video TikTok & kirim link\n` +
        `• \`!searchtt [query] #N\` — Cari & kirim N foto (maks 10)\n` +
        `• \`!searchyt [judul]\` — Cari video YouTube & kirim link\n` +
        `• \`!mp3yt [judul/url]\` — Download MP3 YouTube\n\n` +
        `_Ketik \`!menuall\` untuk kembali_ 🔙`
      );
    }

    // ── MENUFUN ───────────────────────────────────────────────
    if (cmd === "menufun") {
      return reply(
        `╔══════════════════════════╗\n` +
        `║   🎮  MENU FUN & HIBURAN   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `🎮 *Game:*\n` +
        `• \`!tebak\` — Game tebak angka\n` +
        `• \`!tebakkata\` — Game tebak kata\n` +
        `• \`!kuis\` — Kuis matematika\n` +
        `• \`!kuisumum\` — Kuis pengetahuan umum\n` +
        `• \`!tts\` — Teka-teki\n` +
        `• \`!8ball [pertanyaan]\` — Magic 8 Ball\n\n` +
        `🎲 *Random:*\n` +
        `• \`!dadu [n]\` — Lempar dadu\n` +
        `• \`!koin\` — Lempar koin\n` +
        `• \`!fakta\` — Fakta unik\n` +
        `• \`!meme\` — Meme random\n` +
        `• \`!cerita\` — Cerita pendek\n` +
        `• \`!kalimat\` — Kalimat random\n` +
        `• \`!randomwarna\` — Warna random\n\n` +
        `✍️ *Kata & Kreasi:*\n` +
        `• \`!quote\` — Kata motivasi\n` +
        `• \`!jokes\` — Lelucon random\n` +
        `• \`!mutiara\` — Kata mutiara\n` +
        `• \`!pantun\` — Pantun random\n` +
        `• \`!puisi [tema]\` — Buat puisi\n` +
        `• \`!caption [tema]\` — Generator caption\n` +
        `• \`!salam [nama]\` — Generator salam\n` +
        `• \`!lirik [judul - artis]\` — Lirik lagu\n\n` +
        `🔮 *Ramalan:*\n` +
        `• \`!horoscope [zodiak]\` — Ramalan bintang\n` +
        `• \`!karir\` — Ramalan karir\n` +
        `• \`!cinta\` — Ramalan cinta\n` +
        `• \`!kesehatan\` — Tips kesehatan\n\n` +
        `🎨 *Lainnya:*\n` +
        `• \`!username\` — Generate username\n` +
        `• \`!acaknama\` — Nama random\n` +
        `• \`!bisnis\` — Saran nama bisnis\n` +
        `• \`!namaislami\` — Nama islami\n` +
        `• \`!emojify [teks]\` — Teks ke emoji\n` +
        `• \`!warna [hex]\` — Preview warna\n` +
        `• \`!hashtag [kata]\` — Generate hashtag\n` +
        `• \`!namaanak [laki/perempuan]\` — Nama anak\n` +
        `• \`!randomhex\` — Warna random HEX\n` +
        `• \`!roulette\` — Game roulette\n` +
        `• \`!motivasi\` — Kutipan motivasi (alias: !quote)\n` +
        `• \`!motivasipagi\` — Semangat pagi\n` +
        `• \`!semangatpagi\` — Semangat pagi\n` +
        `• \`!haikugen [tema]\` — Buat haiku\n` +
        `• \`!namalucu\` — Nama lucu random\n` +
        `• \`!ramalanmimpi [mimpi]\` — Tafsir mimpi\n\n` +
        `_Ketik \`!menuall\` untuk kembali_ 🔙`
      );
    }

    // ── MENUTOOLS ─────────────────────────────────────────────
    if (cmd === "menutools") {
      return reply(
        `╔══════════════════════════╗\n` +
        `║   🔢  MENU TOOLS   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `• \`!hitung [ekspresi]\` — Kalkulator\n` +
        `• \`!math [ekspresi]\` — Kalkulator scientific\n` +
        `• \`!persen [a] [b]\` — Hitung persen\n` +
        `• \`!ratarata [angka...]\` — Rata-rata nilai\n` +
        `• \`!diskon [harga] [%]\` — Kalkulator diskon\n` +
        `• \`!cicilan [harga] [bln] [bunga]\` — Cicilan\n` +
        `• \`!tip [tagihan] [%] [orang]\` — Hitung tip\n` +
        `• \`!tabungan [modal] [bunga] [tahun]\` — Tabungan\n` +
        `• \`!bmi [bb] [tb]\` — Kalkulator BMI\n` +
        `• \`!kalori [makanan]\` — Info kalori\n` +
        `• \`!zakat [penghasilan]\` — Kalkulator zakat\n` +
        `• \`!luas [bentuk] [ukuran]\` — Hitung luas\n` +
        `• \`!roman [angka]\` — Angka Romawi\n` +
        `• \`!terbilang [angka]\` — Angka ke kata\n` +
        `• \`!qr [teks]\` — Buat QR Code\n` +
        `• \`!otp [panjang]\` — Generate kode OTP\n` +
        `• \`!password [panjang]\` — Generate password\n` +
        `• \`!random [min] [max]\` — Angka random\n` +
        `• \`!balik [teks]\` — Balik teks\n` +
        `• \`!balikkata [teks]\` — Balik urutan kata\n` +
        `• \`!kapital [teks]\` — Huruf kapital semua\n` +
        `• \`!upper/lower [teks]\` — Ubah huruf\n` +
        `• \`!ulang [n] [teks]\` — Ulangi teks\n` +
        `• \`!encode/decode [teks]\` — Base64\n` +
        `• \`!binary/debinary [teks]\` — Binary\n` +
        `• \`!hex/dehex [teks]\` — Hexadecimal\n` +
        `• \`!caesar [n] [teks]\` — Caesar cipher\n` +
        `• \`!morse [teks]\` — Morse code\n` +
        `• \`!palindrom [teks]\` — Cek palindrom\n` +
        `• \`!hitungkata [teks]\` — Hitung kata\n` +
        `• \`!deteksibahasa [teks]\` — Deteksi bahasa\n` +
        `• \`!hashtag [kata]\` — Generator hashtag\n` +
        `• \`!slogan [produk]\` — Generator slogan\n` +
        `• \`!akrostik [nama]\` — Puisi akrostik\n` +
        `• \`!countdown [tgl]\` — Hitung mundur\n` +
        `• \`!hitungmundur [mnt]\` — Timer mundur\n` +
        `• \`!umur [tgl]\` — Hitung umur\n` +
        `• \`!cekhari [tgl]\` — Cek nama hari\n` +
        `• \`!cekzodiak [dd/mm]\` — Cek zodiak\n` +
        `• \`!suhu [val] [c/f/k]\` — Konversi suhu\n` +
        `• \`!celcius [c]\` — Celcius ke Fahrenheit\n` +
        `• \`!kgkelbs [kg]\` — Konversi berat\n` +
        `• \`!cmkaki [cm]\` — Konversi panjang\n` +
        `• \`!konversiwaktu [detik]\` — Konversi waktu\n` +
        `• \`!timezone\` — Waktu dunia\n` +
        `• \`!ukuran [S/M/L]\` — Konversi ukuran baju\n` +
        `• \`!plat [kode]\` — Info plat nomor\n` +
        `• \`!cekoperator [nomor]\` — Info operator HP\n` +
        `• \`!shorturl [url]\` — Persingkat URL\n` +
        `• \`!pilih [a|b|c]\` — Acak pilihan\n` +
        `• \`!remind [menit] [pesan]\` — Pengingat\n\n` +
        `━━━ 💰 *KEUANGAN* ━━━\n` +
        `• \`!diskon [harga] [%]\` — Hitung diskon\n` +
        `• \`!cicilan [harga] [dp] [bulan]\` — Cicilan\n` +
        `• \`!splitbill [total] [orang]\` — Bagi tagihan\n` +
        `• \`!tips [tagihan] [%]\` — Hitung tips\n` +
        `• \`!gaji [nominal]\` — Simulasi gaji\n` +
        `• \`!lembur [gaji] [jam]\` — Upah lembur\n` +
        `• \`!tabungan [target] [bulan]\` — Target nabung\n` +
        `• \`!investasi [modal] [%] [tahun]\` — Simulasi investasi\n` +
        `• \`!bensin [km] [km/l] [harga]\` — Biaya bensin\n` +
        `• \`!ppn [harga]\` — Hitung PPN 11%\n` +
        `• \`!pkb [njkb] [tahun]\` — Estimasi pajak kendaraan\n\n` +
        `━━━ 🏠 *RUMAH & PROPERTI* ━━━\n` +
        `• \`!keramik [p] [l] [uk]\` — Kebutuhan keramik\n` +
        `• \`!hitungcat [p] [l] [t]\` — Kebutuhan cat\n` +
        `• \`!listrik [watt] [jam] [hari]\` — Biaya listrik\n\n` +
        `━━━ 🔐 *KEAMANAN* ━━━\n` +
        `• \`!passgen [panjang] [tipe]\` — Password kuat\n` +
        `• \`!cekpass [password]\` — Cek kekuatan password\n\n` +
        `━━━ 🌐 *JARINGAN* ━━━\n` +
        `• \`!cekweb [url]\` — Status website\n` +
        `• \`!iplookup [ip]\` — Info IP address\n` +
        `• \`!cekdns [domain]\` — Cek DNS\n\n` +
        `━━━ 📊 *SAHAM & KRIPTO* ━━━\n` +
        `• \`!saham [kode]\` — Harga saham\n` +
        `• \`!crypto [koin]\` — Harga crypto (alias: !kripto)\n` +
        `• \`!emas\` — Harga emas\n\n` +
        `━━━ 🔄 *KONVERSI LAINNYA* ━━━\n` +
        `• \`!liter [val] [satuan]\` — Konversi volume\n` +
        `• \`!konversi [n] [dari] [ke]\` — Konversi mata uang\n` +
        `• \`!waktu [detik]\` — Konversi waktu\n` +
        `• \`!kebutuhanair [kg]\` — Kebutuhan air harian\n` +
        `• \`!kaloribakar [aktivitas] [kg] [menit]\` — Kalori terbakar\n` +
        `• \`!hitunglari [km] [menit]\` — Hitung pace lari\n` +
        `• \`!hpht [dd/mm/yyyy]\` — Kalkulator kehamilan\n` +
        `• \`!ukuranbaju [S/M/L]\` — Konversi ukuran baju\n` +
        `• \`!infoplat [kode]\` — Info plat daerah\n` +
        `• \`!provinsi\` — Daftar provinsi Indonesia\n\n` +
        `_Ketik \`!menuall\` untuk kembali_ 🔙`
      );
    }

    // ── MENUOWNER ─────────────────────────────────────────────
    if (cmd === "menuowner") {
      if (!isOwner(sender)) return reply("⛔ Menu ini hanya untuk *Owner*.");
      return reply(
        `╔══════════════════════════╗\n` +
        `║   👑  MENU OWNER   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `━━━ ⚙️ *SISTEM BOT* ━━━\n` +
        `• \`!shell [perintah]\` — Jalankan terminal\n` +
        `• \`!exec [cmd]\` — Alias !shell\n` +
        `• \`!restart\` — Restart bot\n` +
        `• \`!log\` — Lihat log terakhir\n` +
        `• \`!clearlog\` — Bersihkan log\n` +
        `• \`!stats\` — Statistik bot\n` +
        `• \`!sysinfo\` — Info sistem\n` +
        `• \`!maintenance\` — Toggle maintenance\n` +
        `• \`!setprefix [char]\` — Ganti prefix\n` +
        `• \`!setbotname [nama]\` — Ganti nama bot\n` +
        `• \`!allcmd\` — Semua perintah\n\n` +
        `━━━ 📢 *BROADCAST* ━━━\n` +
        `• \`!broadcast [pesan]\` — Kirim ke semua\n` +
        `• \`!bc [pesan]\` — Alias !broadcast\n` +
        `• \`!listchat\` — Daftar grup bot\n\n` +
        `━━━ 🚫 *BLOKIR USER* ━━━\n` +
        `• \`!block [nomor]\` — Blokir user\n` +
        `• \`!unblock [nomor]\` — Unblokir user\n` +
        `• \`!listblock\` — Daftar user diblokir\n\n` +
        `━━━ 👋 *WELCOME & BYE* ━━━\n` +
        `• \`!setwelcome [teks]\` — Set pesan welcome\n` +
        `• \`!delwelcome\` — Hapus welcome\n` +
        `• \`!cekwelcome\` — Lihat welcome\n` +
        `• \`!setbye [teks]\` — Set pesan bye\n` +
        `• \`!delbye\` — Hapus bye\n` +
        `• \`!cekbye\` — Lihat bye\n\n` +
        `_Ketik \`!menuall\` untuk kembali_ 🔙`
      );
    }

    // ── MENUISLAM ─────────────────────────────────────────────
    if (cmd === "menuislam") {
      return reply(
        `╔══════════════════════════╗\n` +
        `║   ☪️  MENU ISLAMI   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `• \`!quran [surah] [ayat]\` — Baca Al-Quran\n` +
        `• \`!tafsir [surah:ayat]\` — Tafsir ayat\n` +
        `• \`!hadis\` — Hadis random\n` +
        `• \`!doa\` — Doa harian\n` +
        `• \`!asmaul [1-99]\` — Asmaul Husna\n` +
        `• \`!hijriah\` — Kalender hijriah\n` +
        `• \`!sholat [kota]\` — Jadwal sholat\n` +
        `• \`!zakat [penghasilan]\` — Kalkulator zakat\n` +
        `• \`!namaislami [l/p]\` — Nama islami\n` +
        `• \`!kalimatbaik\` — Kata bijak Islami\n` +
        `• \`!islamicname [l/p]\` — Nama islami (alias: !namaislami)\n` +
        `• \`!islamicquote\` — Kutipan Islami\n` +
        `• \`!jadwalsholat [kota]\` — Jadwal sholat (alias: !sholat)\n` +
        `• \`!kalenderislam\` — Kalender Islam (alias: !hijriah)\n` +
        `• \`!asmaul [1-99]\` — Asmaul Husna (alias: !asmaulhusna)\n` +
        `• \`!hadis\` — Hadis random (alias: !hadith)\n\n` +
        `_Ketik \`!menuall\` untuk kembali_ 🔙`
      );
    }

    // ── MENUCATATAN ───────────────────────────────────────────
    if (cmd === "menucatatan") {
      return reply(
        `╔══════════════════════════╗\n` +
        `║   💾  MENU CATATAN   ║\n` +
        `╚══════════════════════════╝\n\n` +
        `📝 *Catatan:*\n` +
        `• \`!save [key] [value]\` — Simpan catatan\n` +
        `• \`!get [key]\` — Ambil catatan\n` +
        `• \`!del [key]\` — Hapus catatan\n` +
        `• \`!list\` — Lihat semua catatan\n\n` +
        `✅ *Todo:*\n` +
        `• \`!todo [teks]\` — Tambah todo\n` +
        `• \`!todos\` — Lihat semua todo\n` +
        `• \`!donetodo [no]\` — Tandai selesai\n` +
        `• \`!deltodo [no]\` — Hapus todo\n\n` +
        `💰 *Hutang:*\n` +
        `• \`!hutang [nama|jumlah|ket]\` — Catat hutang\n` +
        `• \`!hutang\` — Lihat daftar hutang\n` +
        `• \`!bayarhutang [no]\` — Hapus hutang lunas\n\n` +
        `📌 *Pesan Tersimpan:*\n` +
        `• \`!simpan [teks]\` — Simpan pesan penting\n` +
        `• \`!lihatpesan\` — Lihat semua pesan tersimpan\n` +
        `• \`!hapuspesan [no]\` — Hapus pesan tersimpan\n\n` +
        `📅 *Jadwal:*\n` +
        `• \`!jadwal [nama|hari|jam]\` — Tambah jadwal\n` +
        `• \`!listshedule\` — Lihat jadwal\n\n` +
        `🛒 *Belanja:*\n` +
        `• \`!belanja [item,item]\` — Daftar belanja\n` +
        `• \`!belanja bersih\` — Kosongkan daftar\n\n` +
        `📋 *Lainnya:*\n` +
        `• \`!biodata [nama|usia|hobi|asal]\` — Simpan biodata\n` +
        `• \`!cekbio\` — Lihat biodata\n` +
        `• \`!poll [pertanyaan|op1|op2]\` — Buat polling\n` +
        `• \`!vote [id] [no]\` — Vote polling\n` +
        `• \`!remind [menit] [pesan]\` — Pengingat\n\n` +
        `_Ketik \`!menuall\` untuk kembali_ 🔙`
      );
    }

    // ============================================================
    // 30 FITUR BARU
    // ============================================================

    // ── N1. KALKULATOR PERSEN ─────────────────────────────────
    if (cmd === "persen") {
      const a = parseFloat(args[1]), b = parseFloat(args[2]);
      if (isNaN(a) || isNaN(b)) return reply("⚠️ Contoh: `!persen 20 500` (20% dari 500)");
      const hasil = (a / 100) * b;
      return reply(`🔢 *Kalkulator Persen*\n\n${a}% dari ${b} = *${hasil}*\n\nDari sisi lain:\n${b} adalah ${((b/a)*100).toFixed(2)}% dari ${a}`);
    }

    // ── N2. KONVERSI MATA UANG ────────────────────────────────
    if (cmd === "convert" || cmd === "konversi") {
      const [, jumlah, dari, ke] = args;
      if (!jumlah || !dari || !ke) return reply("⚠️ Contoh: `!convert 100 USD IDR`");
      try {
        const data = await fetchJSON(`https://open.er-api.com/v6/latest/${dari.toUpperCase()}`);
        const rate = data.rates?.[ke.toUpperCase()];
        if (!rate) return reply("❌ Kode mata uang tidak valid.");
        return reply(`💱 *Konversi Mata Uang*\n\n${jumlah} ${dari.toUpperCase()} = *${(parseFloat(jumlah) * rate).toFixed(2)} ${ke.toUpperCase()}*`);
      } catch {
        return reply("❌ Gagal konversi. Coba lagi nanti.");
      }
    }

    // ── N3. CEK HARI ──────────────────────────────────────────
    if (cmd === "cekhari") {
      if (!text) return reply("⚠️ Contoh: `!cekhari 17/08/1945`");
      const [dd, mm, yyyy] = text.split("/");
      if (!dd || !mm || !yyyy) return reply("⚠️ Format: dd/mm/yyyy");
      const tgl = new Date(`${yyyy}-${mm}-${dd}`);
      if (isNaN(tgl)) return reply("❌ Tanggal tidak valid.");
      const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      return reply(`📅 *Cek Nama Hari*\n\nTanggal : ${dd}/${mm}/${yyyy}\nHari    : *${hariNama[tgl.getDay()]}*`);
    }

    // ── N4. HITUNG KATA ───────────────────────────────────────
    if (cmd === "hitungkata") {
      if (!text) return reply("⚠️ Contoh: `!hitungkata Halo dunia ini bot`");
      const kata = text.trim().split(/\s+/);
      const karakter = text.length;
      const tanpaSpasi = text.replace(/\s/g, "").length;
      return reply(`📊 *Hitung Kata*\n\nJumlah kata      : *${kata.length}*\nJumlah karakter  : *${karakter}*\nTanpa spasi      : *${tanpaSpasi}*`);
    }

    // ── N5. PILIH ACAK ────────────────────────────────────────
    if (cmd === "pilih") {
      if (!text) return reply("⚠️ Contoh: `!pilih nasi|mie|soto`");
      const pilihan = text.split("|").map(s => s.trim()).filter(Boolean);
      if (pilihan.length < 2) return reply("⚠️ Minimal 2 pilihan, pisahkan dengan |");
      const hasil = pilihan[Math.floor(Math.random() * pilihan.length)];
      return reply(`🎯 *Pilih Acak*\n\nPilihan: ${pilihan.join(", ")}\n\nHasil: *${hasil}* ✅`);
    }

    // ── N6. HITUNG LUAS ───────────────────────────────────────
    if (cmd === "luas") {
      const bentuk = (args[1] || "").toLowerCase();
      if (!bentuk) return reply("⚠️ Contoh:\n`!luas persegi 10`\n`!luas persegipanjang 10 5`\n`!luas lingkaran 7`\n`!luas segitiga 10 5`");
      if (bentuk === "persegi") {
        const s = parseFloat(args[2]);
        if (isNaN(s)) return reply("⚠️ `!luas persegi [sisi]`");
        return reply(`📐 Luas persegi (s=${s}) = *${s*s}*`);
      }
      if (bentuk === "persegipanjang") {
        const p = parseFloat(args[2]), l = parseFloat(args[3]);
        if (isNaN(p)||isNaN(l)) return reply("⚠️ `!luas persegipanjang [p] [l]`");
        return reply(`📐 Luas persegi panjang (${p}×${l}) = *${p*l}*`);
      }
      if (bentuk === "lingkaran") {
        const r = parseFloat(args[2]);
        if (isNaN(r)) return reply("⚠️ `!luas lingkaran [jari-jari]`");
        return reply(`📐 Luas lingkaran (r=${r}) = *${(Math.PI*r*r).toFixed(4)}*`);
      }
      if (bentuk === "segitiga") {
        const a = parseFloat(args[2]), t = parseFloat(args[3]);
        if (isNaN(a)||isNaN(t)) return reply("⚠️ `!luas segitiga [alas] [tinggi]`");
        return reply(`📐 Luas segitiga (a=${a}, t=${t}) = *${0.5*a*t}*`);
      }
      return reply("⚠️ Bentuk: persegi, persegipanjang, lingkaran, segitiga");
    }

    // ── N7. PALINDROM CEK ─────────────────────────────────────
    if (cmd === "palindrom") {
      if (!text) return reply("⚠️ Contoh: `!palindrom katak`");
      const clean = text.toLowerCase().replace(/\s/g, "");
      const balik = clean.split("").reverse().join("");
      const isPalin = clean === balik;
      return reply(`🔁 *Cek Palindrom*\n\nKata: *${text}*\nHasil: ${isPalin ? "✅ *PALINDROM!*" : "❌ *Bukan palindrom*"}`);
    }

    // ── N8. HITUNG UMUR ───────────────────────────────────────
    if (cmd === "umur") {
      if (!text) return reply("⚠️ Contoh: `!umur 17/08/1990`");
      const [dd, mm, yyyy] = text.split("/");
      if (!dd||!mm||!yyyy) return reply("⚠️ Format: dd/mm/yyyy");
      const lahir = new Date(`${yyyy}-${mm}-${dd}`);
      if (isNaN(lahir)) return reply("❌ Tanggal tidak valid.");
      const now = new Date();
      let umur = now.getFullYear() - lahir.getFullYear();
      if (now.getMonth() < lahir.getMonth() || (now.getMonth() === lahir.getMonth() && now.getDate() < lahir.getDate())) umur--;
      const hariLahir = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][lahir.getDay()];
      return reply(`🎂 *Hitung Umur*\n\nTanggal Lahir : ${dd}/${mm}/${yyyy} (${hariLahir})\nUmur Sekarang : *${umur} tahun*`);
    }

    // ── N9. KALKULATOR SCIENTIFIC ─────────────────────────────
    if (cmd === "math") {
      if (!text) return reply("⚠️ Contoh: `!math sqrt(144)` atau `!math sin(90)`");
      try {
        const expr = text
          .replace(/sqrt\(([^)]+)\)/g, (_, n) => Math.sqrt(parseFloat(n)))
          .replace(/sin\(([^)]+)\)/g, (_, n) => Math.sin(parseFloat(n) * Math.PI / 180))
          .replace(/cos\(([^)]+)\)/g, (_, n) => Math.cos(parseFloat(n) * Math.PI / 180))
          .replace(/tan\(([^)]+)\)/g, (_, n) => Math.tan(parseFloat(n) * Math.PI / 180))
          .replace(/log\(([^)]+)\)/g, (_, n) => Math.log10(parseFloat(n)))
          .replace(/pi/gi, Math.PI)
          .replace(/[^0-9+\-*/().%\s]/g, "");
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${expr})`)();
        return reply(`🔬 *Kalkulator Scientific*\n\n${text} = *${result}*`);
      } catch {
        return reply("❌ Ekspresi tidak valid.");
      }
    }

    // ── N10. KONVERSI KG KE LBS ───────────────────────────────
    if (cmd === "kgkelbs") {
      const kg = parseFloat(args[1]);
      if (isNaN(kg)) return reply("⚠️ Contoh: `!kgkelbs 70`");
      return reply(`⚖️ *Konversi Berat*\n\n${kg} kg = *${(kg * 2.20462).toFixed(3)} lbs*\n${kg} kg = *${(kg * 1000).toFixed(0)} gram*`);
    }

    // ── N11. KONVERSI CM KE KAKI ──────────────────────────────
    if (cmd === "cmkaki") {
      const cm = parseFloat(args[1]);
      if (isNaN(cm)) return reply("⚠️ Contoh: `!cmkaki 170`");
      const kaki = Math.floor(cm / 30.48);
      const inci = ((cm / 30.48 - kaki) * 12).toFixed(1);
      return reply(`📏 *Konversi Panjang*\n\n${cm} cm = *${kaki} kaki ${inci} inci*\n${cm} cm = *${(cm/100).toFixed(2)} meter*`);
    }

    // ── N12. KONVERSI CELCIUS ─────────────────────────────────
    if (cmd === "celcius") {
      const c = parseFloat(args[1]);
      if (isNaN(c)) return reply("⚠️ Contoh: `!celcius 100`");
      const f = (c * 9/5) + 32;
      const k = c + 273.15;
      return reply(`🌡️ *Konversi Suhu*\n\n${c}°C =\n• *${f.toFixed(2)}°F*\n• *${k.toFixed(2)} K*`);
    }

    // ── N13. TIMEZONE DUNIA ───────────────────────────────────
    if (cmd === "timezone") {
      const zones = [
        { kota: "Jakarta", tz: "Asia/Jakarta" },
        { kota: "Tokyo", tz: "Asia/Tokyo" },
        { kota: "London", tz: "Europe/London" },
        { kota: "New York", tz: "America/New_York" },
        { kota: "Sydney", tz: "Australia/Sydney" },
        { kota: "Dubai", tz: "Asia/Dubai" },
        { kota: "Paris", tz: "Europe/Paris" },
      ];
      let out = `🌍 *Waktu Dunia*\n\n`;
      zones.forEach(z => {
        const t = new Date().toLocaleString("id-ID", { timeZone: z.tz, hour:"2-digit", minute:"2-digit" });
        out += `🏙️ ${z.kota.padEnd(10)} : *${t}*\n`;
      });
      return reply(out);
    }

    // ── N14. SPEEDTEST BOT ────────────────────────────────────
    if (cmd === "speedtest") {
      const start = Date.now();
      try {
        await fetchJSON("https://api64.ipify.org?format=json");
        const ping = Date.now() - start;
        const mem = process.memoryUsage();
        return reply(
          `⚡ *Speedtest Bot*\n\n` +
          `🏓 Ping     : ${ping}ms\n` +
          `💾 RAM Bot  : ${formatBytes(mem.heapUsed)}\n` +
          `⏱️ Uptime   : ${formatUptime(Math.floor((Date.now() - botStats.startTime) / 1000))}\n` +
          `🟢 Status   : Online`
        );
      } catch {
        return reply("❌ Gagal cek speedtest.");
      }
    }

    // ── N15. SYSINFO (OWNER) ──────────────────────────────────
    if (cmd === "sysinfo") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const mem = process.memoryUsage();
      const cpus = os.cpus();
      return reply(
        `🖥️ *System Info*\n\n` +
        `OS       : ${os.type()} ${os.release()}\n` +
        `Platform : ${os.platform()} (${os.arch()})\n` +
        `CPU      : ${cpus[0]?.model || "?"} (${cpus.length} core)\n` +
        `RAM OS   : ${formatBytes(os.totalmem())}\n` +
        `RAM Free : ${formatBytes(os.freemem())}\n` +
        `RAM Bot  : ${formatBytes(mem.heapUsed)}\n` +
        `Node.js  : ${process.version}\n` +
        `Uptime   : ${formatUptime(process.uptime())}`
      );
    }

    // ── N16. TEKS KE HURUF KAPITAL SEMUA ─────────────────────
    if (cmd === "kapital") {
      if (!text) return reply("⚠️ Contoh: `!kapital halo dunia`");
      return reply(text.toUpperCase());
    }

    // ── N17. BALIK KATA (PER KATA) ────────────────────────────
    if (cmd === "balikkata") {
      if (!text) return reply("⚠️ Contoh: `!balikkata halo dunia bot`");
      const balik = text.split(" ").reverse().join(" ");
      return reply(`🔄 *Balik Urutan Kata*\n\nAsli  : ${text}\nBalik : *${balik}*`);
    }

    // ── N18. KAMUS INDONESIA-INGGRIS ──────────────────────────
    if (cmd === "kamus") {
      if (!text) return reply("⚠️ Contoh: `!kamus happy`");
      try {
        const data = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
        const entry = data[0];
        let out = `📖 *Kamus: ${entry.word}*\n\n`;
        entry.meanings.slice(0, 2).forEach(m => {
          out += `*${m.partOfSpeech}*\n`;
          m.definitions.slice(0, 2).forEach((d, i) => { out += `${i+1}. ${d.definition}\n`; });
          out += "\n";
        });
        return reply(out.trim());
      } catch {
        return reply(`❌ Kata "${text}" tidak ditemukan di kamus.`);
      }
    }

    // ── N19. SINONIM ──────────────────────────────────────────
    if (cmd === "sinonim") {
      if (!text) return reply("⚠️ Contoh: `!sinonim happy`");
      try {
        const data = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
        const sinonim = data[0].meanings.flatMap(m => m.synonyms).slice(0, 10);
        if (!sinonim.length) return reply(`❌ Tidak ada sinonim untuk "${text}".`);
        return reply(`📚 *Sinonim "${text}"*\n\n${sinonim.join(", ")}`);
      } catch {
        return reply("❌ Gagal cari sinonim.");
      }
    }

    // ── N20. CEK ZODIAK ───────────────────────────────────────
    if (cmd === "cekzodiak") {
      if (!text) return reply("⚠️ Contoh: `!cekzodiak 15/06`");
      const [dd, mm] = text.split("/").map(Number);
      if (!dd||!mm) return reply("⚠️ Format: dd/mm");
      let zodiak = "";
      if((mm===3&&dd>=21)||(mm===4&&dd<=19)) zodiak="♈ Aries";
      else if((mm===4&&dd>=20)||(mm===5&&dd<=20)) zodiak="♉ Taurus";
      else if((mm===5&&dd>=21)||(mm===6&&dd<=20)) zodiak="♊ Gemini";
      else if((mm===6&&dd>=21)||(mm===7&&dd<=22)) zodiak="♋ Cancer";
      else if((mm===7&&dd>=23)||(mm===8&&dd<=22)) zodiak="♌ Leo";
      else if((mm===8&&dd>=23)||(mm===9&&dd<=22)) zodiak="♍ Virgo";
      else if((mm===9&&dd>=23)||(mm===10&&dd<=22)) zodiak="♎ Libra";
      else if((mm===10&&dd>=23)||(mm===11&&dd<=21)) zodiak="♏ Scorpio";
      else if((mm===11&&dd>=22)||(mm===12&&dd<=21)) zodiak="♐ Sagittarius";
      else if((mm===12&&dd>=22)||(mm===1&&dd<=19)) zodiak="♑ Capricorn";
      else if((mm===1&&dd>=20)||(mm===2&&dd<=18)) zodiak="♒ Aquarius";
      else zodiak="♓ Pisces";
      return reply(`⭐ *Zodiak untuk ${dd}/${mm}*\n\n${zodiak}`);
    }

    // ── N21. KATA MUTIARA ─────────────────────────────────────
    if (cmd === "mutiara") {
      const mutiara = [
        "Ilmu tanpa amal seperti pohon tanpa buah.",
        "Kesabaran adalah kunci dari segala keberhasilan.",
        "Orang yang tidak pernah membuat kesalahan adalah orang yang tidak pernah mencoba sesuatu yang baru.",
        "Hidup bukan tentang menemukan diri sendiri, tapi tentang menciptakan diri sendiri.",
        "Jangan takut bermimpi besar, tapi takutlah tidak berani mewujudkannya.",
        "Setiap hari adalah kesempatan baru untuk menjadi lebih baik.",
        "Sukses bukan kunci kebahagiaan, kebahagiaanlah kunci sukses.",
        "Jika kamu bisa bermimpi, kamu bisa melakukannya.",
      ];
      return reply(`💎 *Kata Mutiara*\n\n_"${mutiara[Math.floor(Math.random() * mutiara.length)]}"_`);
    }

    // ── N22. PANTUN RANDOM ────────────────────────────────────
    if (cmd === "pantun") {
      const pantun = [
        "Buah mangga buah pepaya,\nDimakan bersama nasi putih.\nBelajar rajin setiap harinya,\nAgar ilmu makin meninggi.",
        "Pergi ke pasar beli ketupat,\nJangan lupa beli terasi.\nRaih cita-cita dengan semangat,\nPasti berhasil suatu hari nanti.",
        "Burung merpati terbang tinggi,\nHinggap di dahan pohon jambu.\nJika hati sudah bersih murni,\nRezeki datang tanpa kamu tahu.",
        "Jalan-jalan ke kota Bandung,\nJangan lupa beli kue rangi.\nKalau kamu rajin dan tekun,\nPasti sukses di kemudian hari.",
      ];
      return reply(`🎭 *Pantun*\n\n${pantun[Math.floor(Math.random() * pantun.length)]}`);
    }

    // ── N23. TEKA-TEKI ────────────────────────────────────────
    if (cmd === "tts") {
      const tts = [
        { q: "Semakin diisi semakin ringan, apakah itu?", a: "Balon" },
        { q: "Ada kepala tidak ada rambut, ada ekor tidak ada badan. Apakah itu?", a: "Koin" },
        { q: "Makin tua makin muda, apakah itu?", a: "Lilin" },
        { q: "Apa yang bisa berjalan tapi tidak punya kaki?", a: "Waktu" },
        { q: "Semakin banyak kamu ambil, semakin besar ia menjadi. Apakah itu?", a: "Lubang" },
        { q: "Apa yang selalu di depan kamu tapi tidak bisa kamu lihat?", a: "Masa depan" },
      ];
      const soal = tts[Math.floor(Math.random() * tts.length)];
      const db = loadDB();
      if (!db._tts) db._tts = {};
      db._tts[from] = soal.a;
      saveDB(db);
      return reply(`🧩 *Teka-Teki*\n\n❓ ${soal.q}\n\n_Jawab dengan \`!jawabtts [jawaban]\`_`);
    }

    if (cmd === "jawabtts") {
      const db = loadDB();
      const jawaban = db._tts?.[from];
      if (!jawaban) return reply("⚠️ Belum ada teka-teki. Ketik `!tts` dulu.");
      delete db._tts[from];
      saveDB(db);
      const benar = text.toLowerCase().trim() === jawaban.toLowerCase();
      return reply(benar ? `✅ *BENAR!* Jawabannya memang *${jawaban}*! 🎉` : `❌ *Salah!* Jawabannya adalah *${jawaban}*`);
    }

    // ── N24. RAMALAN KARIR ────────────────────────────────────
    if (cmd === "karir") {
      const ramalan = [
        "🌟 Karirmu sedang menanjak! Tetap fokus dan jangan mudah menyerah.",
        "💼 Ada peluang besar di depanmu. Siapkan dirimu dengan baik.",
        "📈 Kerja kerasmu akan segera terbayar. Bersabarlah sedikit lagi.",
        "🤝 Networking adalah kunci suksesmu saat ini. Perbanyak koneksi.",
        "📚 Tingkatkan skill-mu. Belajar hal baru akan membuka banyak pintu.",
        "⚠️ Hati-hati dengan keputusan besar minggu ini di pekerjaan.",
      ];
      return reply(`💼 *Ramalan Karir Hari Ini*\n\n${ramalan[Math.floor(Math.random() * ramalan.length)]}\n\n_${getDateTime()} WIB_`);
    }

    // ── N25. RAMALAN CINTA ────────────────────────────────────
    if (cmd === "cinta") {
      const ramalan = [
        "💕 Seseorang diam-diam menyukaimu. Buka matamu lebih lebar!",
        "💔 Butuh waktu untuk menyembuhkan luka. Sabar ya!",
        "💑 Hubunganmu akan semakin erat. Jaga komunikasi dengan baik.",
        "🌹 Siap-siap bertemu seseorang yang istimewa dalam waktu dekat.",
        "💬 Komunikasi adalah kunci hubunganmu saat ini.",
        "❤️ Cintamu akan bersambut. Jangan takut untuk mengungkapkannya.",
      ];
      return reply(`💕 *Ramalan Cinta Hari Ini*\n\n${ramalan[Math.floor(Math.random() * ramalan.length)]}\n\n_${getDateTime()} WIB_`);
    }

    // ── N26. BIODATA ──────────────────────────────────────────
    if (cmd === "biodata") {
      const parts = text.split("|").map(s => s.trim());
      if (parts.length < 4) return reply("⚠️ Contoh: `!biodata Andi|20|Gaming|Jakarta`\nFormat: nama|usia|hobi|asal");
      const [nama, usia, hobi, asal] = parts;
      const db = loadDB();
      const user = getNum(sender);
      if (!db[user]) db[user] = {};
      db[user]._biodata = { nama, usia, hobi, asal };
      saveDB(db);
      return reply(`✅ *Biodata Tersimpan!*\n\n👤 Nama : ${nama}\n🎂 Usia : ${usia} tahun\n🎮 Hobi : ${hobi}\n📍 Asal : ${asal}`);
    }

    if (cmd === "cekbio" || cmd === "cekbiodata") {
      const db = loadDB();
      const user = getNum(sender);
      const bio = db[user]?._biodata;
      if (!bio) return reply("❌ Belum ada biodata. Gunakan `!biodata nama|usia|hobi|asal`");
      return reply(`👤 *Biodata Kamu*\n\nNama : ${bio.nama}\nUsia : ${bio.usia} tahun\nHobi : ${bio.hobi}\nAsal : ${bio.asal}`);
    }

    // ── N27. REMIND / PENGINGAT ───────────────────────────────
    if (cmd === "remind" || cmd === "pengingat") {
      const menit = parseInt(args[1]);
      const pesan = args.slice(2).join(" ");
      if (isNaN(menit) || !pesan) return reply("⚠️ Contoh: `!remind 5 Minum obat`");
      if (menit < 1 || menit > 1440) return reply("⚠️ Waktu antara 1–1440 menit.");
      reply(`⏰ Pengingat diset!\n\nPesan : *${pesan}*\nWaktu : ${menit} menit lagi`);
      setTimeout(async () => {
        try {
          await sock.sendMessage(from, {
            text: `⏰ *PENGINGAT!*\n\n📌 ${pesan}\n\n_Diset ${menit} menit yang lalu_`,
          }, { quoted: msg });
        } catch (_) {}
      }, menit * 60 * 1000);
      return;
    }

    // ── N28. JADWAL SHOLAT ────────────────────────────────────
    if (cmd === "sholat") {
      if (!text) return reply("⚠️ Contoh: `!sholat Jakarta`");
      try {
        const data = await fetchJSON(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(text)}&country=Indonesia&method=11`);
        const t = data.data.timings;
        return reply(
          `🕌 *Jadwal Sholat - ${text}*\n\n` +
          `🌅 Subuh   : ${t.Fajr}\n` +
          `☀️ Dzuhur  : ${t.Dhuhr}\n` +
          `🌤️ Ashar   : ${t.Asr}\n` +
          `🌇 Maghrib : ${t.Maghrib}\n` +
          `🌙 Isya    : ${t.Isha}\n\n` +
          `📅 ${getDateTime()} WIB`
        );
      } catch {
        return reply("❌ Gagal ambil jadwal sholat. Pastikan nama kota benar.");
      }
    }

    // ── N29. INFO NEGARA ──────────────────────────────────────
    if (cmd === "negara") {
      if (!text) return reply("⚠️ Contoh: `!negara Japan`");
      try {
        const data = await fetchJSON(`https://restcountries.com/v3.1/name/${encodeURIComponent(text)}`);
        const n = data[0];
        const bahasa = Object.values(n.languages || {}).join(", ");
        const matauang = Object.values(n.currencies || {}).map(c => `${c.name} (${c.symbol})`).join(", ");
        return reply(
          `🌍 *Info Negara: ${n.name.common}*\n\n` +
          `🏳️ Nama Resmi : ${n.name.official}\n` +
          `🏙️ Ibu Kota   : ${Object.values(n.capital||{})[0] || "-"}\n` +
          `🌏 Benua      : ${n.region}\n` +
          `👥 Populasi   : ${n.population?.toLocaleString()}\n` +
          `🗣️ Bahasa     : ${bahasa}\n` +
          `💰 Mata Uang  : ${matauang}\n` +
          `📞 Kode Tlp   : +${n.idd?.root?.replace("+","")}${n.idd?.suffixes?.[0] || ""}`
        );
      } catch {
        return reply("❌ Negara tidak ditemukan.");
      }
    }

    // ── N30. RESEP MASAKAN ────────────────────────────────────
    if (cmd === "resep") {
      if (!text) return reply("⚠️ Contoh: `!resep chicken`");
      try {
        const data = await fetchJSON(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(text)}`);
        const meal = data.meals?.[0];
        if (!meal) return reply(`❌ Resep "${text}" tidak ditemukan.`);
        const bahan = [];
        for (let i = 1; i <= 10; i++) {
          const b = meal[`strIngredient${i}`];
          const m = meal[`strMeasure${i}`];
          if (b && b.trim()) bahan.push(`• ${m?.trim()} ${b}`);
        }
        return reply(
          `🍳 *Resep: ${meal.strMeal}*\n\n` +
          `🌍 Kategori : ${meal.strCategory}\n` +
          `🏳️ Asal     : ${meal.strArea}\n\n` +
          `*Bahan-bahan:*\n${bahan.join("\n")}\n\n` +
          `*Instruksi:*\n${meal.strInstructions?.slice(0, 500)}...`
        );
      } catch {
        return reply("❌ Gagal ambil resep.");
      }
    }

    // ============================================================
    // 35 FITUR BARU TAMBAHAN
    // ============================================================

    // ── X1. PRAKIRAAN CUACA 3 HARI ───────────────────────────
    if (cmd === "cuacaminggu") {
      if (!text) return reply("⚠️ Contoh: `!cuacaminggu Surabaya`");
      try {
        const data = await fetchJSON(`https://wttr.in/${encodeURIComponent(text)}?format=j1`);
        const weather = data.weather;
        let out = `🌤️ *Prakiraan Cuaca 3 Hari - ${text}*\n\n`;
        const hari = ["Hari Ini", "Besok", "Lusa"];
        weather.slice(0, 3).forEach((w, i) => {
          out += `📅 *${hari[i]}* (${w.date})\n`;
          out += `🌡️ ${w.mintempC}°C – ${w.maxtempC}°C\n`;
          out += `💧 ${w.hourly[4]?.humidity || "-"}% kelembaban\n`;
          out += `☁️ ${w.hourly[4]?.weatherDesc?.[0]?.value || "-"}\n\n`;
        });
        return reply(out.trim());
      } catch {
        return reply("❌ Gagal ambil prakiraan cuaca.");
      }
    }

    // ── X2. CEK KODE POS ─────────────────────────────────────
    if (cmd === "kodepos") {
      if (!text) return reply("⚠️ Contoh: `!kodepos Bandung`");
      try {
        const data = await fetchJSON(`https://kodepos.vercel.app/search/?q=${encodeURIComponent(text)}`);
        if (!data.data || data.data.length === 0) return reply(`❌ Kode pos untuk "${text}" tidak ditemukan.`);
        const items = data.data.slice(0, 5);
        let out = `📮 *Kode Pos - ${text}*\n\n`;
        items.forEach(k => {
          out += `📍 ${k.kelurahan}, ${k.kecamatan}\n   ${k.kabupaten}, ${k.provinsi}\n   📬 Kode Pos: *${k.kodepos}*\n\n`;
        });
        return reply(out.trim());
      } catch {
        return reply("❌ Gagal ambil kode pos.");
      }
    }

    // ── X3. HARGA SAHAM ───────────────────────────────────────
    if (cmd === "saham") {
      const kode = (args[1] || "BBCA").toUpperCase();
      try {
        const data = await fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${kode}.JK?interval=1d&range=2d`);
        const result = data.chart?.result?.[0];
        if (!result) return reply(`❌ Saham *${kode}* tidak ditemukan.`);
        const meta = result.meta;
        const harga = meta.regularMarketPrice;
        const prev = meta.previousClose;
        const selisih = harga - prev;
        const persen = ((selisih / prev) * 100).toFixed(2);
        const tren = selisih >= 0 ? "📈" : "📉";
        return reply(
          `${tren} *Saham ${kode} (IDX)*\n\n` +
          `💵 Harga   : Rp ${harga?.toLocaleString("id-ID")}\n` +
          `🔙 Kemarin : Rp ${prev?.toLocaleString("id-ID")}\n` +
          `📊 Selisih : ${selisih >= 0 ? "+" : ""}${selisih?.toFixed(0)} (${persen}%)\n` +
          `🕐 Update  : ${getDateTime()} WIB`
        );
      } catch {
        return reply(`❌ Gagal ambil harga saham *${kode}*.\nPastikan kode saham benar. Contoh: BBCA, TLKM, GOTO`);
      }
    }

    // ── X4. TAFSIR AL-QURAN ───────────────────────────────────
    if (cmd === "tafsir") {
      if (!text) return reply("⚠️ Contoh: `!tafsir 2:255`");
      const [surah, ayat] = text.split(":").map(Number);
      if (!surah || !ayat) return reply("⚠️ Format: `!tafsir surah:ayat` — Contoh: `!tafsir 2:255`");
      try {
        const data = await fetchJSON(`https://api.alquran.cloud/v1/ayah/${surah}:${ayat}/id.indonesian`);
        const d = data.data;
        return reply(
          `📖 *Tafsir Quran - ${d.surah.englishName} (${d.surah.name}) Ayat ${ayat}*\n\n` +
          `_${d.text}_\n\n` +
          `📌 Surah ke-${surah}, Juz ${d.juz}, Halaman ${d.page}`
        );
      } catch {
        return reply("❌ Gagal ambil tafsir. Contoh: `!tafsir 2:255`");
      }
    }

    // ── X5. KALIMAT BIJAK ISLAMI ──────────────────────────────
    if (cmd === "kalimatbaik" || cmd === "islamicquote") {
      const quotes = [
        "Sesungguhnya Allah tidak melihat kepada rupa dan harta kalian, tetapi Dia melihat kepada hati dan amal kalian. (HR. Muslim)",
        "Barangsiapa yang bertakwa kepada Allah, niscaya Dia akan mengadakan baginya jalan keluar. (QS. At-Thalaq: 2)",
        "Dan barangsiapa bersyukur, maka sesungguhnya ia bersyukur untuk dirinya sendiri. (QS. Luqman: 12)",
        "Sesungguhnya bersama kesulitan ada kemudahan. (QS. Al-Insyirah: 6)",
        "Cukuplah Allah menjadi Penolong kami, dan Allah adalah sebaik-baik Pelindung. (QS. Ali Imran: 173)",
        "Dan mohonlah pertolongan dengan sabar dan sholat. (QS. Al-Baqarah: 45)",
        "Allah tidak membebani seseorang melainkan sesuai dengan kesanggupannya. (QS. Al-Baqarah: 286)",
      ];
      return reply(`☪️ *Kata Bijak Islami*\n\n_"${quotes[Math.floor(Math.random() * quotes.length)]}"_`);
    }

    // ── X6. SIMPAN PESAN ──────────────────────────────────────
    if (cmd === "simpan") {
      if (!text) return reply("⚠️ Contoh: `!simpan Rapat jam 3 sore besok`");
      const db = loadDB();
      const user = getNum(sender);
      if (!db[user]) db[user] = {};
      if (!db[user]._pins) db[user]._pins = [];
      if (db[user]._pins.length >= 10) return reply("⚠️ Maksimal 10 pin. Hapus dulu dengan `!hapuspesan [no]`");
      db[user]._pins.push({ teks: text, tgl: new Date().toLocaleString("id-ID") });
      saveDB(db);
      return reply(`📌 *Pesan disimpan!*\n\n"${text}"\n\n_Lihat dengan \`!lihatpesan\`_`);
    }

    if (cmd === "lihatpesan") {
      const db = loadDB();
      const user = getNum(sender);
      const pins = db[user]?._pins || [];
      if (!pins.length) return reply("📭 Belum ada pesan yang disimpan.\nGunakan `!simpan [teks]` untuk menambah.");
      let out = `📌 *Pesan Tersimpan*\n\n`;
      pins.forEach((p, i) => out += `${i+1}. ${p.teks}\n   🕐 ${p.tgl}\n\n`);
      out += `_!hapuspesan [no] untuk hapus_`;
      return reply(out.trim());
    }

    if (cmd === "hapuspesan") {
      const no = parseInt(args[1]) - 1;
      const db = loadDB();
      const user = getNum(sender);
      const pins = db[user]?._pins || [];
      if (isNaN(no) || no < 0 || no >= pins.length) return reply("⚠️ Nomor tidak valid.");
      const [removed] = pins.splice(no, 1);
      saveDB(db);
      return reply(`🗑️ Pin #${no+1} dihapus:\n_"${removed.teks}"_`);
    }

    // ── X7. JADWAL RUTIN ──────────────────────────────────────
    if (cmd === "jadwal") {
      const db = loadDB();
      const user = getNum(sender);
      if (!db[user]) db[user] = {};
      if (!db[user]._jadwal) db[user]._jadwal = [];
      if (text) {
        const parts = text.split("|").map(s => s.trim());
        if (parts.length < 3) return reply("⚠️ Format: `!jadwal Nama|Hari|Jam`\nContoh: `!jadwal Rapat Tim|Senin|09:00`");
        db[user]._jadwal.push({ nama: parts[0], hari: parts[1], jam: parts[2] });
        saveDB(db);
        return reply(`📅 *Jadwal Ditambah!*\n\n📌 ${parts[0]}\n📆 ${parts[1]} jam ${parts[2]}`);
      }
      const jadwal = db[user]._jadwal;
      if (!jadwal?.length) return reply("📭 Belum ada jadwal.\nTambah: `!jadwal Nama|Hari|Jam`");
      let out = `📅 *Jadwal Rutin*\n\n`;
      jadwal.forEach((j, i) => out += `${i+1}. *${j.nama}*\n   📆 ${j.hari}, jam ${j.jam}\n`);
      return reply(out.trim());
    }

    if (cmd === "listshedule" || cmd === "listjadwal") {
      const db = loadDB();
      const user = getNum(sender);
      const jadwal = db[user]?._jadwal || [];
      if (!jadwal.length) return reply("📭 Belum ada jadwal. Gunakan `!jadwal Nama|Hari|Jam`");
      let out = `📅 *Daftar Jadwal*\n\n`;
      jadwal.forEach((j, i) => out += `${i+1}. *${j.nama}*\n   📆 ${j.hari}, ${j.jam}\n`);
      return reply(out.trim());
    }

    // ── X8. GENERATOR HASHTAG ─────────────────────────────────
    if (cmd === "hashtag" || cmd === "sunatau") {
      if (!text) return reply("⚠️ Contoh: `!hashtag pantai liburan`");
      const kata = text.split(" ").filter(Boolean);
      const tags = kata.map(k => `#${k.toLowerCase().replace(/[^a-z0-9]/g, "")}`);
      const extra = ["#Indonesia", "#lifestyle", "#explore", "#viral", "#trending", "#aesthetic", "#photography"];
      const semua = [...new Set([...tags, ...extra.slice(0, 5)])];
      return reply(`#️⃣ *Generator Hashtag*\n\n${semua.join(" ")}\n\n_${semua.length} hashtag dihasilkan_`);
    }

    // ── X9. ROULETTE ──────────────────────────────────────────
    if (cmd === "roulette") {
      const angka = Math.floor(Math.random() * 37);
      const merah = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      const warna = angka === 0 ? "🟢 Hijau" : merah.includes(angka) ? "🔴 Merah" : "⚫ Hitam";
      const ganap = angka === 0 ? "-" : angka % 2 === 0 ? "Genap" : "Ganjil";
      return reply(`🎡 *Roulette!*\n\nBola berhenti di:\n\n🔢 Angka : *${angka}*\n🎨 Warna : ${warna}\n🔢 Jenis : ${ganap}`);
    }

    // ── X10. TEBAK FILM ───────────────────────────────────────
    if (cmd === "tebakfilm") {
      const films = [
        { clue: "🦁 + 👑 + 🌍 Afrika + singa muda", jawab: "The Lion King" },
        { clue: "🕷️ + 🏙️ New York + remaja SMA", jawab: "Spider-Man" },
        { clue: "🧙 + ⚡ + 🏫 sekolah sihir", jawab: "Harry Potter" },
        { clue: "❄️ + 👸 + lagu Let It Go", jawab: "Frozen" },
        { clue: "🤖 + 🚗 + lebih dari bertemu mata", jawab: "Transformers" },
        { clue: "🦈 + 🌊 + lagu ikonik 2 nada", jawab: "Jaws" },
        { clue: "🚀 + ♾️ + beyond infinity", jawab: "Toy Story" },
        { clue: "🧟 + 🧠 + zombie apocalypse Korea", jawab: "Train to Busan" },
      ];
      const pilih = films[Math.floor(Math.random() * films.length)];
      const db = loadDB();
      if (!db._tebakfilm) db._tebakfilm = {};
      db._tebakfilm[from] = pilih.jawab;
      saveDB(db);
      return reply(`🎬 *Tebak Film!*\n\nHint: ${pilih.clue}\n\n_Jawab dengan \`!jawabfilm [judul]\`_`);
    }

    if (cmd === "jawabfilm") {
      const db = loadDB();
      const jawaban = db._tebakfilm?.[from];
      if (!jawaban) return reply("⚠️ Belum ada game. Ketik `!tebakfilm` dulu.");
      delete db._tebakfilm[from];
      saveDB(db);
      const benar = text.toLowerCase().includes(jawaban.toLowerCase()) || jawaban.toLowerCase().includes(text.toLowerCase());
      return reply(benar ? `🎉 *BENAR!* Filmnya adalah *${jawaban}*! 🏆` : `❌ *Salah!* Jawabannya adalah *${jawaban}*`);
    }

    // ── X11. NAMA LUCU ────────────────────────────────────────
    if (cmd === "namalucu") {
      const depan = ["Pak","Bu","Bang","Mas","Mbak","Kang","Neng","Abang","Om","Tante"];
      const tengah = ["Kacang","Pisang","Mangga","Kentang","Wortel","Bayam","Tempe","Tahu","Singkong","Jagung"];
      const belakang = ["Goreng","Rebus","Bakar","Kukus","Mentah","Asin","Manis","Pedas","Segar","Crispy"];
      const nama = `${depan[Math.floor(Math.random() * depan.length)]} ${tengah[Math.floor(Math.random() * tengah.length)]} ${belakang[Math.floor(Math.random() * belakang.length)]}`;
      return reply(`😂 *Nama Lucu Generator*\n\nNama kamu hari ini:\n*${nama}*`);
    }

    // ── X12. HAIKU GENERATOR ──────────────────────────────────
    if (cmd === "haikugen") {
      const tema = text || "alam";
      const haiku = [
        `Angin berhembus lembut\nMembawa aroma ${tema}\nSunyi malam tiba`,
        `Di bawah langit biru\n${tema.charAt(0).toUpperCase()+tema.slice(1)} memanggil jiwa\nDamai tak tertandingi`,
        `Embun pagi menetes\n${tema.charAt(0).toUpperCase()+tema.slice(1)} berbisik pelan\nHati pun tenang`,
      ];
      return reply(`🍃 *Haiku - Tema: ${tema}*\n\n${haiku[Math.floor(Math.random() * haiku.length)]}`);
    }

    // ── X13. AKROSTIK ─────────────────────────────────────────
    if (cmd === "akrostik") {
      if (!text) return reply("⚠️ Contoh: `!akrostik ANDI`");
      const nama = text.toUpperCase().replace(/\s+/g, "");
      if (nama.length > 15) return reply("⚠️ Maksimal 15 karakter.");
      const kataPerHuruf = {
        A:"Agung dan berwibawa",B:"Baik hati tak terkira",C:"Ceria selalu",D:"Dermawan tiada duanya",
        E:"Elegan dan anggun",F:"Fleksibel dalam segala hal",G:"Gagah berani",H:"Hangat dan ramah",
        I:"Istimewa dari segalanya",J:"Jujur dan terpercaya",K:"Kreatif dan inovatif",
        L:"Lembut nan tulus",M:"Mulia di mata semua",N:"Nyata kasih sayangnya",
        O:"Optimis menghadapi hari",P:"Pintar dan cekatan",Q:"Quickwitted dan tajam",
        R:"Rajin pantang menyerah",S:"Setia dan teguh hati",T:"Tegar menghadapi badai",
        U:"Unik dan berkarakter",V:"Visioner dan inspiratif",W:"Welas asih pada semua",
        X:"Xenial dan ramah tamah",Y:"Yakin dengan tujuan",Z:"Zestful penuh semangat"
      };
      const baris = nama.split("").map(h => `*${h}* — ${kataPerHuruf[h] || "..."}`).join("\n");
      return reply(`✨ *Akrostik: ${nama}*\n\n${baris}`);
    }

    // ── X14. KONVERSI MATA UANG LANJUTAN ─────────────────────
    if (cmd === "convert") {
      const jumlah = parseFloat(args[1]);
      const dari = (args[2] || "").toUpperCase();
      const ke = (args[3] || "IDR").toUpperCase();
      if (isNaN(jumlah) || !dari) return reply("⚠️ Contoh: `!convert 100 USD IDR`");
      try {
        const data = await fetchJSON(`https://open.er-api.com/v6/latest/${dari}`);
        const rate = data.rates?.[ke];
        if (!rate) return reply(`❌ Mata uang *${ke}* tidak ditemukan.`);
        const hasil = (jumlah * rate).toLocaleString("id-ID", { maximumFractionDigits: 2 });
        return reply(`💱 *Konversi Mata Uang*\n\n${jumlah.toLocaleString()} *${dari}*\n=\n*${hasil} ${ke}*\n\n🕐 Rate: ${rate.toFixed(4)}`);
      } catch {
        return reply("❌ Gagal konversi mata uang. Cek kode mata uang.");
      }
    }

    // ── X15. DETEKSI BAHASA ───────────────────────────────────
    if (cmd === "deteksibahasa" || cmd === "detectlang") {
      if (!text) return reply("⚠️ Contoh: `!deteksibahasa Hello World`");
      // Deteksi sederhana berdasarkan pola
      const bahasa = [];
      if (/[あ-んア-ン]/.test(text)) bahasa.push("Jepang 🇯🇵");
      if (/[가-힣]/.test(text)) bahasa.push("Korea 🇰🇷");
      if (/[一-龟]/.test(text)) bahasa.push("Cina 🇨🇳");
      if (/[ก-๙]/.test(text)) bahasa.push("Thai 🇹🇭");
      if (/\b(the|is|are|and|or|in)\b/i.test(text)) bahasa.push("Inggris 🇬🇧");
      if (/\b(yang|dan|ini|itu|dengan|di)\b/i.test(text)) bahasa.push("Indonesia 🇮🇩");
      if (/\b(le|la|les|est|et|ou)\b/i.test(text)) bahasa.push("Prancis 🇫🇷");
      if (/\b(el|la|los|es|en|de)\b/i.test(text)) bahasa.push("Spanyol 🇪🇸");
      if (/\b(der|die|das|ist|und|oder)\b/i.test(text)) bahasa.push("Jerman 🇩🇪");
      const hasil = bahasa.length > 0 ? bahasa.join(", ") : "Tidak terdeteksi";
      return reply(`🔍 *Deteksi Bahasa*\n\nTeks: "${text.slice(0, 50)}"\nKemungkinan: *${hasil}*`);
    }

    // ── X16. KALKULATOR DISKON ────────────────────────────────
    if (cmd === "diskon") {
      const harga = parseFloat((args[1] || "").replace(/\D/g, ""));
      const persen = parseFloat(args[2]);
      if (isNaN(harga) || isNaN(persen)) return reply("⚠️ Contoh: `!diskon 150000 20` (harga, persen diskon)");
      const potongan = (harga * persen) / 100;
      const hargaAkhir = harga - potongan;
      return reply(
        `🏷️ *Kalkulator Diskon*\n\n` +
        `💰 Harga Asli  : Rp ${harga.toLocaleString("id-ID")}\n` +
        `🔖 Diskon      : ${persen}% (Rp ${potongan.toLocaleString("id-ID")})\n` +
        `✅ Harga Bayar : *Rp ${hargaAkhir.toLocaleString("id-ID")}*`
      );
    }

    // ── X17. KALKULATOR CICILAN ───────────────────────────────
    if (cmd === "cicilan") {
      const harga = parseFloat((args[1] || "").replace(/\D/g, ""));
      const bulan = parseInt(args[2]);
      const bunga = parseFloat(args[3]) || 0;
      if (isNaN(harga) || isNaN(bulan)) return reply("⚠️ Contoh: `!cicilan 12000000 12 1.5` (harga, bulan, bunga%/bulan)");
      let cicilanPerBulan;
      if (bunga === 0) {
        cicilanPerBulan = harga / bulan;
      } else {
        const r = bunga / 100;
        cicilanPerBulan = (harga * r * Math.pow(1 + r, bulan)) / (Math.pow(1 + r, bulan) - 1);
      }
      const totalBayar = cicilanPerBulan * bulan;
      return reply(
        `💳 *Kalkulator Cicilan*\n\n` +
        `💰 Harga Awal    : Rp ${harga.toLocaleString("id-ID")}\n` +
        `📅 Tenor         : ${bulan} bulan\n` +
        `📊 Bunga/bulan   : ${bunga}%\n` +
        `💵 Cicilan/bulan : *Rp ${Math.ceil(cicilanPerBulan).toLocaleString("id-ID")}*\n` +
        `💸 Total Bayar   : Rp ${Math.ceil(totalBayar).toLocaleString("id-ID")}`
      );
    }

    // ── X18. KALKULATOR TIP ───────────────────────────────────
    if (cmd === "tip") {
      const tagihan = parseFloat((args[1] || "").replace(/\D/g, ""));
      const persen = parseFloat(args[2]) || 10;
      const orang = parseInt(args[3]) || 1;
      if (isNaN(tagihan)) return reply("⚠️ Contoh: `!tip 150000 15 4` (tagihan, persen tip, jumlah orang)");
      const tipTotal = (tagihan * persen) / 100;
      const totalBayar = tagihan + tipTotal;
      const perOrang = totalBayar / orang;
      return reply(
        `🍽️ *Kalkulator Tip*\n\n` +
        `🧾 Tagihan  : Rp ${tagihan.toLocaleString("id-ID")}\n` +
        `💰 Tip ${persen}%  : Rp ${tipTotal.toLocaleString("id-ID")}\n` +
        `💵 Total    : Rp ${totalBayar.toLocaleString("id-ID")}\n` +
        `👥 Per orang (${orang}): *Rp ${Math.ceil(perOrang).toLocaleString("id-ID")}*`
      );
    }

    // ── X19. INFO NOMOR HP ────────────────────────────────────
    if (cmd === "cekoperator" || cmd === "infonomor") {
      const nomor = (args[1] || text || "").replace(/[^0-9]/g, "");
      if (!nomor || nomor.length < 8) return reply("⚠️ Contoh: `!cekoperator 0812xxxxxxxx`");
      const prefix = nomor.startsWith("62") ? nomor.slice(2, 6) : nomor.slice(1, 4);
      const operators = {
        "811":"Telkomsel","812":"Telkomsel","813":"Telkomsel","821":"Telkomsel","822":"Telkomsel","823":"Telkomsel","851":"Telkomsel","852":"Telkomsel","853":"Telkomsel",
        "814":"Indosat","815":"Indosat","816":"Indosat","855":"Indosat","856":"Indosat","857":"Indosat","858":"Indosat",
        "817":"XL","818":"XL","819":"XL","859":"XL","877":"XL","878":"XL",
        "838":"Axis","831":"Axis","832":"Axis","833":"Axis",
        "881":"Smartfren","882":"Smartfren","883":"Smartfren","884":"Smartfren","885":"Smartfren","886":"Smartfren","887":"Smartfren","888":"Smartfren","889":"Smartfren",
        "895":"Three","896":"Three","897":"Three","898":"Three","899":"Three",
        "896":"Three",
      };
      const op = operators[prefix.slice(0,3)] || operators[prefix.slice(0,4)] || "Tidak diketahui";
      return reply(`📱 *Info Nomor HP*\n\nNomor    : +${nomor.startsWith("62") ? nomor : "62" + nomor.slice(1)}\nOperator : *${op}*`);
    }

    // ── X20. GENERATOR KODE OTP ───────────────────────────────
    if (cmd === "otp") {
      const panjang = parseInt(args[1]) || 6;
      if (panjang < 4 || panjang > 8) return reply("⚠️ Panjang OTP antara 4–8 digit.");
      let kode = "";
      for (let i = 0; i < panjang; i++) kode += Math.floor(Math.random() * 10);
      return reply(`🔑 *Generator Kode OTP*\n\nKode OTP (${panjang} digit):\n\`${kode}\`\n\n⚠️ _Jangan bagikan ke siapapun!_`);
    }

    // ── X21. KALKULATOR TABUNGAN ──────────────────────────────
    if (cmd === "tabungan") {
      const modal = parseFloat((args[1] || "").replace(/\D/g, ""));
      const bunga = parseFloat(args[2]) || 3.5;
      const tahun = parseInt(args[3]) || 1;
      if (isNaN(modal)) return reply("⚠️ Contoh: `!tabungan 5000000 3.5 5` (modal, bunga%/tahun, tahun)");
      const hasilBungaMajemuk = modal * Math.pow(1 + bunga/100, tahun);
      const totalBunga = hasilBungaMajemuk - modal;
      return reply(
        `🏦 *Kalkulator Tabungan*\n\n` +
        `💰 Modal Awal   : Rp ${modal.toLocaleString("id-ID")}\n` +
        `📊 Bunga/tahun  : ${bunga}%\n` +
        `📅 Jangka waktu : ${tahun} tahun\n` +
        `💵 Hasil Bunga  : Rp ${Math.round(totalBunga).toLocaleString("id-ID")}\n` +
        `✅ Total Akhir  : *Rp ${Math.round(hasilBungaMajemuk).toLocaleString("id-ID")}*`
      );
    }

    // ── X22. DAFTAR BELANJA ───────────────────────────────────
    if (cmd === "belanja") {
      const db = loadDB();
      const user = getNum(sender);
      if (!db[user]) db[user] = {};
      if (!db[user]._belanja) db[user]._belanja = [];
      if (text && !["list","lihat","bersih","clear"].includes(text.toLowerCase())) {
        const items = text.split(",").map(s => s.trim()).filter(Boolean);
        db[user]._belanja.push(...items.map(i => ({ item: i, beli: false })));
        saveDB(db);
        return reply(`🛒 *Ditambah ke daftar belanja!*\n\n${items.map(i => `✅ ${i}`).join("\n")}`);
      }
      const list = db[user]._belanja;
      if (!list?.length) return reply("📭 Daftar belanja kosong.\nTambah: `!belanja susu, roti, telur`");
      if (text?.toLowerCase() === "bersih" || text?.toLowerCase() === "clear") {
        db[user]._belanja = [];
        saveDB(db);
        return reply("🗑️ Daftar belanja dikosongkan.");
      }
      let out = `🛒 *Daftar Belanja*\n\n`;
      list.forEach((l, i) => out += `${i+1}. ${l.beli ? "✅" : "⬜"} ${l.item}\n`);
      out += `\n_!belanja bersih untuk kosongkan_`;
      return reply(out.trim());
    }

    // ── X23. GENERATOR SLOGAN ─────────────────────────────────
    if (cmd === "slogan") {
      if (!text) return reply("⚠️ Contoh: `!slogan kopi`");
      const templates = [
        `${text.charAt(0).toUpperCase()+text.slice(1)}: Satu tegukan, seribu cerita.`,
        `Tanpa ${text}, hari terasa hampa.`,
        `${text.charAt(0).toUpperCase()+text.slice(1)} — Kualitas tak pernah bohong.`,
        `Pilih yang terbaik, pilih ${text}.`,
        `${text.charAt(0).toUpperCase()+text.slice(1)}: Karena kamu layak mendapatkan yang terbaik.`,
        `Bersama ${text}, hidup lebih bermakna.`,
      ];
      const slogan = templates[Math.floor(Math.random() * templates.length)];
      return reply(`📢 *Generator Slogan*\n\nProduk: *${text}*\n\n_"${slogan}"_`);
    }

    // ── X24. INFO PROV/KAB INDONESIA ─────────────────────────
    if (cmd === "provinsi") {
      const provinsis = [
        "Aceh","Sumatera Utara","Sumatera Barat","Riau","Kepulauan Riau","Jambi","Bengkulu",
        "Sumatera Selatan","Kepulauan Bangka Belitung","Lampung","Banten","DKI Jakarta",
        "Jawa Barat","Jawa Tengah","DI Yogyakarta","Jawa Timur","Bali","Nusa Tenggara Barat",
        "Nusa Tenggara Timur","Kalimantan Barat","Kalimantan Tengah","Kalimantan Selatan",
        "Kalimantan Timur","Kalimantan Utara","Sulawesi Utara","Gorontalo","Sulawesi Tengah",
        "Sulawesi Barat","Sulawesi Selatan","Sulawesi Tenggara","Maluku","Maluku Utara",
        "Papua Barat","Papua","Papua Selatan","Papua Tengah","Papua Pegunungan","Papua Barat Daya"
      ];
      return reply(`🗺️ *Daftar Provinsi Indonesia*\n_(${provinsis.length} Provinsi)_\n\n${provinsis.map((p,i) => `${i+1}. ${p}`).join("\n")}`);
    }

    // ── X25. KUIS IBUQOTA ─────────────────────────────────────
    if (cmd === "kuisnegara") {
      const negara = [
        {negara:"Perancis",ibu:"Paris"},{negara:"Jepang",ibu:"Tokyo"},{negara:"Mesir",ibu:"Kairo"},
        {negara:"Brasil",ibu:"Brasilia"},{negara:"Kanada",ibu:"Ottawa"},{negara:"Australia",ibu:"Canberra"},
        {negara:"Rusia",ibu:"Moskow"},{negara:"India",ibu:"New Delhi"},{negara:"China",ibu:"Beijing"},
        {negara:"Argentina",ibu:"Buenos Aires"},{negara:"Thailand",ibu:"Bangkok"},{negara:"Korea Selatan",ibu:"Seoul"},
      ];
      const pilih = negara[Math.floor(Math.random() * negara.length)];
      const db = loadDB();
      if (!db._kuisnegara) db._kuisnegara = {};
      db._kuisnegara[from] = pilih.ibu;
      saveDB(db);
      return reply(`🌍 *Kuis Ibu Kota*\n\nApa ibu kota dari *${pilih.negara}*?\n\n_Jawab: \`!jawabibukota [jawaban]\`_`);
    }

    if (cmd === "jawabibukota") {
      const db = loadDB();
      const jawaban = db._kuisnegara?.[from];
      if (!jawaban) return reply("⚠️ Belum ada kuis. Ketik `!kuisnegara` dulu.");
      delete db._kuisnegara[from];
      saveDB(db);
      const benar = text.toLowerCase().replace(/\s+/g,"") === jawaban.toLowerCase().replace(/\s+/g,"");
      return reply(benar ? `🎉 *BENAR!* Ibu kotanya adalah *${jawaban}*! 🏆` : `❌ *Salah!* Jawabannya adalah *${jawaban}*`);
    }

    // ── X26. COUNTDOWN HITUNG MUNDUR ─────────────────────────
    if (cmd === "hitungmundur") {
      const menit = parseInt(args[1]);
      const label = args.slice(2).join(" ") || "Timer";
      if (isNaN(menit) || menit < 1 || menit > 60) return reply("⚠️ Contoh: `!hitungmundur 5 Masak nasi` (1-60 menit)");
      reply(`⏳ *Hitung Mundur Dimulai!*\n\n⏰ Waktu: ${menit} menit\n📌 Label: ${label}\n\nBot akan mengirim notifikasi saat waktu habis.`);
      setTimeout(async () => {
        try {
          await sock.sendMessage(from, {
            text: `⏰ *TIMER HABIS!*\n\n📌 *${label}*\n\n⏱️ ${menit} menit telah berlalu!\n\n_${getDateTime()} WIB_`
          }, { quoted: msg });
        } catch (_) {}
      }, menit * 60 * 1000);
      return;
    }

    // ── X27. KALKULATOR NILAI RATA-RATA ──────────────────────
    if (cmd === "ratarata" || cmd === "average") {
      if (!text) return reply("⚠️ Contoh: `!ratarata 80 75 90 85 70`");
      const angkas = text.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      if (angkas.length === 0) return reply("❌ Masukkan angka yang valid.");
      const total = angkas.reduce((a, b) => a + b, 0);
      const rata = total / angkas.length;
      const maks = Math.max(...angkas);
      const mins = Math.min(...angkas);
      return reply(
        `📊 *Kalkulator Rata-rata*\n\n` +
        `📝 Data   : ${angkas.join(", ")}\n` +
        `🔢 Jumlah : ${angkas.length} nilai\n` +
        `➕ Total  : ${total}\n` +
        `📈 Maks   : ${maks}\n` +
        `📉 Min    : ${mins}\n` +
        `✅ Rata²  : *${rata.toFixed(2)}*`
      );
    }

    // ── X28. RAMALAN MIMPI ────────────────────────────────────
    if (cmd === "ramalanmimpi" || cmd === "arti mimpi") {
      if (!text) return reply("⚠️ Contoh: `!ramalanmimpi terbang`");
      const mimpi = {
        "terbang": "Mimpi terbang berarti kamu akan segera meraih kebebasan dan kesuksesan! 🕊️",
        "air": "Mimpi tentang air melambangkan perasaan dan emosi yang sedang mengalir dalam hidupmu. 💧",
        "ular": "Mimpi ular bisa berarti ada godaan atau musuh tersembunyi yang perlu diwaspadai. 🐍",
        "gigi": "Mimpi gigi copot sering dikaitkan dengan rasa khawatir tentang penampilan atau komunikasi. 😬",
        "uang": "Mimpi uang melambangkan rezeki dan kemakmuran yang akan datang. 💰",
        "api": "Mimpi api berarti semangat dan energi yang membara, namun hati-hati dengan amarah. 🔥",
        "hujan": "Mimpi hujan menandakan pemurnian dan permulaan baru dalam hidupmu. 🌧️",
        "kucing": "Mimpi kucing sering melambangkan intuisi dan kemandirian yang kuat. 🐱",
        "anjing": "Mimpi anjing berarti ada sahabat setia yang selalu ada untukmu. 🐶",
        "meninggal": "Mimpi meninggal sering menandakan akhir dari suatu fase dan awal baru dalam hidup. ✨",
      };
      const kata = text.toLowerCase();
      const arti = Object.keys(mimpi).find(k => kata.includes(k));
      if (arti) return reply(`🌙 *Arti Mimpi: ${text}*\n\n${mimpi[arti]}`);
      return reply(`🌙 *Arti Mimpi: ${text}*\n\nMimpi ini mengisyaratkan perubahan dan petualangan baru yang menanti. Tetaplah positif dan percaya pada prosesnya! ✨`);
    }

    // ── X29. MOTIVASI PAGI ────────────────────────────────────
    if (cmd === "motivasipagi" || cmd === "semangatpagi") {
      const motivasi = [
        "🌅 Selamat pagi! Hari baru, semangat baru! Mulailah dengan senyum dan nikmati setiap momen. Kamu bisa! 💪",
        "☀️ Pagi ini adalah hadiah. Manfaatkan sebaik mungkin. Setiap langkah kecilmu hari ini membawamu lebih dekat ke tujuan! 🎯",
        "🌸 Good morning! Ingat, kemarin sudah berlalu. Hari ini kamu bisa mulai sesuatu yang luar biasa! ✨",
        "🦅 Bangun, bersyukur, dan bergerak! Hari ini penuh peluang yang menunggu untuk kamu raih. Semangat! 🚀",
        "🌻 Pagi yang cerah untuk jiwa yang bersih. Bersihkan pikiran negatif dan isi dengan hal-hal positif! 💛",
      ];
      const jam = new Date().getHours();
      const sapaan = jam < 12 ? "pagi" : jam < 15 ? "siang" : jam < 18 ? "sore" : "malam";
      return reply(`🌅 *Motivasi Selamat ${sapaan.charAt(0).toUpperCase()+sapaan.slice(1)}!*\n\n${motivasi[Math.floor(Math.random() * motivasi.length)]}\n\n_${getDateTime()} WIB_`);
    }

    // ── X30. LIHAT SEMUA CMD ──────────────────────────────────
    if (cmd === "allcmd") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const allCmds = [
        "ping","menu","info","jam","uptime","profil","id","sysinfo","speedtest",
        "tagall","hidetag","kick","add","promote","demote","groupinfo","link","revokelink",
        "mute","unmute","listadmin","setdesc","setname","setwelcome","delwelcome","cekwelcome","setbye",
        "cuaca","cuacadetail","cuacaminggu","berita","kurs","convert","quote","jokes","wiki","crypto",
        "emas","ip","npm","shorturl","github","negara","gempa","sholat","resep","film","kamus","sinonim",
        "translate","cekwa","domain","ceknet","lirik","saham","kodepos","tafsir",
        "hitung","math","luas","bmi","kalori","persen","terbilang","roman","kgkelbs","cmkaki",
        "celcius","suhu","konversiwaktu","timezone","countdown","umur","cekhari","qr","password","random",
        "balik","balikkata","kapital","upper","lower","encode","decode","binary","debinary","hex","dehex",
        "caesar","morse","palindrom","hitungkata","pilih","ukuran","plat","kesehatan","hashtag","ratarata",
        "diskon","cicilan","tip","otp","tabungan","belanja","slogan","provinsi",
        "tebak","tebakkata","kuis","kuisumum","kuisnegara","dadu","koin","8ball","horoscope","cekzodiak",
        "fakta","meme","mutiara","pantun","puisi","cerita","tts","karir","cinta","username","acaknama",
        "bisnis","emojify","kalimat","warna","randomwarna","caption","salam","tebakfilm","roulette",
        "namalucu","haikugen","akrostik","deteksibahasa","ramalanmimpi","motivasipagi",
        "quran","hadis","doa","asmaul","namaislami","zakat","hijriah","kalimatbaik",
        "save","get","del","list","todo","todos","donetodo","deltodo","biodata","cekbio",
        "poll","vote","remind","hutang","bayarhutang","jadwal","listshedule","pin","lihatpesan","hapuspesan",
        "shell","broadcast","restart","log","setprefix","clearlog","stats","listchat","setbotname",
        "maintenance","block","unblock","listblock","allcmd","menuall"
      ];
      return reply(`📋 *Semua Perintah Bot*\n_(${allCmds.length} perintah)_\n\n\`\`\`${allCmds.map(c => config.prefix+c).join(", ")}\`\`\``);
    }

    // ── X31. LIST BLOCK (OWNER) ───────────────────────────────
    if (cmd === "listblock") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const db = loadDB();
      const blocked = db._blocked || [];
      if (!blocked.length) return reply("✅ Tidak ada user yang diblokir.");
      return reply(`🚫 *Daftar User Diblokir*\n\n${blocked.map((n,i) => `${i+1}. +${n}`).join("\n")}`);
    }

    // ── X32. CUACA DETAIL ─────────────────────────────────────
    if (cmd === "cuacadetail") {
      if (!text) return reply("⚠️ Contoh: `!cuacadetail Jakarta`");
      try {
        const url = `https://wttr.in/${encodeURIComponent(text)}?format=j1`;
        const data = await fetchJSON(url);
        const c = data.current_condition[0];
        const area = data.nearest_area[0];
        const kota = area.areaName[0].value + ", " + area.country[0].value;
        return reply(
          `🌤️ *Cuaca Detail - ${kota}*\n\n` +
          `🌡️ Suhu       : ${c.temp_C}°C (terasa ${c.FeelsLikeC}°C)\n` +
          `💧 Kelembaban : ${c.humidity}%\n` +
          `🌬️ Angin      : ${c.windspeedKmph} km/h (${c.winddir16Point})\n` +
          `👁️ Visibilitas : ${c.visibility} km\n` +
          `🌡️ Tekanan     : ${c.pressure} hPa\n` +
          `☁️ Tutupan awan: ${c.cloudcover}%\n` +
          `🌧️ Curah Hujan : ${c.precipMM} mm\n` +
          `📝 Kondisi    : ${c.weatherDesc[0].value}\n\n` +
          `🕐 ${getDateTime()} WIB`
        );
      } catch {
        return reply("❌ Gagal mengambil data cuaca detail.");
      }
    }

    // ── X33. SETBOTNAME (OWNER) ───────────────────────────────
    if (cmd === "setbotname") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      if (!text) return reply("⚠️ Contoh: `!setbotname NamaBotBaru`");
      const namaBaru = text.trim();
      config.botName = namaBaru;
      return reply(`✅ Nama bot berhasil diubah ke: *${namaBaru}*`);
    }

    // ── X34. LISTCHAT (OWNER) ─────────────────────────────────
    if (cmd === "listchat") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      try {
        const chats = await sock.groupFetchAllParticipating();
        const daftarGrup = Object.values(chats);
        if (!daftarGrup.length) return reply("📭 Bot belum bergabung di grup manapun.");
        let out = `📋 *Daftar Grup Bot*\n_(${daftarGrup.length} grup)_\n\n`;
        daftarGrup.slice(0, 20).forEach((g, i) => {
          out += `${i+1}. *${g.subject}*\n   👥 ${g.participants.length} anggota\n`;
        });
        if (daftarGrup.length > 20) out += `\n_...dan ${daftarGrup.length - 20} grup lainnya_`;
        return reply(out.trim());
      } catch {
        return reply("❌ Gagal ambil daftar grup.");
      }
    }

    // ── X35. MAINTENANCE TOGGLE (OWNER) ──────────────────────
    if (cmd === "maintenance") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const db = loadDB();
      db._maintenance = !db._maintenance;
      saveDB(db);
      return reply(`🔧 *Mode Maintenance*\n\nStatus: ${db._maintenance ? "🔴 AKTIF — bot hanya merespons owner" : "🟢 NONAKTIF — bot berjalan normal"}`);
    }

    // ── X_BONUS. BLOCK/UNBLOCK (OWNER) ───────────────────────
    if (cmd === "block") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const nomor = (args[1] || "").replace(/[^0-9]/g, "");
      if (!nomor) return reply("⚠️ Contoh: `!block 628xxxxxxxxxx`");
      const db = loadDB();
      if (!db._blocked) db._blocked = [];
      if (db._blocked.includes(nomor)) return reply(`⚠️ Nomor *${nomor}* sudah diblokir.`);
      db._blocked.push(nomor);
      saveDB(db);
      return reply(`🚫 Nomor *+${nomor}* berhasil diblokir dari bot.`);
    }

    if (cmd === "unblock") {
      if (!isOwner(sender)) return reply("⛔ Hanya owner.");
      const nomor = (args[1] || "").replace(/[^0-9]/g, "");
      if (!nomor) return reply("⚠️ Contoh: `!unblock 628xxxxxxxxxx`");
      const db = loadDB();
      if (!db._blocked?.includes(nomor)) return reply(`⚠️ Nomor *${nomor}* tidak ada di daftar blokir.`);
      db._blocked = db._blocked.filter(n => n !== nomor);
      saveDB(db);
      return reply(`✅ Nomor *+${nomor}* berhasil di-unblokir.`);
    }


    // ╔══════════════════════════════════════╗
    // ║        20 FITUR BARU                 ║
    // ╚══════════════════════════════════════╝

    // ── 1. KALKULATOR DISKON ─────────────────────────────────

    // ── 2. KALKULATOR CICILAN ────────────────────────────────

    // ── 3. CEK TABUNGAN / INVESTASI ──────────────────────────

    // ── 4. KALKULATOR BELANJA ────────────────────────────────

    // ── 5. KONVERSI PROVINSI ─────────────────────────────────

    // ── 6. INFO NOMOR PLAT ───────────────────────────────────
    if (cmd === "bmkg") {
      try {
        const data = await fetchJSON("https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json");
        const g = data.Infogempa.gempa;
        return reply(
          `🌋 *Info BMKG Terkini*\n\n` +
          `📅 Tanggal   : ${g.Tanggal}\n` +
          `🕐 Jam       : ${g.Jam} WIB\n` +
          `📍 Wilayah   : ${g.Wilayah}\n` +
          `💥 Magnitudo : ${g.Magnitude} SR\n` +
          `🌊 Kedalaman : ${g.Kedalaman}\n` +
          `🌐 Koordinat : ${g.Lintang}, ${g.Bujur}\n` +
          `⚠️ Potensi   : ${g.Potensi}\n\n` +
          `_Sumber: BMKG Indonesia_`
        );
      } catch {
        return reply("❌ Gagal mengambil data BMKG.");
      }
    }

    // ── 7. DETEKSI BAHASA ────────────────────────────────────
    if (cmd === "detektbahasa" || cmd === "detectlang") {
      if (!text) return reply("⚠️ Contoh: `!detectlang Hello World`");
      try {
        const data = await fetchJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|id`);
        const detected = data.responseData?.detectedLanguage || "Tidak terdeteksi";
        return reply(`🔍 *Deteksi Bahasa*\n\nTeks     : ${text}\nBahasa   : *${detected}*`);
      } catch {
        return reply("❌ Gagal mendeteksi bahasa.");
      }
    }

    // ── 8. KONVERSI UKURAN PAKAIAN ───────────────────────────
    if (cmd === "size" || cmd === "ukuran") {
      const tabel = [
        { label:"XS", id:"28-30", eu:"34-36", us:"2-4" },
        { label:"S",  id:"30-32", eu:"36-38", us:"4-6" },
        { label:"M",  id:"32-34", eu:"38-40", us:"8-10" },
        { label:"L",  id:"34-36", eu:"40-42", us:"10-12" },
        { label:"XL", id:"36-38", eu:"42-44", us:"12-14" },
        { label:"XXL",id:"38-40", eu:"44-46", us:"14-16" },
        { label:"3XL",id:"40-42", eu:"46-48", us:"16-18" },
      ];
      let out = `👕 *Tabel Ukuran Pakaian*\n\n`;
      out += `${"Size".padEnd(5)} ${"Indonesia".padEnd(10)} ${"EU".padEnd(8)} US\n`;
      out += "─".repeat(32) + "\n";
      tabel.forEach(t => {
        out += `${t.label.padEnd(5)} ${t.id.padEnd(10)} ${t.eu.padEnd(8)} ${t.us}\n`;
      });
      return reply(`\`\`\`${out}\`\`\``);
    }

    // ── 9. KATA MOTIVASI PAGI ────────────────────────────────
    if (cmd === "semangatpagi") {
      const pesan = [
        "🌅 Selamat pagi! Setiap hari adalah kesempatan baru. Mulailah dengan semangat dan rasa syukur!",
        "🌄 Pagi ini adalah hadiah. Gunakan dengan baik, karena waktu tidak bisa diputar ulang.",
        "☀️ Bangun pagi, bergerak, dan jadikan hari ini lebih baik dari kemarin!",
        "🌻 Jangan biarkan hari berlalu tanpa melakukan sesuatu yang berarti. Ayo semangat!",
        "💪 Setiap pagi adalah babak baru. Yang kemarin sudah berlalu, hari ini adalah kesempatan.",
      ];
      const tanggal = new Date().toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Jakarta"});
      return reply(`🌅 *Semangat Pagi!*\n📅 ${tanggal}\n\n${pesan[Math.floor(Math.random()*pesan.length)]}`);
    }

    // ── 10. TIPS RANDOM ──────────────────────────────────────
    if (cmd === "tips") {
      const tips = [
        "💡 Minum air putih minimal 8 gelas sehari untuk menjaga kesehatan tubuh.",
        "💡 Istirahat 5 menit setiap 25 menit kerja (Teknik Pomodoro) meningkatkan produktivitas.",
        "💡 Backup data penting secara rutin. Kehilangan data bisa sangat merugikan!",
        "💡 Gunakan password manager untuk menyimpan kata sandi dengan aman.",
        "💡 Jangan lupa stretching ringan jika terlalu lama duduk di depan layar.",
        "💡 Simpan nomor darurat (polisi 110, ambulans 118, pemadam 113) di kontak HP.",
        "💡 Biasakan membaca 15-30 menit sehari. Membaca melatih otak dan memperluas wawasan.",
        "💡 Tidur 7-8 jam sehari membantu otak memproses informasi dan meningkatkan daya ingat.",
        "💡 Kurangi penggunaan media sosial sebelum tidur agar kualitas tidur lebih baik.",
        "💡 Catat pengeluaran harian untuk menghindari kebocoran keuangan.",
      ];
      return reply(tips[Math.floor(Math.random() * tips.length)]);
    }

    // ── 11. GENERATOR OTP ────────────────────────────────────
    if (cmd === "otp") {
      const panjang = Math.min(Math.max(parseInt(args[1]) || 6, 4), 8);
      const kode = Array.from({length: panjang}, () => Math.floor(Math.random() * 10)).join("");
      return reply(
        `🔐 *Generator OTP*\n\n` +
        `Kode OTP : \`${kode}\`\n` +
        `Panjang  : ${panjang} digit\n\n` +
        `⚠️ _Jangan bagikan kode ini ke siapapun!_`
      );
    }

    // ── 12. SLOGAN GENERATOR ─────────────────────────────────
    if (cmd === "slogan") {
      if (!text) return reply("⚠️ Contoh: `!slogan Kopi Mantap`");
      const templates = [
        `${text} — Karena Kualitas Berbicara Sendiri`,
        `Pilih ${text}, Pilih yang Terbaik`,
        `${text} — Solusi Tepat untuk Hidup Lebih Baik`,
        `Satu ${text}, Sejuta Manfaat`,
        `${text} — Inovasi Tiada Henti`,
        `Dengan ${text}, Semua Jadi Mudah`,
        `${text} — Kepercayaan Jutaan Orang`,
        `${text}: Lebih Dari Sekadar Biasa`,
      ];
      const slogan = templates[Math.floor(Math.random() * templates.length)];
      return reply(`🎯 *Generator Slogan*\n\nBrand  : ${text}\nSlogan : *"${slogan}"*`);
    }

    // ── 13. KONVERSI ANGKA KE KATA (TERBILANG) ───────────────
    if (cmd === "ulang") {
      // Ulangi teks N kali
      if (args.length < 2) return reply("⚠️ Contoh: `!ulang 3 halo dunia`");
      const n = Math.min(parseInt(args[1]) || 1, 10);
      const kata = args.slice(2).join(" ");
      if (!kata) return reply("⚠️ Contoh: `!ulang 3 halo dunia`");
      const hasil = Array(n).fill(kata).join("\n");
      return reply(`🔁 *Ulangi Teks (${n}x)*\n\n${hasil}`);
    }

    // ── 14. INFO NOMOR TELEPON ───────────────────────────────
    if (cmd === "infonomor") {
      const nomor = (args[1] || text || "").replace(/[^0-9]/g, "");
      if (!nomor || nomor.length < 4) return reply("⚠️ Contoh: `!infonomor 081234567890`");
      const prefix = nomor.substring(0, 4);
      const operators = {
        "0811":"Telkomsel","0812":"Telkomsel","0813":"Telkomsel","0821":"Telkomsel","0822":"Telkomsel","0823":"Telkomsel","0851":"Telkomsel","0852":"Telkomsel","0853":"Telkomsel",
        "0814":"Indosat","0815":"Indosat","0816":"Indosat","0855":"Indosat","0856":"Indosat","0857":"Indosat","0858":"Indosat",
        "0817":"XL Axiata","0818":"XL Axiata","0819":"XL Axiata","0859":"XL Axiata","0877":"XL Axiata","0878":"XL Axiata",
        "0895":"3 (Tri)","0896":"3 (Tri)","0897":"3 (Tri)","0898":"3 (Tri)","0899":"3 (Tri)",
        "0881":"Smartfren","0882":"Smartfren","0883":"Smartfren","0884":"Smartfren","0885":"Smartfren","0886":"Smartfren","0887":"Smartfren","0888":"Smartfren","0889":"Smartfren",
        "0831":"AXIS","0832":"AXIS","0833":"AXIS","0838":"AXIS",
      };
      const op = operators[prefix] || "Tidak dikenali";
      const jenis = nomor.startsWith("08") ? "Prabayar/Pascabayar" : nomor.startsWith("62") ? "Format Internasional" : "Tidak dikenal";
      return reply(
        `📱 *Info Nomor Telepon*\n\n` +
        `📞 Nomor    : ${nomor}\n` +
        `🏢 Operator : *${op}*\n` +
        `🔢 Prefix   : ${prefix}\n` +
        `📋 Jenis    : ${jenis}`
      );
    }

    // ── 15. AVERAGE / RATA-RATA ──────────────────────────────
    if (cmd === "average" || cmd === "ratarata") {
      if (!text) return reply("⚠️ Contoh: `!average 80 90 75 88 92`");
      const nums = text.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      if (!nums.length) return reply("❌ Masukkan angka-angka yang valid.");
      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = sum / nums.length;
      const max = Math.max(...nums);
      const min = Math.min(...nums);
      return reply(
        `📊 *Statistik Angka*\n\n` +
        `📋 Data      : ${nums.join(", ")}\n` +
        `🔢 Jumlah    : ${nums.length} angka\n` +
        `➕ Total     : ${sum}\n` +
        `📈 Rata-rata : *${avg.toFixed(2)}*\n` +
        `🔼 Tertinggi : ${max}\n` +
        `🔽 Terendah  : ${min}`
      );
    }

    // ── 16. GENERATOR NAMA BISNIS ────────────────────────────
    if (cmd === "namabisnis") {
      const kata1 = ["Smart","Maju","Karya","Cahaya","Sukses","Prima","Indah","Mitra","Bersama","Jaya","Global","Nusa","Bumi","Sinar","Mega"];
      const kata2 = ["Abadi","Sejahtera","Mandiri","Gemilang","Utama","Mulia","Sentosa","Lestari","Perdana","Perkasa","Digital","Teknologi","Solusi","Kreatif","Inovasi"];
      const nama1 = kata1[Math.floor(Math.random()*kata1.length)];
      const nama2 = kata2[Math.floor(Math.random()*kata2.length)];
      const nama3 = kata1[Math.floor(Math.random()*kata1.length)];
      return reply(
        `🏢 *Generator Nama Bisnis*\n\n` +
        `💡 Opsi 1 : *${nama1} ${nama2}*\n` +
        `💡 Opsi 2 : *${nama3} ${kata2[Math.floor(Math.random()*kata2.length)]}*\n` +
        `💡 Opsi 3 : *${kata1[Math.floor(Math.random()*kata1.length)]} ${kata2[Math.floor(Math.random()*kata2.length)]} Group*\n\n` +
        `_Ketik \`!namabisnis\` lagi untuk nama lain_`
      );
    }

    // ── 17. KALKULATOR ZAKAT LENGKAP ─────────────────────────
    if (cmd === "zakat") {
      const tipe = (args[1] || "").toLowerCase();
      if (tipe === "fitrah") {
        const jiwa = parseInt(args[2]) || 1;
        const hargaBeras = parseFloat(args[3]) || 13500;
        return reply(
          `☪️ *Zakat Fitrah*\n\n` +
          `👥 Jumlah jiwa : ${jiwa} orang\n` +
          `🌾 Per jiwa    : 2.5 kg beras\n` +
          `💰 Harga beras : Rp ${hargaBeras.toLocaleString("id-ID")}/kg\n\n` +
          `🌾 *Total beras : ${2.5 * jiwa} kg*\n` +
          `💵 *Total uang  : Rp ${(2.5 * jiwa * hargaBeras).toLocaleString("id-ID")}*`
        );
      }
      const penghasilan = parseFloat(args[1]);
      if (isNaN(penghasilan)) return reply(
        "⚠️ Format:\n" +
        "`!zakat [penghasilan/bln]`\n" +
        "`!zakat fitrah [jiwa] [harga beras]`\n\n" +
        "Contoh: `!zakat 5000000` atau `!zakat fitrah 4 13500`"
      );
      const nisab = 85 * 1100000 / 12;
      const wajib = penghasilan >= nisab;
      const jumlah = wajib ? penghasilan * 0.025 : 0;
      return reply(
        `☪️ *Kalkulator Zakat Penghasilan*\n\n` +
        `💰 Penghasilan/bln : Rp ${penghasilan.toLocaleString("id-ID")}\n` +
        `📊 Nisab/bln       : Rp ${Math.round(nisab).toLocaleString("id-ID")}\n` +
        `✅ Wajib zakat     : ${wajib ? "Ya" : "Belum (di bawah nisab)"}\n` +
        (wajib ? `\n💵 *Zakat 2.5%/bln  : Rp ${Math.round(jumlah).toLocaleString("id-ID")}*\n💵 *Zakat 2.5%/thn  : Rp ${Math.round(jumlah*12).toLocaleString("id-ID")}*` : "")
      );
    }

    // ── 18. CARI NAMA ISLAMI ─────────────────────────────────
    if (cmd === "islamicname" || cmd === "namaislami") {
      const namaL = [
        {nama:"Ahmad",arti:"Yang Terpuji"},{nama:"Muhammad",arti:"Yang Terpuji"},{nama:"Rizqi",arti:"Rezeki"},
        {nama:"Faris",arti:"Penunggang Kuda/Ksatria"},{nama:"Hasan",arti:"Yang Baik"},{nama:"Ibrahim",arti:"Bapak Banyak Umat"},
        {nama:"Yusuf",arti:"Allah Menambah"},{nama:"Umar",arti:"Makmur/Panjang Umur"},{nama:"Zaid",arti:"Bertambah"},
        {nama:"Khalid",arti:"Abadi"},{nama:"Naufal",arti:"Dermawan"},{nama:"Rayhan",arti:"Harum"},
      ];
      const namaP = [
        {nama:"Aisyah",arti:"Yang Hidup"},{nama:"Fatimah",arti:"Yang Berpantang"},{nama:"Khadijah",arti:"Lahir Prematur/Mulia"},
        {nama:"Maryam",arti:"Wanita Shalihah"},{nama:"Zahra",arti:"Bunga/Bersinar"},{nama:"Nadia",arti:"Pemanggil"},
        {nama:"Salma",arti:"Selamat/Damai"},{nama:"Hana",arti:"Kebahagiaan"},{nama:"Layla",arti:"Malam"},
        {nama:"Rania",arti:"Memandang dengan Senang"},{nama:"Safira",arti:"Duta/Utusan"},{nama:"Zubaidah",arti:"Kepala Mentega/Mulia"},
      ];
      const gender = (args[1] || "l").toLowerCase();
      const list = (gender === "p" || gender === "perempuan") ? namaP : namaL;
      const pilihan = list.slice().sort(() => Math.random() - 0.5).slice(0, 5);
      const label = (gender === "p" || gender === "perempuan") ? "Perempuan" : "Laki-laki";
      let out = `☪️ *Nama Islami ${label}*\n\n`;
      pilihan.forEach((n, i) => { out += `${i+1}. *${n.nama}* — ${n.arti}\n`; });
      return reply(out);
    }

    // ── 19. SLANG / BAHASA GAUL ──────────────────────────────
    if (cmd === "gaul" || cmd === "slang") {
      if (!text) return reply("⚠️ Contoh: `!gaul Terima kasih banyak`");
      const kamus = {
        "terima kasih":"makasih","tidak":"gak/nggak","sudah":"udah","belum":"belom","sangat":"banget",
        "kenapa":"knp","dengan":"sama","kalian":"kalian semua","sekarang":"skrg","bagaimana":"gimana",
        "begitu":"gitu","memang":"emang","seperti":"kayak","sedikit":"dikit","banyak":"buanyak",
        "iya":"iyasih","tidak tahu":"gatau","lagi":"lgi","ada":"ad","mau":"mw","kamu":"lo/lu",
        "saya":"gua/gw","juga":"juga dong","apa":"apaan","ini":"ini tuh","itu":"itu tuh",
      };
      let hasil = text.toLowerCase();
      for (const [baku, gaul] of Object.entries(kamus)) {
        hasil = hasil.replace(new RegExp(baku, "gi"), gaul);
      }
      return reply(`😎 *Konversi Bahasa Gaul*\n\nFormal : ${text}\nGaul   : *${hasil}*`);
    }

    // ── 20. GENERATOR KALIMAT BAHASA INDONESIA ───────────────
    if (cmd === "kalimatacak" || cmd === "sentence") {
      const subjek = ["Budi","Siti","Pak Guru","Ibu Dokter","Anak-anak","Para pemuda","Tim sukses","Kelompok peneliti"];
      const predikat = ["sedang belajar","dengan tekun mengerjakan","berhasil menyelesaikan","terus berupaya mencapai","dengan gembira merayakan","tidak pernah menyerah dalam"];
      const objek = ["tugas sekolah","proyek besar","mimpi-mimpi indah","tantangan hidup","pekerjaan penting","cita-cita mulia"];
      const keterangan = ["dengan penuh semangat","di pagi hari yang cerah","bersama keluarga tercinta","demi masa depan yang lebih baik","tanpa kenal lelah","dengan senyum di wajah"];
      const kalimat = `${subjek[Math.floor(Math.random()*subjek.length)]} ${predikat[Math.floor(Math.random()*predikat.length)]} ${objek[Math.floor(Math.random()*objek.length)]} ${keterangan[Math.floor(Math.random()*keterangan.length)]}.`;
      return reply(`📝 *Kalimat Random*\n\n"${kalimat}"\n\n_Ketik \`!kalimatacak\` lagi untuk kalimat lain_`);
    }


    // ============================================================
    // 30 FITUR BARU BERGUNA
    // ============================================================

    // F1. PRAKIRAAN CUACA 3 HARI
    if (cmd === "prakiraan" || cmd === "forecast") {
      if (!text) return reply("⚠️ Contoh: `!prakiraan Jakarta`");
      try {
        const data = await fetchJSON(`https://wttr.in/${encodeURIComponent(text)}?format=j1`);
        const w = data.weather;
        let out = `🌤️ *Prakiraan Cuaca 3 Hari - ${text}*\n\n`;
        const hari = ["Hari ini","Besok","Lusa"];
        w.slice(0,3).forEach((d,i) => {
          out += `📅 *${hari[i]}* (${d.date})\n`;
          out += `🌡️ ${d.mintempC}°C - ${d.maxtempC}°C\n`;
          out += `☁️ ${d.hourly[4]?.weatherDesc[0]?.value || "-"}\n`;
          out += `💧 Hujan: ${d.hourly[4]?.chanceofrain}%\n\n`;
        });
        return reply(out.trim());
      } catch { return reply("❌ Gagal ambil prakiraan cuaca."); }
    }

    // F2. KALKULATOR DISKON

    // F3. KALKULATOR CICILAN

    // F4. SPLIT BILL
    if (cmd === "splitbill" || cmd === "bagibill") {
      const total=parseFloat(args[1]),orang=parseInt(args[2]);
      if (isNaN(total)||isNaN(orang)||orang<1) return reply("⚠️ Contoh: `!splitbill 300000 4`");
      return reply(`👥 *Split Bill*\n\nTotal     : Rp ${total.toLocaleString("id-ID")}\nOrang     : ${orang}\nPer Orang : *Rp ${Math.ceil(total/orang).toLocaleString("id-ID")}*`);
    }

    // F5. KALKULATOR DISKON + TIPS
    if (cmd === "tips") {
      const tagihan=parseFloat(args[1]),persen=parseFloat(args[2])||10;
      if (isNaN(tagihan)) return reply("⚠️ Contoh: `!tips 150000 15`");
      const tip=(persen/100)*tagihan;
      return reply(`🧾 *Kalkulator Tips*\n\nTagihan : Rp ${tagihan.toLocaleString("id-ID")}\nTips    : ${persen}% = Rp ${tip.toLocaleString("id-ID")}\nTotal   : *Rp ${(tagihan+tip).toLocaleString("id-ID")}*`);
    }

    // F6. HITUNG KEBUTUHAN AIR
    if (cmd === "kebutuhanair") {
      const bb=parseFloat(text);
      if (isNaN(bb)||bb<1) return reply("⚠️ Contoh: `!kebutuhanair 70`");
      const ml=bb*30;
      return reply(`💧 *Kebutuhan Air Harian*\n\nBerat Badan : ${bb} kg\nKebutuhan   : *${ml} mL/hari*\n= ${Math.ceil(ml/250)} gelas (250mL)\n= ${(ml/1000).toFixed(1)} botol (1L)`);
    }

    // F7. KALORI BAKAR
    if (cmd === "kaloribakar") {
      const aktivitas=(args[1]||"").toLowerCase(),bb=parseFloat(args[2]),menit=parseInt(args[3]);
      const met={jalan:3.5,lari:8,bersepeda:6,renang:7,yoga:2.5,gym:5,futsal:7,badminton:5.5};
      if (!aktivitas||!met[aktivitas]||isNaN(bb)||isNaN(menit))
        return reply(`⚠️ Contoh: \`!kaloribakar lari 70 30\`\nAktivitas: ${Object.keys(met).join(", ")}`);
      const kal=((met[aktivitas]*bb*3.5)/200)*menit;
      return reply(`🔥 *Kalori Terbakar*\n\n${aktivitas} | ${bb}kg | ${menit} menit\n\nTerbakar: *${kal.toFixed(0)} kcal*`);
    }

    // F8. HITUNG LISTRIK
    if (cmd === "listrik") {
      const watt=parseFloat(args[1]),jam=parseFloat(args[2])||24,hari=parseInt(args[3])||30;
      if (isNaN(watt)) return reply("⚠️ Contoh: `!listrik 450 8 30` (watt, jam/hari, hari)");
      const kwh=(watt*jam*hari)/1000, biaya=kwh*1444.70;
      return reply(`⚡ *Hitung Listrik*\n\nDaya: ${watt}W | ${jam}j/hari | ${hari} hari\nTotal: *${kwh.toFixed(2)} kWh*\nEstimasi: *Rp ${Math.round(biaya).toLocaleString("id-ID")}*\n\n_Tarif R1 900VA: Rp 1.444,70/kWh_`);
    }

    // F9. KALKULATOR GAJI
    if (cmd === "gaji") {
      const gaji=parseFloat(args[1]);
      if (isNaN(gaji)) return reply("⚠️ Contoh: `!gaji 5000000`");
      const pph=gaji>4500000?(gaji-4500000)*0.05:0;
      const bpjsKes=gaji*0.01, bpjsTk=gaji*0.02;
      const totalPotong=pph+bpjsKes+bpjsTk, takehome=gaji-totalPotong;
      return reply(`💰 *Simulasi Gaji*\n\nGaji Pokok  : Rp ${gaji.toLocaleString("id-ID")}\n\nPotongan:\nPPh21       : Rp ${Math.round(pph).toLocaleString("id-ID")}\nBPJS Kes    : Rp ${Math.round(bpjsKes).toLocaleString("id-ID")}\nBPJS TK     : Rp ${Math.round(bpjsTk).toLocaleString("id-ID")}\nTotal Potong: Rp ${Math.round(totalPotong).toLocaleString("id-ID")}\n\n*Take Home  : Rp ${Math.round(takehome).toLocaleString("id-ID")}*`);
    }

    // F10. HITUNG LEMBUR
    if (cmd === "lembur") {
      const gajiBulan=parseFloat(args[1]),jamLembur=parseFloat(args[2]);
      if (isNaN(gajiBulan)||isNaN(jamLembur)) return reply("⚠️ Contoh: `!lembur 5000000 3`");
      const gajiJam=gajiBulan/173;
      let total=0;
      if (jamLembur>=1) total+=gajiJam*1.5;
      if (jamLembur>1) total+=(jamLembur-1)*gajiJam*2;
      return reply(`⏰ *Upah Lembur*\n\nGaji/Bulan : Rp ${gajiBulan.toLocaleString("id-ID")}\nGaji/Jam   : Rp ${Math.round(gajiJam).toLocaleString("id-ID")}\nJam Lembur : ${jamLembur} jam\n\nUpah Lembur: *Rp ${Math.round(total).toLocaleString("id-ID")}*`);
    }

    // F11. HITUNG TABUNGAN

    // F12. KALKULATOR INVESTASI
    if (cmd === "investasi") {
      const modal=parseFloat(args[1]),bunga=parseFloat(args[2]),tahun=parseInt(args[3]);
      if (isNaN(modal)||isNaN(bunga)||isNaN(tahun)) return reply("⚠️ Contoh: `!investasi 10000000 8 5`\n(modal, %bunga/tahun, tahun)");
      const hasil=modal*Math.pow(1+bunga/100,tahun), keuntungan=hasil-modal;
      return reply(`📈 *Kalkulator Investasi*\n\nModal Awal : Rp ${modal.toLocaleString("id-ID")}\nBunga/Tahun: ${bunga}%\nLama       : ${tahun} tahun\n\nHasil Akhir: *Rp ${Math.round(hasil).toLocaleString("id-ID")}*\nKeuntungan : Rp ${Math.round(keuntungan).toLocaleString("id-ID")}`);
    }

    // F13. KALKULATOR BENSIN
    if (cmd === "bensin") {
      const jarak=parseFloat(args[1]),konsumsi=parseFloat(args[2])||12,harga=parseFloat(args[3])||10000;
      if (isNaN(jarak)) return reply("⚠️ Contoh: `!bensin 100 12 10000`\n(jarak km, km/liter, harga/liter)");
      const liter=jarak/konsumsi, biaya=liter*harga;
      return reply(`⛽ *Kalkulator Bensin*\n\nJarak       : ${jarak} km\nKonsumsi    : ${konsumsi} km/liter\nHarga/liter : Rp ${harga.toLocaleString("id-ID")}\n\nButuh : *${liter.toFixed(2)} liter*\nBiaya : *Rp ${Math.round(biaya).toLocaleString("id-ID")}*`);
    }

    // F14. KALKULATOR PPN
    if (cmd === "ppn") {
      const harga=parseFloat(args[1]),inklusif=(args[2]||"").toLowerCase()==="inklusif";
      if (isNaN(harga)) return reply("⚠️ Contoh: `!ppn 100000` atau `!ppn 111000 inklusif`");
      const tarif=0.11;
      if (inklusif) {
        const dpp=harga/(1+tarif), ppn2=harga-dpp;
        return reply(`🧾 *PPN 11% Inklusif*\n\nHarga Inklusif : Rp ${harga.toLocaleString("id-ID")}\nDPP            : Rp ${Math.round(dpp).toLocaleString("id-ID")}\nPPN            : *Rp ${Math.round(ppn2).toLocaleString("id-ID")}*`);
      }
      const ppn=harga*tarif, total=harga+ppn;
      return reply(`🧾 *PPN 11% Eksklusif*\n\nHarga Sebelum PPN: Rp ${harga.toLocaleString("id-ID")}\nPPN (11%)        : Rp ${Math.round(ppn).toLocaleString("id-ID")}\nTotal + PPN      : *Rp ${Math.round(total).toLocaleString("id-ID")}*`);
    }

    // F15. GENERATOR PASSWORD KUAT
    if (cmd === "passgen") {
      const panjang=parseInt(args[1])||16, tipe=(args[2]||"mixed").toLowerCase();
      if (panjang<4||panjang>64) return reply("⚠️ Panjang 4-64.");
      const sets={angka:"0123456789",huruf:"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",simbol:"!@#$%^&*()_+-=[]{}",mixed:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"};
      const chars=sets[tipe]||sets.mixed;
      let pass="";
      for(let i=0;i<panjang;i++) pass+=chars[Math.floor(Math.random()*chars.length)];
      const strength=panjang<8?"🔴 Lemah":panjang<12?"🟡 Sedang":panjang<16?"🟢 Kuat":"🔵 Sangat Kuat";
      return reply(`🔐 *Password Generator*\n\n\`${pass}\`\n\nPanjang  : ${panjang} karakter\nTipe     : ${tipe}\nKekuatan : ${strength}`);
    }

    // F16. CEK KEKUATAN PASSWORD
    if (cmd === "cekpass") {
      if (!text) return reply("⚠️ Contoh: `!cekpass P@ssw0rd123`");
      let skor=0;
      const checks=[
        {ok:text.length>=8,msg:"Minimal 8 karakter"},
        {ok:text.length>=12,msg:"Minimal 12 karakter"},
        {ok:/[A-Z]/.test(text),msg:"Ada huruf kapital"},
        {ok:/[a-z]/.test(text),msg:"Ada huruf kecil"},
        {ok:/[0-9]/.test(text),msg:"Ada angka"},
        {ok:/[^A-Za-z0-9]/.test(text),msg:"Ada simbol"},
      ];
      const hasil=checks.map(c=>{if(c.ok)skor++;return(c.ok?"✅":"❌")+" "+c.msg;});
      const level=skor<=2?"🔴 Sangat Lemah":skor<=3?"🟠 Lemah":skor<=4?"🟡 Sedang":skor<=5?"🟢 Kuat":"🔵 Sangat Kuat";
      return reply(`🔐 *Cek Password*\n\n${hasil.join("\n")}\n\nSkor    : ${skor}/6\nLevel   : ${level}`);
    }

    // F17. CEK STATUS WEBSITE
    if (cmd === "cekweb") {
      if (!text) return reply("⚠️ Contoh: `!cekweb google.com`");
      const url=text.startsWith("http")?text:`https://${text}`;
      try {
        const start=Date.now();
        const res=await axios.get(url,{timeout:10000,maxRedirects:5});
        return reply(`🌐 *Cek Website*\n\nURL    : ${url}\nStatus : ✅ ${res.status} ${res.statusText}\nRespon : ${Date.now()-start}ms\nTipe   : ${res.headers["content-type"]?.split(";")[0]||"-"}`);
      } catch(e){
        return reply(`🌐 *Cek Website*\n\nURL    : ${url}\nStatus : ❌ Tidak bisa diakses\nError  : ${e.message}`);
      }
    }

    // F18. IP LOOKUP
    if (cmd === "iplookup") {
      if (!text) return reply("⚠️ Contoh: `!iplookup 8.8.8.8`");
      try {
        const data=await fetchJSON(`https://ipapi.co/${text}/json/`);
        if(data.error) return reply("❌ IP tidak valid.");
        return reply(`🔍 *IP Lookup: ${text}*\n\nNegara  : ${data.country_name} (${data.country_code})\nKota    : ${data.city||"-"}\nRegion  : ${data.region||"-"}\nISP     : ${data.org||"-"}\nTimezone: ${data.timezone||"-"}`);
      } catch { return reply("❌ Gagal lookup IP."); }
    }

    // F19. GENERATOR NAMA ANAK
    if (cmd === "namaanak") {
      const jk=(args[1]||"").toLowerCase();
      const namaL=["Aryan","Rafif","Zafran","Kenzie","Rayyan","Farhan","Gibran","Daffa","Azka","Naufal","Reyhan","Ilham","Faiz","Dzaky","Hakim"];
      const namaP=["Aisyah","Naura","Hana","Zahra","Nadia","Fira","Kirana","Salwa","Rani","Dinda","Syifa","Aira","Nabila","Rara","Lila"];
      const nama=jk==="laki"?pickRandom(namaL):jk==="perempuan"?pickRandom(namaP):pickRandom([...namaL,...namaP]);
      return reply(`👶 *Nama Anak*\n\nNama: *${nama}*\n\n_Ketik \`!namaanak laki\` atau \`!namaanak perempuan\`_`);
    }

    // F20. HITUNG KEHAMILAN (HPHT)
    if (cmd === "hpht") {
      if (!text) return reply("⚠️ Contoh: `!hpht 01/01/2025` (hari pertama haid terakhir)");
      const [dd,mm,yyyy]=text.split("/");
      const hpht=new Date(`${yyyy}-${mm}-${dd}`);
      if(isNaN(hpht)) return reply("❌ Tanggal tidak valid.");
      const hpl=new Date(hpht); hpl.setDate(hpl.getDate()+280);
      const minggu=Math.floor((Date.now()-hpht)/(7*24*60*60*1000));
      return reply(`🤰 *Kalkulator Kehamilan*\n\nHPHT  : ${text}\nHPL   : ${hpl.toLocaleDateString("id-ID")}\nUsia  : *${minggu} minggu*\nTrimester: ${minggu<=13?"1️⃣ Pertama":minggu<=26?"2️⃣ Kedua":"3️⃣ Ketiga"}`);
    }

    // F21. HITUNG LARI / PACE
    if (cmd === "hitunglari" || cmd === "pace") {
      const km=parseFloat(args[1]),menit=parseFloat(args[2]);
      if(isNaN(km)||isNaN(menit)) return reply("⚠️ Contoh: `!hitunglari 5 30` (km, menit)");
      const pace=menit/km, paceM=Math.floor(pace), paceS=Math.round((pace-paceM)*60);
      return reply(`🏃 *Hitung Lari*\n\nJarak    : ${km} km\nWaktu    : ${menit} menit\nPace     : *${paceM}'${paceS}" /km*\nKecepatan: *${(km/(menit/60)).toFixed(2)} km/jam*\nEst. Kalori: ~${Math.round(km*60)} kcal`);
    }

    // F22. GENERATOR HASHTAG
    if (cmd === "hashtag") {
      if (!text) return reply("⚠️ Contoh: `!hashtag fotografi landscape sunset`");
      const tags=text.split(" ").filter(Boolean).map(k=>`#${k.replace(/[^a-zA-Z0-9]/g,"")}`);
      const bonus=["#viral","#fyp","#trending","#Indonesia","#explore"];
      const semua=[...tags,...bonus.slice(0,3)];
      return reply(`#️⃣ *Hashtag*\n\n${semua.join(" ")}\n\n_${semua.length} hashtag_`);
    }

    // F23. INFO PLAT DAERAH
    if (cmd === "infoplat") {
      if (!text) return reply("⚠️ Contoh: `!infoplat B`");
      const platMap={A:"Banten",B:"DKI Jakarta",D:"Bandung",E:"Cirebon",F:"Bogor",G:"Pekalongan",H:"Semarang",K:"Pati",L:"Surabaya",M:"Madura",N:"Malang",P:"Besuki",R:"Banyumas",S:"Bojonegoro",T:"Karawang",W:"Sidoarjo",Z:"Sumedang",AA:"Kedu",AB:"Yogyakarta",AD:"Solo",AE:"Madiun",AG:"Kediri",BA:"Sumatera Barat",BB:"Tapanuli",BD:"Bengkulu",BE:"Lampung",BG:"Sumsel",BK:"Sumut",BL:"Aceh",BM:"Riau",BN:"Babel",BP:"Kepri",DA:"Kalsel",DB:"Sulut",DD:"Sulsel",DE:"Maluku",DK:"Bali",DN:"Sulteng",DR:"NTB",DS:"Papua",DT:"Sultra",EA:"NTB",KB:"Kalbar",KT:"Kaltim",KU:"Kaltara",PA:"Papua",PB:"Papua Barat"};
      const kode=text.toUpperCase();
      return platMap[kode] ? reply(`🚗 *Plat ${kode}*\n\nWilayah: *${platMap[kode]}*`) : reply(`❌ Kode plat "${kode}" tidak ditemukan.`);
    }

    // F24. KONVERSI UKURAN BAJU
    if (cmd === "ukuranbaju") {
      const uk=(args[1]||"").toUpperCase();
      const tabel={XS:"Dada: 80-84cm | Pinggang: 60-64cm",S:"Dada: 84-88cm | Pinggang: 64-68cm",M:"Dada: 88-92cm | Pinggang: 68-72cm",L:"Dada: 92-96cm | Pinggang: 72-76cm",XL:"Dada: 96-100cm | Pinggang: 76-80cm",XXL:"Dada: 100-104cm | Pinggang: 80-84cm",XXXL:"Dada: 104-108cm | Pinggang: 84-88cm"};
      if (!uk||!tabel[uk]) return reply(`⚠️ Contoh: \`!ukuranbaju M\`\nUkuran: ${Object.keys(tabel).join(" ")}`);
      return reply(`👕 *Ukuran ${uk}*\n\n${tabel[uk]}`);
    }

    // F25. HITUNG KERAMIK
    if (cmd === "keramik") {
      const p=parseFloat(args[1]),l=parseFloat(args[2]),uk=parseFloat(args[3])||60;
      if(isNaN(p)||isNaN(l)) return reply("⚠️ Contoh: `!keramik 5 4 60` (panjang lebar ukuranKeramikCm)");
      const luasR=p*l, luasK=(uk/100)*(uk/100), jumlah=Math.ceil((luasR/luasK)*1.1);
      return reply(`🏠 *Hitung Keramik*\n\nLuas Ruangan   : ${p}×${l}m = ${luasR}m²\nUkuran Keramik : ${uk}×${uk}cm\nKebutuhan      : *${jumlah} keping* (+10% cadangan)`);
    }

    // F26. HITUNG KEBUTUHAN CAT
    if (cmd === "hitungcat") {
      const p=parseFloat(args[1]),l=parseFloat(args[2]),t=parseFloat(args[3])||3;
      if(isNaN(p)||isNaN(l)) return reply("⚠️ Contoh: `!hitungcat 5 4 3` (panjang lebar tinggi meter)");
      const luas=2*(p+l)*t, kaleng=Math.ceil(luas/10);
      return reply(`🎨 *Hitung Cat Dinding*\n\nRuangan : ${p}m × ${l}m × ${t}m\nLuas Cat: ${luas.toFixed(1)} m²\nKebutuhan: *±${kaleng} kaleng* (2 lapis, 1 kaleng=10m²)`);
    }

    // F27. HITUNG PAJAK KENDARAAN
    if (cmd === "pkb") {
      const njkb=parseFloat(args[1]), thn=parseInt(args[2])||1;
      if(isNaN(njkb)) return reply("⚠️ Contoh: `!pkb 150000000 1` (nilai kendaraan, tahun ke-)");
      const pkb2=njkb*0.02, swdkllj=143000, denda=thn>1?pkb2*0.25*(thn-1):0;
      const total=pkb2+swdkllj+denda;
      return reply(`🚗 *Estimasi Pajak Kendaraan*\n\nNJKB      : Rp ${njkb.toLocaleString("id-ID")}\nPKB (2%)  : Rp ${Math.round(pkb2).toLocaleString("id-ID")}\nSWDKLLJ   : Rp ${swdkllj.toLocaleString("id-ID")}${denda>0?`\nDenda     : Rp ${Math.round(denda).toLocaleString("id-ID")}`:""}\n\n*Total    : Rp ${Math.round(total).toLocaleString("id-ID")}*`);
    }

    // F28. KONVERSI LITER/GALON
    if (cmd === "liter") {
      const val=parseFloat(args[1]), dari=(args[2]||"l").toLowerCase();
      if(isNaN(val)) return reply("⚠️ Contoh: `!liter 10 l` atau `!liter 3 gal`");
      if(dari==="l"||dari==="liter") return reply(`🪣 *${val} Liter*\n\n= ${(val*0.264172).toFixed(4)} galon US\n= ${(val*1000).toFixed(0)} mL\n= ${(val*33.814).toFixed(2)} fl oz`);
      if(dari==="gal"||dari==="galon") return reply(`🪣 *${val} Galon* = ${(val*3.78541).toFixed(3)} Liter`);
      return reply("⚠️ Satuan: l atau gal");
    }

    // F29. RANDOM WARNA HEX
    if (cmd === "randomhex") {
      const hex=Math.floor(Math.random()*16777215).toString(16).padStart(6,"0");
      const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
      return reply(`🎨 *Warna Random*\n\nHex : #${hex.toUpperCase()}\nRGB : rgb(${r}, ${g}, ${b})\n\nPreview: https://via.placeholder.com/200/${hex}/fff?text=%23${hex.toUpperCase()}`);
    }

    // F30. CEK DNS
    if (cmd === "cekdns") {
      if (!text) return reply("⚠️ Contoh: `!cekdns google.com`");
      try {
        const data=await fetchJSON(`https://dns.google/resolve?name=${encodeURIComponent(text)}&type=A`);
        if(!data.Answer) return reply(`❌ DNS "${text}" tidak ditemukan.`);
        return reply(`🔍 *DNS Lookup: ${text}*\n\nA Records:\n• ${data.Answer.map(r=>r.data).join("\n• ")}`);
      } catch { return reply("❌ Gagal cek DNS."); }
    }

    // F31. SEARCH FOTO (DUCKDUCKGO)
    if (cmd === "pin") {
      if (!text) return reply("⚠️ Contoh:\n• `!pin Spongebob` — kirim 1 foto random\n• `!pin Spongebob #5` — kirim 5 foto");

      // Cek apakah ada #N di akhir query
      let querySearch = text;
      let jumlahFoto = 1;
      const matchJumlah = text.match(/^(.*?)\s*#(\d+)\s*$/);
      if (matchJumlah) {
        querySearch = matchJumlah[1].trim();
        jumlahFoto = Math.min(Math.max(parseInt(matchJumlah[2]), 1), 10);
      }

      if (!querySearch) return reply("⚠️ Masukkan kata kunci pencarian.");

      try {
        await sock.sendPresenceUpdate("composing", from);
        await reply(`🔍 Mencari foto *"${querySearch}"*...`);

        // Step 1: Ambil token vqd dari DuckDuckGo
        const ddgHeaders = {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/108.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        };

        const initRes = await axios.get(
          `https://duckduckgo.com/?q=${encodeURIComponent(querySearch)}&iax=images&ia=images`,
          { headers: ddgHeaders, timeout: 15000 }
        );

        const vqdMatch = initRes.data.match(/vqd=([\d-]+)/);
        if (!vqdMatch) return reply("❌ Gagal mengambil token pencarian. Coba lagi.");
        const vqd = vqdMatch[1];

        // Step 2: Fetch hasil gambar dari DDG Image API
        const imgApiUrl = `https://duckduckgo.com/i.js?l=id-id&o=json&q=${encodeURIComponent(querySearch)}&vqd=${vqd}&f=,,,,,&p=1`;
        const imgApiRes = await axios.get(imgApiUrl, {
          headers: { ...ddgHeaders, Referer: "https://duckduckgo.com/" },
          timeout: 15000,
        });

        const results = imgApiRes.data.results;
        if (!results || results.length === 0) {
          return reply(`❌ Tidak ada gambar ditemukan untuk *"${querySearch}"*.`);
        }

        // Step 3: Acak & ambil sejumlah URL gambar
        const shuffled = results.sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, Math.min(jumlahFoto * 3, shuffled.length)); // ambil lebih banyak untuk cadangan

        let terkirim = 0;
        for (const item of picked) {
          if (terkirim >= jumlahFoto) break;
          try {
            const imgRes = await axios.get(item.image, {
              responseType: "arraybuffer",
              timeout: 20000,
              maxRedirects: 5,
              headers: { "User-Agent": ddgHeaders["User-Agent"] },
            });

            const contentType = imgRes.headers["content-type"] || "";
            if (!contentType.startsWith("image/")) continue;

            const buffer = Buffer.from(imgRes.data);
            const caption = terkirim === 0
              ? `🖼️ *Hasil pencarian: ${querySearch}*${jumlahFoto > 1 ? `\n_(Foto ${terkirim + 1} dari ${jumlahFoto})_` : ""}`
              : `_(Foto ${terkirim + 1} dari ${jumlahFoto})_`;

            await sock.sendMessage(from, {
              image: buffer,
              mimetype: contentType,
              caption: caption,
            }, { quoted: msg });

            terkirim++;
            if (terkirim < jumlahFoto) await new Promise(r => setTimeout(r, 800));
          } catch (_) {}
        }

        if (terkirim === 0) {
          return reply(`❌ Gagal mengambil gambar untuk *"${querySearch}"*.\nCoba kata kunci lain atau ulangi beberapa saat lagi.`);
        }

        if (terkirim < jumlahFoto) {
          await sock.sendMessage(from, {
            text: `⚠️ ${terkirim}/${jumlahFoto} foto berhasil dikirim. Beberapa URL gambar tidak bisa diakses.`,
          }, { quoted: msg });
        }

        log(`[pin] query="${querySearch}" jumlah=${jumlahFoto} terkirim=${terkirim}`);
        return;
      } catch (err) {
        log(`[pin ERROR] ${err.message}`);
        return reply(`❌ Terjadi kesalahan saat mencari gambar.\n\`${err.message}\``);
      }
    }

    // F31b. SEARCH TIKTOK (!searchtt) - cari video TikTok, kirim link
    if (cmd === "searchtt") {
      if (!text) return reply("⚠️ Contoh: `!searchtt kucing lucu`");
      try {
        await sock.sendPresenceUpdate("composing", from);
        await reply(`🔍 Mencari video TikTok *"${text}"*...`);

        // Pakai TikTok unofficial search via scraper API
        const encoded = encodeURIComponent(text);
        let videos = [];

        // Coba API pertama: TikTok via RapidAPI-style scraper gratis
        try {
          const res = await axios.get(
            `https://www.tikwm.com/api/feed/search?keywords=${encoded}&count=5&cursor=0&web=1&hd=1`,
            {
              timeout: 15000,
              headers: { "User-Agent": "Mozilla/5.0" },
            }
          );
          if (res.data?.data?.videos?.length > 0) {
            videos = res.data.data.videos.slice(0, 5);
          }
        } catch (_) {}

        // Fallback: generate link pencarian langsung
        if (videos.length === 0) {
          return reply(
            `🎵 *Cari Video TikTok: "${text}"*\n\n` +
            `🔗 Klik link di bawah untuk lihat hasil:\n` +
            `• https://www.tiktok.com/search?q=${encoded}\n\n` +
            `_API sedang tidak tersedia, cari langsung di TikTok_`
          );
        }

        let out = `🎵 *Hasil Pencarian TikTok: "${text}"*\n\n`;
        videos.forEach((v, i) => {
          const judul = (v.title || "Tanpa judul").slice(0, 60);
          const author = v.author?.nickname || v.author?.unique_id || "Unknown";
          const likes = v.digg_count ? `❤️ ${parseInt(v.digg_count).toLocaleString("id-ID")}` : "";
          const views = v.play_count ? `👁️ ${parseInt(v.play_count).toLocaleString("id-ID")}` : "";
          const link = `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.video_id}`;
          out += `${i + 1}. *${judul}*\n`;
          out += `   👤 @${author}  ${likes}  ${views}\n`;
          out += `   🔗 ${link}\n\n`;
        });
        out += `_Gunakan !tiktok [url] untuk download videonya_`;

        return reply(out);
      } catch (err) {
        log(`[searchtt ERROR] ${err.message}`);
        return reply(`❌ Gagal mencari video TikTok.\n_${err.message.slice(0, 80)}_`);
      }
    }

    // F32. SEARCH YOUTUBE (!searchyt) - pakai Invidious API + banyak fallback
    if (cmd === "searchyt") {
      if (!text) return reply("\u26a0\ufe0f Contoh: `!searchyt Alan Walker Faded`");

      // Instance Invidious publik yang aktif - diurutkan dari yang paling stabil
      const instances = [
        "https://inv.tux.pizza",
        "https://invidious.io.lol",
        "https://invidious.fdn.fr",
        "https://invidious.slipfox.xyz",
        "https://vid.puffyan.us",
        "https://invidious.flokinet.to",
        "https://invidious.projectsegfau.lt",
        "https://y.com.sb",
        "https://invidious.lunar.icu",
        "https://iv.melmac.space",
      ];

      try {
        await sock.sendPresenceUpdate("composing", from);
        const encoded = encodeURIComponent(text);

        let videos = [];

        for (const base of instances) {
          try {
            const res = await axios.get(
              `${base}/api/v1/search?q=${encoded}&type=video&fields=title,videoId,author,lengthSeconds,viewCount`,
              {
                timeout: 10000,
                headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
              }
            );
            if (Array.isArray(res.data) && res.data.length > 0) {
              videos = res.data.slice(0, 5);
              break;
            }
          } catch (_) {}
        }

        if (videos.length === 0) return reply(`\u274c Tidak ada hasil untuk *"${text}"*.\nSemua server sedang tidak tersedia, coba beberapa saat lagi.`);

        const fmtDur = (s) => {
          if (!s) return "?";
          const m = Math.floor(s / 60);
          const sec = s % 60;
          return `${m}:${sec.toString().padStart(2, "0")}`;
        };

        const fmtViews = (n) => {
          if (!n) return "?";
          if (n >= 1000000) return (n / 1000000).toFixed(1) + "M views";
          if (n >= 1000) return (n / 1000).toFixed(1) + "K views";
          return n + " views";
        };

        let pesan = `\ud83c\udfac *Hasil Pencarian YouTube*\n\ud83d\udd0d *${text}*\n${"─".repeat(28)}\n\n`;
        videos.forEach((v, i) => {
          pesan += `*${i + 1}. ${v.title}*\n`;
          pesan += `\ud83d\udc64 ${v.author || "Unknown"}\n`;
          pesan += `\u23f1\ufe0f ${fmtDur(v.lengthSeconds)}  \ud83d\udc41\ufe0f ${fmtViews(v.viewCount)}\n`;
          pesan += `\ud83d\udd17 https://youtu.be/${v.videoId}\n\n`;
        });
        pesan += `_Gunakan !mp3yt [url] untuk download audio_`;

        return reply(pesan);
      } catch (err) {
        log(`[searchyt ERROR] ${err.message}`);
        return reply("\u274c Gagal mencari video YouTube. Coba lagi.");
      }
    }

        // F33. DOWNLOAD MP3 YOUTUBE (!mp3yt) - kirim file audio langsung
    if (cmd === "mp3yt") {
      if (!text) return reply("⚠️ Contoh: `!mp3yt https://youtu.be/xxxxx`\nPastikan yt-dlp sudah terinstall: `pip install yt-dlp`");

      // Hanya terima URL YouTube
      const urlMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([-\w]{11})/);
      if (!urlMatch) return reply("⚠️ Masukkan URL YouTube yang valid.\nContoh: `!mp3yt https://youtu.be/xxxxx`");
      const videoId = urlMatch[1];
      const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

      try {
        await sock.sendPresenceUpdate("composing", from);
        await reply("⏳ Sedang mendownload audio... Mohon tunggu.");

        // Buat nama file temp unik
        const tmpFile = path.join(os.tmpdir(), `mp3yt_${videoId}_${Date.now()}`);
        const outFile = `${tmpFile}.mp3`;

        // Jalankan yt-dlp untuk download audio
        await new Promise((resolve, reject) => {
          const cmd_ytdlp = `yt-dlp -x --audio-format mp3 --audio-quality 5 --no-playlist -o "${tmpFile}.%(ext)s" "${ytUrl}"`;
          exec(cmd_ytdlp, { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve();
          });
        });

        // Cek file hasil download
        if (!fs.existsSync(outFile)) {
          // Coba cari file dengan ekstensi apapun (fallback)
          const tmpDir = os.tmpdir();
          const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(`mp3yt_${videoId}`));
          if (files.length === 0) return reply("❌ File audio tidak ditemukan setelah download.");
        }

        // Ambil info judul via oembed
        let title = videoId;
        let channel = "";
        try {
          const infoRes = await axios.get(
            `https://www.youtube.com/oembed?url=${ytUrl}&format=json`,
            { timeout: 8000 }
          );
          title = infoRes.data.title || videoId;
          channel = infoRes.data.author_name || "";
        } catch (_) {}

        // Baca file dan kirim sebagai audio
        const audioBuffer = fs.readFileSync(outFile);

        await sock.sendMessage(from, {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
          ptt: false,
        }, { quoted: msg });

        // Hapus file temp
        try { fs.unlinkSync(outFile); } catch (_) {}

        log(`[mp3yt] Berhasil kirim audio: ${title}`);
        return;
      } catch (err) {
        log(`[mp3yt ERROR] ${err.message}`);
        if (err.message.includes("yt-dlp") || err.message.includes("not found")) {
          return reply("❌ yt-dlp tidak ditemukan!\nInstall dulu dengan perintah:\n`pip install yt-dlp`");
        }
        return reply(`❌ Gagal download audio.\n_${err.message.slice(0, 100)}_`);
      }
    }

        // ── PERINTAH TIDAK DIKENAL ────────────────────────────────
    return reply(`❓ Perintah \`${config.prefix}${cmd}\` tidak dikenal.\nKetik \`${config.prefix}menuall\` untuk melihat daftar menu.`);

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

  // ── KONEKSI UPDATE ─────────────────────────────────────────
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      log("[QR] Scan QR Code menggunakan WhatsApp di HP kamu!");
      qrcode.generate(qr, { small: true });
    }

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
    try {
      const groupMeta = await sock.groupMetadata(id);
      const db = loadDB();

      // ── WELCOME (anggota masuk) ────────────────────────────
      if (action === "add") {
        const welcomeTpl = (db._welcome && db._welcome[id]) || welcomeMessages[id];
        if (!welcomeTpl) return;
        for (const jid of participants) {
          const jidStr = typeof jid === "string" ? jid : (jid.id || jid.jid || String(jid));
          const nama = jidStr.split("@")[0];
          const pesan = welcomeTpl
            .replace(/@name/gi, `@${nama}`)
            .replace(/@group/gi, groupMeta.subject);
          await sock.sendMessage(id, { text: pesan, mentions: [jidStr] });
        }
      }

      // ── BYE (anggota keluar / dikick) ─────────────────────
      if (action === "remove") {
        const byeTpl = db._bye && db._bye[id];
        if (!byeTpl) return;
        for (const jid of participants) {
          const jidStr = typeof jid === "string" ? jid : (jid.id || jid.jid || String(jid));
          const nama = jidStr.split("@")[0];
          const pesan = byeTpl
            .replace(/@name/gi, `@${nama}`)
            .replace(/@group/gi, groupMeta.subject);
          await sock.sendMessage(id, { text: pesan, mentions: [jidStr] });
        }
      }

    } catch (e) {
      log(`[GROUP EVENT ERROR] ${e.message}`);
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
