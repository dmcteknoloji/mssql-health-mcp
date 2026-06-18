# mssql-health-mcp

[![npm](https://img.shields.io/npm/v/@dmcteknoloji/mssql-health-mcp)](https://www.npmjs.com/package/@dmcteknoloji/mssql-health-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![node >=18](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)

**Salt-okunur SQL Server sağlık/teşhis MCP sunucusu.** MCP destekleyen istemciniz, canlı SQL Server'ınızı DMV'lerle teşhis etsin: "Sunucum neden yavaş?", "Hangi index'ler eksik?", "Şu an kim kimi blokluyor?" — gerçek cevapları, gerçek sunucudan.

> Statik bir bilgi tabanı **değildir**. Değeri, internetin/genel modellerin göremeyeceği şeye erişmesindedir: **sizin canlı sunucunuzun o anki durumu.**

## 🔒 Güvenlik — tasarımı gereği salt-okunur

Bu en önemli kısım:

- **Yazma aracı yoktur.** Sunucu yalnızca üç teşhis aracı sunar; hepsi `SELECT`/DMV'dir. `INSERT/UPDATE/DELETE`, `DROP/ALTER`, "rastgele sorgu çalıştır" **yoktur**. Yapısal olarak hiçbir şey değiştiremez.
- **En az ayrıcalık.** Önerilen kullanım: salt-okunur bir login (`VIEW SERVER STATE`). Hazır script: [`setup-readonly-login.sql`](setup-readonly-login.sql). İki kat koruma: araç da yazamaz, login de yazamaz.
- **Lokalde çalışır.** Sunucu sizin makinenizde çalışır; bağlantı dizeniz ve verileriniz üçüncü bir sunucuya gitmez.
- **`ApplicationIntent=ReadOnly` + sorgu zaman aşımı (30 sn).** Ağır bir teşhis bile production'ı yormaz.
- Açık kaynak — kodu denetleyebilirsiniz.

## Kurulum

Kurulum gerektirmez; istemci `npx` ile çalıştırır. Önce salt-okunur login'i oluşturun ([`setup-readonly-login.sql`](setup-readonly-login.sql)), sonra istemcinize ekleyin.

### MCP istemci yapılandırması

MCP destekleyen istemcilerin çoğu aynı `mcpServers` biçimini kullanır. İstemcinizin MCP ayar dosyasına şunu ekleyin:

```json
{
  "mcpServers": {
    "mssql-health": {
      "command": "npx",
      "args": ["-y", "@dmcteknoloji/mssql-health-mcp"],
      "env": {
        "MSSQL_CONNECTION_STRING": "Server=SUNUCUM,1433;Database=master;User Id=mcp_readonly;Password=***;Encrypt=true;TrustServerCertificate=true;ApplicationIntent=ReadOnly;"
      }
    }
  }
}
```

Komut satırından MCP ekleyen istemcilerde eşdeğeri:

```bash
<istemci> mcp add mssql-health \
  -e MSSQL_CONNECTION_STRING="Server=SUNUCUM,1433;Database=master;User Id=mcp_readonly;Password=***;TrustServerCertificate=true" \
  -- npx -y @dmcteknoloji/mssql-health-mcp
```

### Bağlantı (env)

İki yöntemden biri:

- **ADO bağlantı dizesi:** `MSSQL_CONNECTION_STRING` (yukarıdaki gibi — tanıdık `Server=...;Database=...;User Id=...;Password=...` biçimi).
- **Ayrı değişkenler:** `MSSQL_SERVER`, `MSSQL_PORT`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD`, `MSSQL_ENCRYPT`, `MSSQL_TRUST_CERT`.

## Araçlar

| Araç | Ne döndürür |
|------|-------------|
| `sunucu_sagligi` | Sürüm, edisyon, CPU, fiziksel bellek, uptime, veritabanı sayısı, online olmayan DB |
| `aktif_sorgular_blocking` | O an çalışan sorgular + blocking zinciri (oturum, engelleyen, bekleme türü/süresi, CPU, sorgu metni) |
| `eksik_indexler` | SQL Server'ın önerdiği eksik index'ler, etki skoruna göre sıralı (yalnızca **önerir**, oluşturmaz) |

Örnek sorular:
- "Sunucum şu an neden yavaş?" → `aktif_sorgular_blocking`
- "Performans için hangi index'ler eksik?" → `eksik_indexler`
- "Sunucunun genel durumu nedir?" → `sunucu_sagligi`

## Yerel test (MCP Inspector)

```bash
MSSQL_CONNECTION_STRING="Server=...;User Id=mcp_readonly;Password=***;TrustServerCertificate=true" \
  npx -y @modelcontextprotocol/inspector npx -y @dmcteknoloji/mssql-health-mcp
```

## Sınırlar / yol haritası (v1)

- Yalnızca 3 araç (read-only DMV). Sıradaki adaylar: wait stats, pahalı sorgular (query store/plan cache), log & dosya kullanımı, yedek durumu.
- Şu an SQL Authentication odaklı; Entra ID / Windows auth ileride.

## Gizlilik notu

Araç sonuçları, kullandığınız istemcinin modeline bağlam olarak gönderilir. Hassas ortamlarda bunu göz önünde bulundurun (yerel model kullanımı bir seçenek).

## Bir adım sonrası: sürekli izleme

Bu MCP **anlık** bir görüntü verir ("şu an ne oluyor"). Sürekli izleme, geçmiş trend, otomatik uyarı ve yönetişim istiyorsanız DMC'nin ürünü **[SentinelDB360](https://sentineldb360.com)** (veritabanı izleme yazılımı) tam bunun için. Asistana *"bunu sürekli nasıl izlerim?"* diye sorarsanız `surekli_izleme` aracı anlatır.

## Lisans

MIT — © Çağlar Özenç · [caglarozenc.com](https://caglarozenc.com)
