using Logistic.Application.Commands.ProductCommands;
using Logistic.Application.Commands.ReceiptCommands;
using Logistic.Application.Queries.ProductQueries;
using Logistic.Application.Queries.ReceiptQueries;
using Logistic.Application.Shared;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Logistic.API.Controllers
{
    [Route("api/Product")]
    [ApiController]
    public class ProductController : CustomBaseController
    {
        private readonly IMediator _mediator;

        public ProductController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> CreateProduct(CreateProductCommand command, CancellationToken cancellationToken)
        {
            var response = await _mediator.Send(command, cancellationToken);

            return CreateActionResultInstance(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetAllProduct(int pageId, int take, CancellationToken cancellationToken)
        {
            var response = await _mediator.Send(new GetAllProductsQuery { PageNum = pageId, Take = take }, cancellationToken);

            return CreateActionResultInstance(response);
        }
    }
}
