using Logistic.Domain.Common;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Domain.Aggregate
{
    public class Stock : BaseEntity
    {
        public string ProductId { get; set; } = string.Empty;
        public string ShelfId { get; set; } = string.Empty;
        public int Quantity { get; set; }
    }
}
