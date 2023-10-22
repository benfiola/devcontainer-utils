from pathlib import Path
from typing import Optional

import pydantic
from devcontainer_utils.project import Project, find_projects
from devcontainer_utils.terminal import Terminal


class Workspace(pydantic.BaseModel):
    directory: Path
    name: str
    projects: list[Project]

    def get_devcontainer_path(self, subpath: Optional[Path] = None) -> Path:
        subpath = subpath or self.directory
        relative_path = subpath.relative_to(self.directory)
        devcontainer_path = Path(f"/workspace/{self.name}").joinpath(relative_path)
        return devcontainer_path


def create_workspace(workspace_folder: Path, terminal: Optional[Terminal] = None):
    workspace_folder = workspace_folder.resolve()

    projects = find_projects(workspace_folder, terminal=terminal)

    return Workspace(
        directory=workspace_folder, name=workspace_folder.name, projects=projects
    )
