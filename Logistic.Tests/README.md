# Logistic backend testleri

xUnit testleri mal kabul, rafa yerleştirme ve dosya logger'ını kontrol eder. Repo kökünde:

```powershell
# MongoDB gerektirmeyen testler
dotnet test Logistic.Tests --filter "Category!=Integration"

# MongoDB entegrasyon testleri dahil tüm testler
$env:LOGISTIC_TEST_MONGO_URI = "mongodb://localhost:27017"
dotnet test Logistic.Tests

# Yalnız entegrasyon testleri
dotnet test Logistic.Tests --filter "Category=Integration"
```

.NET 10 SDK gerekir. Entegrasyon testleri için MongoDB çalışmalı ve `LOGISTIC_TEST_MONGO_URI` bağlantısı veritabanı oluşturma / silme izni sağlamalıdır. Ayrı bir test MongoDB örneği kullanılabilir. Ana uygulamanın `Logistic` veritabanı kullanılmaz.

## Kapsam

- **ReceiptValidationTests:** geçersiz kullanıcı / ürün kimliği, pozitif miktar ve zorunlu anahtar.
- **ReceiptIntegrationTests:** kabul, stok, hareket, kullanıcı kimliği, aynı anahtarla tekrar, farklı içerikte `409`, kapasite, aktif kayıtlar ve aynı API içindeki eş zamanlı istekler.
- **PutawayValidationTests:** geçersiz kimlik, boş barkod / raf / anahtar ve pozitif miktar.
- **PutawayIntegrationTests:** kaynak / hedef bakiyesi, hareket kaydı, işlem tekrarı, yeterli stok, raf kapasitesi, aktif kayıtlar ve kabul / yerleştirme işlemlerinin eş zamanlı çalışması.
- **FileLoggerTests:** klasör oluşturma, Türkçe içerik, exception kaydı, eş zamanlı yazım, log seviyeleri ve yazılamayan dosya yolu.

HTTP entegrasyon testleri API'yi geçici portta başlatıp JWT kimliği, roller, zorunlu header ve tekrar gönderim davranışını doğrular. Test API süreci sonunda kapatılır.

MongoDB testleri her test örneği için `logistic_receipt_test_<guid>` veya `logistic_putaway_test_<guid>` adlı ayrı veritabanı oluşturur; test sonunda bu veritabanını temizler. Dosya logger testleri geçici klasörler kullanır.

## Mevcut sınır

Standalone MongoDB ile çalışır. Stok handler'ları ortak uygulama içi kilit kullanır; test edilen eş zamanlılık aynı API süreci içindedir. Transaction, otomatik rollback veya birden fazla API sunucusu arasında koordinasyon bulunmaz. Bu testlerin geçmesi bu özelliklerin uygulanmış olduğu anlamına gelmez.

React testleri ve arayüz derlemesi için `Logistic.Frontend` klasöründe `npm test` ve `npm run build` kullanılır. Kurulum bilgileri [ana README'de](../README.md).
