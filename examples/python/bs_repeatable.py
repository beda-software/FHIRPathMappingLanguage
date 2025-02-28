from fhirpathpy import dsl

from .resources import (
    Bundle,
    BundleEntry,
    BundleEntryRequest,
    ContactPoint,
    Patient,
    QuestionnaireResponse,
    QuestionnaireResponseItem,
)


def apply(s, qr):
    return s


def map(qr: QuestionnaireResponse) -> Bundle:
    return apply(
        Bundle(
            type="transaction",
            entry=[
                BundleEntry(
                    request=BundleEntryRequest(
                        url="/Patient/"
                        + dsl.QuestionnaireResponse.repeat("item")
                        .where(linkId="patientId")
                        .answer.valueString,
                        method="PATCH",
                    ),
                    resource=Patient(
                        telecom=list(
                            mapItem(c)
                            for c in dsl.QuestionnaireResponse.repeat("item").where(
                                linkId="phone-group"
                            )
                        )
                    ),
                )
            ],
        ),
        qr,
    )


def mapItem(qi: QuestionnaireResponseItem) -> ContactPoint:
    return apply(
        ContactPoint(
            use=dsl.where(linkId="phone-type").answer.valueString,
            value=dsl.where(linkId="phone-value").answer.valueString,
            system="phone",
        ),
        qi,
    )
