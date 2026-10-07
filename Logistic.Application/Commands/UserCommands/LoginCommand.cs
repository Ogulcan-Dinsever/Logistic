using Logistic.Application.Responses;
using Logistic.Application.Shared;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Commands.UserCommands
{
    public class LoginCommand : IRequest<Response<UserResponse>>
    {
        public string Email { get; set; }
        public string Password { get; set; }
    }
}
