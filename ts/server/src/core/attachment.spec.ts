import { FPOptions, resolveTemplate } from './extract';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';
import * as fhirpath from 'fhirpath';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

const template = yaml.load(
    fs.readFileSync(path.join(__dirname, './__data__/attachment.template.yaml'), 'utf8'),
);
const result = JSON.parse(
    fs.readFileSync(path.join(__dirname, './__data__/attachment.result.json'), 'utf8'),
);
const context = JSON.parse(
    fs.readFileSync(path.join(__dirname, './__data__/attachment.context.json'), 'utf8'),
);

const options: FPOptions = {
    userInvocationTable: {
        answers: {
            fn: (inputs, linkId: string) => {
                return fhirpath.evaluate(
                    inputs,
                    `repeat(item).where(linkId='${linkId}').answer.value`,
                    null,
                    fhirpath_r4_model,
                    null,
                );
            },
            arity: { 0: [], 1: ['String'] },
        }
    }
};

test('Test real example (fhir)', () => {
    // Re-wrap to get rid of undefined (reconsider it after #17)
    const templateResult = JSON.parse(JSON.stringify(resolveTemplate(
        (context as any).QuestionnaireResponse,
        template,
        context,
        fhirpath_r4_model,
        options,
        true
    )))
    expect(templateResult
    ).toStrictEqual(result);
});
