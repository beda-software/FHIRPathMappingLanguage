import { Injectable } from '@nestjs/common';
import { resolveTemplate } from './utils/extract';
import { Resource } from 'fhir/r4b';

@Injectable()
export class AppService {
    resolveTemplate(qr: Resource, template: object): object {
        return resolveTemplate(qr, template);
    }
}
