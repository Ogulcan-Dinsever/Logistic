using Logistic.Application.Commands.ProductCommands;
using Logistic.Application.Commands.ShelfCommands;
using Logistic.Application.Queries.ProductQueries;
using Logistic.Application.Queries.ShelfQueries;
using Logistic.Application.Shared;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Logistic.API.Controllers
{
    [Route("api/Shelf")]
    [ApiController]
    public class ShelfController : CustomBaseController
    {
        private readonly IMediator _mediator;

        public ShelfController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> CreateShelf(CreateShelfCommand command, CancellationToken cancellationToken)
        {
            var response = await _mediator.Send(command, cancellationToken);

            return CreateActionResultInstance(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetAllShelves(int pageId, int take, CancellationToken cancellationToken)
        {
            var response = await _mediator.Send(new GetAllShelvesQuery { PageNum = pageId, Take = take }, cancellationToken);

            return CreateActionResultInstance(response);
        }
    }
}
