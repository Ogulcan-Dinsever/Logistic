# Logistic gösterim akışı

## Canlı backend ile

Backend ve React'i [ana README'deki](../../README.md) adımlarla çalıştır. Canlı modda test hesapları otomatik oluşturulmaz; admin ve user hesaplarını önce kaydet.

1. **Admin ile giriş:** ürün ve raf oluşturma yetkisini göster.
2. **Hazırlık:** bir ürün, `KABUL` konumu ve `A-01` depolama rafı oluştur. Mevcut verileri kullanıyorsan aynı barkod / raf kodunu tekrar oluşturma.
3. **Mal kabul:** ürün barkodunu örnek okutmayla veya elle gir; tedarikçi ve miktarı doldur. Kaydettiğinde miktar KABUL stoklarına eklenir.
4. **RF terminali:** ürünü okut, kaynak KABUL'ü seç, hedef raf `A-01` ve miktarı gir. Yerleştirmeyi onayla.
5. **Stok ve raflar:** kaynak azalırken hedefin arttığını, toplam ürün stoğunun değişmediğini göster.
6. **User ile giriş:** yeni ürün / raf düğmeleri görünmez; mal kabul ve RF işlemleri kullanılabilir.
7. **Backend logu:** `Logistic.API/Logs/logistic.txt` dosyasında handler işlem kayıtlarını göster.

Bu akış MongoDB'deki gerçek yerel veriyi değiştirir. Miktarları mevcut stok ve raf kapasitesine göre belirle.

## Backend gerektirmeyen demo

Giriş ekranındaki **Bağlantı ayarları → Demo modu** seçeneğini kullan. Admin ile girip **Ayarlar → Demo verilerini sıfırla** ile örnek başlangıca dönebilirsin. Bu sıfırlama yalnız tarayıcıdaki demo verisini etkiler.

Örnek gösterim: 10 ürün kabul et → KABUL'den A-01'e 10 ürün taşı → satış ekranında 2 ürün sat → stok hareketlerini göster. Demo modunda özet, satış, hareket geçmişi ve kullanıcı yönetimi ekranları da açıktır.

Bu ek ekranlar tarayıcıdaki MSW simülasyonudur; satış ve geçmiş endpoint'leri henüz gerçek .NET backend'ine bağlı değildir.

## Anlatabileceğim teknik kararlar

- İstekler arayüzde tek API katmanından gidiyor; canlı ve demo yolları burada ayrılıyor.
- .NET controller'ları MediatR handler'larını çağırıyor; veri erişiminde repository, dönüşümlerde AutoMapper var.
- Kabul ve yerleştirmede kullanıcı JWT'den, işlem anahtarı `Idempotency-Key` başlığından geliyor.
- Fiziksel barkod okuyucu klavye gibi veri girebilir; mevcut RF ekranı elle / örnek okutmayla aynı akışı gösteriyor.
- Ortak uygulama içi kilit, aynı API süreci içindeki stok işlemlerini sıralıyor. Transaction ve otomatik rollback henüz yok.

Güncel canlı endpoint'ler için [API sözleşmesine](API-CONTRACT.md), çalışan backend'in ayrıntıları için Swagger'a bak.
