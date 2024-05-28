import * as fhirpath from 'fhirpath';

type Resource = Record<string, any>;
type Path = Array<string | number>;

// TODO: looks a bit hacky to use extra node here
// TODO: I believe it might be re-written without using it
const rootNodeKey = '__rootNode__';

export interface FPOptions {
    userInvocationTable?: UserInvocationTable;
}

export class FPMLValidationError extends Error {
    constructor(message: string, path: Path) {
        const pathStr = path.filter((x) => x != rootNodeKey).join('.');
        super(`${message}. Path '${pathStr}'`);
    }
}

const guardedResource = new Proxy(
    {},
    {
        get: (obj, prop) => {
            if (prop === '__path__' || prop === 'resourceType') {
                return undefined;
            }

            throw new Error(
                `Forbidden access to resource property ${String(
                    prop,
                )} in strict mode. Use context instead`,
            );
        },
    },
);

export function resolveTemplate(
    resource: Resource,
    template: any,
    context?: Context,
    model?: Model,
    fpOptions?: FPOptions,
    strict?: boolean,
    // TODO: it's fast hack for backward compatibility
    dropNulls?: boolean,
): any {
    return resolveTemplateRecur(
        [],
        strict ? guardedResource : resource,
        template,
        context,
        model,
        fpOptions,
        dropNulls,
    );
}

function resolveTemplateRecur(
    startPath: Path,
    resource: Resource,
    template: any,
    initialContext?: Context,
    model?: Model,
    fpOptions?: FPOptions,
    dropNulls?: boolean,
): any {
    return iterateObject(
        startPath,
        { [rootNodeKey]: template },
        initialContext ?? {},
        (path, node, context) => {
            if (isPlainObject(node)) {
                const { node: newNode, context: newContext } = processAssignBlock(
                    path,
                    resource,
                    node,
                    context,
                    model,
                    fpOptions,
                    dropNulls,
                );
                const matchers = [
                    processContextBlock,
                    processMergeBlock,
                    processForBlock,
                    processIfBlock,
                ];
                for (const matcher of matchers) {
                    const result = matcher(
                        path,
                        resource,
                        newNode,
                        newContext,
                        model,
                        fpOptions,
                        dropNulls,
                    );

                    if (result) {
                        return { node: result.node, context: newContext };
                    }
                }

                return { node: newNode, context: newContext };
            } else if (typeof node === 'string') {
                return {
                    node: processTemplateString(
                        path,
                        resource,
                        node,
                        context,
                        model,
                        fpOptions,
                        dropNulls,
                    ),
                    context,
                };
            }

            return { node, context };
        },
    )[rootNodeKey];
}

function processTemplateString(
    path: Path,
    resource: Resource,
    node: string,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
    dropNulls?: boolean,
) {
    const templateRegExp = /{{-?\s*([\s\S]+?)\s*-?}}/g;
    let match:
        | RegExpExecArray
        | { [Symbol.replace](string: string, replaceValue: string): string }[];
    let result: any = node;

    while ((match = templateRegExp.exec(node)) !== null) {
        const expr = match[1];
        const replacement =
            evaluateExpression(path, resource, expr, context, model, fpOptions)[0] ?? null;

        if (replacement === null) {
            if (match[0].startsWith('{{-')) {
                return undefined;
            }

            return dropNulls ? undefined : null;
        }

        if (match[0] === node) {
            return replacement;
        }

        result = result.replace(match[0], replacement);
    }

    return result;
}

function processAssignBlock(
    path: Path,
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
    dropNulls?: boolean,
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
                        path,
                    );
                }

                Object.entries(
                    resolveTemplateRecur(
                        path,
                        resource,
                        obj,
                        extendedContext,
                        model,
                        fpOptions,
                        dropNulls,
                    ),
                ).forEach(([key, value]) => {
                    extendedContext[key] = value;
                });
            });
        } else if (isPlainObject(node[assignKey])) {
            if (Object.keys(node[assignKey]).length !== 1) {
                throw new FPMLValidationError(
                    'Assign block must accept only one key per object',
                    path,
                );
            }
            Object.entries(
                resolveTemplateRecur(
                    path,
                    resource,
                    node[assignKey],
                    extendedContext,
                    model,
                    fpOptions,
                    dropNulls,
                ),
            ).forEach(([key, value]) => {
                extendedContext[key] = value;
            });
        } else {
            throw new FPMLValidationError('Assign block must accept array or object', path);
        }

        return { node: omitKey(node, assignKey), context: extendedContext };
    }

    return { node, context };
}

function processMergeBlock(
    path: Path,
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
    dropNulls?: boolean,
): { node: any } | undefined {
    const keys = Object.keys(node);

    const mergeRegExp = /{%\s*merge\s*%}/;
    const mergeKey = keys.find((k) => k.match(mergeRegExp));

    if (mergeKey) {
        return {
            node: (Array.isArray(node[mergeKey]) ? node[mergeKey] : [node[mergeKey]]).reduce(
                (mergeAcc, nodeValue) => {
                    const result = resolveTemplateRecur(
                        path,
                        resource,
                        nodeValue,
                        context,
                        model,
                        fpOptions,
                        dropNulls,
                    );
                    if (!isPlainObject(result) && result !== null) {
                        throw new FPMLValidationError('Merge block must contain object', path);
                    }

                    return { ...mergeAcc, ...(result || {}) };
                },
                omitKey(node, mergeKey),
            ),
        };
    }
}

function processForBlock(
    path: Path,
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
    dropNulls?: boolean,
): { node: any } | undefined {
    const keys = Object.keys(node);

    const forRegExp = /{%\s*for\s+(?:(\w+?)\s*,\s*)?(\w+?)\s+in\s+(.+?)\s*%}/;
    const forKey = keys.find((k) => k.match(forRegExp));

    if (forKey) {
        const matches = forKey.match(forRegExp);
        const hasIndexKey = matches.length === 4;
        const indexKey = hasIndexKey ? matches[1] : null;
        const itemKey = hasIndexKey ? matches[2] : matches[1];
        const expr = hasIndexKey ? matches[3] : matches[2];

        if (keys.length > 1) {
            throw new FPMLValidationError(`For block must be presented as single key`, path);
        }

        const answers = evaluateExpression(path, resource, expr, context, model, fpOptions);
        return {
            node: answers.map((answer, index) =>
                resolveTemplateRecur(
                    path,
                    resource,
                    node[forKey],
                    {
                        ...context,
                        [itemKey]: answer,
                        ...(hasIndexKey ? { [indexKey]: index } : {}),
                    },
                    model,
                    fpOptions,
                    dropNulls,
                ),
            ),
        };
    }
}

function processContextBlock(
    path: Path,
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
    dropNulls?: boolean,
): { node: any } | undefined {
    const keys = Object.keys(node);

    const contextRegExp = /{{\s*(.+?)\s*}}/;
    const contextKey = keys.find((k) => k.match(contextRegExp));
    if (contextKey) {
        const matches = contextKey.match(contextRegExp);
        const expr = matches[1];

        if (keys.length > 1) {
            throw new FPMLValidationError('Context block must be presented as single key', path);
        }

        const answers = evaluateExpression(path, resource, expr, context, model, fpOptions);
        const result: any[] = answers.map((answer) =>
            resolveTemplateRecur(
                path,
                answer,
                node[contextKey],
                context,
                model,
                fpOptions,
                dropNulls,
            ),
        );

        return { node: result };
    }
}

function processIfBlock(
    path: Path,
    resource: Resource,
    node: any,
    context: Context,
    model: Model,
    fpOptions: FPOptions,
    dropNulls?: boolean,
): { node: any } | undefined {
    const keys = Object.keys(node);

    const ifRegExp = /{%\s*if\s+(.+?)\s*%}/;
    const elseRegExp = /{%\s*else\s*%}/;

    const ifKeys = keys.filter((k) => k.match(ifRegExp));
    if (ifKeys.length > 1) {
        throw new FPMLValidationError('If block must be presented once', path);
    }
    const ifKey = ifKeys[0];

    const elseKeys = keys.filter((k) => k.match(elseRegExp));
    if (elseKeys.length > 1) {
        throw new FPMLValidationError('Else block must be presented once', path);
    }
    const elseKey = elseKeys[0];

    if (elseKey && !ifKey) {
        throw new FPMLValidationError(
            'Else block must be presented only when if block is presented',
            path,
        );
    }

    if (ifKey) {
        const matches = ifKey.match(ifRegExp);
        const expr = matches[1];

        const answer = evaluateExpression(
            path,
            resource,
            `iif(${expr}, true, false)`,
            context,
            model,
            fpOptions,
        )[0];

        const newNode = answer
            ? resolveTemplateRecur(
                  path,
                  resource,
                  node[ifKey],
                  context,
                  model,
                  fpOptions,
                  dropNulls,
              )
            : elseKey
            ? resolveTemplateRecur(
                  path,
                  resource,
                  node[elseKey],
                  context,
                  model,
                  fpOptions,
                  dropNulls,
              )
            : null;

        const isMergeBehavior = keys.length !== (elseKey ? 2 : 1);
        if (isMergeBehavior) {
            if (!isPlainObject(newNode) && newNode !== null) {
                throw new FPMLValidationError(
                    'If/else block must return object for implicit merge into existing node',
                    path,
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

type Transformer = (path: Path, node: any, context: Context) => { node: any; context: Context };

function iterateObject(startPath: Path, obj: any, context: Context, transform: Transformer): any {
    if (Array.isArray(obj)) {
        // Arrays are flattened and null values are removed here
        return obj
            .flatMap((value, index) => {
                const result = transform([...startPath, index], value, context);

                return iterateObject([...startPath, index], result.node, result.context, transform);
            })
            .filter((x) => x !== null);
    } else if (isPlainObject(obj)) {
        return mapValues(obj, (value, key) => {
            const result = transform([...startPath, key], value, context);

            return iterateObject([...startPath, key], result.node, result.context, transform);
        });
    }

    return transform(startPath, obj, context).node;
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
    path: Path,
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
        throw new FPMLValidationError(`Can not evaluate '${expression}': ${exc}`, path);
    }
}
