import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { FPMLValidationError } from './utils/extract';

@Catch(FPMLValidationError)
export class FPMLValidationErrorFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: exception.message || 'Unprocessable Entity',
        });
    }
}
