# Logistic API sözleşmesi

Bu dosya mevcut .NET backend'inin arayüzle kullandığı sözleşmeyi anlatır. API adresi `https://localhost:7228/api`. Çalışan backend'in ayrıntılı Swagger tanımı `https://localhost:7228/swagger/v1/swagger.json` adresindedir.

JSON alanları camelCase, MongoDB kimlikleri string, tarihler UTC'dir. Barkodlar sayı değil string olarak gönderilir. Miktarlar ve kapasite tam sayıdır.

## Canlı endpoint'ler

| Method | `/api` sonrası yol | İstek / cevap | Mevcut yetki |
| --- | --- | --- | --- |
| POST | `/Logistic/User/Login` | E-posta, parola / kullanıcı + token | Anonim |
| POST | `/Logistic/User/CreateUser` | Kullanıcı bilgileri / kullanıcı | Anonim |
| POST | `/Product` | Ürün / ürün | Admin |
| GET | `/Product?pageId=1&take=1000` | Ürün listesi | Anonim |
| POST | `/Shelf` | Raf / raf | Admin |
| GET | `/Shelf?pageId=1&take=1000` | Raf listesi | Anonim |
| POST | `/Receipt` | Mal kabul / kabul kaydı | Admin, User, Employee |
| GET | `/Receipt?pageId=1&take=1000` | Kabul listesi | Anonim |
| GET | `/Stock?pageId=1&take=1000` | Stok listesi | Anonim |
| POST | `/Stock/Putaway` | Yerleştirme / stok hareketi | Admin, User, Employee |

Ürün, raf ve kabul listeleri `pageId` ile `take` değerlerini kullanır; bu değerler pozitif olmalıdır. Mevcut stok handler'ı ise bu parametreleri kullanmadan bütün aktif stokları döndürür. Liste yanıtının `data` alanı array'dir; toplam kayıt / sayfa zarfı yoktur.

## Yanıt ve oturum

Backend `Response<T>` biçimini kullanır:

```json
{ "data": { "id": "507f1f77bcf86cd799439011" }, "errors": null }
```

Hatalı işlemlerde örneğin:

```json
{ "data": null, "errors": ["Kaynak rafta yeterli stok yok."] }
```

HTTP durum kodu response gövdesindeki bir alandan ayrı iletilir. Model doğrulaması ASP.NET'in `ValidationProblemDetails` cevabını, bazı controller kontrolleri düz hata mesajını da döndürebilir. Arayüz başarılı cevabın `data` alanını açar.

Login isteği:

```json
{ "email": "user@example.com", "password": "Demo123!" }
```

Login cevabındaki kullanıcı alanları `id`, `name`, `surName`, `email`, `role`, `token`, `status`, `createdDate`, `modifiedDate`, `createdBy`, `modifiedBy` şeklindedir. Backend rolü Admin / User, arayüzün iç modeli admin / employee'dir. Canlı arayüz User rolünü User olarak gösterir.

Arayüz login cevabını `sessionStorage` içinde saklar; ayrı bir `/auth/me` çağrısı yapmaz. Yetkili istek başlığı:

```http
Authorization: Bearer LOGIN_CEVABINDAKI_TOKEN
```

Kayıt isteği:

```json
{
  "name": "Elif",
  "surName": "Yılmaz",
  "email": "user@example.com",
  "password": "Demo123!",
  "isAdmin": false,
  "createdBy": "self-registration"
}
```

Kayıt cevabı token üretmez; arayüz kayıttan sonra login gönderir. Mevcut kayıt endpoint'i `isAdmin: true` ile admin de oluşturabilir. Bu geliştirme davranışıdır; gerçek dağıtım öncesinde admin ataması ve açık listeleme endpoint'lerinin yetkileri sınırlandırılmalıdır.

## Ürün, raf ve stok

`POST /Product`:

```json
{
  "name": "USB-C Şarj Kablosu",
  "sku": "ELK-001",
  "barcode": "8690000001001",
  "category": "Elektronik",
  "unit": "adet",
  "salePrice": 249.9,
  "minStock": 5
}
```

Ürün cevabı bu alanlara `id` ve `isActive` ekler. Handler metin alanlarının boş olmamasını ve `salePrice > 0` koşulunu kontrol eder. Barkod / SKU benzersizliği ve `minStock` alt sınırı şu an backend'de ayrıca kontrol edilmiyor.

`POST /Shelf`:

```json
{ "code": "A-01", "zone": "A bölgesi", "capacity": 600 }
```

Raf cevabı `id`, `code`, `zone`, `capacity`, `isReceiving` içerir. Kod trimlenip büyük harfe çevrilir. `code: "KABUL"` ile oluşturulan raf otomatik olarak kabul konumu olur. Diğer kodlar normal depolama rafıdır. Kod / bölge zorunlu, kapasite pozitiftir; kod benzersizliği şu an ayrıca kontrol edilmiyor.

`GET /Stock` yanıtındaki `data`:

```json
[
  {
    "productId": "507f1f77bcf86cd799439011",
    "shelfId": "507f1f77bcf86cd799439012",
    "quantity": 10
  }
]
```

Bir stok bakiyesi ürün + raf üzerinden bulunur. Kapasite, raftaki bütün ürünlerin miktar toplamına göre hesaplanır; hacim / ağırlık ölçüsü değildir.

## Mal kabul

```http
POST /api/Receipt
Content-Type: application/json
Authorization: Bearer TOKEN
Idempotency-Key: BENZERSIZ_ISLEM_ANAHTARI
```

```json
{
  "supplier": "Marmara Tedarik",
  "productId": "507f1f77bcf86cd799439011",
  "quantity": 10,
  "note": "Teslim alındı"
}
```

Ürün kimliği mal kabulde gönderilir; barkod arayüzde yüklenen ürün listesiyle eşleştirilir. Aktif kullanıcı / ürün, pozitif miktar, tedarikçi ve KABUL kapasitesi kontrol edilir. Kabul kaydı oluşur, KABUL stoğu artar ve `type: "receipt"` hareketi yazılır.

Cevap alanları: `id`, `reference`, `supplier`, `productId`, `quantity`, `note`, `createdAt`, `modifiedDate`, `createdBy`, `modifiedBy`, `userName`. Referans `MK-` ile başlayan benzersiz bir değerdir. Yeni işlem ve aynı işlemin tekrarı `201` döner.

## RF / rafa yerleştirme

```http
POST /api/Stock/Putaway
Content-Type: application/json
Authorization: Bearer TOKEN
Idempotency-Key: BENZERSIZ_ISLEM_ANAHTARI
```

```json
{
  "productBarcode": "8690000001001",
  "sourceShelfId": "507f1f77bcf86cd799439012",
  "targetShelfCode": "A-01",
  "quantity": 3
}
```

RF ekranı ürün / raf listelerini kullanır; canlı modda ayrı bir barkod arama endpoint'ine ihtiyaç duymaz. Son istekte barkod ve konumlar backend'de yeniden bulunur. Kaynak KABUL veya başka bir raf olabilir; hedef KABUL olamaz. Kaynak / hedef aynı olmamalı, kayıtlar aktif olmalı, stok ve hedef kapasitesi yeterli olmalıdır.

Kaynak bakiyesi azalır, hedef bakiyesi artar ve hareket kaydedilir. Toplam ürün stoğu değişmez. `201` cevabındaki hareket alanları: `id`, `type` (`putaway`), `productId`, `quantity`, `fromShelfId`, `toShelfId`, `reference`, `createdAt`, `createdBy`, `userName`. Referans `RF-` ile başlar.

## İşlem tekrarı ve mevcut sınırlar

Mal kabul / yerleştirme `CreatedBy` alanını JSON'dan değil JWT claim'inden, `IdempotencyKey` alanını header'dan alır. Yeni işlemde yeni anahtar kullanılır; aynı içerik yeniden gönderilirken anahtar korunur. Kullanıcı + anahtar üzerinden önceki sonuç bulunur; aynı anahtar farklı içerikle kullanılırsa `409` döner.

Her iki handler ortak bir `SemaphoreSlim` kullanır. Bu kilit aynı API süreci içindeki eş zamanlı stok işlemlerini sıralar. Farklı API süreçlerini koordine etmez. Mevcut yazımlar transaction içinde değildir; veritabanı hatasında otomatik rollback yoktur. Benzersiz veritabanı indeksleri ve işlem bütünlüğü geliştirme alanlarıdır.

## Yalnız demo modunda olan endpoint'ler

Tarayıcıdaki MSW sözleşmesi gerçek backend'e göre farklı yollar içerir:

- `/products`, `/products/by-barcode/{barcode}`, `PUT /products/{id}`
- `/shelves`, `/stock`, `/receipts`, `/stock/putaway`
- `/dashboard`, `/stock/movements`, `/sales`
- `/users`, `PATCH /users/{id}`

Bu yolların tamamı .NET API endpoint'i olarak değerlendirilmemeli. Canlı arayüz mevcut işlemler için tablodaki tekil yolları kullanır. Özet, satış, hareket geçmişi ve kullanıcı yönetimi ekranları yalnız demo modunda açıktır. `/auth/me` canlı backend'de yoktur ve arayüz bu endpoint'i çağırmaz.

`openapi.json` ve `BackendDtos.cs` demo / genişletme örnekleridir; gerçek backend'in Swagger tanımı ve Application command / response sınıfları güncel uygulamanın kaynağıdır. [Logistic.http](Logistic.http) yalnız mevcut canlı endpoint örneklerini içerir.
