import { FPMLValidationError, resolveTemplate } from './extract';

describe('Transformation', () => {
    const resource = { list: [{ key: 1 }, { key: 2 }, { key: 3 }] } as any;

    test('fails on accessing props of resource in strict mode', () => {
        expect(() =>
            resolveTemplate(
                resource,
                { resourceType: 'Resource', result: '{{ list.key }}' },
                {},
                null,
                null,
                true,
            ),
        ).toThrow(FPMLValidationError);
    });

    test('fails on accessing props of resource (with capital letter) in strict mode', () => {
        expect(() =>
            resolveTemplate(
                { resourceType: 'Resource', key: [1, 2, 3] },
                { resourceType: 'Resource', result: '{{ Resource.key }}' },
                {},
                null,
                null,
                true,
            ),
        ).toThrow(FPMLValidationError);
    });

    test.skip('fails on accessing props of undefined resource (with capital letter) in strict mode (issue #27)', () => {
        expect(() =>
            resolveTemplate(
                { resourceType: 'Resource', key: [1, 2, 3] },
                { resourceType: 'Resource', result: '{{ UndefinedResource.key }}' },
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
                { resourceType: 'Resource', result: '{{ %Resource.list.key }}' },
                { Resource: resource },
                null,
                null,
                true,
            ),
        ).toStrictEqual({ resourceType: 'Resource', result: 1 });
    });

    test('works on accessing props of implicit context in strict mode', () => {
        expect(
            resolveTemplate(
                resource,
                { resourceType: 'Resource', result: '{{ %context.list.key }}' },
                { Resource: resource },
                null,
                null,
                true,
            ),
        ).toStrictEqual({ resourceType: 'Resource', result: 1 });
    });

    test('removes undefined values from nested lists and arrays', () => {
        expect(
            resolveTemplate(
                resource,
                { resourceType: 'Resource', list: [undefined, { nested: [undefined] }, undefined] },
                {},
                null,
                null,
                true,
            ),
        ).toStrictEqual({ resourceType: 'Resource' });
    });

    test('removes empty objects', () => {
        expect(resolveTemplate(resource, { resourceType: 'Resource', key: {} })).toStrictEqual({
            resourceType: 'Resource',
        });
    });

    test('removes empty arrays', () => {
        expect(resolveTemplate(resource, { resourceType: 'Resource', key: [] })).toStrictEqual({
            resourceType: 'Resource',
        });
    });

    test('flattens array of arrays', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: [
                    [1, 2, 3],
                    [4, 5, 6],
                ],
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: [1, 2, 3, 4, 5, 6],
        });
    });

    test('preserves null values in array', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: [1, null, 2, null, 3],
            }),
        ).toStrictEqual({ resourceType: 'Resource', result: [1, null, 2, null, 3] });
    });

    test('removes undefined values from array', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: [1, undefined, 2, undefined, 3],
            }),
        ).toStrictEqual({ resourceType: 'Resource', result: [1, 2, 3] });
    });

    test('preserves null values in object', () => {
        expect(resolveTemplate(resource, { resourceType: 'Resource', result: null })).toStrictEqual(
            {
                resourceType: 'Resource',
                result: null,
            },
        );
    });

    test('removes undefined values from object', () => {
        expect(
            resolveTemplate(resource, { resourceType: 'Resource', result: undefined }),
        ).toStrictEqual({ resourceType: 'Resource' });
    });

    test('preserves non null values in object', () => {
        expect(resolveTemplate(resource, { resourceType: 'Resource', result: 1 })).toStrictEqual({
            resourceType: 'Resource',
            result: 1,
        });
    });

    test('preserves array of objects', () => {
        expect(resolveTemplate(resource, [{ list: [1, 2, 3] }, { list: [4, 5, 6] }])).toStrictEqual(
            [{ list: [1, 2, 3] }, { list: [4, 5, 6] }],
        );
    });

    test('returns null for null', () => {
        expect(resolveTemplate(resource, null)).toStrictEqual(null);
    });

    test('returns string for string', () => {
        expect(resolveTemplate(resource, 'string')).toStrictEqual('string');
    });

    test('returns number for number', () => {
        expect(resolveTemplate(resource, 1)).toStrictEqual(1);
    });

    test('returns boolean for boolean', () => {
        expect(resolveTemplate(resource, false)).toStrictEqual(false);
    });

    test('returns true for true', () => {
        expect(resolveTemplate(resource, true)).toStrictEqual(true);
    });

    test('returns first element of array', () => {
        expect(
            resolveTemplate(resource, { resourceType: 'Resource', result: '{{ list }}' }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: { key: 1 },
        });
    });

    test('returns undefined for undefined values in expression', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: '{{ list.where($this = 0) }}',
            }),
        ).toStrictEqual({ resourceType: 'Resource' });
    });

    test('returns null for null values using null retention', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: '{{+ list.where($this = 0) +}}',
            }),
        ).toStrictEqual({ resourceType: 'Resource', result: null });
    });

    test('returns resolved template for template expression', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: '/{{ list[0].key }}/{{ list[1].key }}/{{ list[2].key }}',
            }),
        ).toStrictEqual({ resourceType: 'Resource', result: '/1/2/3' });
    });

    test('removes undefined values for undefined values in complex expression', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: '/Patient/{{ list.where($this = 0) }}/_history/{{ list.last() }}',
            }),
        ).toStrictEqual({ resourceType: 'Resource' });
    });

    test('preserves null values using null retention for complex expression', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: '/Patient/{{+ list.where($this = 0) +}}/_history/{{ list.last() }}',
            }),
        ).toStrictEqual({ resourceType: 'Resource', result: null });
    });

    test('works properly for multiline template', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: '{{\nlist.where(\n$this.key=1\n).key\n}}',
            }),
        ).toStrictEqual({ resourceType: 'Resource', result: 1 });
    });

    test('fails with incorrect fhirpath expression', () => {
        expect(() =>
            resolveTemplate({} as any, {
                resourceType: 'Resource',
                result: "{{ item.where(linkId='a) }}",
            }),
        ).toThrow(FPMLValidationError);
    });

    test('array template works properly', () => {
        expect(
            resolveTemplate(
                { list: [{ key: 1 }, { key: 2 }] },
                { resourceType: 'Resource', result: '{[ list.key ]}' },
            ),
        ).toStrictEqual({ resourceType: 'Resource', result: [1, 2] });
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
                resourceType: 'Resource',
                '{% assign %}': { var: 100 },
                value: '{{ %var }}',
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            value: 100,
        });
    });

    test('works with undefined intermediate values', () => {
        expect(
            resolveTemplate(
                resource,
                {
                    resourceType: 'Resource',
                    '{% assign %}': [{ varA: '{{ {} }}' }, { varB: '{{ %varA }}' }],
                    valueA: '{{ %varB }}',
                },
                null,
                null,
                null,
                true,
            ),
        ).toStrictEqual({ resourceType: 'Resource' });
    });

    test('works with multiple vars as array of objects', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                '{% assign %}': [{ varA: 100 }, { varB: '{{ %varA + 100}}' }],
                valueA: '{{ %varA }}',
                valueB: '{{ %varB }}',
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            valueA: 100,
            valueB: 200,
        });
    });

    test('has isolated nested context', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                '{% assign %}': { varC: 100 },
                nested: {
                    '{% assign %}': { varC: 200 },
                    valueC: '{{ %varC }}',
                },
                valueC: '{{ %varC }}',
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            valueC: 100,
            nested: {
                valueC: 200,
            },
        });
    });

    test('works properly in full example', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
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
            resourceType: 'Resource',
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
                resourceType: 'Resource',
                '{% assign %}': { varA: 100, varB: 200 },
                value: '{{ %var }}',
            }),
        ).toThrowError(FPMLValidationError);
    });

    test('fails with multiple keys in array of objects', () => {
        expect(() =>
            resolveTemplate(resource, {
                resourceType: 'Resource',
                '{% assign %}': [{ varA: 100, varB: 200 }],
                value: '{{ %var }}',
            }),
        ).toThrowError(FPMLValidationError);
    });

    test('fails with non-array and non-object as value', () => {
        expect(() =>
            resolveTemplate(resource, {
                resourceType: 'Resource',
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
                    resourceType: 'Resource',
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
            resourceType: 'Resource',
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
                resourceType: 'Resource',
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
            resourceType: 'Resource',
            listArr: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
        });
    });

    test('fails with other keys passed', () => {
        expect(() =>
            resolveTemplate({ list: [1, 2, 3] } as any, {
                resourceType: 'Resource',
                result: {
                    userKey: 1,
                    '{% for key in %list %}': '{{ %key }}',
                },
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
                resourceType: 'Resource',
                result: {
                    "{% if key = 'value' %}": { nested: "{{ 'true' + key }}" },
                    '{% else %}': { nested: "{{ 'false' + key }}" },
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: { nested: 'truevalue' },
        });
    });

    test('returns if branch for truthy condition', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    "{% if key = 'value' %}": { nested: "{{ 'true' + key }}" },
                    '{% else %}': { nested: "{{ 'false' + key }}" },
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: { nested: 'truevalue' },
        });
    });

    test('returns if branch for truthy condition without else branch', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    "{% if key = 'value' %}": { nested: "{{ 'true' + key }}" },
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: { nested: 'truevalue' },
        });
    });

    test('returns else branch for falsy condition', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    "{% if key != 'value' %}": { nested: "{{ 'true' + key }}" },
                    '{% else %}': { nested: "{{ 'false' + key }}" },
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: { nested: 'falsevalue' },
        });
    });

    test('returns undefined for falsy condition without else branch', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    "{% if key != 'value' %}": { nested: "{{ 'true' + key }}" },
                },
            }),
        ).toStrictEqual({ resourceType: 'Resource' });
    });

    test('returns null for falsy condition with nullable else branch', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    "{% if key != 'value' %}": { nested: "{{ 'true' + key }}" },
                    '{% else %}': '{{+ {} +}}',
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: null,
        });
    });

    test('returns if branch for nested if', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    "{% if key = 'value' %}": {
                        "{% if key = 'value' %}": 'value',
                    },
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: 'value',
        });
    });

    test('returns else branch for nested else', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    "{% if key != 'value' %}": null,
                    '{% else %}': {
                        "{% if key != 'value' %}": null,
                        '{% else %}': 'value',
                    },
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: 'value',
        });
    });

    test('implicitly merges with null returned', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    myKey: 1,
                    "{% if key = 'value' %}": null,
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: {
                myKey: 1,
            },
        });
    });

    test('implicitly merges with undefined returned', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    myKey: 1,
                    "{% if key = 'value' %}": undefined,
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: {
                myKey: 1,
            },
        });
    });

    test('implicitly merges with object returned for truthy condition', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    myKey: 1,
                    "{% if key = 'value' %}": {
                        anotherKey: 2,
                    },
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: {
                myKey: 1,
                anotherKey: 2,
            },
        });
    });

    test('implicitly merges with object returned for falsy condition', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
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
            resourceType: 'Resource',
            result: {
                myKey: 1,
                anotherKey: 3,
            },
        });
    });

    test('fails on implicit merge with non-object returned from if branch', () => {
        expect(() =>
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    myKey: 1,
                    "{% if key = 'value' %}": [{ key1: true }],
                },
            }),
        ).toThrow(FPMLValidationError);
    });

    test('fails on implicit merge with non-object returned from else branch', () => {
        expect(() =>
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    myKey: 1,
                    "{% if key != 'value' %}": {},
                    '{% else %}': [{ key1: true }],
                },
            }),
        ).toThrow(FPMLValidationError);
    });

    test('fails on multiple if blocks', () => {
        expect(() =>
            resolveTemplate(resource, {
                resourceType: 'Resource',
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
                resourceType: 'Resource',
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
                resourceType: 'Resource',
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
                resourceType: 'Resource',
                result: {
                    b: 1,
                    '{% merge %}': { a: 1 },
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: {
                b: 1,
                a: 1,
            },
        });
    });

    test('merges multiple blocks within order', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    '{% merge %}': [{ a: 1 }, { b: 2 }, { a: 3 }],
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: {
                a: 3,
                b: 2,
            },
        });
    });

    test('merges multiple blocks containing nulls', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    '{% merge %}': [{ a: 1 }, null, { b: 2 }],
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: {
                a: 1,
                b: 2,
            },
        });
    });

    test('merges multiple blocks containing undefined', () => {
        expect(
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    '{% merge %}': [{ a: 1 }, undefined, { b: 2 }],
                },
            }),
        ).toStrictEqual({
            resourceType: 'Resource',
            result: {
                a: 1,
                b: 2,
            },
        });
    });

    test('fails on merge with non-object', () => {
        expect(() =>
            resolveTemplate(resource, {
                resourceType: 'Resource',
                result: {
                    '{% merge %}': [1, 2],
                },
            }),
        ).toThrow(FPMLValidationError);
    });
});
