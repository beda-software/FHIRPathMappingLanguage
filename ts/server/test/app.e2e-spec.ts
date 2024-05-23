import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('Conver simple resource', () => {
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

    it('$extract', () => {
        return request(app.getHttpServer())
            .post('/parse-template')
            .send({
                context: {
                    QuestionnaireResponse: {
                        resourceType: 'QuestionnaireResponse',
                        id: 'foo',
                    },
                },
                template: { id: '{{ QuestionnaireResponse.id }}' },
            })
            .expect(200)
            .expect({ id: 'foo' });
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
                template: { id: '{{Patient.id}}' },
            })
            .expect(200)
            .expect({ id: { foo: { bar: { baz: 1 } } } });
    });
});
