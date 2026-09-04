import { Injectable } from '@nestjs/common';
import { FPOptions, resolveTemplate } from './core/extract';
import { compileExpression, ExpressionCache } from './core/cache';

const cacheSizeEnvVar = 'FPML_CACHE_SIZE';

// Opt-in: a compiled expression retains its parsed AST, see README for the memory cost
const cacheSize = readCacheSize();

const toStringExpression = compileExpression('x.toString()', null, null);

// Options and their cache are bound to a model and must outlive requests to be reused
const optionsByModel = new Map<Model | null, FPOptions>();

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
            model,
            getOptions(model),
            strict,
        );
    }
}

function getOptions(model?: Model): FPOptions {
    const key = model ?? null;
    const options = optionsByModel.get(key) ?? buildOptions(model);
    optionsByModel.set(key, options);

    return options;
}

function buildOptions(model?: Model): FPOptions {
    // The linkId travels as a variable to keep the expression constant, so it is
    // compiled once per model and cannot break the expression when it holds a quote
    const answersExpression = compileExpression(
        model
            ? 'repeat(item).where(linkId=%FPMLLinkId).answer.value'
            : 'repeat(item).where(linkId=%FPMLLinkId).answer.value.children()',
        model,
        null,
    );

    return {
        cache: new ExpressionCache(cacheSize),
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
