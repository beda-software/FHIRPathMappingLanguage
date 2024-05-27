import * as fhirpath from 'fhirpath';

type Resource = Record<string, any>;

interface FPOptions {
    userInvocationTable?: UserInvocationTable;
}

export class FPMLValidationError extends Error {}

export function resolveTemplate(
    resource: Resource,
    template: any,
    context?: Context,
    model?: Model,
    fpOptions?: FPOptions,
): any {
    // We pass template under rootNode because template might be not object, e.g. array or primitive
    return resolveTemplateRecur(resource, { rootNode: template }, context, model, fpOptions)[
        'rootNode'
    ];
}

function resolveTemplateRecur(
    resource: Resource,
    template: any,
    initialContext?: Context,
    model?: Model,
    fpOptions?: FPOptions,
): any {
    return iterateObject(template, initialContext ?? {}, (node, context) => {
        if (isPlainObject(node)) {
            const { node: newNode, context: newContext } = processAssignBlock(
                resource,
                node,
                context,
                model,
                fpOptions,
            );
            const matchers = [processContextBlock, processForBlock, processIfBlock];
            for (const matcher of matchers) {
                const result = matcher(resource, newNode, newContext, model, fpOptions);

                if (result) {
                    return { node: result.node, context: newContext };
                }
            }

            return { node: newNode, context: newContext };
        } else if (typeof node === 'string') {
            return {
                node: processTemplateString(resource, node, context, model, fpOptions),
                context,
            };
        }

        return { node, context };
    });
}

function processTemplateString(
    resource: Resource,
    node: string,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
) {
    const templateRegExp = /{{-?\s*(.+?)\s*-?}}/g;
    let match:
        | RegExpExecArray
        | { [Symbol.replace](string: string, replaceValue: string): string }[];
    let result: any = node;

    while ((match = templateRegExp.exec(node)) !== null) {
        const expr = match[1];
        const replacement =
            evaluateExpression(resource, expr, context, model, fpOptions)[0] ?? null;

        if (replacement === null) {
            if (match[0].startsWith('{{-')) {
                return undefined;
            }

            return null;
        }

        if (match[0] === node) {
            return replacement;
        }

        result = result.replace(match[0], replacement);
    }

    return result;
}

function processAssignBlock(
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
): { node: any; context: Context } {
    const extendedContext = { ...context };
    const keys = Object.keys(node);

    const assignRegExp = /{%\s*assign\s*%}/;
    const assignKey = keys.find((k) => k.match(assignRegExp));
    if (assignKey) {
        if (Array.isArray(node[assignKey])) {
            node[assignKey].forEach((obj) => {
                if (Object.keys(obj).length !== 1) {
                    throw new FPMLValidationError(
                        'Assign block must accept only one key per object',
                    );
                }

                Object.entries(
                    resolveTemplate(resource, obj, extendedContext, model, fpOptions),
                ).forEach(([key, value]) => {
                    extendedContext[key] = value;
                });
            });
        } else if (isPlainObject(node[assignKey])) {
            if (Object.keys(node[assignKey]).length !== 1) {
                throw new FPMLValidationError('Assign block must accept only one key per object');
            }
            Object.entries(
                resolveTemplate(resource, node[assignKey], extendedContext, model, fpOptions),
            ).forEach(([key, value]) => {
                extendedContext[key] = value;
            });
        } else {
            throw new FPMLValidationError('Assign block must accept array or object');
        }

        return { node: omitKey(node, assignKey), context: extendedContext };
    }

    return { node, context };
}

function processForBlock(
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
): { node: any } | undefined {
    const keys = Object.keys(node);

    const forRegExp = /{%\s*for\s+(?:(\w+?)\s*,\s*)?(\w+?)\s+in\s+(.+?)\s*%}/;
    const forKey = keys.find((k) => k.match(forRegExp));
    if (forKey) {
        if (keys.length > 1) {
            throw new FPMLValidationError('For block must be presented as single key');
        }

        const matches = forKey.match(forRegExp);
        const hasIndexKey = matches.length === 4;
        const indexKey = hasIndexKey ? matches[1] : null;
        const itemKey = hasIndexKey ? matches[2] : matches[1];
        const expr = hasIndexKey ? matches[3] : matches[2];

        const answers = evaluateExpression(resource, expr, context, model, fpOptions);
        return {
            node: answers.map((answer, index) =>
                resolveTemplate(
                    resource,
                    node[forKey],
                    {
                        ...context,
                        [itemKey]: answer,
                        ...(hasIndexKey ? { [indexKey]: index } : {}),
                    },
                    model,
                    fpOptions,
                ),
            ),
        };
    }
}

function processContextBlock(
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
): { node: any } | undefined {
    const keys = Object.keys(node);

    const contextRegExp = /{{\s*(.+?)\s*}}/;
    const contextKey = keys.find((k) => k.match(contextRegExp));
    if (contextKey) {
        if (keys.length > 1) {
            throw new FPMLValidationError('Context block must be presented as single key');
        }
        const matches = contextKey.match(contextRegExp);

        const expr = matches[1];
        const answers = evaluateExpression(resource, expr, context, model, fpOptions);
        const result: any[] = answers.map((answer) =>
            resolveTemplate(answer, node[contextKey], context, model, fpOptions),
        );

        return { node: result };
    }
}

function processIfBlock(
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
): { node: any } | undefined {
    const keys = Object.keys(node);

    const ifRegExp = /{%\s*if\s+(.+?)\s*%}/;
    const elseRegExp = /{%\s*else\s*%}/;
    const ifKey = keys.find((k) => k.match(ifRegExp));

    if (ifKey) {
        const elseKey = keys.find((k) => k.match(elseRegExp));

        const matches = ifKey.match(ifRegExp);
        const expr = matches[1];

        const answer = evaluateExpression(
            resource,
            `iif(${expr}, true, false)`,
            context,
            model,
            fpOptions,
        )[0];

        const newNode = answer
            ? resolveTemplate(resource, node[ifKey], context, model, fpOptions)
            : elseKey
            ? resolveTemplate(resource, node[elseKey], context, model, fpOptions)
            : null;

        const isMergeBehavior = keys.length !== (elseKey ? 2 : 1);
        if (isMergeBehavior) {
            if (!isPlainObject(newNode) && newNode !== null) {
                throw new FPMLValidationError(
                    'If/else block must return object for implicit merge into existing node',
                );
            }

            return {
                node: {
                    ...omitKey(omitKey(node, ifKey), elseKey),
                    ...(newNode !== null ? newNode : {}),
                },
            };
        }
        return { node: newNode };
    }
}

type Transformer = (node: any, context: Context) => { node: any; context: Context };

function iterateObject(obj: any, context: Context, transform: Transformer): any {
    if (Array.isArray(obj)) {
        // Arrays are flattened and null values are removed here
        return obj
            .flatMap((value) => {
                const result = transform(value, context);

                return iterateObject(result.node, result.context, transform);
            })
            .filter((x) => x !== null);
    } else if (isPlainObject(obj)) {
        return mapValues(obj, (value) => {
            const result = transform(value, context);

            return iterateObject(result.node, result.context, transform);
        });
    }

    return transform(obj, context).node;
}

function isPlainObject(obj: any) {
    return Object.prototype.toString.call(obj) === '[object Object]';
}

function mapValues(obj: object, fn: (value: any, key: string) => any) {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => {
            return [key, fn(value, key)];
        }),
    );
}

function omitKey(obj: any, key: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [key]: _, ...rest } = obj;

    return rest;
}

export function evaluateExpression(
    resource: any,
    expression: string,
    context: Context,
    model: Model,
    options: FPOptions,
) {
    try {
        return fhirpath.evaluate(
            resource,
            expression,
            // fhirpath mutates context https://github.com/HL7/fhirpath.js/issues/155
            { ...context },
            model,
            options,
        );
    } catch (exc) {
        throw new FPMLValidationError(
            `Can not evaluate "${expression}": ${exc}\nContext:\n${JSON.stringify(
                context,
                null,
                1,
            )}\n\nResource:\n${JSON.stringify(resource, null, 1)}`,
        );
    }
}
