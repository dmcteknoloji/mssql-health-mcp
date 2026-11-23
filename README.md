<h1 align="center">🩺 mssql-health-mcp</h1>

<p align="center">
  <b>Ask your AI about your <i>live</i> SQL Server.</b><br/>
  A read-only MCP server that lets Claude, ChatGPT, Gemini — or any MCP client —<br/>
  diagnose your real SQL Server through DMVs. <b>Read-only by design.</b>
</p>

<p align="center">
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

Built so that the tools themselves cannot change anything:

- **No write tools.** Only DMV/SELECT diagnostics. `INSERT/UPDATE/DELETE`, `DROP/ALTER`, "run any SQL" **don't exist** in the tool surface. Structurally cannot change anything.
- **Least privilege.** Connect with a read-only login (`VIEW SERVER STATE`). Ready script: [`setup-readonly-login.sql`](setup-readonly-login.sql). Two layers: the tools can't write *and* the login can't write.
- **Runs locally, but tool output goes to your AI client.** The MCP server runs on your machine and sends nothing to a server of ours. Its tool results are returned to your AI client, and therefore to the LLM provider you use. That output can include SQL text (which may contain literal values such as names, e-mail addresses or amounts) and database, login, host and application names. Check your organization's data policy first and prefer an enterprise-grade LLM account.
- **Output is treated as untrusted data.** Names and query text come from your server and can be attacker controlled, so they can try to steer your AI client (prompt injection). Every value goes through one sanitizer (line breaks, control characters, `` ` | [ ] ( ) < > ! `` are neutralised). Database, table, index, login, host and application names must match a strict pattern (no spaces, 64 characters, letters, digits and `_ . - $ # @ : \ /`) or they print as `gecersiz-ad`. Every response is wrapped in a random per-call marker that says the content is data, not instructions. This lowers the risk, it does not remove it. A plain single-word name can still pass, so keep the read-only login and review what your client does with tool output.
- **Query text is off by default.** `aktif_sorgular_blocking` and `pahali_sorgular` do not return SQL text unless you set `MSSQL_HEALTH_SORGU_METNI=1`. When on, comments are stripped, string and number literals become `?`, and the text is cut at 200 characters.
- **Certificate validation is on by default.** For a local test server with a self-signed certificate set `MSSQL_TRUST_SERVER_CERT=1` (or add `TrustServerCertificate=true` to the connection string). Do not do this against a production server over an untrusted network.
- **No advertising in tool output.** Responses carry no promotional text. The `surekli_izleme` tool is only listed if you set `MSSQL_HEALTH_TANITIM=1`.
- **Timeouts and a small connection pool** limit the load a diagnostic adds. This is not a guarantee: the diagnostics still read DMVs, so run them outside peak hours on busy systems. `ApplicationIntent=ReadOnly` only routes to a readable secondary and does not block writes. The real protection is the read-only login.

## 🚀 Quick start

Create the read-only login ([`setup-readonly-login.sql`](setup-readonly-login.sql)), then add this to your MCP client's config (works for most clients that use the `mcpServers` format):

```json
{
  "mcpServers": {
    "mssql-health": {
      "command": "npx",
      "args": ["-y", "github:dmcteknoloji/mssql-health-mcp#v1.1.0"],
      "env": {
        "MSSQL_CONNECTION_STRING": "Server=YOURSERVER,1433;Database=master;User Id=mcp_readonly;Password=***;Encrypt=true;ApplicationIntent=ReadOnly;"
      }
    }
  }
}
```

> Needs Node.js 18+ and git (installs straight from GitHub; not published to npm). The install line is pinned to a release tag so you get the tested dependency tree. No git? Download the repo ZIP and run it with `node index.js`.

| Environment variable | Default | Effect |
|----------------------|---------|--------|
| `MSSQL_TRUST_SERVER_CERT` | off | `1` trusts a self-signed server certificate (local tests only) |
| `MSSQL_HEALTH_SORGU_METNI` | off | `1` returns masked SQL text in `aktif_sorgular_blocking` and `pahali_sorgular` |
| `MSSQL_HEALTH_AD_KALIBI` | strict pattern | Regular expression for allowed object names, loosen it if your names contain spaces |
| `MSSQL_HEALTH_TANITIM` | off | `1` lists the `surekli_izleme` tool |

Then just ask: *"Show my SQL Server health"*, *"Why is my server slow right now?"*, *"Which indexes are missing?"*

## 🧰 Tools

| Tool | What it answers |
|------|-----------------|
| `tam_teshis` | **Health report** — prioritized critical/warning findings in one call |
| `sunucu_sagligi` | Server health: version, edition, CPU, memory, uptime, database count |
| `aktif_sorgular_blocking` | Running queries + blocking chain — *"why is it slow right now?"* |
| `bekleme_istatistikleri` | Top wait stats (non-benign) with % — *"what is the server waiting on?"* |
| `eksik_indexler` | Missing-index suggestions by impact (suggests only, never creates) |
| `log_kullanimi` | Transaction log size & used % per database |
| `disk_dosya` | Data/log file sizes + disk free space per volume |
| `yedek_durumu` | Last full/diff/log backup per database — "is my backup current?" |
| `tempdb_kullanimi` | tempdb space by type (user/internal objects, version store, free) |
| `deadlock` | Recent deadlock timestamps from system_health |
| `pahali_sorgular` | Top queries by CPU/reads/duration + query text |
| `index_sagligi` | Unused indexes across all databases the login can reach (write cost, never read). Grant `CONNECT ANY DATABASE` to cover every database |
| `eksik_index_create` | Missing index suggestions as CREATE INDEX statements (review them and try in a test environment first) |
| `konfig_denetimi` | Server config best-practice audit (MAXDOP, memory…) |
| `bellek_baskisi` | Memory pressure: PLE, pending grants, free RAM |
| `vlf_log_sagligi` | VLF count + why the log can't truncate |
| `acik_transactionlar` | Long/open transactions (log bloat) |
| `surekli_izleme` | Only with `MSSQL_HEALTH_TANITIM=1`. Points you to continuous monitoring → SentinelDB360 |

## 🩺 → 📈 Next step: continuous monitoring

This MCP gives you a **snapshot** ("what's happening now"). For 24/7 monitoring, history, alerting and governance, DMC's product **[SentinelDB360](https://sentineldb360.com)** (database monitoring software) is built for exactly that. If you set `MSSQL_HEALTH_TANITIM=1`, the `surekli_izleme` tool explains it when asked.

## License

MIT — © Çağlar Özenç · [caglarozenc.com](https://caglarozenc.com)

<br/>

---

<h2 id="-türkçe">🇹🇷 Türkçe</h2>

<p><b>Canlı</b> SQL Server'ınızı yapay zekaya sorun. Claude, ChatGPT, Gemini — ya da herhangi bir MCP istemcisi — gerçek sunucunuzu DMV'lerle teşhis etsin. <b>Tasarımı gereği salt-okunur.</b></p>

ChatGPT log dosyasının *nasıl* küçültüleceğini bilir, ama **sizin** sunucunuzu göremez. Bu MCP görür. **"Sunucum şu an neden yavaş?"** diye sorun; gerçek cevabı — canlı blocking zinciri, en çok bekleme, eksik index — doğrudan sunucunuzdan alın.

> **Bir MCP'nin değeri bilgide değil, erişimde**: internetin göremeyeceği tek şeye — **sizin** veritabanınızın canlı durumuna — erişiminde.

### 🔒 Tasarımı gereği salt-okunur

Araçların kendisi hiçbir şeyi değiştiremeyecek biçimde tasarlandı:

- **Yazma aracı yok.** Yalnızca DMV/SELECT teşhis araçları. `INSERT/UPDATE/DELETE`, `DROP/ALTER`, "rastgele sorgu çalıştır" araç yüzeyinde **yoktur** — yapısal olarak hiçbir şey değiştiremez.
- **En az ayrıcalık.** Salt-okunur login ile bağlanın (`VIEW SERVER STATE`). Hazır script: [`setup-readonly-login.sql`](setup-readonly-login.sql). İki kat koruma: araç da yazamaz, login de yazamaz.
- **Lokal çalışır, ama araç çıktısı yapay zeka istemcinize gider.** MCP sunucusu sizin makinenizde çalışır ve bize hiçbir şey göndermez. Araç sonuçları yapay zeka istemcinize, dolayısıyla kullandığınız LLM sağlayıcısına iletilir. Bu çıktı SQL metnini (içinde isim, e-posta, tutar gibi sabit değerler olabilir) ve veritabanı, login, makine ve uygulama adlarını içerebilir. Önce kurumunuzun veri politikasına bakın, kurumsal bir LLM hesabı tercih edin.
- **Çıktı güvenilmeyen veri sayılır.** Adlar ve sorgu metni sunucunuzdan gelir ve saldırgan kontrolünde olabilir, yani yapay zeka istemcinizi yönlendirmeye (prompt injection) çalışabilir. Her değer tek bir temizleme işlevinden geçer (satır sonları, kontrol karakterleri ve `` ` | [ ] ( ) < > ! `` etkisiz hale gelir). Veritabanı, tablo, index, login, makine ve uygulama adları sıkı bir kalıba uymak zorundadır (boşluksuz, 64 karakter, harf, rakam ve `_ . - $ # @ : \ /`), uymayan ad `gecersiz-ad` olarak yazılır. Her yanıt, içeriğin talimat değil veri olduğunu söyleyen, çağrıya özgü rastgele bir belirteçle sarılır. Bu risk azaltır, ortadan kaldırmaz. Tek sözcüklü sıradan bir ad yine geçebilir, bu yüzden salt-okunur login'i koruyun ve istemcinizin araç çıktısıyla ne yaptığına bakın.
- **Sorgu metni varsayılan olarak kapalı.** `aktif_sorgular_blocking` ve `pahali_sorgular`, `MSSQL_HEALTH_SORGU_METNI=1` vermedikçe SQL metni döndürmez. Açıkken yorumlar silinir, dizgi ve sayı sabitleri `?` olur, metin 200 karakterde kesilir.
- **Sertifika doğrulaması varsayılan olarak açık.** Kendinden imzalı sertifikalı yerel bir test sunucusu için `MSSQL_TRUST_SERVER_CERT=1` verin (ya da bağlantı dizesine `TrustServerCertificate=true` ekleyin). Güvenilmeyen bir ağ üzerindeki üretim sunucusunda bunu yapmayın.
- **Araç çıktısında reklam yok.** Yanıtlar tanıtım metni taşımaz. `surekli_izleme` aracı yalnızca `MSSQL_HEALTH_TANITIM=1` verirseniz listelenir.
- **Zaman aşımı ve küçük bağlantı havuzu** bir teşhisin ekleyeceği yükü sınırlar. Bu bir garanti değildir, teşhisler yine DMV okur, yoğun sistemlerde yoğun saatlerin dışında çalıştırın. `ApplicationIntent=ReadOnly` yalnızca okunabilir ikincil kopyaya yönlendirir, yazmayı engellemez. Asıl koruma salt-okunur login'dir.

### 🚀 Hızlı başlangıç

Salt-okunur login'i oluşturun ([`setup-readonly-login.sql`](setup-readonly-login.sql)), sonra MCP istemcinizin ayar dosyasına yukarıdaki `mcpServers` bloğunu ekleyin (çoğu istemci aynı biçimi kullanır). Ardından sorun: *"SQL sunucumun sağlığını göster"*, *"Sunucum şu an neden yavaş?"*, *"Hangi index'ler eksik?"*

### 🧰 Araçlar

| Araç | Ne yanıtlar |
|------|-------------|
| `tam_teshis` | **Sağlık karnesi** — tek çağrıda önceliklendirilmiş kritik/uyarı bulgular |
| `sunucu_sagligi` | Sunucu sağlığı: sürüm, edition, CPU, bellek, uptime, veritabanı sayısı |
| `aktif_sorgular_blocking` | Çalışan sorgular + blocking zinciri — *"şu an neden yavaş?"* |
| `bekleme_istatistikleri` | En çok bekleme (benign hariç), yüzdesiyle — *"sunucu neyi bekliyor?"* |
| `eksik_indexler` | Etkiye göre eksik index önerileri (yalnızca önerir, oluşturmaz) |
| `log_kullanimi` | Veritabanı başına transaction log boyutu ve kullanım % |
| `disk_dosya` | Veri/log dosya boyutları + disk boş alanı |
| `yedek_durumu` | DB başına son full/diff/log yedeği — "yedeğim güncel mi?" |
| `tempdb_kullanimi` | tempdb alan kullanımı (kullanıcı/dahili nesneler, version store, boş) |
| `deadlock` | system_health'ten son deadlock zamanları |
| `pahali_sorgular` | En çok CPU/okuma/süre yiyen sorgular + metin |
| `index_sagligi` | Login'in erişebildiği tüm veritabanlarında kullanılmayan index'ler (yazma maliyeti, okunmuyor). Hepsini kapsamak için `CONNECT ANY DATABASE` verin |
| `eksik_index_create` | Eksik index önerileri CREATE INDEX cümlesi olarak (gözden geçirin, önce test ortamında deneyin) |
| `konfig_denetimi` | Sunucu konfig best-practice denetimi (MAXDOP, bellek…) |
| `bellek_baskisi` | Bellek baskısı: PLE, bekleyen talep, boş RAM |
| `vlf_log_sagligi` | VLF sayısı + log neden truncate olmuyor |
| `acik_transactionlar` | Uzun/açık transaction'lar (log şişiren) |
| `surekli_izleme` | Yalnızca `MSSQL_HEALTH_TANITIM=1` ile. Sürekli izleme için yönlendirir → SentinelDB360 |

### 🩺 → 📈 Bir adım sonrası: sürekli izleme

Bu MCP **anlık** bir görüntü verir ("şu an ne oluyor"). 7/24 izleme, geçmiş, uyarı ve yönetişim için DMC'nin ürünü **[SentinelDB360](https://sentineldb360.com)** (veritabanı izleme yazılımı) tam bunun için. `MSSQL_HEALTH_TANITIM=1` verirseniz `surekli_izleme` aracı sorulunca bunu anlatır.

### Lisans

MIT — © Çağlar Özenç · [caglarozenc.com](https://caglarozenc.com)
