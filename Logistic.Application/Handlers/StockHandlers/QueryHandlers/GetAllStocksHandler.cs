using AutoMapper;
using Logistic.Application.Interfaces;
using Logistic.Application.Queries.StockQueries;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Handlers.StockHandlers.QueryHandlers
{
    public class GetAllStocksHandler
        : IRequestHandler<GetAllStockQuery, Response<List<StockResponse>>>
    {
        private readonly IRepository<Stock> _repository;
        private readonly IMapper _mapper;
        private readonly ILogger<GetAllStocksHandler> _logger;

        public GetAllStocksHandler(
            IRepository<Stock> repository,
            IMapper mapper,
            ILogger<GetAllStocksHandler> logger)
        {
            _repository = repository;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<Response<List<StockResponse>>> Handle(
            GetAllStockQuery request,
            CancellationToken cancellationToken)
        {
            _logger.LogInformation("Stok listeleme işlemi başladı.");

            var stocks = await _repository.GetAll(x => x.Status);

            var response = _mapper.Map<List<StockResponse>>(stocks);

            _logger.LogInformation("Stoklar listelendi. Count: {Count}", response.Count);

            return Response<List<StockResponse>>.Success(response, 200);
        }
    }
}
