import * as fhirpath from 'fhirpath';
import { ExpressionCache } from './expression-cache';
import { resolveTemplate } from './core/extract';

describe('ExpressionCache', () => {
    test('reuses compiled expression', () => {
        const cache = new ExpressionCache(16);
        const compiled = cache.compile('list.key');

        expect(cache.compile('list.key')).toBe(compiled);
    });

    test('evicts least recently used expression', () => {
        const cache = new ExpressionCache(2);
        const first = cache.compile('first');
        const middle = cache.compile('middle');
        cache.compile('first');
        cache.compile('last');

        expect(cache.size).toBe(2);
        expect(cache.compile('first')).toBe(first);
        expect(cache.compile('middle')).not.toBe(middle);
    });

    test('does not cache with zero max size', () => {
        const cache = new ExpressionCache(0);
        const compiled = cache.compile('list.key');

        expect(cache.compile('list.key')).not.toBe(compiled);
    });

    test('clear drops compiled expressions', () => {
        const cache = new ExpressionCache(16);
        const compiled = cache.compile('list.key');
        cache.clear();

        expect(cache.compile('list.key')).not.toBe(compiled);
    });

    test('its evaluator compiles a repeated expression once', () => {
        const compile = jest.spyOn(fhirpath, 'compile');
        const resource = { list: [{ key: 1 }, { key: 2 }] } as any;
        const template = { first: '{{ list.key }}', second: '{{ list.key }}' };
        const evaluate = new ExpressionCache(16).makeEvaluator();
        const result = resolveTemplate(resource, template, {}, false, evaluate);

        expect(result).toStrictEqual({ first: 1, second: 1 });
        expect(compile.mock.calls.map(([expression]) => expression)).toStrictEqual(['list.key']);

        compile.mockRestore();
    });
});
