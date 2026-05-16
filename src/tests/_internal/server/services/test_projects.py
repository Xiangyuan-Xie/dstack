from datetime import datetime, timezone
from unittest.mock import Mock
from uuid import uuid4

from dstack._internal.core.models.users import GlobalRole, ProjectRole
from dstack._internal.server.models import ProjectModel, UserModel
from dstack._internal.server.services import projects


class TestProjectModelToProject:
    def test_includes_current_user_project_role_without_members(self) -> None:
        owner = Mock(spec=UserModel)
        owner.id = uuid4()
        owner.name = "owner"
        owner.created_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
        owner.global_role = GlobalRole.USER
        owner.email = None
        owner.active = True
        owner.ssh_public_key = None
        owner.projects_quota = 1

        project_model = Mock(spec=ProjectModel)
        project_model.id = uuid4()
        project_model.name = "research"
        project_model.owner = owner
        project_model.created_at = datetime(2026, 5, 16, tzinfo=timezone.utc)
        project_model.backends = []
        project_model.members = []
        project_model.is_public = False
        project_model.templates_repo = None

        project = projects.project_model_to_project(
            project_model,
            include_backends=False,
            include_members=False,
            current_user_project_role=ProjectRole.MANAGER,
        )

        assert project.members == []
        assert project.current_user_project_role == ProjectRole.MANAGER
