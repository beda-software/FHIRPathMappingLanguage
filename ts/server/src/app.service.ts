import { Injectable } from '@nestjs/common';
import * as fhirpath from 'fhirpath';
import { Evaluate, FPOptions } from './core/evaluator';
import { resolveTemplate } from './core/extract';
import { ExpressionCache } from './expression-cache';

const cacheSizeEnvVar = 'FPML_CACHE_SIZE';

// Opt-in: a compiled expression retains its parsed AST, see README for the memory cost
const cacheSize = readCacheSize();

const toStringExpression = fhirpath.compile('x.toString()');

// A cache is bound to its model and must outlive requests to be reused
const evaluatorByModel = new Map<Model | null, Evaluate>();

@Injectable()
export class AppService {
    resolveTemplate(
        resource: Record<string, any>,
        template: object,
        context: Context,
        model?: Model,
        strict?: boolean,
    ): object {
        return resolveTemplate(
            resource,
            template,
            { root: resource, ...context },
            strict,
            getEvaluator(model),
        );
    }
}

function getEvaluator(model?: Model): Evaluate {
    const key = model ?? null;
    const evaluate = evaluatorByModel.get(key) ?? buildEvaluator(model);
    evaluatorByModel.set(key, evaluate);

    return evaluate;
}

function buildEvaluator(model?: Model): Evaluate {
    const answersExpression = fhirpath.compile(
        model
            ? 'repeat(item).where(linkId=%FPMLLinkId).answer.value'
            : 'repeat(item).where(linkId=%FPMLLinkId).answer.value.children()',
        model,
    );
    const options: FPOptions = {
        userInvocationTable: {
            answers: {
                fn: (inputs, linkId: string) => answersExpression(inputs, { FPMLLinkId: linkId }),
                arity: { 0: [], 1: ['String'] },
            },
            // Get rid of toString once it's fixed https://github.com/HL7/fhirpath.js/issues/156
            toString: {
                fn: (inputs) => toStringExpression({ x: inputs }),
                arity: { 0: [] },
            },
        },
    };

    return new ExpressionCache(cacheSize, model, options).makeEvaluator();
}

function readCacheSize(): number {
    const rawSize = process.env[cacheSizeEnvVar];
    if (!rawSize) {
        return 0;
    }

    if (!/^\d+$/.test(rawSize)) {
        throw new Error(`${cacheSizeEnvVar} must be a non-negative integer, got '${rawSize}'`);
    }

    return Number.parseInt(rawSize, 10);
}
