using System.Text.Json.Serialization;

namespace Logistic.Application.Responses
{
    public class StockMovementResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string ProductId { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string? FromShelfId { get; set; }
        public string? ToShelfId { get; set; }
        public string Reference { get; set; } = string.Empty;

        [JsonPropertyName("createdAt")]
        public DateTime CreatedDate { get; set; }

        public string CreatedBy { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
    }
}
