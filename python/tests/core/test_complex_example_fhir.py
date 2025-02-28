from fhirpathpy.models import models  # type: ignore

from fpml.core.extract import resolve_template


def test_complex_example_fhir(load_yaml_fixture):
    context = load_yaml_fixture("complex-example.fhir.context.yaml")
    template = load_yaml_fixture("complex-example.fhir.template.yaml")
    expected_result = load_yaml_fixture("complex-example.fhir.result.yaml")

    actual_result = resolve_template(
        context["QuestionnaireResponse"], template, context, fp_options={"model": models["r4"]}
    )

    assert actual_result == expected_result
