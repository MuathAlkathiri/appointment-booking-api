import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // All validation-related 400 errors use the required API format.
      if (status === HttpStatus.BAD_REQUEST) {
        response.status(HttpStatus.BAD_REQUEST).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: this.getValidationMessage(payload),
          },
        });
        return;
      }

      // Preserve our explicitly defined API errors,
      // e.g. SLOT_NOT_FOUND and SLOT_UNAVAILABLE.
      if (this.isApiErrorResponse(payload)) {
        response.status(status).json(payload);
        return;
      }
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  }

  private isApiErrorResponse(
    payload: string | object,
  ): payload is {
    error: {
      code: string;
      message: string;
    };
  } {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('error' in payload)
    ) {
      return false;
    }

    const error = payload.error;

    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string' &&
      'message' in error &&
      typeof error.message === 'string'
    );
  }

  private getValidationMessage(payload: string | object): string {
    if (typeof payload === 'string') {
      return payload;
    }

    if (
      'message' in payload &&
      Array.isArray(payload.message) &&
      payload.message.length > 0
    ) {
      return payload.message.join('; ');
    }

    if (
      'message' in payload &&
      typeof payload.message === 'string' &&
      payload.message.length > 0
    ) {
      return payload.message;
    }

    return 'The request contains invalid data.';
  }
}