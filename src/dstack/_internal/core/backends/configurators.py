import importlib
from dataclasses import dataclass
from typing import List, Optional, Type, Union

from dstack._internal.core.backends.base.configurator import Configurator
from dstack._internal.core.models.backends.base import BackendType


@dataclass(frozen=True)
class _ConfiguratorImportSpec:
    module: str
    class_name: str
    optional_dependency_prefixes: tuple[str, ...] = ()


_CONFIGURATOR_IMPORT_SPECS: tuple[_ConfiguratorImportSpec, ...] = (
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.amddevcloud.configurator",
        "AMDDevCloudConfigurator",
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.aws.configurator",
        "AWSConfigurator",
        ("boto3", "botocore"),
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.azure.configurator",
        "AzureConfigurator",
        ("azure",),
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.cloudrift.configurator",
        "CloudRiftConfigurator",
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.crusoe.configurator",
        "CrusoeConfigurator",
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.cudo.configurator",
        "CudoConfigurator",
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.datacrunch.configurator",
        "DataCrunchConfigurator",
        ("verda",),
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.digitalocean.configurator",
        "DigitalOceanConfigurator",
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.gcp.configurator",
        "GCPConfigurator",
        ("google",),
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.hotaisle.configurator",
        "HotAisleConfigurator",
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.kubernetes.configurator",
        "KubernetesConfigurator",
        ("kubernetes",),
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.lambdalabs.configurator",
        "LambdaConfigurator",
        ("boto3", "botocore"),
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.nebius.configurator",
        "NebiusConfigurator",
        ("nebius",),
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.oci.configurator",
        "OCIConfigurator",
        ("oci",),
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.runpod.configurator",
        "RunpodConfigurator",
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.vastai.configurator",
        "VastAIConfigurator",
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.verda.configurator",
        "VerdaConfigurator",
        ("verda",),
    ),
    _ConfiguratorImportSpec(
        "dstack._internal.core.backends.vultr.configurator",
        "VultrConfigurator",
    ),
)


def _import_configurator_class(
    spec: _ConfiguratorImportSpec,
) -> Optional[Type[Configurator]]:
    try:
        module = importlib.import_module(spec.module)
    except ModuleNotFoundError as e:
        if _is_allowed_optional_dependency_error(e, spec.optional_dependency_prefixes):
            return None
        raise
    return getattr(module, spec.class_name)


def _is_allowed_optional_dependency_error(
    exc: ModuleNotFoundError, optional_dependency_prefixes: tuple[str, ...]
) -> bool:
    if exc.name is None or exc.name.startswith("dstack"):
        return False
    return any(
        exc.name == prefix or exc.name.startswith(f"{prefix}.")
        for prefix in optional_dependency_prefixes
    )


_CONFIGURATOR_CLASSES: List[Type[Configurator]] = [
    configurator_class
    for spec in _CONFIGURATOR_IMPORT_SPECS
    if (configurator_class := _import_configurator_class(spec)) is not None
]
_BACKEND_TYPE_TO_CONFIGURATOR_CLASS_MAP = {c.TYPE: c for c in _CONFIGURATOR_CLASSES}
_BACKEND_TYPES = [c.TYPE for c in _CONFIGURATOR_CLASSES]


def get_configurator(backend_type: Union[BackendType, str]) -> Optional[Configurator]:
    """
    Returns an available `Configurator` for a given `backend_type`.
    """
    backend_type = BackendType(backend_type)
    configurator_class = _BACKEND_TYPE_TO_CONFIGURATOR_CLASS_MAP.get(backend_type)
    if configurator_class is None:
        return None
    return configurator_class()


def list_available_backend_types() -> List[BackendType]:
    """
    Lists all backend types available on the server.
    """
    return _BACKEND_TYPES


def list_available_configurator_classes() -> List[type[Configurator]]:
    """
    Lists all backend configurator classes available on the server.
    """
    return _CONFIGURATOR_CLASSES


def register_configurator(configurator: Type[Configurator]):
    """
    A hook to for registering new configurators without importing them.
    Can be used to extend dstack functionality.
    """
    old_configurator = _BACKEND_TYPE_TO_CONFIGURATOR_CLASS_MAP.get(configurator.TYPE)
    if old_configurator is None:
        _BACKEND_TYPES.append(configurator.TYPE)
        _CONFIGURATOR_CLASSES.append(configurator)
    else:
        _CONFIGURATOR_CLASSES[_CONFIGURATOR_CLASSES.index(old_configurator)] = configurator
    _BACKEND_TYPE_TO_CONFIGURATOR_CLASS_MAP[configurator.TYPE] = configurator
