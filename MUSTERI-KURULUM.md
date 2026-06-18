# SQL Server Sağlık Asistanı — Kurulum Rehberi

Bu asistan sayesinde SQL Server'ınıza **yapay zekaya soru sorar gibi** sorabilirsiniz:
*"Sunucum neden yavaş?"* yazarsınız, gerçek cevabı alırsınız.

> ✅ **Tamamen güvenli:** Asistan sunucunuzu yalnızca **okur**. Hiçbir şey eklemez, silmez, değiştirmez.

Kurulum **3 adım**, hepsi "indir → çift tıkla → yapıştır". Yaklaşık **10 dakika**. Takılırsanız DMC yanınızda.

---

## 🎁 Başlamadan: DMC size bir "ayar metni" verdi

Kurulum sırasında DMC size küçük bir **ayar metni** iletti (içinde sunucu adınız ve şifreniz hazır dolu). Onu **3. adımda** yapıştıracaksınız. Şimdi elinizin altında olsun (e-posta / not).

---

## Adım 1 — "Motoru" kurun (Node.js)

1. İnternet tarayıcınızda şu adrese gidin: **https://nodejs.org**
2. Ortadaki yeşil **"LTS"** yazan butona tıklayın. Dosya inecek.
3. İnen dosyaya **çift tıklayın** → açılan pencerelerde hep **İleri (Next)** → **Kur (Install)** → **Bitir (Finish)**.

> Bu, asistanın çalışması için gereken motordur. **Bir kez** kurulur, bir daha uğraşmazsınız.

---

## Adım 2 — Yapay zeka uygulamasını kurun

En kolayı **Claude Desktop** (ücretsiz):

1. Tarayıcıda şu adrese gidin: **https://claude.ai/download**
2. **Windows** sürümünü indirin, çift tıklayıp kurun.
3. Açın, ücretsiz bir hesapla giriş yapın.

> Şirketinizde zaten **ChatGPT** veya **Gemini** kullanıyorsanız sorun değil — DMC o kuruluma yardımcı olur. Ama en kolayı budur.

---

## Adım 3 — DMC'nin verdiği ayarı yapıştırın

1. **Claude Desktop**'ı açın.
2. Sağ üstten (veya menüden) **Settings (Ayarlar)** → **Developer** → **Edit Config** butonuna tıklayın.
3. Açılan dosyada ne yazıyorsa **silin**, **DMC'nin size gönderdiği metni** olduğu gibi **yapıştırın**.
4. **Kaydedin** (klavyeden **Ctrl + S**).
5. Claude Desktop'ı **tamamen kapatın ve tekrar açın**.

---

## 🎉 Bitti! Artık sorabilirsiniz

Claude'un yazı kutusuna örnek sorular:

- **"SQL sunucumun sağlığını göster"**
- **"Sunucum şu an neden yavaş?"**
- **"Hangi index'ler eksik?"**
- **"Şu an kim kimi blokluyor?"**

Asistan, cevabı **doğrudan sizin sunucunuzdan** çekip sade bir dille anlatır.

---

## 🔒 Bu güvenli mi? (Evet)

- Asistan sunucunuzu **sadece okur** — hiçbir şey eklemez, silmez, değiştirmez. Yapısal olarak buna izin yoktur.
- DMC, yalnızca **okuma yetkili** özel bir kullanıcı açtı; asistan bunun dışına çıkamaz.
- Verileriniz **sunucunuzdan dışarı çıkmaz**, DMC'ye gitmez — sizin bilgisayarınızla sunucunuz arasında kalır.

---

## ❓ Takıldınız mı?

DMC her adımda yanınızda: **caglarozenc.com** · destek için bizimle iletişime geçin.
