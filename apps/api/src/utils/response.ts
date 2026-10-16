import { ApiResponse, PaginationMeta } from '@reachinbox/shared';
import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: PaginationMeta
): Response {
  const body: ApiResponse<T> = { success: true, data, meta };
  return res.status(status).json(body);
}

export function sendError(
  res: Response,
  message: string,
  status = 500
): Response {
  const body: ApiResponse = { success: false, error: message };
  return res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T): Response {
  return sendSuccess(res, data, 201);
}

export function paginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export function parsePagination(
  query: Record<string, unknown>
): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
