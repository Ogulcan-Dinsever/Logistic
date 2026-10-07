using AutoMapper;
using Logistic.Application.Interfaces;
using Logistic.Application.Queries.ProductQueries;
using Logistic.Application.Queries.ShelfQueries;
using Logistic.Application.Responses;
using Logistic.Application.Shared;
using Logistic.Domain.Aggregate;
using MediatR;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Handlers.ShelfHandlers.QueryHandlers
{
    public class GetAllShelvesHandler : IRequestHandler<GetAllShelvesQuery, Response<List<ShelfResponse>>>
    {
        private readonly IRepository<Shelf> _repository;
        private readonly IMapper _mapper;
        private readonly ILogger<GetAllShelvesHandler> _logger;

        public GetAllShelvesHandler(IRepository<Shelf> repository, IMapper mapper, ILogger<GetAllShelvesHandler> logger)
        {
            _repository = repository;
            _mapper = mapper;
            _logger = logger;
        }
        public async Task<Response<List<ShelfResponse>>> Handle(GetAllShelvesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Raf listeleme işlemi başladı.");

            if (request.PageNum <= 0 || request.Take <= 0)
                return Response<List<ShelfResponse>>.Fail("Request parametleri 0 veya 0'dan küçük olamaz.", 409);

            var getShelves = await _repository.GetAllTake((x => x.Status), request.Take, request.PageNum);

            var response = _mapper.Map<List<ShelfResponse>>(getShelves);

            _logger.LogInformation("Raflar listelendi. Count: {Count}", response.Count);

            return Response<List<ShelfResponse>>.Success(response, 200);
        }
    }
}
