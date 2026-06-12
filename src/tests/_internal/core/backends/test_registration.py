import importlib
from types import ModuleType
from typing import get_args, get_origin

import pytest
from pydantic.fields import ModelField

from dstack._internal.core.backends.base.configurator import Configurator
from dstack._internal.core.backends.configurators import (
    _ConfiguratorImportSpec,
    _import_configurator_class,
    get_configurator,
    list_available_configurator_classes,
    list_available_backend_types,
)
from dstack._internal.core.backends.models import AnyBackendConfigWithCreds
from dstack._internal.core.models.backends.base import BackendType


def _backend_types_from_union(union_type) -> set[BackendType]:
    backend_types: set[BackendType] = set()
    for model in get_args(union_type):
        if get_origin(model) is not None:
            continue
        field: ModelField = model.__fields__["type"]
        if field.default is not None:
            backend_types.add(BackendType(field.default))
            continue
        for literal_value in get_args(field.outer_type_):
            backend_types.add(BackendType(literal_value))
    return backend_types


class TestConfiguratorImports:
    def test_allowed_optional_dependency_module_not_found_is_skipped(self, monkeypatch) -> None:
        def import_module(name: str):
            raise ModuleNotFoundError("No module named 'azure'", name="azure.core")

        monkeypatch.setattr(importlib, "import_module", import_module)

        assert (
            _import_configurator_class(
                _ConfiguratorImportSpec(
                    module="dstack._internal.core.backends.azure.configurator",
                    class_name="AzureConfigurator",
                    optional_dependency_prefixes=("azure",),
                )
            )
            is None
        )

    @pytest.mark.parametrize(
        ("exc", "match"),
        [
            (
                ModuleNotFoundError(
                    "No module named 'dstack._internal.core.backends.azure.configurator'",
                    name="dstack._internal.core.backends.azure.configurator",
                ),
                "dstack",
            ),
            (ImportError("cannot import name 'AzureCredential'"), "AzureCredential"),
        ],
    )
    def test_internal_import_errors_are_not_swallowed(self, monkeypatch, exc, match) -> None:
        def import_module(name: str):
            raise exc

        monkeypatch.setattr(importlib, "import_module", import_module)

        with pytest.raises(type(exc), match=match):
            _import_configurator_class(
                _ConfiguratorImportSpec(
                    module="dstack._internal.core.backends.azure.configurator",
                    class_name="AzureConfigurator",
                    optional_dependency_prefixes=("azure",),
                )
            )

    def test_missing_configurator_class_is_not_swallowed(self, monkeypatch) -> None:
        module = ModuleType("test_configurator_module")

        monkeypatch.setattr(importlib, "import_module", lambda name: module)

        with pytest.raises(AttributeError, match="MissingConfigurator"):
            _import_configurator_class(
                _ConfiguratorImportSpec(
                    module="test_configurator_module",
                    class_name="MissingConfigurator",
                    optional_dependency_prefixes=(),
                )
            )


def test_registered_configurator_types_are_unique_and_mapped() -> None:
    configurator_classes = list_available_configurator_classes()
    backend_types = [configurator_class.TYPE for configurator_class in configurator_classes]

    assert len(backend_types) == len(set(backend_types))
    assert list_available_backend_types() == backend_types
    for backend_type, configurator_class in zip(backend_types, configurator_classes):
        configurator = get_configurator(backend_type)
        assert isinstance(configurator, configurator_class)


def test_backend_config_union_matches_registered_configurators_with_explicit_exceptions() -> None:
    union_types = _backend_types_from_union(AnyBackendConfigWithCreds)
    registered_types = set(list_available_backend_types())

    # TensorDock remains in the config union for compatibility, but has no runtime configurator.
    # DSTACK config is internal dstack Sky/base-backend state, not a user-registered provider.
    assert union_types - registered_types == {BackendType.TENSORDOCK, BackendType.DSTACK}

    # DataCrunch remains a BackendType/configurator for backward compatibility, but is not
    # accepted through the user-facing backend config union.
    assert registered_types - union_types == {BackendType.DATACRUNCH}

    # AMD Developer Cloud intentionally shares the DigitalOcean-base config model.
    assert BackendType.AMDDEVCLOUD in union_types
    assert BackendType.AMDDEVCLOUD in registered_types
    assert get_configurator(BackendType.AMDDEVCLOUD) is not None
    assert issubclass(type(get_configurator(BackendType.AMDDEVCLOUD)), Configurator)
