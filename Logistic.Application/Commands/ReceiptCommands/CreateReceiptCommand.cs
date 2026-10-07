using Logistic.Application.Responses;
using Logistic.Application.Shared;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json.Serialization;

namespace Logistic.Application.Commands.ReceiptCommands
{
    public class CreateReceiptCommand : IRequest<Response<ReceiptResponse>>
    {
        public string Supplier { get; set; } = string.Empty;
        public string ProductId { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string? Note { get; set; }

        [JsonIgnore]
        public string CreatedBy { get; set; } = string.Empty;

        [JsonIgnore]
        public string IdempotencyKey { get; set; } = string.Empty;
    }
}
