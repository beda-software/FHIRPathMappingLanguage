import { Resource } from 'fhir/r4b';
import * as fhirpath from 'fhirpath';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';

interface Embeded {
    before: string;
    after: string;
    expression: string;
}

export function embededFHIRPath(a: string): (Embeded | undefined) {
    const start = a.search("{{");
    const stop = a.search("}}");
    if(start === -1 || stop === -1){
        return undefined;
    }

    const before = a.slice(0, start);
    const after = a.slice(stop+2);
    const expression = a.slice(start+2,stop);
    console.log(
        {
            before,
            expression,
            after,
        }
    )
    return {
        before,
        expression,
        after,
    };
}

export function resolveTemplate(qr: Resource, template: object): object {
    return iterateObject(template, (a) => {
        if (typeof a === 'object' && Object.keys(a).length == 1) {
            const key = Object.keys(a)[0]!;
            const embeded = embededFHIRPath(key);
            if (embeded) {
                const {expression: keyExpr} = embeded;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result: any[] = [];
                const answers = fhirpath.evaluate(qr, keyExpr, {}, fhirpath_r4_model);
                for (const c of answers) {
                    result.push(resolveTemplate(c, a[key]));
                }
                return result;
            } else {
                return a;
            }
        } else if (typeof a === 'string') {
            const embeded = embededFHIRPath(a);
            if (embeded) {
                const result = fhirpath.evaluate(qr, embeded.expression, {}, fhirpath_r4_model)[0];
                return `${embeded.before}${result}${embeded.after}`;
            } else {
                return a;
            }
        }
        return a;
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Transform = (a: any) => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function iterateObject(obj: object, transform: Transform): any {
    if (Array.isArray(obj)) {
        const transformedArray = [];
        for (let i = 0; i < obj.length; i++) {
            const value = obj[i];
            if (typeof value === 'object') {
                transformedArray.push(iterateObject(transform(value), transform));
            } else {
                transformedArray.push(transform(value));
            }
        }
        return transformedArray;
    } else if (typeof obj === 'object') {
        const transformedObject = {};
        for (const key in obj) {
            // eslint-disable-next-line no-prototype-builtins
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (typeof value === 'object') {
                    transformedObject[key] = iterateObject(transform(value), transform);
                } else {
                    transformedObject[key] = transform(value);
                }
            }
        }
        return transformedObject;
    }
}
