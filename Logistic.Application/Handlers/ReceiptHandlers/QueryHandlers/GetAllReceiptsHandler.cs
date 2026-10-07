using AutoMapper;
using Logistic.Application.Interfaces;
using Logistic.Application.Queries.ReceiptQueries;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Handlers.ReceiptHandlers.QueryHandlers
{
    public class GetAllReceiptsHandler : IRequestHandler<GetAllReceiptsQuery, Response<List<ReceiptResponse>>>
    {
        private readonly IRepository<Receipt> _repository;
        private readonly IMapper _mapper;
        private readonly ILogger<GetAllReceiptsHandler> _logger;

        public GetAllReceiptsHandler(IRepository<Receipt> repository, IMapper mapper, ILogger<GetAllReceiptsHandler> logger)
        {
            _repository = repository;
            _mapper = mapper;
            _logger = logger;
        }
        public async Task<Response<List<ReceiptResponse>>> Handle(GetAllReceiptsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Mal kabul listeleme işlemi başladı.");

            if (request.PageNum <= 0 || request.Take <= 0)
                return Response<List<ReceiptResponse>>.Fail("Request parametleri 0 veya 0'dan küçük olamaz.", 409);

            var getReceipts = await _repository.GetAllTake((x => x.Status), request.Take, request.PageNum);

            var response = _mapper.Map<List<ReceiptResponse>>(getReceipts);

            _logger.LogInformation("Mal kabuller listelendi. Count: {Count}", response.Count);

            return Response<List<ReceiptResponse>>.Success(response, 200);
        }
    }
}
