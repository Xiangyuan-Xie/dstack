from pathlib import Path

import yaml

from dstack._internal.server.schemas.runner import TaskSubmitRequest


def test_task_submit_request_matches_shim_openapi_contract() -> None:
    schema_path = Path("runner/docs/shim.openapi.yaml")
    openapi = yaml.safe_load(schema_path.read_text())
    task_submit_schema = openapi["components"]["schemas"]["TaskSubmitRequest"]
    openapi_properties = set(task_submit_schema["properties"])
    openapi_required = set(task_submit_schema.get("required", []))
    serialized_fields = set(TaskSubmitRequest.__fields__)

    assert serialized_fields == openapi_properties
    assert openapi_required <= serialized_fields
