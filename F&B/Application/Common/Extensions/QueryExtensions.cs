namespace Application.Common.Extensions;

public static class QueryExtensions
{
    public static IQueryable<T> ApplyPaging<T>(this IQueryable<T> query, int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100; // Protection against large payload DoS

        return query.Skip((page - 1) * pageSize).Take(pageSize);
    }
}
