using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Responses
{
    public class StockResponse
    {
        public string ProductId { get; set; } = string.Empty;
        public string ShelfId { get; set; } = string.Empty;
        public int Quantity { get; set; }
    }
}
