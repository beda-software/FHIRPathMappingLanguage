import * as fhirpath from 'fhirpath';
import type { FPOptions } from './extract';

export type CompiledExpression = (resource: any, context?: Context) => any[];

export function compileExpression(
    expression: string,
    model: Model,
    options: FPOptions,
): CompiledExpression {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cache, ...fhirpathOptions } = options ?? {};

    return fhirpath.compile(expression, model, fhirpathOptions);
}

/**
 * LRU cache of compiled FHIRPath expressions.
 *
 * Entries are keyed by the expression only, while compilation binds the model
 * and the user-defined functions, so use a separate cache per options.
 * Zero max size disables caching.
 */
export class ExpressionCache {
    private readonly compiled = new Map<string, CompiledExpression>();

    constructor(private readonly maxSize: number) {}

    compile(expression: string, model: Model, options: FPOptions): CompiledExpression {
        const cached = this.compiled.get(expression);
        if (cached) {
            this.compiled.delete(expression);
            this.compiled.set(expression, cached);

            return cached;
        }

        const compiled = compileExpression(expression, model, options);
        if (this.maxSize > 0) {
            this.compiled.set(expression, compiled);
            if (this.compiled.size > this.maxSize) {
                this.compiled.delete(this.compiled.keys().next().value);
            }
        }

        return compiled;
    }

    clear() {
        this.compiled.clear();
    }

    get size() {
        return this.compiled.size;
    }
}
