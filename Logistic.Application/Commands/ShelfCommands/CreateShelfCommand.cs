using Logistic.Application.Responses;
using Logistic.Application.Shared;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Commands.ShelfCommands
{
    public class CreateShelfCommand : IRequest<Response<ShelfResponse>>
    {
        public string Code { get; set; } = string.Empty;
        public string Zone { get; set; } = string.Empty;
        public int Capacity { get; set; }
    }
}
