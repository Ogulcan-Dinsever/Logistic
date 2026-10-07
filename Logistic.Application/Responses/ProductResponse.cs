using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Responses
{
    public class ProductResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public string Barcode { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
        public decimal SalePrice { get; set; }
        public int MinStock { get; set; }
        public bool IsActive { get; set; }
    }
}
