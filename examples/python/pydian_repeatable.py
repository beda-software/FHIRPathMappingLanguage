from pydian import get


def map(qr):
    return {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
            {
                "request": {
                    "url": "/Patient/" + get(qr, "item[?linkId == 'patientId'].answer.valueString"),
                    "method": "Patch",
                },
                "resource": {
                    "resourceType": "Patient",
                    "telecom": list(
                        {
                            "use": get(item, "[?linkId == 'phone-type'].answer.valueString"),
                            "value": get(item, "[?linkId == 'phone-number'].answer.valueString"),
                            "system": "phone",
                        }
                        for item in get(qr, "item[?linkId == 'phone-group']")
                    ),
                },
            }
        ],
    }
