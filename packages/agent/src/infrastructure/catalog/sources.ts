import type { SearchArgs } from "../../domain/catalog/types.js";
function pageUrl(url: URL, args: SearchArgs) {
  url.searchParams.set("limit", String(args.limit ?? 8));
  url.searchParams.set("skip", String(args.skip ?? 0));
  return url;
}
export function categorySource(category: string, args: SearchArgs) {
  return pageUrl(
    new URL(
      `https://dummyjson.com/products/category/${encodeURIComponent(category)}`,
    ),
    args,
  );
}
export function keywordSource(query: string, args: SearchArgs) {
  const url = new URL("https://dummyjson.com/products/search");
  url.searchParams.set("q", query);
  return pageUrl(url, args);
}
export function catalogSource(args: SearchArgs) {
  return args.category
    ? categorySource(args.category, args)
    : keywordSource(args.query || args.brand || "", args);
}
