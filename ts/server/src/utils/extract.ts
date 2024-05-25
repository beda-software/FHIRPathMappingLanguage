import * as fhirpath from 'fhirpath';

type Resource = Record<string, any>;

interface FPOptions {
    userInvocationTable?: UserInvocationTable;
}

interface Embedded {
    before: string;
    after: string;
    expression: string;
}

// TODO rewrite using regex and multiple embedding (#8)
export function embeddedFHIRPath(a: string): Embedded | undefined {
    const start = a.search('{{');
    const stop = a.search('}}');
    if (start === -1 || stop === -1) {
        return undefined;
    }

    const before = a.slice(0, start);
    const after = a.slice(stop + 2);
    const expression = a.slice(start + 2, stop);
    return {
        before,
        expression,
        after,
    };
}

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
            const matchers = [
                processForBlock,
                processContextBlock,
                processIfBlock,
                processMergeBlock,
            ];
            for (const matcher of matchers) {
                const result = matcher(resource, newNode, newContext, model, fpOptions);

                if (result) {
                    return { node: result.node, context: newContext };
                }
            }

            return { node: newNode, context: newContext };
        } else if (typeof node === 'string') {
            const embedded = embeddedFHIRPath(node);

            if (embedded) {
                const result =
                    fhirpath.evaluate(
                        resource,
                        embedded.expression,
                        { ...context }, // fhirpath mutates context!
                        model,
                        fpOptions,
                    )[0] ?? null;
                if (embedded.before || embedded.after) {
                    return {
                        node: `${embedded.before}${result}${embedded.after}`,
                        context,
                    };
                }

                return {
                    node: result,
                    context,
                };
            }
        }

        return { node, context };
    });
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
                Object.entries(
                    resolveTemplate(resource, obj, extendedContext, model, fpOptions),
                ).forEach(([key, value]) => {
                    extendedContext[key] = value;
                });
            });
        } else if (isPlainObject(node[assignKey])) {
            Object.entries(
                resolveTemplate(resource, node[assignKey], extendedContext, model, fpOptions),
            ).forEach(([key, value]) => {
                extendedContext[key] = value;
            });
        } else {
            throw new Error('Assign block must accept array or object');
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
            throw new Error('For block must be presented as single key');
        }

        const matches = forKey.match(forRegExp);
        const hasIndexKey = matches.length === 4;
        const indexKey = hasIndexKey ? matches[1] : null;
        const itemKey = hasIndexKey ? matches[2] : matches[1];
        const expr = hasIndexKey ? matches[3] : matches[2];

        const answers = fhirpath.evaluate(
            resource,
            expr,
            { ...context }, // fhirpath mutates context!
            model,
            fpOptions,
        );
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
            throw new Error('Context block must be presented as single key');
        }
        const matches = contextKey.match(contextRegExp);

        const expr = matches[1];
        const answers = fhirpath.evaluate(
            resource,
            expr,
            { ...context }, // fhirpath mutates context!
            model,
            fpOptions,
        );
        const result: any[] = answers.map((answer) =>
            resolveTemplate(answer, node[contextKey], context, model, fpOptions),
        );

        return { node: result };
    }
}

function processMergeBlock(
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
): { node: any } | undefined {
    const keys = Object.keys(node);

    const mergeRegExp = /{%\s*merge\s*%}/;
    const mergeKey = keys.find((k) => k.match(mergeRegExp));
    if (mergeKey) {
        if (keys.length > 1) {
            throw new Error('Merge block must be presented as single key');
        }

        return {
            node: (Array.isArray(node[mergeKey]) ? node[mergeKey] : [node[mergeKey]]).reduce(
                (mergeAcc, nodeValue) => {
                    const result = resolveTemplate(resource, nodeValue, context, model, fpOptions);
                    if (!isPlainObject(result) && result !== null) {
                        throw new Error('Merge block must contain object');
                    }

                    return { ...mergeAcc, ...(result || {}) };
                },
                {},
            ),
        };
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

        const maxKeysCount = elseKey ? 2 : 1;
        if (keys.length > maxKeysCount) {
            throw new Error('If block must contain only if and optional else keys');
        }

        const matches = ifKey.match(ifRegExp);
        const expr = matches[1];

        const answer = fhirpath.evaluate(
            resource,
            `iif(${expr}, true, false)`,
            { ...context }, // fhirpath mutates context!
            model,
            fpOptions,
        )[0];

        return {
            node: answer
                ? resolveTemplate(resource, node[ifKey], context, model, fpOptions)
                : elseKey
                ? resolveTemplate(resource, node[elseKey], context, model, fpOptions)
                : null,
        };
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
