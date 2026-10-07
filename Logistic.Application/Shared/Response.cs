using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json.Serialization;

namespace Logistic.Application.Shared
{
    public class Response<T>
    {
        public T Data { get; set; }

        [JsonIgnore] // Json Ignore yaptığımızda client geri dönüşte bu parametreleri görmeyecek sadece kodun içinde kullanmak için
        public int StatusCode { get; set; }

        [JsonIgnore]
        public bool IsSuccessful { get; set; }

        public List<string> Errors { get; set; }

        //Static Factory Method
        //Yazdığınız program da birbirine benzeyen birden fazla sınıf olabilir. Bu tür sınıfları oluştururken her seferinde new operatörünü kullanmayın ya da o sınıflardan sanki birbirinden bağımsızmış gibi kod yazmayalım diye böyle bir örüntü tasarlamışlar.
        public static Response<T> Success(T data, int statusCode)
        {
            return new Response<T>
            {
                Data = data,
                StatusCode = statusCode,
                IsSuccessful = true,
            };
        }

        public static Response<T> Success(int statusCode)
        {
            return new Response<T>
            {
                Data = default(T),
                StatusCode = statusCode,
                IsSuccessful = true,
            };
        }

        public static Response<T> Fail(List<string> errors, int statusCode)
        {
            return new Response<T>
            {
                Errors = errors,
                StatusCode = statusCode,
                IsSuccessful = false,
            };
        }

        public static Response<T> Fail(string error, int statusCode)
        {
            return new Response<T>
            {
                Errors = new List<string>() {

                    error
                },
                StatusCode = statusCode,
                IsSuccessful = false,
            };
        }
    }
}
