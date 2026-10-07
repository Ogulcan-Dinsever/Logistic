using Logistic.Application.Responses;
using Logistic.Application.Shared;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Commands.ProductCommands
{
    public class CreateProductCommand : IRequest<Response<ProductResponse>>
    {
        public string Name { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public string Barcode { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Unit { get; set; } = "adet";
        public decimal SalePrice { get; set; }
        public int MinStock { get; set; }
    }
}
