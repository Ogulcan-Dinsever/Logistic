using Logistic.Domain.Common;

namespace Logistic.Domain.Aggregate;

public class Shelf : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Zone { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public bool IsReceiving { get; set; }
    public long StockVersion { get; set; }
}
