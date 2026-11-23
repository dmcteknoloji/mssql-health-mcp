# Veri akışı belgesi

Bu belge, mssql-health-mcp çalıştığında hangi verinin nereye gittiğini tek sayfada anlatır. Müşterinin BT güvenlik onayı için hazırlandı. **Hukuk gözden geçirmesi bekliyor, henüz onaylı bir metin değildir.**

## Kısa özet

- Sunucu müşterinin kendi makinesinde çalışır. DMC'ye ya da başka bir sunucuya kendiliğinden hiçbir şey göndermez.
- Araç sonuçları, bu sunucuyu çağıran MCP istemcisine döner. İstemci bunları kullandığı yapay zeka sağlayıcısına gönderir. Verinin hangi ülkeye gittiğini istemcinin ve sağlayıcının ayarı belirler, bu yazılım belirlemez.
- Yalnızca okuma yapar. Tablo içeriği okunmaz. Sorgu metni varsayılan olarak kapalıdır.

## İşletim modları

| Mod | Durum | Veri nereye gider |
|-----|-------|-------------------|
| 1. Müşterinin kendi LLM hesabı | Mevcut | Müşterinin seçtiği istemci ve sağlayıcı. DMC bu akışın tarafı değildir. |
| 2. DMC'nin barındırdığı LLM | **Yok** | Henüz yazılmadı. Açılırsa ayrı belge ve avukat görüşü gerekir, bu belge onu kapsamaz. |

## Araç çıktısında hangi alanlar var

| Alan türü | Hangi araçlarda | Varsayılan davranış |
|-----------|-----------------|---------------------|
| Veritabanı, tablo, index, login, makine ve uygulama adları | aktif_sorgular_blocking, eksik_indexler, index_sagligi, disk_dosya, yedek_durumu, log_kullanimi, vlf_log_sagligi, acik_transactionlar, sunucu_sagligi, tam_teshis | Sıkı bir ad kalıbına uymayan ad `gecersiz-ad` yazılır. Kalıp `MSSQL_HEALTH_AD_KALIBI` ile gevşetilir. |
| SQL sorgu metni | aktif_sorgular_blocking, pahali_sorgular | **Kapalı.** `MSSQL_HEALTH_SORGU_METNI=1` ile açılır. Açıkken yorumlar silinir, dizgi ve sayı sabitleri `?` olur, 200 karakterde kesilir. |
| Sayaçlar ve süreler (CPU, okuma, bekleme, boyut, tarih) | tüm araçlar | Maskelenmez. Kişisel veri taşımaz. |
| `CREATE INDEX` önerisi | eksik_index_create | Tablo ve kolon adı içerir. Ad kalıbı uygulanmaz, ayraç ve kontrol karakterleri etkisizlenir. Müşterinin şema adları LLM sağlayıcısına gider. |
| Hata iletisi | tüm araçlar | Kesilir ve temizlenir. SQL Server'ın hata metni nesne adı, bağlantı hatalarında sunucu adresi içerebilir. |

Çıktıda tablo satırı (iş verisi), parola, parola özeti ve bağlantı dizesi bulunmaz. Bağlantı dizesi yalnızca ortam değişkeninde durur ve araç çıktısına yazılmaz.

## Ek koruma önlemleri

- Her yanıt, çağrıya özgü rastgele bir belirteçli zarfa sarılır ve içeriğin veri olduğu, talimat olmadığı yazılır.
- Sertifika doğrulaması varsayılan olarak açıktır.
- Yanıtlarda tanıtım metni yoktur.
- Bağlantı için salt okunur ayrı bir login önerilir (`setup-readonly-login.sql`).

## Bilinen sınırlar

- Ad kalıbı tek sözcüklü sıradan bir adı geçirir. Bir veritabanı adı yapay zekayı yönlendiren tek bir sözcük olabilir. Zarf ve salt okunur login bu yüzden gereklidir.
- `eksik_index_create` şema adlarını olduğu gibi taşır.
- Hangi sağlayıcıya, hangi ülkeye ve hangi saklama süresiyle gidildiği istemciye bağlıdır ve bu belgede güvence verilmez.

## Müşteri için kontrol listesi

1. Kullanılan istemci ve LLM sağlayıcısı kurumsal veri politikasına uygun mu.
2. Sorgu metni gerekiyor mu. Gerekmiyorsa `MSSQL_HEALTH_SORGU_METNI` verilmez.
3. Şema adlarının sağlayıcıya gitmesi kabul edilebilir mi.
4. Bağlantı yalnızca okuma yetkili ayrı bir login ile mi kurulu.
5. Çalıştırma süresi için yoğun olmayan saat seçildi mi.
