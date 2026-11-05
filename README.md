TÜRK DAMASI - Animasyonlu hamle sürümü + Canlı Yayın (Kral Tahtı) modu

Bu sürümde hem oyuncunun hem yapay zekânın taşları kareler arasında kayarak hareket eder.
Çoklu taş alma sırasında her atlayış ayrı ayrı animasyonla gösterilir.

Dosyalar:
- App.js: Güncel oyun, animasyon ve canlı yayın kodu
- package.json: Expo bağımlılıkları
- README.md: Proje açıklaması

Expo Snack'e aktarırken App.js ve package.json yeterlidir.

CANLI YAYIN MODU (📺 Canlı)
TikTok canlı yayınında izleyiciler yorumla oynar. Kazanan kalır, sıradaki meydan okur.

Yorum komutları:
- !katıl  → sıraya gir (ilk iki kişi oyunu başlatır)
- C3 C4   → hamle (harf sütun A-H, rakam satır 1-8; Beyaz alttan başlar)
- C3 E3 G3 → çoklu taş alma tek yorumda
- !çık    → sıradan çık / oyundan ayrıl (oyundaysa kaybedersin)
Başka tüm yorumlar sohbettir, oyunu etkilemez. Hamle sadece sırası gelen oyuncudan kabul edilir.

Kurallar:
- Hamle süresi 30 sn. Süre dolarsa rastgele geçerli hamle yapılır; arka arkaya 2 kez dolarsa oyun kaybedilir.
- Kazanan "kral" olarak kalır, seri sayılır, her oyunda renkler döner.
- Beraberlikte kral kalır, meydan okuyan sıranın sonuna gider.

TikTok bağlantısı (TikTool, ücretsiz katman):
1. tik.tools'a kayıt ol, API anahtarını al.
2. Uygulamada 📺 Canlı modunu aç, ⚙ panelinde TikTok kullanıcı adını ve anahtarı yaz, Bağlan'a bas.
3. TikTok'ta canlı yayın aç, ekranı paylaş. Yayına geçmeden ⚙ panelini kapat.
Anahtarı koda veya depoya YAZMA; sadece uygulamadaki kutuya yapıştır.
Yayın olmadan denemek için ⚙ panelindeki "TEST: sahte yorum" kutusunu ve "Hızlı deneme" düğmesini kullan.
