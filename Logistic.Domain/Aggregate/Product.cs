using Logistic.Domain.Common;

namespace Logistic.Domain.Aggregate;

public class Product : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Unit { get; set; } = "adet";
    public decimal SalePrice { get; set; }
    public int MinStock { get; set; }
}
