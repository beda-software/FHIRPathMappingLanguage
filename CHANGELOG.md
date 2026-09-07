## 0.3.1

- Make `ExpressionCache` thread-safe, it raised a spurious `FPMLValidationError` when an entry was evicted mid-lookup

## 0.3.0

- Add configurable LRU cache of compiled FHIRPath expressions instead of parsing them on every evaluation #37 (@ruscoder)
- Add proper compilation for `answers()` in TS server #37 (@ruscoder)

## 0.2.0

- Clear empty array and objects #17 (@dmitryashutov)
- Preserve null in arrays #30 (@ruscoder)

## 0.1.3

- Update documentation

## 0.1.2

- Fix strict mode bug with accessing resource with capital letter #26

## 0.1.1

- Add support for strict mode #24
- Add support for userInvocationTable in fp_options #25
- Fix bug with intermediate undefined values in assignment block

## 0.1.0

- Add `{[ expr ]}` that always returns an array #20

## 0.0.1

- Initial PyPI release
