using Logistic.Application.Responses;
using Logistic.Application.Shared;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Queries.StockQueries
{
    public class GetAllStockQuery : IRequest<Response<List<StockResponse>>>
    {
        public int Take { get; set; }
        public int PageNum { get; set; }
    }
}
