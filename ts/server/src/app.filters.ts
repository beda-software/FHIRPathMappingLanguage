import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { FPMLValidationError } from './utils/extract';

@Catch(FPMLValidationError)
export class FPMLValidationErrorFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        response.status(HttpStatus.BAD_REQUEST).json({
            resourceType: 'OperationOutcome',
            text: {
                status: 'generated',
                div: exception.message || 'Unprocessable Entity',
            },
            issue: [
                {
                    severity: 'fatal',
                    code: 'processing',
                    expression: [exception.errorPath],
                    diagnostics: exception.errorMessage || 'Unprocessable Entity',
                },
            ],
        });
    }
}
