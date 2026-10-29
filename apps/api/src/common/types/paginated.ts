import { PaginationQueryDto } from '../dto/pagination-query.dto';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function toSkipTake(query: PaginationQueryDto): {
  skip: number;
  take: number;
} {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function paginated<T>(
  items: T[],
  total: number,
  query: PaginationQueryDto,
): Paginated<T> {
  return { items, total, page: query.page, pageSize: query.pageSize };
}
