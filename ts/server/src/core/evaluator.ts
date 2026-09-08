import * as fhirpath from 'fhirpath';

export interface FPOptions {
    userInvocationTable?: UserInvocationTable;
}

export type Evaluate = (resource: any, expression: string, context: Context) => any[];

/** Builds the default evaluator, which compiles every expression on every evaluation. */
export function makeEvaluator(model?: Model, options?: FPOptions): Evaluate {
    return (resource, expression, context) =>
        fhirpath.evaluate(resource, expression, context, model, options);
}
