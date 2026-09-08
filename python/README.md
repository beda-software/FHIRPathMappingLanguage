# fpml (FHIRPathMappingLanguage)

The FHIRPath Mapping Language (FPML) is a data DSL designed to convert data from QuestionnaireResponse (and not only) to any FHIR Resource.

For more details visit the [FHIRPathMappingLanguage specification](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main?tab=readme-ov-file#specification).

## Installation

You can install the package from PyPI using the following command:

```bash
pip install fpml
```

## API Reference

### resolve_template

The `resolve_template` function processes a given template with a specified FHIR resource, optionally applying a context and additional processing options.

```python
from fpml import resolve_template

result = resolve_template(
    resource,
    template,
    context=None,
    strict=False,
    evaluate=None
)
```

### Arguments:

- resource (Resource): The input FHIR resource to process.
- template (Any): The template describing the transformation.
- context (Optional[Context], optional): Additional context data. Defaults to None.
- strict (bool, optional): Whether to enforce strict mode. Defaults to False. See more details on [strict mode](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main?tab=readme-ov-file#strict-mode).
- evaluate (Optional[Evaluate], optional): Evaluates one FHIRPath expression against a resource and a context. Defaults to `make_evaluator()`, which compiles every expression on every evaluation.

### Returns:

- Any: The processed output based on the template.

### Raises:

- FPMLValidationError: If validation of the template or resource fails.

## Usage

For the following QuestionnaireResponse resource:

```python
resource = {
    "resourceType": "QuestionnaireResponse",
    "status": "completed",
    "item": [
        {
            "linkId": "name",
            "answer": [
                {
                    "valueString": "Name"
                }
            ]
        }
    ]
}
```


Here's an example demonstrating how to use the `resolve_template` function:

```python
from fpml import resolve_template


template = {
    "resourceType": "Patient",
    "name": [
        {
            "text": "{{ item.where(linkId='name').answer.valueString }}"
        }
    ]
}

context = {}

result = resolve_template(resource, template, context)
print(result)
```

Output:
```python
{'resourceType': 'Patient', 'name': [{'text': 'Name'}]}
```

### Using FHIR data-model

```python
from fhirpathpy.models import models

from fpml import make_evaluator, resolve_template


template = {
    "resourceType": "Patient",
    "name": [
        {
            "text": "{{ item.where(linkId='name').answer.value }}"  # <-- according R4 model
        }
    ]
}

context = {}

evaluate = make_evaluator(models["r4"])

result = resolve_template(resource, template, context, evaluate=evaluate)
print(result)
```

Output:
```python
{'resourceType': 'Patient', 'name': [{'text': 'Name'}]}
```

### Using user-defined functions

```python
from fpml import make_evaluator, resolve_template


template = {
    "resourceType": "Patient",
    "name": [
        {
            "text": "{{ item.where(linkId='name').answer.valueString.strip() }}"  # <-- Custom function
        }
    ]
}

context = {}

user_invocation_table = {
    "strip": {
        "fn": lambda inputs: [i.strip() for i in inputs],
        "arity": {0: []},
    }
}

evaluate = make_evaluator(options={"userInvocationTable": user_invocation_table})

result = resolve_template(resource, template, context, evaluate=evaluate)
print(result)
```

Output:
```python
{'resourceType': 'Patient', 'name': [{'text': 'Name'}]}
```

### Using a custom evaluator

By default every expression is compiled on every evaluation, which is expensive. Pass an `evaluate`
function to reuse compiled expressions, cached the way your application needs. It takes a resource,
an expression and a context, and returns the list of results.

```python
from functools import lru_cache

from fhirpathpy import compile
from fhirpathpy.models import models

from fpml import resolve_template


@lru_cache(maxsize=1024)
def cached_compile(expression, model_name):
    return compile(expression, models.get(model_name))


def evaluate(resource, expression, context):
    return cached_compile(expression, "r4")(resource, context)


for resource in resources:
    resolve_template(resource, template, context, evaluate=evaluate)
```

Compilation binds the model and the user-defined functions, so cache entries are only reusable for
the same pair. Keep them in the key, like `model_name` above, when the application evaluates against
more than one model, otherwise expressions compiled for one silently resolve against the other.

A compiled expression retains its parsed AST, so the memory cost grows with the expression length:
`1024` of them take about 11mb for short expressions and up to 290mb for 1kb ones. Size the cache for
the number of distinct expressions your templates and questionnaires actually contain.

`make_evaluator` builds the default evaluator from a model and a user-defined function table, as the
examples above do. A custom evaluator applies both itself.

### Handling validation errors

```python
from fpml import FPMLValidationError, resolve_template


template = {
    "resourceType": "Patient",
    "name": [
        {
            "text": "{{ item.where( }}"  # <-- Invalid expression
        }
    ]
}

context = {}

try:
    resolve_template(resource, template, context)
except FPMLValidationError as e:
    print(f"Validation error: {e.error_message}")
    print(f"Error path: `{e.error_path}`")
```

Output:
```python
"Validation error: Cannot evaluate 'item.where(': where wrong arity: got 0"
"Error path: `name.0.text`"
```

### Using strict mode

In strict mode only context variables can be used (starting with percent sigh). Any access of the resource property will raise a validation error.

```python
from fpml import resolve_template


template = {
    "resourceType": "Patient",
    "name": [
        {
            "text": "{{ item.where(linkId='name').answer.valueString }}"  # <-- Accessing resource attribute
        }
    ]
}

context = {} 


resolve_template(resource, template, context, strict=True)
```

Raises an error:
```
FPMLValidationError: Cannot evaluate 'item.where(linkId='name').answer.valueString': "Forbidden access to resource property 'item' in strict mode. Use context instead.". Path 'name.0.text'
```

Meanwhile using context:


```python
from fpml import resolve_template


template = {
    "resourceType": "Patient",
    "name": [
        {
            "text": "{{ %QuestionnaireResponse.item.where(linkId='name').answer.valueString }}"  # <-- Accessing context variable
        }
    ]
}

context = {"QuestionnaireResponse": resource}  # <-- Context 

result = resolve_template(resource, template, context, strict=True)
print(result)
```

Output:
```python
{'resourceType': 'Patient', 'name': [{'text': 'Name'}]}
```


## Development

### Local environment and testing

```bash
cd ./python
poetry install
```

To run tests:

```bash
poetry run pytest
```


### Pre-commit hook

In `./python` directory:

Run in the shell
```bash
autohooks activate
```

And edit `../.git/hooks/pre-commit` replacing the first line with
```
#!/usr/bin/env -S poetry --project=./python run python
```

## License

This project is licensed under the MIT License.