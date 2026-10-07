using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Responses
{
    public class ReceiptResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Reference { get; set; } = string.Empty;
        public string Supplier { get; set; } = string.Empty;
        public string ProductId { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string Note { get; set; } = string.Empty;
        [System.Text.Json.Serialization.JsonPropertyName("createdAt")]
        public DateTime CreatedDate { get; set; }
        public DateTime ModifiedDate { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string ModifiedBy { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
    }
}
