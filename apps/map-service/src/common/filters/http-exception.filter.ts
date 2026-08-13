import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException ? exception.message : 'Internal server error';
    const detail = exception instanceof HttpException ? exception.getResponse() : undefined;

    response.status(status).json({
      success: false,
      error: {
        code:
          typeof detail === 'object' && detail !== null && 'code' in detail
            ? (detail as { code: string }).code
            : (HttpStatus[status] ?? 'ERROR'),
        message,
      },
    });
  }
}
