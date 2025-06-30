import re
from typing import Any, Optional, cast

from fhirpathpy import evaluate  # type: ignore

from fpml.core.guarded_resource import guarded_resource

from .constants import root_node_key, undefined
from .core_exceptions import FPMLValidationError
from .core_types import (
    Context,
    DictNode,
    FPOptions,
    Matcher,
    MatcherResult,
    Node,
    Path,
    Resource,
    StrNode,
    Transformer,
)
from .utils import flatten, omit_key


def resolve_template(
    resource: Resource,
    template: Any,
    context: Optional[Context] = None,
    fp_options: Optional[FPOptions] = None,
    strict: bool = False,
) -> Any:
    """
    Processes a given template with the specified resource and optional context.

    This function takes a FHIR resource and applies the provided template, optionally
    using a context and additional processing options. The result is a transformed
    representation of the template.

    Args:
        resource (Resource): The input FHIR resource to process.
        template (Any): The template describing the transformation.
        context (Optional[Context], optional): Additional context data. Defaults to None.
        fp_options (Optional[FPOptions], optional): Options for controlling FHIRPath evaluation. Defaults to None.
        strict (bool, optional): Whether to enforce strict mode. Defaults to False.
            See more details on
            [strict mode](https://github.com/beda-software/FHIRPathMappingLanguage/tree/main?tab=readme-ov-file#strict-mode).

    Returns:
        Any: The processed output based on the template.

    Raises:
        FPMLValidationError: If validation of the template or resource fails.

    See Also:
        FHIRPathMappingLanguage Specification:
        https://github.com/beda-software/FHIRPathMappingLanguage/tree/main?tab=readme-ov-file#specification
    """  # noqa: E501
    result = resolve_template_recur(
        [],
        guarded_resource if strict else resource,
        template,
        # Pass resource as context because original is overriden by strict mode
        {"context": resource, **(context or {})},
        fp_options=fp_options,
    )

    return None if result == undefined else result


def resolve_template_recur(
    start_path: Path,
    resource: Resource,
    template: Any,
    context: Context,
    fp_options: Optional[FPOptions] = None,
) -> Any:
    result = iterate_node(
        start_path,
        {root_node_key: template},
        context or {},
        lambda path, node, context: process_node(path, resource, node, context, fp_options),
    )
    if isinstance(result, dict):
        return result.get(root_node_key, undefined)

    return undefined


def process_node(
    path: Path,
    resource: Resource,
    node: Node,
    context: Context,
    fp_options: Optional[FPOptions],
) -> tuple[Node, Context]:
    if isinstance(node, dict):
        new_node, new_context = process_assign_block(path, resource, node, context, fp_options)

        matchers: list[Matcher] = [
            process_context_block,
            process_merge_block,
            process_for_block,
            process_if_block,
        ]

        for matcher in matchers:
            result = matcher(path, resource, new_node, new_context, fp_options)
            if result:
                return result["node"], new_context

        return new_node, new_context

    if isinstance(node, str):
        return process_template_string(path, resource, node, context, fp_options), context

    return node, context


def iterate_node(start_path: Path, node: Node, context: Context, transform: Transformer) -> Node:
    if isinstance(node, list):
        # Arrays are flattened and undefined values are removed here
        cleaned_array = flatten(
            [
                value
                for value in [
                    iterate_node(
                        [*start_path, index],
                        *transform([*start_path, index], value, context),
                        transform,
                    )
                    for index, value in enumerate(node)
                ]
                if value is not undefined
            ]
        )

        return cleaned_array or undefined
    if isinstance(node, dict):
        # undefined values are removed from dicts, but nulls are preserved
        cleaned_object = {
            key: value
            for key, value in {
                key: iterate_node(
                    [*start_path, key],
                    *transform([*start_path, key], value, context),
                    transform,
                )
                for key, value in node.items()
            }.items()
            if value is not undefined
        }

        return cleaned_object or undefined

    return transform(start_path, node, context)[0]


def process_template_string(
    path: Path,
    resource: Resource,
    node: StrNode,
    context: Context,
    fp_options: Optional[FPOptions],
) -> Any:
    array_template_regexp = re.compile(r"{\[\s*([\s\S]+?)\s*\]}")

    match = array_template_regexp.match(node)
    if match:
        expr = match.group(1)
        return evaluate_expression(path, resource, expr, context, fp_options)

    single_template_regexp = re.compile(r"{{\+?\s*([\s\S]+?)\s*\+?}}")
    result = node

    for match in single_template_regexp.finditer(node):
        expr = match.group(1)
        try:
            replacement = evaluate_expression(path, resource, expr, context, fp_options)[0]
        except IndexError:
            return None if match.group(0).startswith("{{+") else undefined
        if match.group(0) == node:
            return replacement
        result = result.replace(match.group(0), str(replacement))

    return result


def process_context_block(
    path: Path,
    resource: Resource,
    node: DictNode,
    context: Context,
    fp_options: Optional[FPOptions],
) -> Optional[MatcherResult]:
    keys = list(node.keys())
    context_regexp = re.compile(r"{{\s*(.+?)\s*}}")
    context_key = next((k for k in keys if context_regexp.match(k)), None)

    if context_key:
        matches = context_regexp.match(context_key)
        expr = matches.group(1) if matches else ""

        if len(keys) > 1:
            raise FPMLValidationError("Context block must be presented as single key", path)

        answers = evaluate_expression(path, resource, expr, context, fp_options)
        return {
            "node": [
                resolve_template_recur(path, answer, node[context_key], context, fp_options)
                for answer in answers
            ]
        }

    return None


def process_for_block(
    path: Path,
    resource: Resource,
    node: DictNode,
    context: Context,
    fp_options: Optional[FPOptions],
) -> Optional[MatcherResult]:
    keys = list(node.keys())

    for_regexp = re.compile(r"{%\s*for\s+(?:(\w+?)\s*,\s*)?(\w+?)\s+in\s+(.+?)\s*%}")
    for_key = next((k for k in keys if for_regexp.match(k)), None)

    if for_key:
        matches = for_regexp.match(for_key)
        if not matches:
            return None

        has_index_key = len(matches.groups()) == 3  # noqa: PLR2004
        index_key = cast(str, matches.group(1)) if has_index_key else None
        item_key = cast(str, matches.group(2) if has_index_key else matches.group(1))
        expr = matches.group(3) if has_index_key else matches.group(2)

        if len(keys) > 1:
            raise FPMLValidationError("For block must be presented as single key", path)

        answers = evaluate_expression(path, resource, expr, context, fp_options)

        return {
            "node": [
                resolve_template_recur(
                    path,
                    resource,
                    node[for_key],
                    {
                        **context,
                        item_key: answer,
                        **({index_key: index} if index_key else {}),
                    },
                    fp_options,
                )
                for index, answer in enumerate(answers)
            ]
        }

    return None


def process_if_block(
    path: Path,
    resource: Resource,
    node: dict[str, Any],
    context: Context,
    fp_options: Optional[FPOptions],
) -> Optional[MatcherResult]:
    keys = list(node.keys())

    if_regexp = re.compile(r"{%\s*if\s+(.+?)\s*%}")
    else_regexp = re.compile(r"{%\s*else\s*%}")

    if_keys = [k for k in keys if if_regexp.match(k)]
    if len(if_keys) > 1:
        raise FPMLValidationError("If block must be presented once", path)
    if_key = if_keys[0] if if_keys else None

    else_keys = [k for k in keys if else_regexp.match(k)]
    if len(else_keys) > 1:
        raise FPMLValidationError("Else block must be presented once", path)
    else_key = else_keys[0] if else_keys else None

    if else_key and not if_key:
        raise FPMLValidationError(
            "Else block must be presented only when if block is presented", path
        )

    if not if_key:
        return None

    matches = if_regexp.match(if_key)
    expr = matches.group(1) if matches else ""

    answer = evaluate_expression(path, resource, f"iif({expr}, true, false)", context, fp_options)[
        0
    ]

    new_node = (
        resolve_template_recur(path, resource, node[if_key], context, fp_options)
        if answer
        else (
            resolve_template_recur(path, resource, node[else_key], context, fp_options)
            if else_key
            else undefined
        )
    )

    is_merge_behavior = len(keys) != (2 if else_key else 1)
    if is_merge_behavior:
        if not isinstance(new_node, dict) and new_node is not None and new_node is not undefined:
            raise FPMLValidationError(
                "If/else block must return object for implicit merge into existing node",
                path,
            )

        return {
            "node": {
                **omit_key(omit_key(node, if_key), else_key),
                **(new_node if isinstance(new_node, dict) else {}),
            }
        }

    return {"node": new_node}


def process_merge_block(
    path: Path,
    resource: Resource,
    node: DictNode,
    context: Context,
    fp_options: Optional[FPOptions],
) -> Optional[MatcherResult]:
    merge_key = next((k for k in node if re.match(r"{%\s*merge\s*%}", k)), None)
    if merge_key:
        merged_node = omit_key(node, merge_key)
        values = node[merge_key] if isinstance(node[merge_key], list) else [node[merge_key]]
        for value in values:
            result = resolve_template_recur(path, resource, value, context, fp_options)
            if not isinstance(result, dict) and result is not None and result is not undefined:
                raise FPMLValidationError("Merge block must contain object", path)
            if result is not undefined and result is not None:
                merged_node.update(result)
        return {"node": merged_node}
    return None


def process_assign_block(
    path: Path,
    resource: Resource,
    node: DictNode,
    context: Context,
    fp_options: Optional[FPOptions],
) -> tuple[DictNode, Context]:
    extended_context = context.copy()
    assign_key = next((k for k in node if re.match(r"{%\s*assign\s*%}", k)), None)
    if assign_key:
        # TODO: re-write without copy-pasting
        if isinstance(node[assign_key], list):
            for obj in node[assign_key]:
                if len(obj) != 1:
                    raise FPMLValidationError(
                        "Assign block must accept only one key per object", path
                    )
                result = {
                    key: resolve_template_recur(
                        [*path, key], resource, obj_value, extended_context, fp_options
                    )
                    for key, obj_value in obj.items()
                }
                key = next(iter(obj.keys()))
                extended_context.update({key: result[key] if result[key] != undefined else None})
        elif isinstance(node[assign_key], dict) and len(node[assign_key]) == 1:
            obj = node[assign_key]
            result = {
                key: resolve_template_recur(
                    [*path, key], resource, obj_value, extended_context, fp_options
                )
                for key, obj_value in obj.items()
            }
            key = next(iter(obj.keys()))
            extended_context.update({key: result[key] if result[key] != undefined else None})
        else:
            raise FPMLValidationError("Assign block must accept array or object", path)
        return omit_key(node, assign_key), extended_context
    return node, context


def evaluate_expression(
    path: Path,
    resource: Resource,
    expression: str,
    context: Context,
    fp_options: Optional[FPOptions] = None,
) -> list[Any]:
    fp_options_copy = cast(dict, fp_options or {}).copy()
    model = fp_options_copy.pop("model", None)

    try:
        return evaluate(resource, expression, context, model, options=fp_options_copy)
    except Exception as exc:
        raise FPMLValidationError(f"Cannot evaluate '{expression}': {exc}", path) from exc
