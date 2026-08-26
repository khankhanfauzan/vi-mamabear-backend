import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import { NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CustomResponse } from '../CustomResponse';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { ServiceResult } from '../ServiceResult';

function isServiceResult<T>(val: any): val is ServiceResult<T> {
  return (
    val &&
    typeof val === 'object' &&
    'success' in val &&
    'message' in val &&
    'data' in val
  );
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  ServiceResult<T> | T,
  CustomResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<CustomResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data: ServiceResult<T> | T) => {
        if (isServiceResult<T>(data)) {
          return {
            success: true,
            statusCode: response.statusCode,
            message: [response.statusMessage || data.message || 'No message specified'],
            data: data.data,
            timestamp: new Date().toISOString(),
          };
        }
        return {
          success: true,
          statusCode: response.statusCode,
          message: [response.statusMessage || 'No message specified'],
          data: data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
