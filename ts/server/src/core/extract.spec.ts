import { FPMLValidationError, resolveTemplate } from './extract';

describe('Transformation', () => {
    const resource = { list: [{ key: 1 }, { key: 2 }, { key: 3 }] } as any;

    test('fails on accessing props of resource in strict mode', () => {
        expect(() =>
            resolveTemplate(resource, { key: '{{ list.key }}' }, {}, null, null, true),
        ).toThrow(FPMLValidationError);
    });

    test.skip('fails on accessing props of resource (with capital letter) in strict mode', () => {
        expect(() =>
            resolveTemplate(
                { resourceType: 'Resource', key: [1, 2, 3] },
                { key: '{{ Resource.key }}' },
                {},
                null,
                null,
                true,
            ),
        ).toThrow(FPMLValidationError);
    });

    test('works on accessing props of explicit context in strict mode', () => {
        expect(
            resolveTemplate(
                resource,
                { key: '{{ %Resource.list.key }}' },
                { Resource: resource },
                null,
                null,
                true,
            ),
        ).toStrictEqual({ key: 1 });
    });

    test('works on accessing props of implicit context in strict mode', () => {
        expect(
            resolveTemplate(
                resource,
                { key: '{{ %context.list.key }}' },
                { Resource: resource },
                null,
                null,
                true,
            ),
        ).toStrictEqual({ key: 1 });
    });

    test('for empty object return empty object', () => {
        expect(resolveTemplate(resource, {})).toStrictEqual({});
    });

    test('for empty array return empty array', () => {
        expect(resolveTemplate(resource, [])).toStrictEqual([]);
    });

    test('for array of arrays returns flattened array', () => {
        expect(
            resolveTemplate(resource, [
                [1, 2, 3],
                [4, 5, 6],
            ]),
        ).toStrictEqual([1, 2, 3, 4, 5, 6]);
    });

    test('for array with null values returns compacted array', () => {
        expect(resolveTemplate(resource, [[1, null, 2, null, 3]])).toStrictEqual([1, 2, 3]);
    });

    test('for array with undefined values returns compacted array', () => {
        expect(resolveTemplate(resource, [[1, undefined, 2, undefined, 3]])).toStrictEqual([
            1, 2, 3,
        ]);
    });

    test('for object with null keys returns null keys', () => {
        expect(resolveTemplate(resource, { key: null })).toStrictEqual({ key: null });
    });

    test('for object with undefined keys returns undefined keys', () => {
        expect(resolveTemplate(resource, { key: undefined })).toStrictEqual({ key: undefined });
    });

    test('for object with non-null keys returns non-null keys', () => {
        expect(resolveTemplate(resource, { key: 1 })).toStrictEqual({ key: 1 });
    });

    test('for array of objects returns original array', () => {
        expect(resolveTemplate(resource, [{ list: [1, 2, 3] }, { list: [4, 5, 6] }])).toStrictEqual(
            [{ list: [1, 2, 3] }, { list: [4, 5, 6] }],
        );
    });

    test('for null returns null', () => {
        expect(resolveTemplate(resource, null)).toStrictEqual(null);
    });

    test('for constant string returns constant string', () => {
        expect(resolveTemplate(resource, 'string')).toStrictEqual('string');
    });

    test('for constant number returns constant number', () => {
        expect(resolveTemplate(resource, 1)).toStrictEqual(1);
    });

    test('for false returns false', () => {
        expect(resolveTemplate(resource, false)).toStrictEqual(false);
    });

    test('for true returns true', () => {
        expect(resolveTemplate(resource, true)).toStrictEqual(true);
    });

    test('for non-empty array expression return first element', () => {
        expect(resolveTemplate(resource, '{{ list }}')).toStrictEqual({ key: 1 });
    });

    test('for empty array expression returns undefined', () => {
        expect(resolveTemplate(resource, '{{ list.where($this = 0) }}')).toStrictEqual(undefined);
    });

    test('for empty array nullable expression returns null', () => {
        expect(resolveTemplate(resource, '{{+ list.where($this = 0) +}}')).toStrictEqual(null);
    });

    test('for template expression returns resolved template', () => {
        expect(
            resolveTemplate(resource, '/{{ list[0].key }}/{{ list[1].key }}/{{ list[2].key }}'),
        ).toStrictEqual('/1/2/3');
    });

    test('for empty array template expression returns undefined', () => {
        expect(
            resolveTemplate(
                resource,
                '/Patient/{{ list.where($this = 0) }}/_history/{{ list.last() }}',
            ),
        ).toStrictEqual(undefined);
    });

    test('for empty array nullable template expression returns null', () => {
        expect(
            resolveTemplate(
                resource,
                '/Patient/{{+ list.where($this = 0) +}}/_history/{{ list.last() }}',
            ),
        ).toStrictEqual(null);
    });

    test('for multiline template works properly', () => {
        expect(resolveTemplate(resource, '{{\nlist.where(\n$this.key=1\n).key\n}}')).toStrictEqual(
            1,
        );
    });

    test('fails with incorrect fhirpath expression', () => {
        expect(() => resolveTemplate({} as any, "{{ item.where(linkId='a) }}")).toThrowError(
            FPMLValidationError,
        );
    });

    test('array template works properly', () => {
        expect(resolveTemplate({ list: [{ key: 1 }, { key: 2 }] }, '{[ list.key ]}')).toStrictEqual(
            [1, 2],
        );
    });
});

describe('Context block', () => {
    const resource: any = {
        foo: 'bar',
        list: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
    };

    test('passes result as resource', () => {
        expect(
            resolveTemplate(
                resource,
                {
                    list: {
                        '{{ list }}': {
                            key: '{{ key }}',
                            foo: '{{ %root.foo }}',
                        },
                    },
                },
                { root: resource },
            ),
        ).toStrictEqual({
            list: [
                { key: 'a', foo: 'bar' },
                { key: 'b', foo: 'bar' },
                { key: 'c', foo: 'bar' },
            ],
        });
    });
});

describe('Assign block', () => {
    const resource = {
        resourceType: 'Resource',
        sourceValue: 100,
    } as any;

    test('works with single var as object', () => {
        expect(
            resolveTemplate(resource, {
                '{% assign %}': { var: 100 },
                value: '{{ %var }}',
            }),
        ).toStrictEqual({
            value: 100,
        });
    });

    test('works with undefined intermediate values', () => {
        expect(
            resolveTemplate(resource, {
                '{% assign %}': [{ varA: '{{ {} }}' }, { varB: '{{ %varA }}' }],
                valueA: '{{ %varB }}',
            }),
        ).toStrictEqual({
            valueA: undefined,
        });
    });

    test('works with multiple vars as array of objects', () => {
        expect(
            resolveTemplate(resource, {
                '{% assign %}': [{ varA: 100 }, { varB: '{{ %varA + 100}}' }],
                valueA: '{{ %varA }}',
                valueB: '{{ %varB }}',
            }),
        ).toStrictEqual({
            valueA: 100,
            valueB: 200,
        });
    });

    test('has isolated nested context', () => {
        expect(
            resolveTemplate(resource, {
                '{% assign %}': { varC: 100 },
                nested: {
                    '{% assign %}': { varC: 200 },
                    valueC: '{{ %varC }}',
                },
                valueC: '{{ %varC }}',
            }),
        ).toStrictEqual({
            valueC: 100,
            nested: {
                valueC: 200,
            },
        });
    });

    test('works properly in full example', () => {
        expect(
            resolveTemplate(resource, {
                '{% assign %}': [
                    {
                        varA: {
                            '{% assign %}': [
                                {
                                    varX: '{{ Resource.sourceValue.first() }}',
                                },
                            ],

                            x: '{{ %varX }}',
                        },
                    },
                    { varB: '{{ %varA.x + 1 }}' },
                    { varC: 0 },
                ],
                nested: {
                    '{% assign %}': { varC: '{{ %varA.x + %varB }}' },
                    valueA: '{{ %varA }}',
                    valueB: '{{ %varB }}',
                    valueC: '{{ %varC }}',
                },
                valueA: '{{ %varA }}',
                valueB: '{{ %varB }}',
                valueC: '{{ %varC }}',
            }),
        ).toStrictEqual({
            valueA: { x: 100 },
            valueB: 101,
            valueC: 0,

            nested: {
                valueA: { x: 100 },
                valueB: 101,
                valueC: 201,
            },
        });
    });

    test('fails with multiple keys in object', () => {
        expect(() =>
            resolveTemplate(resource, {
                '{% assign %}': { varA: 100, varB: 200 },
                value: '{{ %var }}',
            }),
        ).toThrowError(FPMLValidationError);
    });

    test('fails with multiple keys in array of objects', () => {
        expect(() =>
            resolveTemplate(resource, {
                '{% assign %}': [{ varA: 100, varB: 200 }],
                value: '{{ %var }}',
            }),
        ).toThrowError(FPMLValidationError);
    });

    test('fails with non-array and non-object as value', () => {
        expect(() =>
            resolveTemplate(resource, {
                '{% assign %}': 1,
                value: '{{ %var }}',
            }),
        ).toThrowError(FPMLValidationError);
    });
});

describe('For block', () => {
    test('works properly in full example', () => {
        expect(
            resolveTemplate(
                {
                    foo: 'bar',
                    list: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
                } as any,
                {
                    listArr: [
                        {
                            '{% for index, item in list %}': {
                                key: '{{ %item.key }}',
                                foo: '{{ foo }}',
                                index: '{{ %index }}',
                            },
                        },
                        {
                            '{% for item in list %}': {
                                key: '{{ %item.key }}',
                                foo: '{{ foo }}',
                            },
                        },
                    ],
                    listObj: {
                        '{% for item in list %}': {
                            key: '{{ %item.key }}',
                            foo: '{{ foo }}',
                        },
                    },
                },
            ),
        ).toStrictEqual({
            listArr: [
                { key: 'a', foo: 'bar', index: 0 },
                { key: 'b', foo: 'bar', index: 1 },
                { key: 'c', foo: 'bar', index: 2 },
                { key: 'a', foo: 'bar' },
                { key: 'b', foo: 'bar' },
                { key: 'c', foo: 'bar' },
            ],
            listObj: [
                { key: 'a', foo: 'bar' },
                { key: 'b', foo: 'bar' },
                { key: 'c', foo: 'bar' },
            ],
        });
    });

    test('has context from local assign block', () => {
        expect(
            resolveTemplate({} as any, {
                '{% assign %}': {
                    localList: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
                },
                listArr: [
                    {
                        '{% for item in %localList %}': {
                            key: '{{ %item.key }}',
                        },
                    },
                ],
            }),
        ).toStrictEqual({
            listArr: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
        });
    });

    test('fails with other keys passed', () => {
        expect(() =>
            resolveTemplate({ list: [1, 2, 3] } as any, {
                userKey: 1,
                '{% for key in %list %}': '{{ %key }}',
            }),
        ).toThrowError(FPMLValidationError);
    });
});

describe('If block', () => {
    const resource: any = {
        key: 'value',
    };

    test('returns if branch for truthy condition at root level', () => {
        expect(
            resolveTemplate(resource, {
                "{% if key = 'value' %}": { nested: "{{ 'true' + key }}" },
                '{% else %}': { nested: "{{ 'false' + key }}" },
            }),
        ).toStrictEqual({
            nested: 'truevalue',
        });
    });

    test('returns if branch for truthy condition', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    "{% if key = 'value' %}": { nested: "{{ 'true' + key }}" },
                    '{% else %}': { nested: "{{ 'false' + key }}" },
                },
            }),
        ).toStrictEqual({
            result: { nested: 'truevalue' },
        });
    });

    test('returns if branch for truthy condition without else branch', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    "{% if key = 'value' %}": { nested: "{{ 'true' + key }}" },
                },
            }),
        ).toStrictEqual({
            result: { nested: 'truevalue' },
        });
    });

    test('returns else branch for falsy condition', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    "{% if key != 'value' %}": { nested: "{{ 'true' + key }}" },
                    '{% else %}': { nested: "{{ 'false' + key }}" },
                },
            }),
        ).toStrictEqual({
            result: { nested: 'falsevalue' },
        });
    });

    test('returns undefined for falsy condition without else branch', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    "{% if key != 'value' %}": { nested: "{{ 'true' + key }}" },
                },
            }),
        ).toStrictEqual({
            result: undefined,
        });
    });

    test('returns null for falsy condition with nullable else branch', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    "{% if key != 'value' %}": { nested: "{{ 'true' + key }}" },
                    '{% else %}': '{{+ {} +}}',
                },
            }),
        ).toStrictEqual({
            result: null,
        });
    });

    test('returns if branch for nested if', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    "{% if key = 'value' %}": {
                        "{% if key = 'value' %}": 'value',
                    },
                },
            }),
        ).toStrictEqual({
            result: 'value',
        });
    });

    test('returns else branch for nested else', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    "{% if key != 'value' %}": null,
                    '{% else %}': {
                        "{% if key != 'value' %}": null,
                        '{% else %}': 'value',
                    },
                },
            }),
        ).toStrictEqual({
            result: 'value',
        });
    });

    test('implicitly merges with null returned', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    myKey: 1,
                    "{% if key = 'value' %}": null,
                },
            }),
        ).toStrictEqual({
            result: {
                myKey: 1,
            },
        });
    });

    test('implicitly merges with undefined returned', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    myKey: 1,
                    "{% if key = 'value' %}": undefined,
                },
            }),
        ).toStrictEqual({
            result: {
                myKey: 1,
            },
        });
    });

    test('implicitly merges with object returned for truthy condition', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    myKey: 1,
                    "{% if key = 'value' %}": {
                        anotherKey: 2,
                    },
                },
            }),
        ).toStrictEqual({
            result: {
                myKey: 1,
                anotherKey: 2,
            },
        });
    });

    test('implicitly merges with object returned for falsy condition', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    myKey: 1,
                    "{% if key != 'value' %}": {
                        anotherKey: 2,
                    },
                    '{% else %}': {
                        anotherKey: 3,
                    },
                },
            }),
        ).toStrictEqual({
            result: {
                myKey: 1,
                anotherKey: 3,
            },
        });
    });

    test('fails on implicit merge with non-object returned from if branch', () => {
        expect(() =>
            resolveTemplate(resource, {
                result: {
                    myKey: 1,
                    "{% if key = 'value' %}": [],
                },
            }),
        ).toThrow(FPMLValidationError);
    });

    test('fails on implicit merge with non-object returned from else branch', () => {
        expect(() =>
            resolveTemplate(resource, {
                result: {
                    myKey: 1,
                    "{% if key != 'value' %}": {},
                    '{% else %}': [],
                },
            }),
        ).toThrow(FPMLValidationError);
    });

    test('fails on multiple if blocks', () => {
        expect(() =>
            resolveTemplate(resource, {
                result: {
                    myKey: 1,
                    "{% if key != 'value' %}": {},
                    "{% if key = 'value' %}": {},
                },
            }),
        ).toThrow(FPMLValidationError);
    });

    test('fails on multiple else blocks', () => {
        expect(() =>
            resolveTemplate(resource, {
                result: {
                    myKey: 1,
                    "{% if key != 'value' %}": {},
                    '{% else %}': {},
                    '{% else  %}': {},
                },
            }),
        ).toThrow(FPMLValidationError);
    });

    test('fails on else block without if block', () => {
        expect(() =>
            resolveTemplate(resource, {
                result: {
                    myKey: 1,
                    '{% else %}': {},
                },
            }),
        ).toThrow(FPMLValidationError);
    });
});

describe('Merge block', () => {
    const resource: any = {
        key: 'value',
    };

    test('implicitly merges into the node', () => {
        expect(
            resolveTemplate(resource, {
                b: 1,
                '{% merge %}': { a: 1 },
            }),
        ).toStrictEqual({
            b: 1,
            a: 1,
        });
    });

    test('merges multiple blocks within order', () => {
        expect(
            resolveTemplate(resource, {
                '{% merge %}': [{ a: 1 }, { b: 2 }, { a: 3 }],
            }),
        ).toStrictEqual({
            a: 3,
            b: 2,
        });
    });

    test('merges multiple blocks containing nulls', () => {
        expect(
            resolveTemplate(resource, {
                '{% merge %}': [{ a: 1 }, null, { b: 2 }],
            }),
        ).toStrictEqual({
            a: 1,
            b: 2,
        });
    });

    test('merges multiple blocks containing undefined', () => {
        expect(
            resolveTemplate(resource, {
                '{% merge %}': [{ a: 1 }, undefined, { b: 2 }],
            }),
        ).toStrictEqual({
            a: 1,
            b: 2,
        });
    });

    test('fails on merge with non-object', () => {
        expect(() =>
            resolveTemplate(resource, {
                '{% merge %}': [1, 2],
            }),
        ).toThrow(FPMLValidationError);
    });
});
