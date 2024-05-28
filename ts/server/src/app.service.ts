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
        strict?: boolean,
    ): object {
        const options: FPOptions = {
            userInvocationTable: {
                answers: {
                    fn: (inputs, linkId: string) => {
                        return fhirpath.evaluate(
                            inputs,
                            model
                                ? `repeat(item).where(linkId='${linkId}').answer.value`
                                : `repeat(item).where(linkId='${linkId}').answer.value.children()`,
                            null,
                            model,
                            null,
                        );
                    },
                    arity: { 0: [], 1: ['String'] },
                },
                // Get rid of toString once it's fixed https://github.com/HL7/fhirpath.js/issues/156
                toString: {
                    fn: (inputs) => fhirpath.evaluate({ x: inputs }, 'x.toString()'),
                    arity: { 0: [] },
                },
            },
        };

        return resolveTemplate(
            resource,
            template,
            { root: resource, ...context },
            model,
            options,
            strict,
        );
    }
}
