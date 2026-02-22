const MAX_PER_PAGE = 200;
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 25;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return parsed;
};

const clampPerPage = (perPage) => Math.min(perPage, MAX_PER_PAGE);

const hasPaginationParams = (query = {}) => {
  return (
    query.page ||
    query.pageNo ||
    query.page_number ||
    query.per_page ||
    query.perPage ||
    query.limit
  );
};

const getPaginationParams = (query = {}, overrides = {}) => {
  const wantsPagination = overrides.forcePaginate || hasPaginationParams(query);
  if (!wantsPagination) return null;
  const page = parsePositiveInt(
    query.page || query.pageNo || query.page_number,
    overrides.defaultPage || DEFAULT_PAGE,
  );
  const perPage = parsePositiveInt(
    query.per_page || query.perPage || query.limit,
    overrides.defaultPerPage || DEFAULT_PER_PAGE,
  );
  const safePerPage = clampPerPage(perPage);
  return {
    page,
    perPage: safePerPage,
    limit: safePerPage,
    offset: (page - 1) * safePerPage,
  };
};

const normalizeCount = (count) => {
  if (Array.isArray(count)) return count.length;
  return Number.isFinite(count) ? count : 0;
};

const buildPaginationMeta = (pagination, total) => {
  const safeTotal = normalizeCount(total);
  const totalPages = safeTotal === 0 ? 1 : Math.ceil(safeTotal / pagination.perPage);
  return {
    total: safeTotal,
    totalPages,
    currentPage: pagination.page,
    perPage: pagination.perPage,
    hasNext: pagination.page < totalPages,
    hasPrev: pagination.page > 1,
  };
};

const applyPaginationOptions = (baseOptions, pagination, opts = {}) => {
  if (!pagination) return baseOptions;
  const options = {
    ...baseOptions,
    limit: pagination.limit,
    offset: pagination.offset,
  };
  if (opts.forceDistinct || baseOptions.include) {
    options.distinct = opts.distinct !== false;
  }
  return options;
};

module.exports = {
  getPaginationParams,
  buildPaginationMeta,
  applyPaginationOptions,
  normalizeCount,
};
