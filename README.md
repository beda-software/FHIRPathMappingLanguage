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

As a result, I got the following specifications:

## Specification
FHIRPath mapping language is data dsl designed to convert data from QuestionnaireResponse to any FHIR Resource.

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
        }
    ]
}
```

You need to map it to Patient FHIR resource. The mapper define struture of the resource.
This mapper
```json
{"resourceType": "Patient"}
```

is a valid maper that return exacly the same structure
```json
{"resourceType": "Patient"}
```

All strings are treated as constant value unless it start with `{{` and ends with `}}`.
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
"name": [{"given": ["{{ QuestionnaireResponse.repeat(item).where(linkId='1').answer.value }}"]}],
"telecom": [
    {"value": "{{ QuestionnaireResponse.repeat(item).where(linkId='phone').answer.value }}",
     "system": "phone"},
    {"value": "{{ QuestionnaireResponse.repeat(item).where(linkId='email').answer.value }}",
     "system": "email"}]
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
"name": [{"given": ["{{ QuestionnaireResponse.repeat(item).where(linkId='1').answer.value }}"]}],
"telecom": [
    {"value": "{{ QuestionnaireResponse.repeat(item).where(linkId='phone').answer.value }}",
     "system": "phone"},
    {"value": "{{ QuestionnaireResponse.repeat(item).where(linkId='email').answer.value }}",
     "system": "email"}]
"gender": "{{ QuestionnaireResponse.repeat(item).where(linkId='4.1').answer.value.code }}"
}
```  

## TODO
- [ ] Alternative to [JUTE $map](https://github.com/healthSamurai/jute.clj#map) derective. [Proposal](https://github.com/beda-software/FHIRPathMappingLanguage/issues/1)
- [ ] Alternative to [JUTE $if](https://github.com/healthSamurai/jute.clj#if) directive.
- [ ] Do we need a way to define FHIRPath variables? Like [JUTE $let](https://github.com/healthSamurai/jute.clj#let) directive.

## Reference implementation
I am going to build Python and TypeScript versions of FHIRPathMappingLanguage.   
TypeScript is already available https://github.com/beda-software/FHIRPathMappingLanguage/tree/main/server   
Also, it is packed into a docker image to use as a microservice https://hub.docker.com/r/bedasoftware/fhirpath-extract   
