from fhirpathpy.models import models  # type: ignore
from fhirpathpy import evaluate as fhirpath

from fpml.core.extract import resolve_template, FPOptions

def answers(inputs, link_id):
    return fhirpath(
        inputs,
        f"repeat(item).where(linkId='{link_id}').answer.value",
        None,
        models["r4"],
    )


fp_options:FPOptions = {
    "userInvocationTable": {
        "answers": {
            "fn": answers,
            "arity": {0: [], 1: ["String"]},
        },
    },
    "model": models["r4"],
}


def test_attachment(load_yaml_fixture, load_json_fixture):
    context = load_json_fixture("attachment.context.json")
    template = load_yaml_fixture("attachment.template.yaml")
    expected_result = load_json_fixture("attachment.result.json")

    actual_result = resolve_template(
        context["QuestionnaireResponse"], template, context, fp_options, True
    )

    assert actual_result == expected_result
