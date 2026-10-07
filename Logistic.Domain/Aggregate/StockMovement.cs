using Logistic.Domain.Common;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Domain.Aggregate
{
    public class StockMovement : BaseEntity
    {
        public string Type { get; set; } = string.Empty;
        public string ProductId { get; set; } = string.Empty;
        public int Quantity { get; set; }

        public string? FromShelfId { get; set; }
        public string? ToShelfId { get; set; }

        public string Reference { get; set; } = string.Empty;
        public string? ReceiptId { get; set; }
        public string IdempotencyKey { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
    }
}
