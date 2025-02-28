from fpml.core.extract import resolve_template


def test_complex_example_aidbox(load_yaml_fixture):
    context = load_yaml_fixture("complex-example.aidbox.context.yaml")
    template = load_yaml_fixture("complex-example.aidbox.template.yaml")
    expected_result = load_yaml_fixture("complex-example.aidbox.result.yaml")

    actual_result = resolve_template(context["QuestionnaireResponse"], template, context)

    assert actual_result == expected_result
