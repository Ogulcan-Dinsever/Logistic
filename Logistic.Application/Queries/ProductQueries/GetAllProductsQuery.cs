using Logistic.Application.Responses;
using Logistic.Application.Shared;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Queries.ProductQueries
{
    public class GetAllProductsQuery : IRequest<Response<List<ProductResponse>>>
    {
        public int Take { get; set; }
        public int PageNum { get; set; }
    }
}
