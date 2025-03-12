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
    fp_options=None,
    strict=False
)
```

### Arguments:

- resource (Resource): The input FHIR resource to process.
- template (Any): The template describing the transformation.
- context (Optional[Context], optional): Additional context data. Defaults to None.
- fp_options (Optional[FPOptions], optional): Options for controlling FHIRPath evaluation. Defaults to None.
- strict (bool, optional): Whether to enforce strict mode. Defaults to False. See more details on [strict mode](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main?tab=readme-ov-file#strict-mode).

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
from fpml import resolve_template
from fhirpathpy.models import models


template = {
    "resourceType": "Patient",
    "name": [
        {
            "text": "{{ item.where(linkId='name').answer.value }}"  # <-- according R4 model
        }
    ]
}

context = {}

fp_options = {
    "model": models["r4"]
}

result = resolve_template(resource, template, context, fp_options)
print(result)
```

Output:
```python
{'resourceType': 'Patient', 'name': [{'text': 'Name'}]}
```

### Using user-defined functions

```python
from fpml import resolve_template


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

fp_options = {
    "userInvocationTable": user_invocation_table
}

result = resolve_template(resource, template, context, fp_options)
print(result)
```

Output:
```python
{'resourceType': 'Patient', 'name': [{'text': 'Name'}]}
```

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