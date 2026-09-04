import * as fhirpath from 'fhirpath';
import { ExpressionCache } from './cache';
import { resolveTemplate } from './extract';

describe('ExpressionCache', () => {
    test('reuses compiled expression', () => {
        const cache = new ExpressionCache(16);
        const compiled = cache.compile('list.key', null, null);

        expect(cache.compile('list.key', null, null)).toBe(compiled);
    });

    test('evicts least recently used expression', () => {
        const cache = new ExpressionCache(2);
        const first = cache.compile('first', null, null);
        const middle = cache.compile('middle', null, null);
        cache.compile('first', null, null);
        cache.compile('last', null, null);

        expect(cache.size).toBe(2);
        expect(cache.compile('first', null, null)).toBe(first);
        expect(cache.compile('middle', null, null)).not.toBe(middle);
    });

    test('does not cache with zero max size', () => {
        const cache = new ExpressionCache(0);
        const compiled = cache.compile('list.key', null, null);

        expect(cache.compile('list.key', null, null)).not.toBe(compiled);
    });

    test('clear drops compiled expressions', () => {
        const cache = new ExpressionCache(16);
        const compiled = cache.compile('list.key', null, null);
        cache.clear();

        expect(cache.compile('list.key', null, null)).not.toBe(compiled);
    });

    test('resolveTemplate compiles repeated expression once', () => {
        const compile = jest.spyOn(fhirpath, 'compile');
        const resource = { list: [{ key: 1 }, { key: 2 }] } as any;
        const template = { first: '{{ list.key }}', second: '{{ list.key }}' };
        const result = resolveTemplate(resource, template, {}, null, {
            cache: new ExpressionCache(16),
        });

        expect(result).toStrictEqual({ first: 1, second: 1 });
        expect(compile.mock.calls.map(([expression]) => expression)).toStrictEqual(['list.key']);

        compile.mockRestore();
    });
});
