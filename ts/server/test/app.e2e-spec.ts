import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('Convert simple resource r4', () => {
        return request(app.getHttpServer())
            .post('/r4/parse-template')
            .send({
                context: {
                    resourceType: 'Patient',
                    id: 'foo',
                },
                template: { id: '{{ Patient.id }}' },
            })
            .expect(200)
            .expect({ id: 'foo' });
    });

    it('Convert simple resource default (r4)', () => {
        return request(app.getHttpServer())
            .post('/parse-template')
            .send({
                context: {
                    resourceType: 'Patient',
                    id: 'foo',
                },
                template: { id: '{{ Patient.id }}' },
            })
            .expect(200)
            .expect({ id: 'foo' });
    });

    it('Convert simple resource aidbox', () => {
        return request(app.getHttpServer())
            .post('/aidbox/parse-template')
            .send({
                context: {
                    resourceType: 'Patient',
                    id: 'foo',
                },
                template: { id: '{{ Patient.id }}' },
            })
            .expect(200)
            .expect({ id: 'foo' });
    });

    it('$extract r4', () => {
        return request(app.getHttpServer())
            .post('/parse-template')
            .send({
                context: {
                    QuestionnaireResponse: {
                        resourceType: 'QuestionnaireResponse',
                        id: 'foo',
                        item: [
                            {
                                linkId: 'q1',
                                answer: [{ valueDecimal: 10 }],
                            },
                        ],
                    },
                    extraContextVar: '1',
                },
                template: {
                    id: '{{ QuestionnaireResponse.id }}',
                    value: "{{ answers('q1') }}",
                    extraContextVar: '{{ %extraContextVar.toInteger() }}',
                },
            })
            .expect(200)
            .expect({ id: 'foo', value: 10, extraContextVar: 1 });
    });

    it('$extract aidbox', () => {
        return request(app.getHttpServer())
            .post('/aidbox/parse-template')
            .send({
                context: {
                    QuestionnaireResponse: {
                        resourceType: 'QuestionnaireResponse',
                        id: 'foo',

                        item: [
                            {
                                linkId: 'q1',
                                answer: [{ value: { decimal: 10 } }],
                            },
                        ],
                    },
                    extraContextVar: '1',
                },
                template: {
                    id: '{{ QuestionnaireResponse.id }}',
                    value: "{{ answers('q1') }}",
                    extraContextVar: '{{ %extraContextVar.toInteger() }}',
                },
            })
            .expect(200)
            .expect({ id: 'foo', value: 10, extraContextVar: 1 });
    });

    it('handle nested data', () => {
        return request(app.getHttpServer())
            .post('/parse-template')
            .send({
                context: {},
                template: { foo: { bar: { baz: 1 } } },
            })
            .expect(200)
            .expect({ foo: { bar: { baz: 1 } } });
    });

    it('handle nested result', () => {
        return request(app.getHttpServer())
            .post('/parse-template')
            .send({
                context: {
                    resourceType: 'Patient',
                    id: { foo: { bar: { baz: 1 } } },
                },
                template: { id: '{{ Patient.id }}' },
            })
            .expect(200)
            .expect({ id: { foo: { bar: { baz: 1 } } } });
    });
});
