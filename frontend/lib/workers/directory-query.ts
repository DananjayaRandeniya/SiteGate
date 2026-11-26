type DirectorySearchParams =
  Record<string, string | string[] | undefined> | URLSearchParams;

const MAX_LIMIT = 100;
const MAX_PAGE = Math.floor(Number.MAX_SAFE_INTEGER / MAX_LIMIT);
const DEFAULT_LIMIT = 20;

function readParam(params: DirectorySearchParams, key: string) {
  if (params instanceof URLSearchParams) {
    const values = params.getAll(key);
    return values.length === 1 ? values[0] : undefined;
  }

  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function readInteger(value: string | undefined, max: number, fallback: number) {
  if (value === undefined || !/^\d+$/.test(value)) {
    return fallback;
  }

  const number = Number(value);
  return number >= 1 && number <= max ? number : fallback;
}

export function workerDirectoryQuery(
  params: DirectorySearchParams,
): URLSearchParams {
  const query = new URLSearchParams({
    page: String(readInteger(readParam(params, "page"), MAX_PAGE, 1)),
    limit: String(
      readInteger(readParam(params, "limit"), MAX_LIMIT, DEFAULT_LIMIT),
    ),
  });

  const search = readParam(params, "search")?.trim();
  if (search && Array.from(search).length <= 120) {
    query.set("search", search);
  }

  const status = readParam(params, "status");
  if (status === "Active" || status === "Inactive") {
    query.set("status", status);
  }

  const contractorId = readParam(params, "contractorId");
  if (contractorId && /^[a-f\d]{24}$/i.test(contractorId)) {
    query.set("contractorId", contractorId.toLowerCase());
  }

  const siteId = readParam(params, "siteId")?.trim();
  if (siteId) {
    query.set("siteId", siteId);
  }

  return query;
}
