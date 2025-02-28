import { resolveTemplate } from './extract';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

const template = yaml.load(
    fs.readFileSync(path.join(__dirname, './__data__/complex-example.fhir.template.yaml'), 'utf8'),
);
const result = yaml.load(
    fs.readFileSync(path.join(__dirname, './__data__/complex-example.fhir.result.yaml'), 'utf8'),
);
const context = yaml.load(
    fs.readFileSync(path.join(__dirname, './__data__/complex-example.fhir.context.yaml'), 'utf8'),
);

test('Test real example (fhir)', () => {
    // Re-wrap to get rid of undefined (reconsider it after #17)
    expect(
        JSON.parse(JSON.stringify(resolveTemplate(
            (context as any).QuestionnaireResponse,
            template,
            context,
            fhirpath_r4_model,
        ))),
    ).toStrictEqual(result);
});
