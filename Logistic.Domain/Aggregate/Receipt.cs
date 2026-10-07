using Logistic.Domain.Common;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Domain.Aggregate
{
    public class Receipt : BaseEntity
    {
        public string Reference { get; set; } = string.Empty;
        public string Supplier { get; set; } = string.Empty;
        public string ProductId { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string Note { get; set; } = string.Empty;
        public string IdempotencyKey { get; set; } = string.Empty;
        public string RequestHash { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
    }
}
