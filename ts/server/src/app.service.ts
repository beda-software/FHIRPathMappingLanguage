import { Injectable } from '@nestjs/common';
import { FPOptions, resolveTemplate } from './utils/extract';
import * as fhirpath from 'fhirpath';

@Injectable()
export class AppService {
    resolveTemplate(
        resource: Record<string, any>,
        template: object,
        context: Context,
        model?: Model,
        options?: FPOptions,
        strict?: boolean
    ): object {
        return resolveTemplate(resource, template, { root: resource, ...context }, model, options, strict);
    }
}
