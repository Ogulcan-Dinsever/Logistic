using Logistic.Application.Commands.UserCommands;
using Logistic.Application.Shared;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Logistic.API.Controllers
{
    [Route("api/Logistic/[controller]")]
    [ApiController]
    public class UserController : CustomBaseController
    {

        private readonly IMediator _mediator;

        public UserController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpPost("CreateUser")]
        public async Task<IActionResult> CreateUser(CreateUserCommand command)
        {
            var response = await _mediator.Send(command);

            return CreateActionResultInstance(response);
        }

        [HttpPost("Login")]
        public async Task<IActionResult> Login(LoginCommand command)
        {
            var response = await _mediator.Send(command);

            return CreateActionResultInstance(response);
        }
    }
}
