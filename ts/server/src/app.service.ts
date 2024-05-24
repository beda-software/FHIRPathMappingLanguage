import { Injectable } from '@nestjs/common';
import { resolveTemplate } from './utils/extract';
import { Resource } from 'fhir/r4b';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';

@Injectable()
export class AppService {
    resolveTemplate(qr: Resource, template: object): object {
        return resolveTemplate(qr, template, { root: qr }, fhirpath_r4_model);
    }
}
