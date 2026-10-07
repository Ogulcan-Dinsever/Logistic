// TARAYICI DEMOSU / GENİŞLETME ÖRNEĞİ: Bu modeller çalışan backend command/response sınıfları değildir.
// Canlı sözleşme: API-CONTRACT.md; asıl kaynak Logistic.Application ve API Swagger tanımıdır.
// Buradaki DataAnnotations ve transaction notları mevcut backend'de uygulanmış sayılmamalıdır.

// Örnek sözleşme modelleri. Backend projesine otomatik eklenmez.
// Mevcut CreateUserCommand/LoginCommand modellerini kullanmaya devam et.
// Enumları JSONda camelCase string döndür veya burada olduğu gibi string kullan.
using System.ComponentModel.DataAnnotations;

namespace Logistic.Application.DTOs;

public sealed record ProductInput(
    [property: Required, MaxLength(200)] string Name,
    [property: Required, MaxLength(40)] string Sku,
    [property: Required, MaxLength(60)] string Barcode,
    [property: Required, MaxLength(60)] string Category,
    [property: Required, MaxLength(20), AllowedValues("adet", "kutu", "paket")] string Unit,
    [property: Range(typeof(decimal), "0", "10000000")] decimal SalePrice,
    [property: Range(0, 1000000)] int MinStock);

public sealed record ProductDto(string Id, string Name, string Sku, string Barcode,
    string Category, string Unit, decimal SalePrice, int MinStock, bool IsActive);

public sealed record ShelfInput(
    [property: Required, MaxLength(30)] string Code,
    [property: Required, MaxLength(60)] string Zone,
    [property: Range(1, 1000000)] int Capacity);
public sealed record ShelfDto(string Id, string Code, string Zone, int Capacity, bool IsReceiving);
public sealed record StockDto(string ProductId, string ShelfId, int Quantity);

public sealed record ReceiptInput(
    [property: Required, MaxLength(200)] string Supplier,
    [property: Required] string ProductId,
    [property: Range(1, 1000000)] int Quantity,
    [property: MaxLength(500)] string? Note);
public sealed record ReceiptDto(string Id, string Reference, string Supplier,
    string ProductId, int Quantity, string Note, DateTimeOffset CreatedAt, string UserName);

public sealed record PutawayInput(
    [property: Required, MaxLength(60)] string ProductBarcode,
    [property: Required] string SourceShelfId,
    [property: Required, MaxLength(30)] string TargetShelfCode,
    [property: Range(1, 1000000)] int Quantity);

public sealed record SaleLineInput(
    [property: Required] string ProductId,
    [property: Required] string ShelfId,
    [property: Range(1, 1000000)] int Quantity,
    [property: Range(typeof(decimal), "0", "10000000")] decimal UnitPrice);
public sealed record SaleInput(
    [property: Required, MaxLength(200)] string Customer,
    [property: Required, MinLength(1), MaxLength(100)] List<SaleLineInput> Lines);
public sealed record SaleDto(string Id, string Reference, string Customer,
    List<SaleLineInput> Lines, decimal Total, DateTimeOffset CreatedAt, string UserName);

// Role: UI için "admin" / "employee". JWT/DB mevcut "Admin" / "User" olabilir.
public sealed record UserDto(string Id, string FullName, string Email, string Role, bool IsActive);
public sealed record UpdateUserInput(
    [property: Required, AllowedValues("admin", "employee")] string Role, bool IsActive);

// Type: "receipt", "putaway", "sale". Quantity her zaman pozitiftir.
public sealed record MovementDto(string Id, string Type, string ProductId, int Quantity,
    string? FromShelfId, string? ToShelfId, string Reference,
    DateTimeOffset CreatedAt, string UserName);
public sealed record DailyActivityDto(string Date, int Received, int Sold);
public sealed record DashboardDto(int TotalUnits, int ActiveProducts, int OccupiedShelves,
    int TotalShelves, int LowStockCount, int TodayReceipts, int TodaySales,
    decimal TodayRevenue, List<DailyActivityDto> DailyActivity);

// DataAnnotations yalnızca temel giriş doğrulamasıdır. Service/handler katmanında:
// 1. Ürün/raf mevcut mu? Yetki ve güncel kullanıcı durumu uygun mu?
// 2. SKU/barkod/raf kodu benzersiz mi? DB unique index de olmalı.
// 3. Kaynak stok yeterli mi? Hedefin bütün ürünler toplam kapasitesi yeterli mi?
// 4. Satış satırlarını ürün+raf bazında grupla, bütün miktarları önce doğrula.
// 5. Idempotency kaydı + bütün bakiye değişimleri + hareket/satış kaydı atomik olmalı.
// 6. Audit kullanıcı/tarih/referansını serverda oluştur, CreatedByyi istemciden alma.
