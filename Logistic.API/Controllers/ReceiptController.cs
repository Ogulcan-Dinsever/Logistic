using Logistic.Application.Commands.ReceiptCommands;
using Logistic.Application.Commands.UserCommands;
using Logistic.Application.Queries.ReceiptQueries;
using Logistic.Application.Shared;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Logistic.API.Controllers
{
    [Route("api/Receipt")]
    [ApiController]
    public class ReceiptController : CustomBaseController
    {

        private readonly IMediator _mediator;

        public ReceiptController(IMediator mediator)
        {
            _mediator = mediator;
        }


        [Authorize(Roles = "Admin,User,Employee")]
        [HttpPost]
        public async Task<IActionResult> CreateReceipt([FromBody] CreateReceiptCommand command, CancellationToken cancellationToken)
        {
            var idempotencyKey = Request.Headers["Idempotency-Key"].ToString();

            if (string.IsNullOrWhiteSpace(idempotencyKey))
                return BadRequest("Idempotency-Key başlığı zorunludur.");

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrWhiteSpace(userId))
                return Unauthorized();

            command.CreatedBy = userId;
            command.IdempotencyKey = idempotencyKey;

            var response = await _mediator.Send(command, cancellationToken);

            return CreateActionResultInstance(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetAllReceipts(int pageId, int take, CancellationToken cancellationToken)
        {
            var response = await _mediator.Send(new GetAllReceiptsQuery { PageNum = pageId, Take = take }, cancellationToken);

            return CreateActionResultInstance(response);
        }
    }
}
