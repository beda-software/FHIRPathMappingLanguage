import { resolveTemplate } from './extract';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

const template = yaml.load(
    fs.readFileSync(path.join(__dirname, './__data__/complex-example.aidbox.template.yaml'), 'utf8'),
);
const result = yaml.load(
    fs.readFileSync(path.join(__dirname, './__data__/complex-example.aidbox.result.yaml'), 'utf8'),
);
const context = yaml.load(
    fs.readFileSync(path.join(__dirname, './__data__/complex-example.aidbox.context.yaml'), 'utf8'),
);

test('Test real example (aidbox)', () => {
    // Re-wrap to get rid of undefined (reconsider it after #17)
    expect(
        JSON.parse(JSON.stringify(resolveTemplate(
            (context as any).QuestionnaireResponse,
            template,
            context,
            null,
        ))),
    ).toStrictEqual(result);
});
