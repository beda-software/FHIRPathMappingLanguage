# AGENTS-Mapping.md — FPML mapping rules

## Quick Navigation (Mapping)

- **Start here:** Golden rule (section below).
- **If target field is an array/list:** read **1) Arrays (lists)**.
- **If target field is scalar/single object:** read **2) Non-array fields**.
- **If you need reusable per-row values:** read **3) `{% assign %}` inside loops**.
- **If expression already returns Coding:** read **4) Coding assignment**.
- **If linking resources in same Bundle:** read **5) In-bundle references**.

## Golden rule

Never put `{% if %}` or `{% for %}` as sibling keys next to real fields in an object.

Conditionals/loops are allowed only as:
- array element keys, or
- the single key inside a non-array field value.

Reference:
- [FPML style guide](https://github.com/beda-software/FHIRPathMappingLanguage/issues/35)

## 1) Arrays (lists)

### GOOD

```yaml
statusReason:
  - "{% for item in %items %}":
      coding:
        - "{{ %item }}"
```

```yaml
extension:
  - "{% if %condition %}":
      url: ...
```

### BAD

```yaml
period:
  "{% if %start.exists() %}":
    start: "{{ %start }}"
  "{% if %end.exists() %}":
    end: "{{ %end }}"
```

```yaml
statusReason:
  "{% if %condition %}":
    - ...
```

## 2) Non-array fields (scalar/single object)

### GOOD

```yaml
period:
  start:
    "{% if %encounterPeriodStart.exists() %}": "{{ %encounterPeriodStart }}"
  end:
    "{% if %encounterPeriodEnd.exists() %}": "{{ %encounterPeriodEnd }}"
```

### BAD

```yaml
period:
  "{% if %encounterPeriodStart.exists() %}":
    start: "{{ %encounterPeriodStart }}"
  "{% if %encounterPeriodEnd.exists() %}":
    end: "{{ %encounterPeriodEnd }}"
```

## 3) `{% assign %}` inside loops

Use `{% assign %}` inside `{% for ... %}` to avoid repeating long paths.

```yaml
entry:
  - "{% for row in %rows %}":
      "{% assign %}":
        - rowId: "{{ %row.item.where(linkId='row-id').answer.valueString }}"
        - rowCoding: "{{ %row.item.where(linkId='row-coding').answer.valueCoding }}"
      request:
        "{% if %rowId.exists() %}":
          method: PUT
          url: "/SomeResource/{{ %rowId }}"
        "{% else %}":
          method: POST
          url: /SomeResource
      resource:
        coding:
          - "{{ %rowCoding }}"
```

## 4) Coding assignment

If expression returns full `Coding`, assign directly:

```yaml
coding:
  - "{{ %someCoding }}"
```

## 5) In-bundle references

When referencing resources created in the same transaction Bundle, use URN template:

```yaml
reference: "{{ 'urn:uuid:Encounter-0' }}"
```

Do not use plain external-style references (`"Encounter/..."`) for in-bundle links.
