using Logistic.Application.Commands.StockCommands;
using Logistic.Application.Queries.StockQueries;
using Logistic.Application.Shared;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Logistic.API.Controllers
{
    [Route("api/Stock")]
    [ApiController]
    public class StockController : CustomBaseController
    {
        private readonly IMediator _mediator;

        public StockController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllStocks(int pageId, int take, CancellationToken cancellationToken)
        {
            var response = await _mediator.Send(new GetAllStockQuery { PageNum = pageId, Take = take }, cancellationToken);

            return CreateActionResultInstance(response);
        }

        [Authorize(Roles = "Admin,User,Employee")]
        [HttpPost("Putaway")]
        public async Task<IActionResult> PutawayStock([FromBody] PutawayStockCommand command, CancellationToken cancellationToken)
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
    }
}
