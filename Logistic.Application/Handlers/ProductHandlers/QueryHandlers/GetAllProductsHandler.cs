using AutoMapper;
using Logistic.Application.Interfaces;
using Logistic.Application.Queries.ProductQueries;
using Logistic.Application.Queries.ReceiptQueries;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Handlers.ProductHandlers.QueryHandlers
{
    public class GetAllProductsHandler : IRequestHandler<GetAllProductsQuery, Response<List<ProductResponse>>>
    {
        private readonly IRepository<Product> _repository;
        private readonly IMapper _mapper;
        private readonly ILogger<GetAllProductsHandler> _logger;

        public GetAllProductsHandler(IRepository<Product> repository, IMapper mapper, ILogger<GetAllProductsHandler> logger)
        {
            _repository = repository;
            _mapper = mapper;
            _logger = logger;
        }
        public async Task<Response<List<ProductResponse>>> Handle(GetAllProductsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Ürün listeleme işlemi başladı.");

            if (request.PageNum <= 0 || request.Take <= 0)
                return Response<List<ProductResponse>>.Fail("Request parametleri 0 veya 0'dan küçük olamaz.", 409);

            var getProducts = await _repository.GetAllTake((x => x.Status), request.Take, request.PageNum);

            var response = _mapper.Map<List<ProductResponse>>(getProducts);

            _logger.LogInformation("Ürünler listelendi. Count: {Count}", response.Count);

            return Response<List<ProductResponse>>.Success(response, 200);
        }
    }
}
