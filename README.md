# FHIRPathMappingLanguage

## Motivation

Data mapping is a high-demand topic. There are many products that try to address it.  
Even FHIR provides a specification called [FHIR Mapping Language](https://build.fhir.org/mapping-language.html) that should cover this gap.
Unfortunately, there is a lack of open-source implementation of the FHIR Mapping Language.
Furthermore, it is a complicated tool that is hard to create, debug, and manage in along term.
Please check real-life [examples](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main/examples).

A mapping issue was encountered while implementing an extraction operation for [FHIR SDC](https://hl7.org/fhir/us/sdc/).   
Instead of using the FHIR Mapping Language, an alternative was sought and found in [JUTE](https://github.com/healthSamurai/jute.clj). It is a powerful engine that provides a nice experience in creating mappers.
JUTE is a powerful engine that offers a pleasant experience in creating mappers. Its data DSL nature is a significant advantage, allowing the creation of an FHIR resource with some values replaced by JUTE expressions/directives. 
Please have a look at this [mapper](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/examples/repeatable/jute.yaml).
It is pretty easy to understand what is going on here. Especially if you compare it with [FHIR Mapping language](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/examples/repeatable/fhirmapping.map) version.
Unfortunately, JUTE provides its own syntax and approach for path expressions, while it is more convenient to use FHIRPath when you query data from FHIR Resources especially if you are querying QuestionnaireResponse. JUTE provides API to add any function inside the engine, so the fhirpath function was embedded.
As a result, you can see that almost all JUTE expression calls fhirpath function: [jute.yaml](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/examples/repeatable/jute.yaml)
This approach appears to be an overhead, prompting a decision to replace the JUTE path engine with FHIRPath to make it FHIRPath native.
A similar approach in the FHIR world is called [fhir-xquery](https://hl7.org/fhir/fhir-xquery.html), inspired by the [liquid](https://shopify.github.io/liquid/) template language. [Fhir-xquery](https://hl7.org/fhir/fhir-xquery.html) uses to build dynamic query string. 
This approach was adopted instead of the `$` sign used in JUTE to identify an expression.

Finally, data DSL should be LLM-friendly and there should be an easy way to generate a mapper based on the text description.
ChatGPT works pretty well with JSON and FHIRPath. So, you can just copy and paste the specification into ChatGPT and try to generate mappers.


## Specification

The FHIRPath mapping language is a data DSL designed to convert data from QuestionnaireResponse (and not only) to any FHIR Resource.

Here is how it works.

Suppose there is a QuestionnaireResponse describing a patient:

```json
{
    "resourceType": "QuestionnaireResponse",
    "status": "completed",
    "item": [
        {
            "text": "Name",
            "linkId": "1",
            "answer": [
                {
                    "valueString": "Ilya"
                }
            ]
        },
        {
            "text": "Birth date",
            "linkId": "2",
            "answer": [
                {
                    "valueDate": "2023-05-03"
                }
            ]
        },
        {
            "text": "gender",
            "linkId": "4.1",
            "answer": [
                {
                    "valueCoding": {
                        "code": "male",
                        "display": "Male",
                        "system": "http://hl7.org/fhir/administrative-gender"
                    }
                }
            ]
        },
        {
            "text": "Phone",
            "linkId": "phone",
            "answer": [
                {
                    "valueString": "+232319898"
                }
            ]
        },
        {
            "text": "email",
            "linkId": "email",
            "answer": [
                {
                    "valueString": "foo@yahoo.com"
                }
            ]
        },
        {
            "text": "country",
            "linkId": "country",
            "answer": [
                {
                    "valueString": "US"
                }
            ]
        }
    ]
}
```

To map it to a Patient FHIR resource, define the structure of the resource.

This mapper:

```json
{
    "resourceType": "Patient"
}
```

is a valid mapper that returns exactly the same structure:

```json
{
    "resourceType": "Patient"
}
```

All strings are treated as constant values unless they start with `{{` and end with `}}`. The text inside `{{` and `}}` is a FHIRPath expression. 

To extract the patient's birthDate, use:

```json
{
    "resourceType": "Patient",
    "birthDate": "{{ QuestionnaireResponse.repeat(item).where(linkId='2').answer.value }}"
}
```

The result will be:

```json
{
    "resourceType": "Patient",
    "birthDate": "2023-05-03"
}
```

To extract the name, phone number, and email fields:

```json
{
    "resourceType": "Patient",
    "birthDate": "{{ QuestionnaireResponse.repeat(item).where(linkId='2').answer.value }}",
    "name": [
        {
            "given": [
                "{{ QuestionnaireResponse.repeat(item).where(linkId='1').answer.value }}"
            ]
        }
    ],
    "telecom": [
        {
            "value": "{{ QuestionnaireResponse.repeat(item).where(linkId='phone').answer.value }}",
            "system": "phone"
        },
        {
            "value": "{{ QuestionnaireResponse.repeat(item).where(linkId='email').answer.value }}",
            "system": "email"
        }
    ]
}
```

To extract gender, a more complex expression is needed:

`QuestionnaireResponse.repeat(item).where(linkId='4.1').answer.value.code`

because the patient's gender is a token while the question item type is Coding.

The final mapper will look like this:

```json
{
    "resourceType": "Patient",
    "birthDate": "{{ QuestionnaireResponse.repeat(item).where(linkId='2').answer.value }}",
    "name": [
        {
            "given": [
                "{{ QuestionnaireResponse.repeat(item).where(linkId='1').answer.value }}"
            ]
        }
    ],
    "telecom": [
        {
            "value": "{{ QuestionnaireResponse.repeat(item).where(linkId='phone').answer.value }}",
            "system": "phone"
        },
        {
            "value": "{{ QuestionnaireResponse.repeat(item).where(linkId='email').answer.value }}",
            "system": "email"
        }
    ],
    "gender": "{{ QuestionnaireResponse.repeat(item).where(linkId='4.1').answer.value.code }}"
}
```

### Accessing array result of expression

From the example above, it's clearly seen that the expression inside `{{ }}` always evaluated as the first element or null.

There's a special syntax for accessing the whole array - `{[ expression ]}`.

For example,

```json
{
    "resourceType": "Patient",
    "name": [
        {
            "given": "{[ QuestionnaireResponse.repeat(item).where(linkId='1').answer.value ]}"
        }
    ]
}
```

In this example, the result of the evaluation of the expression will be always an array (empty or with results).


### Null key removal

If an expression resolves to an empty set `{}`, the key will be removed from the object.

For example, if the gender field is missing in the QuestionnaireResponse from the example above:

```json
{
    "resourceType": "Patient",
    "gender": "{{ QuestionnaireResponse.repeat(item).where(linkId='4.1').answer.value.code }}"
}
```

this template will be mapped into:

```json
{
    "resourceType": "Patient"
}
```

### Null key retention 

**Note:** This feature is not mature enough and might change in the future.

To preserve the null value in the final result, use `{{+` and `+}}` instead of `{{` and `}}`:

```json
{
    "resourceType": "Patient",
    "gender": "{{+ QuestionnaireResponse.repeat(item).where(linkId='4.1').answer.value.code +}}"
}
```

The result will be:

```json
{
    "resourceType": "Patient",
    "gender": null
}
```

**Note:** This feature is not mature enough and might change in the future.

### Automatic array flattening and null removal

In FHIR resources, arrays of arrays and arrays of nulls are invalid constructions. To simplify writing mappers, there is automatic array flattening.

For example:

```json
{
    "list": [
        [
            1, 2, null, 3
        ],
        null,
        [
            4, 5, 6, null
        ]  
    ]
}
```

will be mapped into:

```json
{
    "list": [
        1, 2, 3, 4, 5, 6
    ]
}
```

This is especially useful if there is conditional and iteration logic used.

### String concatenation

String concatenation might be implemented using fhirpath string concatenation using `+` sign, e.g.

```json
{
    "url": "{{ 'Condition?patient=' + %patientId }}"
}
```

or using liquid syntax

```json
{
    "url": "Condition?patient={{ %patientId }}"
}
```

#### Caveats

Please note that string concatenation will be executed according to FHIRPath rules. If one of the variables resolves to an empty result, the entire expression will be empty result. 

For empty `%patientId`:

```json
{
    "url": "Condition?patient={{ %patientId }}"
}
```

will be transformed into:

```json
{}
```

and using null key retention syntax:

```json
{
    "url": "Condition?patient={{+ %patientId +}}"
}
```

will be transformed into:

```json
{
    "url": null
}
```


### Scoped constant variables

A special construction allows defining custom constant variables for the FHIRPath context of underlying expressions:

```json
{
    "{% assign %}": [
        {
            "varA": 1
        },
        {
            "varB": "{{ %varA + 1 }}"
        }
    ]
}
```

Note that `%varA` is accessed using the percent sign. It means that `%varA` is from the context. The order in the array is important. The context variables can be accessed only in the underlying expressions, including nested arrays/objects. For example:

```json
{
    "{% assign %}": [
        {
            "birthDate": "{{ QuestionnaireResponse.repeat(item).where(linkId='2').answer.value }}" 
        }
    ],
    "resourceType": "Bundle",
    "entry": [
        {
            "resource": {
                "resourceType": "Patient",
                "birthDate": "{{ %birthDate }}"
            }
        }
    ]
}
```

will be transformed into:

```json
{
    "resourceType": "Bundle",
    "entry": [
        {
            "resource": {
                "resourceType": "Patient",
                "birthDate": "2023-05-03"
            }
        }
    ]
}
```

### Conditional logic

FHIRPath provides conditional logic for primitive values like booleans, strings, and numbers using the `iif` function. However, there are scenarios where conditional logic needs to be applied to map values to complex structures, such as JSON objects.

For these cases, a special construction is available in the FHIRPath mapping language:

```json
{
    "{% if expression %}": {
        "key": "value true"
    },
    "{% else %}": {
        "key": "value false"
    }
}
```

where `expression` is FHIRPath expression that is evaluated in the same way as the first argument of `iif` function.

For example:

```json
{
    "resourceType": "Patient",
    "address": {
        "{% if QuestionnaireResponse.repeat(item).where(linkId='country').answer.exists() %}": {
            "type": "physical",
            "country": "{{ QuestionnaireResponse.repeat(item).where(linkId='country').answer.value }}"
        }
    }
}
```

will be mapped into:

```json
{
    "resourceType": "Patient",
    "address": {
        "type": "physical",
        "country": "US"
    }
}
```

#### Implicit merge

It also makes implicit merge, in case when `if`/`else` blocks return JSON objects, for example:

```json
{
    "resourceType": "Patient",
    "address": {
        "type": "physical",
        "{% if QuestionnaireResponse.repeat(item).where(linkId='country').answer.exists() %}": {
            "country": "{{ QuestionnaireResponse.repeat(item).where(linkId='country').answer.value }}"
        },
        "{% else %}": {
            "text": "Unknown"
        }
    }
}
```

The final result will be either

```json
{
    "resourceType": "Patient",
    "address": {
        "type": "physical",
        "country": "US"
    }
}
```

or

```json
{
    "resourceType": "Patient",
    "address": {
        "type": "physical",
        "text": "Unknown"
    }
}
```

In this example, Patient address contains original `{"type": "physical"}` object and `country`/`text` is implicitly merged based on condition.

### Iteration logic

To iterate over the array of values, here's a special construction:

```json
{
    "{% for item in QuestionnaireResponse.item %}": {
        "linkId": "{{ %item.linkId }}"
    }
}
```

that will be transformed into:

```json
[
    { "linkId": "1" },
    { "linkId": "2" },
    { "linkId": "4.1" },
    { "linkId": "phone" },
    { "linkId": "email" },
    { "linkId": "country" }
]
```

#### Using index

```json
{
    "{% for index, item in QuestionnaireResponse.item %}": {
        "index": "{{ %index }}",
        "linkId": "{{ %item.linkId }}"
    }
}
```

that will be transformed into:

```json
[
    { "index": 0, "linkId": "1" },
    { "index": 1, "linkId": "2" },
    { "index": 2, "linkId": "4.1" },
    { "index": 3, "linkId": "phone" },
    { "index": 4, "linkId": "email" },
    { "index": 5, "linkId": "country" }
]
```


### Merge logic

To merge two or more objects, there is a special construction:

```json
{
    "{% merge %}": [
        {
            "a": 1
        },
        {
            "b": 2
        } 
    ]
}
```

that will be transformed into:

```json
{
    "a": 1
    "b": 2
}
```

## Examples

See real-life examples of mappers for [FHIR](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/tests/__data__/complex-example.fhir.yaml) and [Aidbox](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/tests/__data__/complex-example.aidbox.yaml)

and other usage in [unit tests](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main/ts/server/src/utils).

## Reference implementation

## Strict mode

FHIRPath provides a way of accessing the `resource` variables without the percent sign. It potentially leads to the issues made by typos in the variable names.

See the particular implementation for details of usage.


### TypeScript

TypeScript implementation that supports all the specification is already available [in this repository](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main/ts/server).
Also, it is packed into a [docker image](https://hub.docker.com/r/bedasoftware/fhirpath-extract) to use as a microservice.

#### Usage

POST /r4/parse-template

```json
{
    "context": {
        "QuestionnaireResponse": {
            "resourceType": "QuestionnaireResponse",
            "id": "foo",
            "authored": "2024-01-01T10:00:00Z"
        }
    },
    "template": { 
        "id": "{{ id }}",
        "authored": "{{ authored }}",
        "status": "completed"
    }
}
```

#### Strict mode

There's a flag, called `strict` that is set to `false` by default. If it set to `true`, all accesses to the variables without the percent sign will be rejected and exception will be thrown.
NOTE: there's a known issue with accessing the resource by resource type (e.g. QuestionnaireResponse.item), see details [here](https://github.com/beda-software/FHIRPathMappingLanguage/issues/27).

The previous example using strict mode:

POST /r4/parse-template?strict=true

```json
{
    "context": {
        "QuestionnaireResponse": {
            "resourceType": "QuestionnaireResponse",
            "id": "foo",
            "authored": "2024-01-01T10:00:00Z"
        }
    },
    "template": { 
        "id": "{{ %QuestionnaireResponse.id }}",
        "authored": "{{ %QuestionnaireResponse.authored }}",
        "status": "completed"
    }
}
```

### Python

Python implementation that supports all the specification is already available [in this repository](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main/python).
Also, it's available as a PyPI package under the name `fpml` and can be installed using
```
pip install fpml
```

#### Usage

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

#### Strict mode

There's a flag, called `strict` that is set to `false` by default. If it set to `true`, all accesses to the variables without the percent sign will be rejected and exception will be thrown.

Example:

```python
result = resolve_template(
    resource,
    template,
    context,
    strict=True
)
```



#### User-defined functions

There's an ability to pass user-defined functions through fp_options

Example:

```python
user_invocation_table = {
    "pow": {
        "fn": lambda inputs, exp=2: [i**exp for i in inputs],
        "arity": {0: [], 1: ["Integer"]},
    }
}

result = resolve_template(
    resource,
    template,
    context,
    fp_options={'userInvocationTable': user_invocation_table}
)
```

