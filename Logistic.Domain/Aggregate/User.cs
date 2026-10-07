using Logistic.Domain.Common;
using System;
using System.Collections.Generic;
using System.Text;

namespace Logistic.Domain.Aggregate
{
    public class User : BaseEntity
    {
        public string Name { get; set; }
        public string SurName { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
        public string Role { get; set; }
    }
}
