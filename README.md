# FHIRPathMappingLanguage

## Motivation
Data mapping is a high-demand topic. There are many products that try to address it.  
Even FHIR provides a specification called [FHIR Mapping Language](https://build.fhir.org/mapping-language.html) that should cover this gap.
Unfortunately, there is a lack of open-source implementation of the FHIR Mapping Language.
Furthermore, it is a complicated tool that is hard to create, debug, and manage in along term.
Please check real-life [examples](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main/examples) I have created. 

I faced a mapping issue while implementing an extraction operation for [FHIR SDC](https://hl7.org/fhir/us/sdc/).   
I didn't want to use the FHIR Mapping Language, so I started searching for alternatives.
I found [JUTE](https://github.com/healthSamurai/jute.clj). It is a powerful engine that provides a nice experience in creating mappers.
From my point of view, the data DSL nature is a big advantage. You are creating an FHIR resource and just replacing some values with JUTE expression/directives.
Please have a look at this [mapper](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/examples/repeatable/jute.yaml).
It is pretty easy to understand what is going on here. Especially if you compare it with [FHIR Mapping language](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/examples/repeatable/fhirmapping.map) version.
Unfortunately, JUTE provides its own syntax and approach for path expressions, while it is more convenient to use FHIRPath when you query data from FHIR Resources especially if you are querying QuestionnaireResponse. JUTE provides API to add any function inside the engine, so I embedded fhirpath function.
As a result, you can see that almost all JUTE expression calls fhirpath function: [jute.yaml](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/examples/repeatable/jute.yaml)
It looks like an overhead, so I decided to replace the JUTE path engine with FHIRPath and make it FHIRPath native.
There is a similar approach in the FHIR world called [fhir-xquery](https://hl7.org/fhir/fhir-xquery.html). It is inspired by [liquid](https://shopify.github.io/liquid/) template language. [Fhir-xquery](https://hl7.org/fhir/fhir-xquery.html) uses to build dynamic query string. 
Since this approach is already used in FHIR I decided to use it instead of `$` sign that is used in JUTE to identify an expression.

Finally, data DSL should be LLM-friendly and there should be an easy way to generate a mapper based on the text description.
ChatGPT works pretty well with JSON and FHIRPath. So, you can just copy and paste the specification into ChatGPT and try to generate mappers.


## Specification

FHIRPath mapping language is data dsl designed to convert data from QuestionnaireResponse (and not only) to any FHIR Resource.

Here is how does it work.

Let's say we have a QuestionnaireResponse describing a patient:
```json
{
    "resourceType": "QuestionnaireResponse",
    "status": "completed",
    "item": [
        {
            "Text name",
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
            "text": "gender"
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
            "text": "Phone"
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

You need to map it to Patient FHIR resource. The mapper define structure of the resource.
This mapper
```json
{
    "resourceType": "Patient"
}
```

is a valid mapper that return exactly the same structure
```json
{
    "resourceType": "Patient"
}
```

All strings are treated as constant value unless it starts with `{{` and ends with `}}`.
The text inside `{{` and `}}` is a FHIRPath expression.
Let's use it to extract patient birthDate.

```json
{
    "resourceType": "Patient",
    "birthDate": "{{ QuestionnaireResponse.repeat(item).where(linkId='2').answer.value }}"
}
```

The result will be
```json
{
    "resourceType": "Patient",
    "birthDate": "2023-05-03"
}
```
Let's extract name, phone number and email fields:
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

To extract gender we need a bit more complex expression

`QuestionnaireResponse.repeat(item).where(linkId='4.1').answer.value.code`

because patient gender is token while question item type is Coding.

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

### Expression evaluation with empty result

If expression is resolved to empty set `{}`, this key will be removed from the object.

Let's imagine, if the gender field is missing in the QuestionnaireResponse from the example above

```json
{
    "resourceType": "Patient",
    "gender": "{{ QuestionnaireResponse.repeat(item).where(linkId='4.1').answer.value.code }}"
}
```

this template will be mapped into

```json
    {
        "resourceType": "Patient"
    }
```

### Null preservable construction 

**NOTE:** the feature is not mature enough and might be changed in the future.

There's a special construction that allows to preserve the null value in the final result using `{{+` and `+}}` instead of `{{` and `}}`,

```json
{
    "resourceType": "Patient",
    "gender": "{{+ QuestionnaireResponse.repeat(item).where(linkId='4.1').answer.value.code +}}"
}
```

the result will be 

```json
    {
        "resourceType": "Patient",
        "gender": null
    }
```

**NOTE:** the feature is not mature enough and might be changed in the future.


### Automatic array flattening and null removal

In FHIR resources the array of arrays as well as array of nulls are invalid construction. To simplify writing mappers there's an automatic array flattening.

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

will be mapped into

```json
{
    "list": [
        1, 2, 3, 4, 5, 6
    ]
}
```

It is especially useful if there's conditional and iteration logic used.

### Locally scoped variables

Here's a special construction that allows to define custom variables for the FHIRPath context of underlying expressions.

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

Pay attention that `%varA` is accessed using the percent sign. 
It means that `%varA` is from the context. Also the order is in the array is important. The context variables can be accessed only in the underlying expressions including nested arrays/objects, e.g.


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

will be transformed into

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

FHIRPath provides conditional logic for primitive values like booleans, strings and numbers using `iif` function.
Sometimes it's not enough and we need to map some values to complex structures, let's say JSON objects.

There's a special construction

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

For example,

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

will be mapped into

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

It also makes implicit merge, in case when `if`/`else` blocks return JSON objects, e.g.

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

In this example, Patient address contains original `{"type": "physical"}` object and `country`/`text` implicitly merged based on condition.

### Iteration logic

To iterate over the array of values here's a special construction

```json
{
    "{% for item in QuestionnaireResponse.item %}": {
        "linkId": "{{ %item.linkId }}"
    }
}
```

that will be transformed into

```
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
        "index": "{{ %index }}"
        "linkId": "{{ %item.linkId }}"
    }
}
```

that will be transformed into

```
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

To merge two or more objects, there's a special construction

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

that will be transformed into

```json
{
    "a": 1
    "b": 2
}
```

## Examples

See real-life examples of mappers for [FHIR](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/ts/server/src/utils/__data__/complex-example.fhir.yaml) and [Aidbox](https://github.com/beda-software/FHIRPathMappingLanguage/blob/main/ts/server/src/utils/__data__/complex-example.aidbox.yaml)

and other usage in [unit tests](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main/ts/server/src/utils).

## Reference implementation

TypeScript implementation that supports all the specification is already available [in this repository](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main/server).
Also, it is packed into a [docker image](https://hub.docker.com/r/bedasoftware/fhirpath-extract) to use as a microservice.

### Usage

```json
POST /r4/parse-template

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

### Strict mode

FHIRPath provides a way of accessing the `resource` variables without the percent sign. It potentially leads to the issues made by typos in the variable names.

There's a runtime flag, called `strict` that is set to `false` by default. If it set to `true`, all accesses to the variables without the percent sign will be rejected and exception will be thrown.


The previous example should be re-written as

```json
POST /r4/parse-template

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
    "strict": true
}
```