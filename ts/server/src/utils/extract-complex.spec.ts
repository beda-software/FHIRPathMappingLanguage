import { resolveTemplate } from './extract';
import * as fhirpath from 'fhirpath';

const template = {
    resourceType: 'Mapping',
    id: 'extract',
    scopeSchema: {
        required: ['Sample', 'QuestionnaireResponse', 'Provenance', 'Organization'],
        properties: {
            sample: {
                required: ['patient', 'id'],
                properties: {
                    patient: {
                        required: ['id'],
                    },
                },
            },
        },
    },
    body: {
        '{% assign %}': [
            {
                patientId: '{{ %Sample.patient.id }}',
            },
            {
                recordedDate: '{{ %QuestionnaireResponse.authored }}',
            },
            {
                observationEntries: [
                    {
                        "{% if hasAnswers('WEIGHT') and hasAnswers('HEIGHT') %}": {
                            '{% assign %}': [
                                {
                                    observationId:
                                        "{{ %Provenance.target.resource.where(category.coding.code='vital-signs' and resourceType='Observation' and code.coding.code='29463-7').id }}",
                                },
                            ],
                            fullUrl: 'urn:uuid:observation-weight',
                            request: {
                                '{% if %observationId.exists() %}': {
                                    url: "{{ '/Observation/' + %observationId }}",
                                    method: 'PUT',
                                },
                                '{% else %}': {
                                    url: "{{ '/Observation?patient=' + %patientId + '&category=vital-signs&code=http://loinc.org|29463-7' }}",
                                    method: 'POST',
                                },
                            },
                            resource: {
                                resourceType: 'Observation',
                                id: '{{ %observationId }}',
                                subject: {
                                    resourceType: 'Patient',
                                    id: '{{ %patientId }}',
                                },
                                status: 'final',
                                effective: {
                                    dateTime: '{{ %recordedDate }}',
                                },
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
                                        {
                                            system: 'http://loinc.org',
                                            code: '29463-7',
                                            display: 'Body Weight',
                                        },
                                    ],
                                },
                                value: {
                                    Quantity: {
                                        value: {
                                            '{% assign %}': [
                                                {
                                                    rawHeight: "{{ answers('HEIGHT', 'decimal') }}",
                                                },
                                                {
                                                    rawWeight: "{{ answers('WEIGHT', 'decimal') }}",
                                                },
                                            ],
                                            '{% if %rawHeight < 90 %}': '{{ %rawWeight / 2.205 }}',
                                            '{% else %}': '{{ %rawWeight }}',
                                        },
                                        unit: 'kg',
                                        system: 'http://unitsofmeasure.org',
                                        code: 'kg',
                                    },
                                },
                            },
                        },
                    },
                ],
            },
            {
                conditionEntries: {
                    "{% for index, coding in answers('MEDCOND1', 'Coding') | answers('MEDCOND2', 'Coding') | answers('MEDCOND3', 'Coding') | answers('MEDCOND4', 'Coding') %}":
                        {
                            '{% assign %}': [
                                {
                                    conditionId:
                                        "{{ %Provenance.target.resource.where(resourceType='Condition').where(category.coding.code='medicalHistory' and code.coding.system=%coding.system and code.coding.code=%coding.code).id }}",
                                },
                            ],
                            fullUrl:
                                "{{ 'urn:uuid:condition-medical-history-' + %index.toString() }}",
                            request: {
                                '{% if %conditionId.exists() %}': {
                                    url: "{{ 'Condition/' + %conditionId }}",
                                    method: 'PUT',
                                },
                                '{% else %}': {
                                    url: "{{ '/Condition?category=medicalHistory&code=' + %coding.system + '|' + %coding.code + '&patient=' + %patientId }}",
                                    method: 'POST',
                                },
                            },
                            resource: {
                                resourceType: 'Condition',
                                id: '{{ %conditionId }}',
                                subject: {
                                    resourceType: 'Patient',
                                    id: '{{ %patientId }}',
                                },
                                recordedDate: '{{ %recordedDate }}',
                                code: {
                                    coding: ['{{ %coding }}'],
                                    text: '{{ %coding.display }}',
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
                        },
                },
            },
            {
                provenanceEntries: {
                    '{% for entry in %observationEntries | %conditionEntries %}': {
                        request: {
                            url: '/Provenance',
                            method: 'POST',
                        },
                        resource: {
                            resourceType: 'Provenance',
                            target: [
                                {
                                    uri: '{{ %entry.fullUrl }}',
                                },
                            ],
                            recorded: '{{ %recordedDate }}',
                            agent: [
                                {
                                    who: {
                                        resourceType: 'Organization',
                                        id: '{{ %Organization.id }}',
                                    },
                                },
                            ],
                            entity: [
                                {
                                    role: 'source',
                                    what: {
                                        resourceType: 'QuestionnaireResponse',
                                        id: '{{ %QuestionnaireResponse.id }}',
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        ],
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
            {
                '{% for entry in  %observationEntries | %conditionEntries | %provenanceEntries %}':
                    '{{ %entry }}',
            },
            {
                '{% assign %}': [
                    {
                        resourceIdsToDelete: {
                            '{% for id in %Provenance.target.id.exclude((%observationEntries | %conditionEntries).resource.id) %}':
                                '{{ %id }}',
                        },
                    },
                ],

                '{% for provenance in %Provenance.where(target.id in %resourceIdsToDelete) %}': [
                    {
                        request: {
                            url: "{{ '/Provenance/' + %provenance.id }}",
                            method: 'DELETE',
                        },
                    },
                    {
                        request: {
                            url: "{{ '/' + %provenance.target.resourceType + '/' + %provenance.target.id }}",
                            method: 'DELETE',
                        },
                    },
                ],
            },
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
                resource: {
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
                resource: {
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
const organization = { resourceType: 'Organization', id: 'ordid' };
const sample = {
    resourceType: 'Sample',
    id: 'sid',
    patient: {
        resourceType: 'Patient',
        id: 'pid',
    },
};

const userInvocationTable: UserInvocationTable = {
    hasAnswers: {
        fn: (inputs, linkId) =>
            fhirpath.evaluate(
                inputs,
                `repeat(item).where(linkId='${linkId}').answer.value.exists()`,
            )[0],
        arity: { 0: [], 1: ['String'] },
    },
    answers: {
        fn: (inputs, linkId, type) => {
            const getter = ['Reference', 'Coding', 'Quantity'].includes(type) ? 'children()' : type;

            return fhirpath.evaluate(
                inputs,
                `repeat(item).where(linkId='${linkId}').answer.value.${getter}`,
            );
        },
        arity: { 0: [], 2: ['String', 'String'] },
    },
    // Get rid of toString once it's fixed https://github.com/HL7/fhirpath.js/issues/156
    toString: {
        fn: (inputs) => fhirpath.evaluate({ x: inputs }, 'x.toString()'),
        arity: { 0: [] },
    },
};

test.only('test real example', () => {
    expect(
        resolveTemplate(
            qr as any,
            template,
            {
                QuestionnaireResponse: qr,
                Provenance: provenances,
                Organization: organization,
                Sample: sample,
            },
            null,
            { userInvocationTable },
        ),
    ).toStrictEqual({
        resourceType: 'Mapping',
        id: 'extract',
        scopeSchema: {
            required: ['Sample', 'QuestionnaireResponse', 'Provenance', 'Organization'],
            properties: {
                sample: {
                    required: ['patient', 'id'],
                    properties: { patient: { required: ['id'] } },
                },
            },
        },
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
                                {
                                    system: 'http://loinc.org',
                                    code: '29463-7',
                                    display: 'Body Weight',
                                },
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
                    fullUrl: 'urn:uuid:condition-medical-history-0',
                    request: { url: 'Condition/cond1', method: 'PUT' },
                    resource: {
                        resourceType: 'Condition',
                        id: 'cond1',
                        subject: { resourceType: 'Patient', id: 'pid' },
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
                        agent: [{ who: { resourceType: 'Organization', id: 'ordid' } }],
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
                        agent: [{ who: { resourceType: 'Organization', id: 'ordid' } }],
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
                        agent: [{ who: { resourceType: 'Organization', id: 'ordid' } }],
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
                        agent: [{ who: { resourceType: 'Organization', id: 'ordid' } }],
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
    });
});
