import { QuestionnaireResponse } from 'fhir/r4b';
import { resolveTemplate } from './extract';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';

const qr: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    item: [
        {
            linkId: 'name',
            item: [
                {
                    linkId: 'last-name',
                    answer: [
                        {
                            valueString: 'Beda',
                        },
                    ],
                },
                {
                    linkId: 'first-name',
                    answer: [
                        {
                            valueString: 'Ilya',
                        },
                    ],
                },
                {
                    linkId: 'middle-name',
                    answer: [
                        {
                            valueString: 'Alekseevich',
                        },
                    ],
                },
            ],
        },
        {
            linkId: 'birth-date',
            answer: [
                {
                    valueDate: '2023-05-01',
                },
            ],
        },
        {
            linkId: 'gender',
            answer: [
                {
                    valueCoding: { code: 'male' },
                },
            ],
        },
        {
            linkId: 'ssn',
            answer: [
                {
                    valueString: '123',
                },
            ],
        },
        {
            linkId: 'mobile',
            answer: [
                {
                    valueString: '11231231231',
                },
            ],
        },
    ],
};

const template1 = {
    resourceType: 'Patient',
    name: [
        {
            family: "{{ QuestionnaireResponse.repeat(item).where(linkId='last-name').answer.value }}",
            given: [
                "{{ QuestionnaireResponse.repeat(item).where(linkId='first-name').answer.value }}",
                "{{ QuestionnaireResponse.repeat(item).where(linkId='middle-name').answer.value }}",
            ],
        },
    ],
    birthDate: "{{ QuestionnaireResponse.item.where(linkId='birth-date').answer.value }}",
    gender: "{{ QuestionnaireResponse.item.where(linkId='gender').answer.valueCoding.code }}",
    telecom: [
        {
            system: 'phone',
            value: "{{ QuestionnaireResponse.item.where(linkId='mobile').answer.value }}",
        },
    ],
    identifier: [
        {
            system: 'http://hl7.org/fhir/sid/us-ssn',
            value: "{{ QuestionnaireResponse.item.where(linkId='ssn').answer.value }}",
        },
    ],
};

const template2 = {
    resourceType: 'Patient',
    name: {
        "{{ QuestionnaireResponse.item.where(linkId='name') }}": {
            family: "{{ item.where(linkId='last-name').answer.valueString }}",
            given: [
                "{{ item.where(linkId='first-name').answer.valueString }}",
                "{{ item.where(linkId='middle-name').answer.valueString }}",
            ],
        },
    },
    birthDate: "{{ QuestionnaireResponse.item.where(linkId='birth-date').answer.value }}",
    gender: "{{ QuestionnaireResponse.item.where(linkId='gender').answer.valueCoding.code }}",
    telecom: [
        {
            system: 'phone',
            value: "{{ QuestionnaireResponse.item.where(linkId='mobile').answer.value }}",
        },
    ],
    identifier: [
        {
            system: 'http://hl7.org/fhir/sid/us-ssn',
            value: "{{ QuestionnaireResponse.item.where(linkId='ssn').answer.value }}",
        },
    ],
};

const result = {
    birthDate: '2023-05-01',
    gender: 'male',
    identifier: [
        {
            system: 'http://hl7.org/fhir/sid/us-ssn',
            value: '123',
        },
    ],
    name: [
        {
            family: 'Beda',
            given: ['Ilya', 'Alekseevich'],
        },
    ],
    resourceType: 'Patient',
    telecom: [
        {
            system: 'phone',
            value: '11231231231',
        },
    ],
};

describe('Extraction', () => {
    test('Simple transformation', () => {
        expect(resolveTemplate(qr, template1, {}, fhirpath_r4_model)).toStrictEqual(result);
    });

    test('List transformation', () => {
        expect(resolveTemplate(qr, template2, {}, fhirpath_r4_model)).toStrictEqual(result);
    });

    test('Partial strings', () => {
        expect(
            resolveTemplate(
                {
                    resourceType: 'Patient',
                    id: 'foo',
                },
                { reference: 'Patient/{{Patient.id}}' },
            ),
        ).toStrictEqual({ reference: 'Patient/foo' });
    });
});

describe('Context usage', () => {
    const resource: any = {
        foo: 'bar',
        list: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
    };
    test('use context', () => {
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

describe('Transformation', () => {
    const resource = { list: [1, 2, 3] } as any;

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

    test('for array with nulls returns compacted array', () => {
        expect(resolveTemplate(resource, [[1, null, 2, null, 3]])).toStrictEqual([1, 2, 3]);
    });

    test('for object with null keys returns null keys', () => {
        expect(resolveTemplate(resource, { key: null })).toStrictEqual({ key: null });
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
        expect(resolveTemplate(resource, '{{ list }}')).toStrictEqual(1);
    });

    test('for empty array expression returns null', () => {
        expect(resolveTemplate(resource, '{{ list.where($this = 0) }}')).toStrictEqual(null);
    });

    test.skip('for template expression returns resolved template', () => {
        expect(
            resolveTemplate(resource, '/{{ list[1] }}/{{ list[2] }}/{{ list[3] }}'),
        ).toStrictEqual('/1/2/3');
    });

    test('for empty array template expression returns resolved template', () => {
        expect(
            resolveTemplate(
                resource,
                '/Patient/{{ list.where($this = 0) }}/_history/{{ list.last() }}',
            ),
        ).toStrictEqual('/Patient/null/_history/3');
    });
});

describe('Assign usage', () => {
    test('use assign', () => {
        expect(
            resolveTemplate(
                {
                    resourceType: 'Resource',
                    sourceValue: 100,
                } as any,
                {
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
                },
            ),
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
});

describe('If block', () => {
    const resource: any = {
        key: 'value',
    };

    test('works properly for truthy if branch at root level', () => {
        expect(
            resolveTemplate(resource, {
                "{% if key = 'value' %}": { nested: "{{ 'true' + key }}" },
                '{% else %}': { nested: "{{ 'false' + key }}" },
            }),
        ).toStrictEqual({
            nested: 'truevalue',
        });
    });

    test('works properly for truthy if branch', () => {
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

    test('works properly for truthy if branch without else', () => {
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

    test('works properly for falsy if branch', () => {
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

    test('works properly for falsy if branch without else', () => {
        expect(
            resolveTemplate(resource, {
                result: {
                    "{% if key != 'value' %}": { nested: "{{ 'true' + key }}" },
                },
            }),
        ).toStrictEqual({
            result: null,
        });
    });

    test('works properly for nested if', () => {
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

    test('works properly for nested else', () => {
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
});

describe('Merge block', () => {
    const resource: any = {
        key: 'value',
    };

    test('works properly with single merge block', () => {
        expect(
            resolveTemplate(resource, {
                '{% merge %}': { a: 1 },
            }),
        ).toStrictEqual({
            a: 1,
        });
    });

    test('works properly with multiple merge blocks', () => {
        expect(
            resolveTemplate(resource, {
                '{% merge %}': [{ a: 1 }, { b: 2 }],
            }),
        ).toStrictEqual({
            a: 1,
            b: 2,
        });
    });

    test('works properly with multiple merge blocks containing nulls', () => {
        expect(
            resolveTemplate(resource, {
                '{% merge %}': [{ a: 1 }, null, { b: 2 }],
            }),
        ).toStrictEqual({
            a: 1,
            b: 2,
        });
    });

    test('works properly with multiple merge blocks overriding', () => {
        expect(
            resolveTemplate(resource, {
                '{% merge %}': [{ x: 1, y: 2 }, { y: 3 }],
            }),
        ).toStrictEqual({
            x: 1,
            y: 3,
        });
    });
});
