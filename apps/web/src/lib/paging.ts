import api from '@/lib/api';

/**
 * Every list endpoint on this API is paginated and applies a default page size
 * when the caller omits one — `/api/leads` defaults to **20**, which is small
 * enough that a working studio hits it in weeks. A request without an explicit
 * `size` therefore does not mean "give me everything", it means "give me the
 * first 20 and say nothing about the rest": the response is a bare JSON array
 * with no total, no `hasNext`, nothing to distinguish a complete list from a
 * truncated one. Callers that then count or sum over that array are silently
 * wrong, and the UI has no way to notice.
 *
 * This walks the pages until one comes back short, which is the only signal
 * the API gives that the end has been reached.
 */

/** Matches the page size `useBookings` already used for the same reason. */
const PAGE_SIZE = 100;

/**
 * Hard stop so a bug (or an endpoint that ignores `page`) can't spin forever.
 * 25 × 100 = 2500 rows, well past any realistic single-studio list; beyond that
 * the screen needs real pagination, not a bigger loop.
 */
const MAX_PAGES = 25;

/**
 * Fetches every page of a list endpoint and returns the concatenation.
 *
 * @param path endpoint path without paging params, e.g. `/api/leads`
 * @param params any additional query params (filters)
 */
export async function fetchAllPages<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const search = new URLSearchParams({
      ...params,
      page: String(page),
      size: String(PAGE_SIZE),
    });
    const res = await api.get<T[]>(`${path}?${search.toString()}`);
    const chunk = Array.isArray(res.data) ? res.data : [];
    all.push(...chunk);
    // A short page is the end of the list. An exactly-full last page costs one
    // extra empty request, which is the correct trade for not truncating.
    if (chunk.length < PAGE_SIZE) break;
  }
  return all;
}
