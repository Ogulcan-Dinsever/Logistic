using Logistic.Application.Responses;
using Logistic.Application.Shared;
using MediatR;
using System.Text.Json.Serialization;

namespace Logistic.Application.Commands.StockCommands
{
    public class PutawayStockCommand : IRequest<Response<StockMovementResponse>>
    {
        public string ProductBarcode { get; set; } = string.Empty;
        public string SourceShelfId { get; set; } = string.Empty;
        public string TargetShelfCode { get; set; } = string.Empty;
        public int Quantity { get; set; }

        [JsonIgnore]
        public string CreatedBy { get; set; } = string.Empty;

        [JsonIgnore]
        public string IdempotencyKey { get; set; } = string.Empty;
    }
}
