import { resolveTemplate } from './extract';
import * as fhirpath from 'fhirpath';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

const template = yaml.load(
    fs.readFileSync(path.join(__dirname, './__data__/complex-example.aidbox.yaml'), 'utf8'),
);
const result = {
    body: {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
            {
                fullUrl: 'urn:uuid:observation-weight',
                request: {
                    url: '/Observation?patient=pid&category=vital-signs&code=http://loinc.org|29463-7',
                    method: 'POST',
                },
                resource: {
                    resourceType: 'Observation',
                    id: null,
                    subject: { resourceType: 'Patient', id: 'pid' },
                    status: 'final',
                    effective: { dateTime: '2024-01-01' },
                    category: [
                        {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                                    code: 'vital-signs',
                                },
                            ],
                        },
                    ],
                    code: {
                        coding: [
                            { system: 'http://loinc.org', code: '29463-7', display: 'Body Weight' },
                        ],
                    },
                    value: {
                        Quantity: {
                            value: 100,
                            unit: 'kg',
                            system: 'http://unitsofmeasure.org',
                            code: 'kg',
                        },
                    },
                },
            },
            {
                fullUrl: 'urn:uuid:observation-height',
                request: {
                    url: '/Observation?patient=pid&category=vital-signs&code=http://loinc.org|8302-2',
                    method: 'POST',
                },
                resource: {
                    resourceType: 'Observation',
                    id: null,
                    subject: { resourceType: 'Patient', id: 'pid' },
                    status: 'final',
                    effective: { dateTime: '2024-01-01' },
                    category: [
                        {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                                    code: 'vital-signs',
                                },
                            ],
                        },
                    ],
                    code: {
                        coding: [
                            { system: 'http://loinc.org', code: '8302-2', display: 'Body Height' },
                        ],
                    },
                    value: {
                        Quantity: {
                            value: 190,
                            unit: 'kg',
                            system: 'http://unitsofmeasure.org',
                            code: 'kg',
                        },
                    },
                },
            },
            {
                fullUrl: 'urn:uuid:condition-medical-history-0',
                request: { url: 'Condition/cond1', method: 'PUT' },
                resource: {
                    resourceType: 'Condition',
                    id: 'cond1',
                    subject: { resourceType: 'Patient', id: 'pid' },
                    recordedDate: '2024-01-01',
                    code: {
                        coding: [
                            { system: 'urn:raw', code: 'hypertension', display: 'Hypertension' },
                        ],
                        text: 'Hypertension',
                    },
                    category: [
                        { coding: [{ code: 'medicalHistory', display: 'Medical history' }] },
                    ],
                },
            },
            {
                fullUrl: 'urn:uuid:condition-medical-history-1',
                request: {
                    url: '/Condition?category=medicalHistory&code=urn:raw|fatty-liver&patient=pid',
                    method: 'POST',
                },
                resource: {
                    resourceType: 'Condition',
                    id: null,
                    subject: { resourceType: 'Patient', id: 'pid' },
                    recordedDate: '2024-01-01',
                    code: {
                        coding: [
                            { system: 'urn:raw', code: 'fatty-liver', display: 'Fatty Liver' },
                        ],
                        text: 'Fatty Liver',
                    },
                    category: [
                        { coding: [{ code: 'medicalHistory', display: 'Medical history' }] },
                    ],
                },
            },
            {
                fullUrl: 'urn:uuid:condition-medical-history-2',
                request: {
                    url: '/Condition?category=medicalHistory&code=urn:raw|asthma&patient=pid',
                    method: 'POST',
                },
                resource: {
                    resourceType: 'Condition',
                    id: null,
                    subject: { resourceType: 'Patient', id: 'pid' },
                    recordedDate: '2024-01-01',
                    code: {
                        coding: [{ system: 'urn:raw', code: 'asthma', display: 'Asthma' }],
                        text: 'Asthma',
                    },
                    category: [
                        { coding: [{ code: 'medicalHistory', display: 'Medical history' }] },
                    ],
                },
            },
            {
                request: { url: '/Provenance', method: 'POST' },
                resource: {
                    resourceType: 'Provenance',
                    target: [{ uri: 'urn:uuid:observation-weight' }],
                    recorded: '2024-01-01',
                    agent: [{ who: { resourceType: 'Organization', id: 'orgid' } }],
                    entity: [
                        {
                            role: 'source',
                            what: { resourceType: 'QuestionnaireResponse', id: 'qrid' },
                        },
                    ],
                },
            },
            {
                request: { url: '/Provenance', method: 'POST' },
                resource: {
                    resourceType: 'Provenance',
                    target: [{ uri: 'urn:uuid:observation-height' }],
                    recorded: '2024-01-01',
                    agent: [{ who: { resourceType: 'Organization', id: 'orgid' } }],
                    entity: [
                        {
                            role: 'source',
                            what: { resourceType: 'QuestionnaireResponse', id: 'qrid' },
                        },
                    ],
                },
            },
            {
                request: { url: '/Provenance', method: 'POST' },
                resource: {
                    resourceType: 'Provenance',
                    target: [{ uri: 'urn:uuid:condition-medical-history-0' }],
                    recorded: '2024-01-01',
                    agent: [{ who: { resourceType: 'Organization', id: 'orgid' } }],
                    entity: [
                        {
                            role: 'source',
                            what: { resourceType: 'QuestionnaireResponse', id: 'qrid' },
                        },
                    ],
                },
            },
            {
                request: { url: '/Provenance', method: 'POST' },
                resource: {
                    resourceType: 'Provenance',
                    target: [{ uri: 'urn:uuid:condition-medical-history-1' }],
                    recorded: '2024-01-01',
                    agent: [{ who: { resourceType: 'Organization', id: 'orgid' } }],
                    entity: [
                        {
                            role: 'source',
                            what: { resourceType: 'QuestionnaireResponse', id: 'qrid' },
                        },
                    ],
                },
            },
            {
                request: { url: '/Provenance', method: 'POST' },
                resource: {
                    resourceType: 'Provenance',
                    target: [{ uri: 'urn:uuid:condition-medical-history-2' }],
                    recorded: '2024-01-01',
                    agent: [{ who: { resourceType: 'Organization', id: 'orgid' } }],
                    entity: [
                        {
                            role: 'source',
                            what: { resourceType: 'QuestionnaireResponse', id: 'qrid' },
                        },
                    ],
                },
            },
            { request: { url: '/Provenance/prov-hypertension', method: 'DELETE' } },
            { request: { url: '/Condition/cond-hypertension', method: 'DELETE' } },
        ],
    },
};

const qr = {
    resourceType: 'QuestionnaireResponse',
    id: 'qrid',
    authored: '2024-01-01',
    item: [
        {
            linkid: 'root',
            item: [
                {
                    linkId: 'WEIGHT',
                    answer: {
                        value: {
                            decimal: 100,
                        },
                    },
                },
                {
                    linkId: 'HEIGHT',
                    answer: {
                        value: {
                            decimal: 190,
                        },
                    },
                },
                {
                    linkId: 'MEDCOND1',
                    answer: [
                        {
                            value: {
                                Coding: {
                                    system: 'urn:raw',
                                    code: 'hypertension',
                                    display: 'Hypertension',
                                },
                            },
                        },
                        {
                            value: {
                                Coding: {
                                    system: 'urn:raw',
                                    code: 'fatty-liver',
                                    display: 'Fatty Liver',
                                },
                            },
                        },
                    ],
                },
                {
                    linkId: 'MEDCOND2',
                    answer: [
                        {
                            value: {
                                Coding: {
                                    system: 'urn:raw',
                                    code: 'asthma',
                                    display: 'Asthma',
                                },
                            },
                        },
                    ],
                },
            ],
        },
    ],
};
const provenances = [
    {
        resourceType: 'Provenance',
        id: 'prov-hypertension',
        target: [
            {
                resourceType: 'Condition',
                id: 'cond-hypertension',
            },
        ],
        recorded: '2024-01-01',
        agent: [
            {
                who: {
                    resourceType: 'Organization',
                    id: 'orgid',
                },
            },
        ],
        entity: [
            {
                role: 'source',
                what: {
                    resourceType: 'QuestionnaireResponse',
                    id: 'qrid',
                },
            },
        ],
    },
    {
        resourceType: 'Provenance',
        id: 'prov-flu',
        target: [
            {
                resourceType: 'Condition',
                id: 'cond1',
            },
        ],
        recorded: '2024-01-01',
        agent: [
            {
                who: {
                    resourceType: 'Organization',
                    id: 'orgid',
                },
            },
        ],
        entity: [
            {
                role: 'source',
                what: {
                    resourceType: 'QuestionnaireResponse',
                    id: 'qrid',
                },
            },
        ],
    },
];
const organization = { resourceType: 'Organization', id: 'orgid' };
const patient = {
    resourceType: 'Patient',
    id: 'pid',
};
const observations = [];
const conditions = [
    {
        resourceType: 'Condition',
        id: 'cond1',
        subject: {
            resourceType: 'Patient',
            id: 'pid',
        },
        recordedDate: '2024-01-01',
        code: {
            coding: [
                {
                    system: 'urn:raw',
                    code: 'hypertension',
                    display: 'Hypertension',
                },
            ],
            text: 'Hypertension',
        },
        category: [
            {
                coding: [
                    {
                        code: 'medicalHistory',
                        display: 'Medical history',
                    },
                ],
            },
        ],
    },
    {
        resourceType: 'Condition',
        id: 'cond-flu',
        subject: {
            resourceType: 'Patient',
            id: 'pid',
        },
        recordedDate: '2024-01-01',
        code: {
            coding: [
                {
                    system: 'urn:raw',
                    code: 'Flu',
                    display: 'Flu',
                },
            ],
            text: 'Flu',
        },
        category: [
            {
                coding: [
                    {
                        code: 'medicalHistory',
                        display: 'Medical history',
                    },
                ],
            },
        ],
    },
];

const userInvocationTable: UserInvocationTable = {
    answers: {
        fn: (inputs, linkId: string) => {
            return fhirpath.evaluate(
                inputs,
                `repeat(item).where(linkId='${linkId}').answer.value.children()`,
            );
        },
        arity: { 0: [], 1: ['String'] },
    },
    // Get rid of toString once it's fixed https://github.com/HL7/fhirpath.js/issues/156
    toString: {
        fn: (inputs) => fhirpath.evaluate({ x: inputs }, 'x.toString()'),
        arity: { 0: [] },
    },
};

test('Test real example', () => {
    expect(
        resolveTemplate(
            qr as any,
            template,
            {
                QuestionnaireResponse: qr,
                Provenance: provenances,
                Organization: organization,
                Observation: observations,
                Condition: conditions,
                Patient: patient,
            },
            null,
            { userInvocationTable },
        ),
    ).toStrictEqual(result);
});
