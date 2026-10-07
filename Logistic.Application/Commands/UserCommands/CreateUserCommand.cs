using Logistic.Application.Responses;
using Logistic.Application.Shared;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Commands.UserCommands
{
    public class CreateUserCommand : IRequest<Response<UserResponse>>
    {
        public string Name { get; set; }
        public string SurName { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
        public bool IsAdmin { get; set; }
        public string CreatedBy { get; set; }
    }
}
