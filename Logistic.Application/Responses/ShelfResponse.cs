using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Responses
{
    public class ShelfResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Zone { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public bool IsReceiving { get; set; }
    }
}
