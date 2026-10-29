import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErrorsFilter implements ExceptionFilter {
  catch(
    error: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      error.code === 'P2002'
        ? 409
        : error.code === 'P2025'
          ? 404
          : error.code === 'P2003'
            ? 400
            : 500;
    const message =
      status === 409
        ? 'Dữ liệu đã tồn tại'
        : status === 404
          ? 'Không tìm thấy dữ liệu'
          : status === 400
            ? 'Dữ liệu liên kết không hợp lệ'
            : 'Không thể xử lý dữ liệu';
    response.status(status).json({ statusCode: status, message });
  }
}
