import pytest

from fpml.core.constants import undefined
from fpml.core.core_types import Resource, UserInvocationTable
from fpml.core.extract import FPMLValidationError, resolve_template


def test_transformation_with_fp_options() -> None:
    resource: Resource = {"list": [{"key": 5}, {"key": 6}, {"key": 7}]}
    user_invocation_table: UserInvocationTable = {
        "pow": {
            "fn": lambda inputs, exp=2: [i**exp for i in inputs],
            "arity": {0: [], 1: ["Integer"]},
        }
    }
    result = resolve_template(
        resource,
        {"key": "{{ list.key.pow(2) }}"},
        fp_options={"userInvocationTable": user_invocation_table},
    )
    assert result == {"key": 25}


def test_transformation_fails_on_accessing_props_of_resource_in_strict_mode() -> None:
    resource: Resource = {"list": [{"key": 1}, {"key": 2}, {"key": 3}]}
    with pytest.raises(FPMLValidationError):
        resolve_template(resource, {"key": "{{ list.key }}"}, {}, strict=True)


def test_transformation_fails_on_accessing_props_of_resource_with_capital_letter_in_strict_mode() -> (  # noqa: E501
    None
):
    resource: Resource = {"resourceType": "Resource", "key": [1, 2, 3]}
    with pytest.raises(FPMLValidationError):
        resolve_template(resource, {"key": "{{ Resource.key }}"}, {}, strict=True)


def test_transformation_fails_on_accessing_props_of_undefined_resource_with_capital_letter_in_strict_mode() -> (  # noqa: E501
    None
):
    resource: Resource = {"resourceType": "Resource", "key": [1, 2, 3]}
    with pytest.raises(FPMLValidationError):
        resolve_template(resource, {"key": "{{ UndefinedResource.key }}"}, {}, strict=True)


def test_transformation_works_on_accessing_props_of_explicit_context_in_strict_mode() -> None:
    resource: Resource = {"list": [{"key": 1}, {"key": 2}, {"key": 3}]}
    result = resolve_template(
        resource, {"key": "{{ %Resource.list.key }}"}, {"Resource": resource}, strict=True
    )
    assert result == {"key": 1}


def test_transformation_works_on_accessing_props_of_implicit_context_in_strict_mode() -> None:
    resource: Resource = {"list": [{"key": 1}, {"key": 2}, {"key": 3}]}
    result = resolve_template(resource, {"key": "{{ %context.list.key }}"}, strict=True)
    assert result == {"key": 1}


def test_transformation_for_empty_object_return_empty_object() -> None:
    assert resolve_template({}, {}) is None


def test_transformation_for_empty_array_return_empty_array() -> None:
    assert resolve_template({}, []) is None


def test_transformation_for_array_of_arrays_returns_flattened_array() -> None:
    assert resolve_template({}, [[1, 2, 3], [4, 5, 6]]) == [1, 2, 3, 4, 5, 6]


def test_transformation_for_array_with_null_values_returns_compacted_array() -> None:
    assert resolve_template({}, [[1, None, 2, None, 3]]) == [1, 2, 3]


def test_transformation_for_array_with_undefined_values_returns_compacted_array() -> None:
    assert resolve_template({}, [[1, undefined, 2, undefined, 3]]) == [1, 2, 3]


def test_transformation_for_object_with_null_keys_returns_null_keys() -> None:
    assert resolve_template({}, {"key": None}) == {"key": None}


def test_transformation_for_object_with_undefined_keys_clears_undefined_keys() -> None:
    assert resolve_template({}, {"key": undefined}) is None


def test_transformation_for_object_with_non_null_keys_returns_non_null_keys() -> None:
    assert resolve_template({}, {"key": 1}) == {"key": 1}


def test_transformation_for_array_of_objects_returns_original_array() -> None:
    assert resolve_template({}, [{"list": [1, 2, 3]}, {"list": [4, 5, 6]}]) == [
        {"list": [1, 2, 3]},
        {"list": [4, 5, 6]},
    ]


def test_transformation_for_null_returns_null() -> None:
    assert resolve_template({}, None) is None


def test_transformation_for_constant_string_returns_constant_string() -> None:
    assert resolve_template({}, "string") == "string"


def test_transformation_for_constant_number_returns_constant_number() -> None:
    assert resolve_template({}, 1) == 1


def test_transformation_for_false_returns_false() -> None:
    assert resolve_template({}, False) is False


def test_transformation_for_true_returns_true() -> None:
    assert resolve_template({}, True) is True


def test_transformation_for_non_empty_array_expression_return_first_element() -> None:
    resource: Resource = {"list": [{"key": 1}, {"key": 2}, {"key": 3}]}
    assert resolve_template(resource, "{{ list }}") == {"key": 1}


def test_transformation_for_empty_array_expression_clears_undefined_keys() -> None:
    resource: Resource = {"list": []}
    assert resolve_template(resource, {"result": "{{ list.where($this = 0) }}"}) is None


def test_transformation_for_empty_array_nullable_expression_returns_null() -> None:
    resource: Resource = {"list": []}
    assert resolve_template(resource, {"result": "{{+ list.where($this = 0) +}}"}) == {
        "result": None
    }


def test_transformation_for_template_expression_returns_resolved_template() -> None:
    resource: Resource = {"list": [{"key": 1}, {"key": 2}, {"key": 3}]}
    assert (
        resolve_template(resource, "/{{ list[0].key }}/{{ list[1].key }}/{{ list[2].key }}")
        == "/1/2/3"
    )


def test_transformation_for_empty_array_template_expression_returns_undefined() -> None:
    resource: Resource = {"list": [{"key": 1}, {"key": 2}, {"key": 3}]}
    assert (
        resolve_template(
            resource,
            "/Patient/{{ list.where($this = 0) }}/_history/{{ list.last() }}",
        )
        is None
    )


def test_transformation_for_empty_array_nullable_template_expression_returns_null() -> None:
    resource: Resource = {"list": [{"key": 1}, {"key": 2}, {"key": 3}]}
    assert (
        resolve_template(
            resource,
            "/Patient/{{+ list.where($this = 0) +}}/_history/{{ list.last() }}",
        )
        is None
    )


def test_transformation_for_multiline_template_works_properly() -> None:
    resource: Resource = {"list": [{"key": 1}]}
    assert resolve_template(resource, "{{\nlist.where(\n$this.key=1\n).key\n}}") == 1


def test_transformation_fails_with_incorrect_fhirpath_expression() -> None:
    with pytest.raises(FPMLValidationError):
        resolve_template({}, "{{ item.where(linkId='a) }}")


def test_transformation_for_array_template_works_properly() -> None:
    resource: Resource = {"list": [{"key": 1}, {"key": 2}]}
    assert resolve_template(resource, "{[ list.key ]}") == [1, 2]


def test_context_block_resolve_template() -> None:
    resource: Resource = {
        "foo": "bar",
        "list": [{"key": "a"}, {"key": "b"}, {"key": "c"}],
    }
    template = {
        "list": {
            "{{ list }}": {
                "key": "{{ key }}",
                "foo": "{{ %root.foo }}",
            },
        },
    }

    context = {"root": resource}

    expected_result = {
        "list": [
            {"key": "a", "foo": "bar"},
            {"key": "b", "foo": "bar"},
            {"key": "c", "foo": "bar"},
        ]
    }

    result = resolve_template(resource, template, context)

    assert result == expected_result


def test_assign_block_single_var_as_object() -> None:
    resource: Resource = {
        "resourceType": "Resource",
        "sourceValue": 100,
    }
    assert resolve_template(
        resource,
        {
            "{% assign %}": {"var": 100},
            "value": "{{ %var }}",
        },
    ) == {"value": 100}


def test_assign_block_with_undefined_intermediate_values() -> None:
    resource: Resource = {
        "resourceType": "Resource",
        "sourceValue": 100,
    }
    assert (
        resolve_template(
            resource,
            {
                "{% assign %}": [
                    {"varA": "{{ {} }}"},
                    {"varB": "{{ %varA }}"},
                ],
                "valueA": "{{ %varB }}",
            },
        )
        is None
    )


def test_assign_block_multiple_vars_as_array_of_objects() -> None:
    resource: Resource = {
        "resourceType": "Resource",
        "sourceValue": 100,
    }
    assert resolve_template(
        resource,
        {
            "{% assign %}": [{"varA": 100}, {"varB": "{{ %varA + 100}}"}],
            "valueA": "{{ %varA }}",
            "valueB": "{{ %varB }}",
        },
    ) == {
        "valueA": 100,
        "valueB": 200,
    }


def test_assign_block_isolated_nested_context() -> None:
    resource: Resource = {
        "resourceType": "Resource",
        "sourceValue": 100,
    }
    assert resolve_template(
        resource,
        {
            "{% assign %}": {"varC": 100},
            "nested": {
                "{% assign %}": {"varC": 200},
                "valueC": "{{ %varC }}",
            },
            "valueC": "{{ %varC }}",
        },
    ) == {
        "valueC": 100,
        "nested": {"valueC": 200},
    }


def test_assign_block_full_example() -> None:
    resource: Resource = {
        "resourceType": "Resource",
        "sourceValue": 100,
    }
    assert resolve_template(
        resource,
        {
            "{% assign %}": [
                {
                    "varA": {
                        "{% assign %}": [{"varX": "{{ Resource.sourceValue.first() }}"}],
                        "x": "{{ %varX }}",
                    }
                },
                {"varB": "{{ %varA.x + 1 }}"},
                {"varC": 0},
            ],
            "nested": {
                "{% assign %}": {"varC": "{{ %varA.x + %varB }}"},
                "valueA": "{{ %varA }}",
                "valueB": "{{ %varB }}",
                "valueC": "{{ %varC }}",
            },
            "valueA": "{{ %varA }}",
            "valueB": "{{ %varB }}",
            "valueC": "{{ %varC }}",
        },
    ) == {
        "valueA": {"x": 100},
        "valueB": 101,
        "valueC": 0,
        "nested": {
            "valueA": {"x": 100},
            "valueB": 101,
            "valueC": 201,
        },
    }


def test_assign_block_fails_with_multiple_keys_in_object() -> None:
    resource: Resource = {
        "resourceType": "Resource",
        "sourceValue": 100,
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(
            resource,
            {
                "{% assign %}": {"varA": 100, "varB": 200},
                "value": "{{ %var }}",
            },
        )


def test_assign_block_fails_with_multiple_keys_in_array_of_objects() -> None:
    resource: Resource = {
        "resourceType": "Resource",
        "sourceValue": 100,
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(
            resource,
            {
                "{% assign %}": [{"varA": 100, "varB": 200}],
                "value": "{{ %var }}",
            },
        )


def test_assign_block_fails_with_non_array_and_non_object_as_value() -> None:
    resource: Resource = {
        "resourceType": "Resource",
        "sourceValue": 100,
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(
            resource,
            {
                "{% assign %}": 1,
                "value": "{{ %var }}",
            },
        )


def test_for_block_resolve_template_full_example() -> None:
    context = {
        "foo": "bar",
        "list": [{"key": "a"}, {"key": "b"}, {"key": "c"}],
    }
    template = {
        "listArr": [
            {
                "{% for index, item in list %}": {
                    "key": "{{ %item.key }}",
                    "foo": "{{ foo }}",
                    "index": "{{ %index }}",
                },
            },
            {
                "{% for item in list %}": {
                    "key": "{{ %item.key }}",
                    "foo": "{{ foo }}",
                },
            },
        ],
        "listObj": {
            "{% for item in list %}": {
                "key": "{{ %item.key }}",
                "foo": "{{ foo }}",
            },
        },
    }
    expected_result = {
        "listArr": [
            {"key": "a", "foo": "bar", "index": 0},
            {"key": "b", "foo": "bar", "index": 1},
            {"key": "c", "foo": "bar", "index": 2},
            {"key": "a", "foo": "bar"},
            {"key": "b", "foo": "bar"},
            {"key": "c", "foo": "bar"},
        ],
        "listObj": [
            {"key": "a", "foo": "bar"},
            {"key": "b", "foo": "bar"},
            {"key": "c", "foo": "bar"},
        ],
    }
    assert resolve_template(context, template) == expected_result


def test_for_block_resolve_template_local_assign() -> None:
    template = {
        "{% assign %}": {
            "localList": [{"key": "a"}, {"key": "b"}, {"key": "c"}],
        },
        "listArr": [
            {
                "{% for item in %localList %}": {
                    "key": "{{ %item.key }}",
                },
            },
        ],
    }
    expected_result = {"listArr": [{"key": "a"}, {"key": "b"}, {"key": "c"}]}
    assert resolve_template({}, template) == expected_result


def test_for_block_resolve_template_fails_with_other_keys() -> None:
    context = {"list": [1, 2, 3]}
    template = {
        "userKey": 1,
        "{% for key in %list %}": "{{ %key }}",
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(context, template)


def test_if_block_returns_if_branch_for_truthy_condition_at_root_level() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "{% if key = 'value' %}": {"nested": "{{ 'true' + key }}"},
            "{% else %}": {"nested": "{{ 'false' + key }}"},
        },
    )
    assert result == {"nested": "truevalue"}


def test_if_block_returns_if_branch_for_truthy_condition() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "{% if key = 'value' %}": {"nested": "{{ 'true' + key }}"},
                "{% else %}": {"nested": "{{ 'false' + key }}"},
            },
        },
    )
    assert result == {"result": {"nested": "truevalue"}}


def test_if_block_returns_if_branch_for_truthy_condition_without_else_branch() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "{% if key = 'value' %}": {"nested": "{{ 'true' + key }}"},
            },
        },
    )
    assert result == {"result": {"nested": "truevalue"}}


def test_if_block_returns_else_branch_for_falsy_condition() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "{% if key != 'value' %}": {"nested": "{{ 'true' + key }}"},
                "{% else %}": {"nested": "{{ 'false' + key }}"},
            },
        },
    )
    assert result == {"result": {"nested": "falsevalue"}}


def test_if_block_clears_undefined_keys_for_falsy_condition_without_else_branch() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "{% if key != 'value' %}": {"nested": "{{ 'true' + key }}"},
            },
        },
    )
    assert result is None


def test_if_block_returns_null_for_falsy_condition_with_nullable_else_branch() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "{% if key != 'value' %}": {"nested": "{{ 'true' + key }}"},
                "{% else %}": "{{+ {} +}}",
            },
        },
    )
    assert result == {"result": None}


def test_if_block_returns_if_branch_for_nested_if() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "{% if key = 'value' %}": {
                    "{% if key = 'value' %}": "value",
                },
            },
        },
    )
    assert result == {"result": "value"}


def test_if_block_returns_else_branch_for_nested_else() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "{% if key != 'value' %}": None,
                "{% else %}": {
                    "{% if key != 'value' %}": None,
                    "{% else %}": "value",
                },
            },
        },
    )
    assert result == {"result": "value"}


def test_if_block_implicitly_merges_with_null_returned() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "myKey": 1,
                "{% if key = 'value' %}": None,
            },
        },
    )
    assert result == {"result": {"myKey": 1}}


def test_if_block_implicitly_merges_with_object_returned_for_truthy_condition() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "myKey": 1,
                "{% if key = 'value' %}": {"anotherKey": 2},
            },
        },
    )
    assert result == {"result": {"myKey": 1, "anotherKey": 2}}


def test_if_block_implicitly_merges_with_object_returned_for_falsy_condition() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "result": {
                "myKey": 1,
                "{% if key != 'value' %}": {"anotherKey": 2},
                "{% else %}": {"anotherKey": 3},
            },
        },
    )
    assert result == {"result": {"myKey": 1, "anotherKey": 3}}


def test_if_block_fails_on_implicit_merge_with_non_object_returned_from_if_branch() -> None:
    resource: Resource = {
        "key": "value",
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(
            resource,
            {
                "result": {
                    "myKey": 1,
                    "{% if key = 'value' %}": [{"key1": True}],
                },
            },
        )


def test_if_block_fails_on_implicit_merge_with_non_object_returned_from_else_branch() -> None:
    resource: Resource = {
        "key": "value",
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(
            resource,
            {
                "result": {
                    "myKey": 1,
                    "{% if key != 'value' %}": {},
                    "{% else %}": [{"key1": True}],
                },
            },
        )


def test_if_block_fails_on_multiple_if_blocks() -> None:
    resource: Resource = {
        "key": "value",
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(
            resource,
            {
                "result": {
                    "myKey": 1,
                    "{% if key != 'value' %}": {},
                    "{% if key = 'value' %}": {},
                },
            },
        )


def test_if_block_fails_on_multiple_else_blocks() -> None:
    resource: Resource = {
        "key": "value",
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(
            resource,
            {
                "result": {
                    "myKey": 1,
                    "{% if key != 'value' %}": {},
                    "{% else %}": {},
                    "{% else  %}": {},
                },
            },
        )


def test_if_block_fails_on_else_block_without_if_block() -> None:
    resource: Resource = {
        "key": "value",
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(
            resource,
            {
                "result": {
                    "myKey": 1,
                    "{% else %}": {},
                },
            },
        )


def test_merge_block_implicitly_merges_into_the_node() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "b": 1,
            "{% merge %}": {"a": 1},
        },
    )
    assert result == {"b": 1, "a": 1}


def test_merge_block_merges_multiple_blocks_within_order() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "{% merge %}": [{"a": 1}, {"b": 2}, {"a": 3}],
        },
    )
    assert result == {"a": 3, "b": 2}


def test_merge_block_merges_multiple_blocks_containing_nulls() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "{% merge %}": [{"a": 1}, None, {"b": 2}],
        },
    )
    assert result == {"a": 1, "b": 2}


def test_merge_block_merges_multiple_blocks_containing_undefined() -> None:
    resource: Resource = {
        "key": "value",
    }
    result = resolve_template(
        resource,
        {
            "{% merge %}": [{"a": 1}, undefined, {"b": 2}],
        },
    )
    assert result == {"a": 1, "b": 2}


def test_merge_block_fails_on_merge_with_non_object() -> None:
    resource: Resource = {
        "key": "value",
    }
    with pytest.raises(FPMLValidationError):
        resolve_template(
            resource,
            {
                "{% merge %}": [1, 2],
            },
        )
