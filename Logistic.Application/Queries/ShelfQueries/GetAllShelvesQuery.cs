using Logistic.Application.Responses;
using Logistic.Application.Shared;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Application.Queries.ShelfQueries
{
    public class GetAllShelvesQuery : IRequest<Response<List<ShelfResponse>>>
    {
        public int Take { get; set; }
        public int PageNum { get; set; }
    }
}
