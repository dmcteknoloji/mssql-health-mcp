<h1 align="center">🩺 mssql-health-mcp</h1>

<p align="center">
  <b>Ask your AI about your <i>live</i> SQL Server.</b><br/>
  A read-only MCP server that lets Claude, ChatGPT, Gemini — or any MCP client —<br/>
  diagnose your real SQL Server through DMVs. <b>Read-only by design.</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dmcteknoloji/mssql-health-mcp"><img src="https://img.shields.io/npm/v/@dmcteknoloji/mssql-health-mcp" alt="npm"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT"/></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node >=18"/>
  <img src="https://img.shields.io/badge/SQL%20Server-read--only-2ec5ff" alt="read-only"/>
  <img src="https://img.shields.io/badge/MCP-Model%20Context%20Protocol-7af0ff" alt="MCP"/>
</p>

<p align="center"><b>🇬🇧 English</b> · <a href="#-türkçe">🇹🇷 Türkçe</a></p>

---

ChatGPT knows *how* to shrink a log file. It can't see **your** server.
This MCP can. Ask **"why is my server slow right now?"** and get the real answer —
live blocking chains, top waits, missing indexes — straight from your instance.

> **The value of an MCP isn't knowledge (LLMs already have that). It's access** — to the one thing the internet can't see: the live state of *your* database.

## 🔒 Read-only by design

This is the whole point — safe enough to hand to a customer:

- **No write tools.** Only DMV/SELECT diagnostics. `INSERT/UPDATE/DELETE`, `DROP/ALTER`, "run any SQL" **don't exist** in the tool surface. Structurally cannot change anything.
- **Least privilege.** Connect with a read-only login (`VIEW SERVER STATE`). Ready script: [`setup-readonly-login.sql`](setup-readonly-login.sql). Two layers: the tools can't write *and* the login can't write.
- **Local & private.** Runs on your machine; your connection string and data never reach a third-party server.
- **Timeouts + ReadOnly intent** so even a heavy diagnostic won't hurt production.

## 🚀 Quick start

Create the read-only login ([`setup-readonly-login.sql`](setup-readonly-login.sql)), then add this to your MCP client's config (works for most clients that use the `mcpServers` format):

```json
{
  "mcpServers": {
    "mssql-health": {
      "command": "npx",
      "args": ["-y", "@dmcteknoloji/mssql-health-mcp"],
      "env": {
        "MSSQL_CONNECTION_STRING": "Server=YOURSERVER,1433;Database=master;User Id=mcp_readonly;Password=***;Encrypt=true;TrustServerCertificate=true;ApplicationIntent=ReadOnly;"
      }
    }
  }
}
```

Then just ask: *"Show my SQL Server health"*, *"Why is my server slow right now?"*, *"Which indexes are missing?"*

## 🧰 Tools

| Tool | What it answers |
|------|-----------------|
| `sunucu_sagligi` | Server health: version, edition, CPU, memory, uptime, database count |
| `aktif_sorgular_blocking` | Running queries + blocking chain — *"why is it slow right now?"* |
| `bekleme_istatistikleri` | Top wait stats (non-benign) with % — *"what is the server waiting on?"* |
| `eksik_indexler` | Missing-index suggestions by impact (suggests only, never creates) |
| `log_kullanimi` | Transaction log size & used % per database |
| `disk_dosya` | Data/log file sizes + disk free space per volume |
| `yedek_durumu` | Last full/diff/log backup per database — "is my backup current?" |
| `tempdb_kullanimi` | tempdb space by type (user/internal objects, version store, free) |
| `deadlock` | Recent deadlock timestamps from system_health |
| `surekli_izleme` | Points you to continuous monitoring → SentinelDB360 |

## 🩺 → 📈 Next step: continuous monitoring

This MCP gives you a **snapshot** ("what's happening now"). For 24/7 monitoring, history, alerting and governance, DMC's product **[SentinelDB360](https://sentineldb360.com)** (database monitoring software) is built for exactly that. Ask the assistant *"how do I monitor this continuously?"* and the `surekli_izleme` tool explains.

## License

MIT — © Çağlar Özenç · [caglarozenc.com](https://caglarozenc.com)

<br/>

---

<h2 id="-türkçe">🇹🇷 Türkçe</h2>

<p><b>Canlı</b> SQL Server'ınızı yapay zekaya sorun. Claude, ChatGPT, Gemini — ya da herhangi bir MCP istemcisi — gerçek sunucunuzu DMV'lerle teşhis etsin. <b>Tasarımı gereği salt-okunur.</b></p>

ChatGPT log dosyasının *nasıl* küçültüleceğini bilir, ama **sizin** sunucunuzu göremez. Bu MCP görür. **"Sunucum şu an neden yavaş?"** diye sorun; gerçek cevabı — canlı blocking zinciri, en çok bekleme, eksik index — doğrudan sunucunuzdan alın.

> **Bir MCP'nin değeri bilgide değil, erişimde**: internetin göremeyeceği tek şeye — **sizin** veritabanınızın canlı durumuna — erişiminde.

### 🔒 Tasarımı gereği salt-okunur

Müşteriye güvenle teslim edilecek kadar güvenli:

- **Yazma aracı yok.** Yalnızca DMV/SELECT teşhis araçları. `INSERT/UPDATE/DELETE`, `DROP/ALTER`, "rastgele sorgu çalıştır" araç yüzeyinde **yoktur** — yapısal olarak hiçbir şey değiştiremez.
- **En az ayrıcalık.** Salt-okunur login ile bağlanın (`VIEW SERVER STATE`). Hazır script: [`setup-readonly-login.sql`](setup-readonly-login.sql). İki kat koruma: araç da yazamaz, login de yazamaz.
- **Lokal & gizli.** Sizin makinenizde çalışır; bağlantı dizeniz ve verileriniz üçüncü bir sunucuya gitmez.
- **Zaman aşımı + ReadOnly intent** — ağır bir teşhis bile production'ı yormaz.

### 🚀 Hızlı başlangıç

Salt-okunur login'i oluşturun ([`setup-readonly-login.sql`](setup-readonly-login.sql)), sonra MCP istemcinizin ayar dosyasına yukarıdaki `mcpServers` bloğunu ekleyin (çoğu istemci aynı biçimi kullanır). Ardından sorun: *"SQL sunucumun sağlığını göster"*, *"Sunucum şu an neden yavaş?"*, *"Hangi index'ler eksik?"*

### 🧰 Araçlar

| Araç | Ne yanıtlar |
|------|-------------|
| `sunucu_sagligi` | Sunucu sağlığı: sürüm, edition, CPU, bellek, uptime, veritabanı sayısı |
| `aktif_sorgular_blocking` | Çalışan sorgular + blocking zinciri — *"şu an neden yavaş?"* |
| `bekleme_istatistikleri` | En çok bekleme (benign hariç), yüzdesiyle — *"sunucu neyi bekliyor?"* |
| `eksik_indexler` | Etkiye göre eksik index önerileri (yalnızca önerir, oluşturmaz) |
| `log_kullanimi` | Veritabanı başına transaction log boyutu ve kullanım % |
| `disk_dosya` | Veri/log dosya boyutları + disk boş alanı |
| `yedek_durumu` | DB başına son full/diff/log yedeği — "yedeğim güncel mi?" |
| `tempdb_kullanimi` | tempdb alan kullanımı (kullanıcı/dahili nesneler, version store, boş) |
| `deadlock` | system_health'ten son deadlock zamanları |
| `surekli_izleme` | Sürekli izleme için yönlendirir → SentinelDB360 |

### 🩺 → 📈 Bir adım sonrası: sürekli izleme

Bu MCP **anlık** bir görüntü verir ("şu an ne oluyor"). 7/24 izleme, geçmiş, uyarı ve yönetişim için DMC'nin ürünü **[SentinelDB360](https://sentineldb360.com)** (veritabanı izleme yazılımı) tam bunun için. Asistana *"bunu sürekli nasıl izlerim?"* diye sorun; `surekli_izleme` aracı anlatır.

### Lisans

MIT — © Çağlar Özenç · [caglarozenc.com](https://caglarozenc.com)
