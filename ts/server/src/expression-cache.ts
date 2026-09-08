import * as fhirpath from 'fhirpath';
import type { Evaluate, FPOptions } from './core/evaluator';

export type CompiledExpression = (resource: any, context?: Context) => any[];

/**
 * LRU cache of compiled FHIRPath expressions.
 *
 * Entries are keyed by the expression only, so the model and the options are bound
 * to the cache itself. Zero max size disables caching.
 */
export class ExpressionCache {
    private readonly compiled = new Map<string, CompiledExpression>();

    constructor(
        private readonly maxSize: number,
        private readonly model?: Model,
        private readonly options?: FPOptions,
    ) {}

    makeEvaluator(): Evaluate {
        return (resource, expression, context) => this.compile(expression)(resource, context);
    }

    compile(expression: string): CompiledExpression {
        const cached = this.compiled.get(expression);
        if (cached) {
            this.compiled.delete(expression);
            this.compiled.set(expression, cached);

            return cached;
        }

        const compiled = fhirpath.compile(expression, this.model, this.options);
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
