from pathlib import Path
from typing import Iterable, Optional

import pydantic
from devcontainer_utils.terminal import Terminal
from devcontainer_utils.workspace import Workspace, create_workspace


class Config(pydantic.BaseModel):
    output_path: Path
    workspaces: list[Workspace]


def create_config(
    workspace_folders: Iterable[Path],
    output_path: Path,
    terminal: Optional[Terminal] = None,
) -> Config:
    output_path = output_path.resolve()

    workspaces = []
    for workspace_folder in workspace_folders:
        workspace = create_workspace(workspace_folder, terminal=terminal)
        workspaces.append(workspace)

    return Config(output_path=output_path, workspaces=workspaces)
