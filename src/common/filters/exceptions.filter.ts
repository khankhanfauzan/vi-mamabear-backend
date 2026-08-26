import 'dotenv/config';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomResponse } from '../CustomResponse';
import { PinoLogger } from 'pino-nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message = typeof exceptionResponse === 'string'
          ? [exceptionResponse]
          : Array.isArray((exceptionResponse as any).message)
            ? (exceptionResponse as any).message
            : [(exceptionResponse as any).message || exception.message];
      const responseJson: CustomResponse<null> = {
        success: false,
        statusCode: status,
        message,
        data: null,
        timestamp: new Date().toISOString(),
      };
      if (status >= 500) {
        this.logger.error({ req: { method: request.method, url: request.url }, err: exception }, `${request.method} ${request.url} ${status} - ${exception.message}`);
      } else if (status >= 400) {
        this.logger.warn({ req: { method: request.method, url: request.url } }, `${request.method} ${request.url} ${status} - ${message.join(', ')}`);
      }
      response.status(status).json(responseJson);
    } else {
        const message =
            exception instanceof Error ? exception.name : 'Internal server error';
        this.logger.error({ req: { method: request.method, url: request.url }, err: exception }, `${request.method} ${request.url} 500 - ${message}`);
        const responseJson: CustomResponse<null> = {
        success: false,
        statusCode: 500,
        message: [process.env.NODE_ENV == 'production' ? 'Internal server error' : message],
        data: null,
        timestamp: new Date().toISOString(),
      };
      response.status(500).json(responseJson);
    }
  }
}
