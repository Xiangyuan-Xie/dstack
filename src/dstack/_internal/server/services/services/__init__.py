"""
Application logic related to `type: service` runs.
"""

import uuid
from dataclasses import dataclass
from functools import partial
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.errors import (
    GatewayError,
    ResourceNotExistsError,
    ServerClientError,
    SSHError,
)
from dstack._internal.core.models.configurations import (
    RateLimit,
    SERVICE_HTTPS_DEFAULT,
    EntityReference,
    ServiceConfiguration,
)
from dstack._internal.core.models.gateways import GatewayConfiguration, GatewayStatus
from dstack._internal.core.models.routers import (
    AnyServiceRouterConfig,
    RouterType,
    SGLangServiceRouterConfig,
)
from dstack._internal.core.models.runs import RunSpec, ServiceModelSpec, ServiceSpec
from dstack._internal.core.models.services import OpenAIChatModel
from dstack._internal.proxy.gateway.const import SERVICE_ALREADY_REGISTERED_ERROR_TEMPLATE
from dstack._internal.server import settings
from dstack._internal.server.db import get_session_ctx
from dstack._internal.server.models import GatewayModel, RunModel
from dstack._internal.server.services import events
from dstack._internal.server.services.gateways import (
    get_gateway_configuration,
    get_or_add_gateway_connection,
    get_project_default_gateway_model,
    get_project_gateway_model_by_reference,
)
from dstack._internal.server.services.logging import fmt
from dstack._internal.server.services.services.options import get_service_options
from dstack._internal.utils.common import interpolate_gateway_domain
from dstack._internal.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class GatewayServiceRegistration:
    run_id: uuid.UUID
    gateway_id: uuid.UUID
    project_name: str
    run_name: str
    domain: str
    service_spec: ServiceSpec
    service_https: bool
    gateway_https: bool
    auth: bool
    client_max_body_size: int
    rate_limits: list[RateLimit]
    ssh_private_key: str
    has_router_replica: bool
    router: Optional[AnyServiceRouterConfig]


async def prepare_service_registration(
    session: AsyncSession, run_model: RunModel, run_spec: RunSpec
) -> Optional[GatewayServiceRegistration]:
    assert isinstance(run_spec.configuration, ServiceConfiguration)

    if isinstance(run_spec.configuration.gateway, EntityReference) or isinstance(
        run_spec.configuration.gateway, str
    ):
        gateway_reference = EntityReference.parse(run_spec.configuration.gateway)
        gateway = await get_project_gateway_model_by_reference(
            session=session,
            project=run_model.project,
            ref=gateway_reference,
            load_gateway_compute=True,
            load_backend_type=True,
        )
        if gateway is None:
            raise ResourceNotExistsError(
                f"Gateway {gateway_reference.format()} does not exist"
                f" in project {run_model.project.name}"
            )
        if gateway.to_be_deleted:
            raise ResourceNotExistsError(
                f"Gateway {gateway_reference.format()} was marked for deletion"
            )
    elif run_spec.configuration.gateway == False:
        gateway = None
    else:
        gateway = await get_project_default_gateway_model(
            session=session,
            project=run_model.project,
            load_gateway_compute=True,
            load_backend_type=True,
        )
        if gateway is None and run_spec.configuration.gateway == True:
            raise ResourceNotExistsError(
                "The service requires a gateway, but there is no default gateway in the project"
            )

    if gateway is not None:
        registration = _prepare_gateway_service_registration(run_model, run_spec, gateway)
        run_model.gateway = gateway
        service_spec = registration.service_spec
    elif not settings.FORBID_SERVICES_WITHOUT_GATEWAY:
        service_spec = _register_service_in_server(run_model, run_spec)
        registration = None
    else:
        raise ResourceNotExistsError(
            "This dstack-server installation forbids services without a gateway."
            " Please configure a gateway."
        )
    run_model.service_spec = service_spec.json()
    return registration


async def register_service(session: AsyncSession, run_model: RunModel, run_spec: RunSpec):
    registration = await prepare_service_registration(session, run_model, run_spec)
    if registration is not None:
        await register_service_in_gateway(registration)


async def register_service_in_gateway(registration: GatewayServiceRegistration) -> None:
    async with get_session_ctx() as session:
        gateway = await session.get(GatewayModel, registration.gateway_id)
        if gateway is None:
            raise ResourceNotExistsError("Gateway no longer exists")
        _, conn = await get_or_add_gateway_connection(session, registration.gateway_id)

    try:
        logger.debug(
            "run %s/%s: registering service as %s",
            registration.project_name,
            registration.run_name,
            registration.service_spec.url,
        )
        async with conn.client() as client:
            do_register = partial(
                client.register_service,
                project=registration.project_name,
                run_name=registration.run_name,
                domain=registration.domain,
                service_https=registration.service_https,
                gateway_https=registration.gateway_https,
                auth=registration.auth,
                client_max_body_size=registration.client_max_body_size,
                options=registration.service_spec.options,
                rate_limits=registration.rate_limits,
                ssh_private_key=registration.ssh_private_key,
                has_router_replica=registration.has_router_replica,
                router=registration.router,
            )
            try:
                await do_register()
            except GatewayError as e:
                if e.msg == SERVICE_ALREADY_REGISTERED_ERROR_TEMPLATE.format(
                    ref=f"{registration.project_name}/{registration.run_name}"
                ):
                    # Happens if there was a communication issue with the gateway when last unregistering
                    logger.warning(
                        "Service %s/%s is dangling on gateway %s, unregistering and re-registering",
                        registration.project_name,
                        registration.run_name,
                        gateway.name,
                    )
                    await client.unregister_service(
                        project=registration.project_name,
                        run_name=registration.run_name,
                    )
                    await do_register()
                else:
                    raise
    except SSHError:
        raise ServerClientError("Gateway tunnel is not working")
    except httpx.RequestError as e:
        logger.debug("Gateway request failed", exc_info=True)
        raise GatewayError(f"Gateway is not working: {e!r}")

    async with get_session_ctx() as session:
        run_model = await session.get(RunModel, registration.run_id)
        gateway = await session.get(GatewayModel, registration.gateway_id)
        targets = []
        if run_model is not None:
            targets.append(events.Target.from_model(run_model))
        if gateway is not None:
            targets.append(events.Target.from_model(gateway))
        events.emit(
            session,
            "Service registered in gateway",
            actor=events.SystemActor(),
            targets=targets,
        )


def _prepare_gateway_service_registration(
    run_model: RunModel, run_spec: RunSpec, gateway: GatewayModel
) -> GatewayServiceRegistration:
    assert run_spec.configuration.type == "service"

    if gateway.gateway_compute is None:
        raise ServerClientError("Gateway has no instance associated with it")

    if gateway.status != GatewayStatus.RUNNING:
        raise ServerClientError("Gateway status is not running")

    if gateway.forbid_new_services:
        raise ServerClientError("Gateway does not accept new services")

    gateway_configuration = get_gateway_configuration(gateway)

    has_replica_group_router = any(
        g.router is not None for g in run_spec.configuration.replica_groups
    )
    if has_replica_group_router and _gateway_has_sglang_router(gateway_configuration):
        raise ServerClientError(
            "A replica-group `router:` cannot be used with a gateway that has router configuration."
        )

    # Check: service specifies SGLang router but gateway does not have it
    service_router = run_spec.configuration.router
    service_wants_sglang = service_router is not None and isinstance(
        service_router, SGLangServiceRouterConfig
    )
    if service_wants_sglang and not _gateway_has_sglang_router(gateway_configuration):
        raise ServerClientError(
            "Service requires gateway with SGLang router but gateway "
            f"'{gateway.name}' does not have the SGLang router configured."
        )

    configure_service_https = _should_configure_service_https_on_gateway(
        run_spec, gateway_configuration
    )
    show_service_https = _should_show_service_https(run_spec, gateway_configuration)
    service_protocol = "https" if show_service_https else "http"

    if (
        not show_service_https
        and gateway_configuration.certificate is not None
        and gateway_configuration.certificate.type == "acm"
    ):
        # SSL termination is done globally at load balancer so cannot runs only some services via http.
        raise ServerClientError(
            "Cannot run HTTP service on gateway with ACM certificates configured"
        )

    if show_service_https and gateway_configuration.certificate is None:
        raise ServerClientError(
            "Cannot run HTTPS service on gateway with no SSL certificates configured"
        )

    router = _build_service_router_config(gateway_configuration, run_spec.configuration)

    gateway_https = _get_gateway_https(gateway_configuration)
    gateway_protocol = "https" if gateway_https else "http"

    wildcard_domain = gateway.wildcard_domain.lstrip("*.") if gateway.wildcard_domain else None
    if wildcard_domain is None:
        raise ServerClientError("Domain is required for gateway")
    wildcard_domain = interpolate_gateway_domain(
        domain=wildcard_domain,
        run_project_name=run_model.project.name,
        exception_type=GatewayError,
    )
    service_url = f"{service_protocol}://{run_model.run_name}.{wildcard_domain}"
    if isinstance(run_spec.configuration.model, OpenAIChatModel):
        model_url = service_url + run_spec.configuration.model.prefix
    else:
        model_url = f"{gateway_protocol}://gateway.{wildcard_domain}"
    service_spec = _get_service_spec(
        configuration=run_spec.configuration,
        service_url=service_url,
        model_url=model_url,
    )

    domain = service_spec.get_domain()
    assert domain is not None

    logger.debug(
        "%s: prepared gateway service registration as %s",
        fmt(run_model),
        service_spec.url,
    )
    return GatewayServiceRegistration(
        run_id=run_model.id,
        gateway_id=gateway.id,
        project_name=run_model.project.name,
        run_name=run_model.run_name,
        domain=domain,
        service_spec=service_spec,
        service_https=configure_service_https,
        gateway_https=gateway_https,
        auth=run_spec.configuration.auth,
        client_max_body_size=settings.DEFAULT_SERVICE_CLIENT_MAX_BODY_SIZE,
        rate_limits=list(run_spec.configuration.rate_limits),
        ssh_private_key=run_model.project.ssh_private_key,
        has_router_replica=has_replica_group_router,
        router=router,
    )


def _register_service_in_server(run_model: RunModel, run_spec: RunSpec) -> ServiceSpec:
    assert run_spec.configuration.type == "service"
    if (
        run_spec.configuration.router is not None
        and run_spec.configuration.router.type == RouterType.SGLANG
    ):
        raise ServerClientError(
            "Service with SGLang router configuration requires a gateway. "
            "Please configure a gateway with the SGLang router enabled."
        )
    if run_spec.configuration.https not in (
        None,
        "auto",
        True,  # Default set by pre-0.20.12 clients. TODO(0.21.0?): forbid True too.
    ):
        raise ServerClientError(
            f"Setting `https: {run_spec.configuration.https}` is not allowed without a gateway."
            " Please configure a gateway or remove the `https` property from the service configuration"
        )
    # Check if any group has autoscaling (min != max)
    has_autoscaling = any(
        group.count.min != group.count.max for group in run_spec.configuration.replica_groups
    )
    if has_autoscaling:
        raise ServerClientError(
            "Auto-scaling is not supported when running services without a gateway."
            " Please configure a gateway or set `replicas` to a fixed value in the service configuration"
        )
    if run_spec.configuration.rate_limits:
        raise ServerClientError(
            "Rate limits are not supported when running services without a gateway."
            " Please configure a gateway or remove `rate_limits` from the service configuration"
        )
    service_url = f"/proxy/services/{run_model.project.name}/{run_model.run_name}/"
    if isinstance(run_spec.configuration.model, OpenAIChatModel):
        model_url = service_url.rstrip("/") + run_spec.configuration.model.prefix
    else:
        model_url = f"/proxy/models/{run_model.project.name}/"
    return _get_service_spec(
        configuration=run_spec.configuration,
        service_url=service_url,
        model_url=model_url,
    )


def _gateway_has_sglang_router(config: GatewayConfiguration) -> bool:
    return config.router is not None and config.router.type == RouterType.SGLANG.value


def _build_service_router_config(
    gateway_configuration: GatewayConfiguration,
    service_configuration: ServiceConfiguration,
) -> Optional[AnyServiceRouterConfig]:
    """
    Build router config from gateway (type, policy) + service (pd_disaggregation, policy override).
    Service's policy overrides gateway's if present. Keeps backward compat: SGLang enabled
    automatically when gateway has it configured.
    """
    if not _gateway_has_sglang_router(gateway_configuration):
        return None

    gateway_router = gateway_configuration.router
    assert gateway_router is not None  # ensured by _gateway_has_sglang_router
    router_type = gateway_router.type
    policy = gateway_router.policy

    service_router = service_configuration.router
    if service_router is not None and isinstance(service_router, SGLangServiceRouterConfig):
        policy = service_router.policy
        pd_disaggregation = service_router.pd_disaggregation
    else:
        pd_disaggregation = False

    return SGLangServiceRouterConfig(
        type=router_type,
        policy=policy,
        pd_disaggregation=pd_disaggregation,
    )


def _get_service_spec(
    configuration: ServiceConfiguration, service_url: str, model_url: str
) -> ServiceSpec:
    service_spec = ServiceSpec(url=service_url)
    if configuration.model is not None:
        service_spec.model = ServiceModelSpec(
            name=configuration.model.name,
            base_url=model_url,
            type=configuration.model.type,
        )
        service_spec.options = get_service_options(configuration)
    return service_spec


def _should_configure_service_https_on_gateway(
    run_spec: RunSpec, configuration: GatewayConfiguration
) -> bool:
    """
    Returns `True` if the gateway needs to serve the service with HTTPS.
    May be `False` for HTTPS services, e.g. SSL termination is done on a load balancer.
    """
    assert run_spec.configuration.type == "service"
    https = run_spec.configuration.https
    if https is None:
        https = SERVICE_HTTPS_DEFAULT
    if https == "auto":
        if configuration.certificate is None:
            return False
        if configuration.certificate.type == "acm":
            return False
        return True
    if not https:
        return False
    if configuration.certificate is not None and configuration.certificate.type == "acm":
        return False
    return True


def _should_show_service_https(run_spec: RunSpec, configuration: GatewayConfiguration) -> bool:
    """
    Returns `True` if the service needs to be accessed via https://.
    """
    assert run_spec.configuration.type == "service"
    https = run_spec.configuration.https
    if https is None:
        https = SERVICE_HTTPS_DEFAULT
    if https == "auto":
        if configuration.certificate is None:
            return False
        return True
    return https


def _get_gateway_https(configuration: GatewayConfiguration) -> bool:
    if configuration.certificate is not None and configuration.certificate.type == "acm":
        return False
    if configuration.certificate is not None and configuration.certificate.type == "lets-encrypt":
        return True
    return False
