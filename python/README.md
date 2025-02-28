# FHIRPathMappingLanguage - fpml python package

## Installation

```bash
pip install fpml
```

## Usage

```python
from fpml import resolve_template


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

template = {
    "resourceType": "Patient",
    "name": "{{ item.where(linkId='name').answer.valueString }}"
}

context = {}

result = resolve_template(resource, template, context)

print(result)
# {'resourceType': 'Patient', 'name': 'Name'}
```


## Development

In `./python` directory:

Run in the shell
```
autohooks activate
```

And edit `../.git/hooks/pre-commit` by replacing the first line with
```
#!/usr/bin/env -S poetry --project=./python run python
```

