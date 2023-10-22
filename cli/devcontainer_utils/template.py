from pathlib import Path
from typing import Literal, Union

import copier
from devcontainer_utils.config import Config
from devcontainer_utils.project import ProjectType

template_path = Path(__file__).parent.joinpath("template_")


def get_vscode_extensions(config: Config) -> list[str]:
    extension_map = {
        ProjectType.Python: [
            "ms-python.black-formatter",
            "ms-python.isort",
            "ms-python.python",
            "ms-python.vscode-pylance",
            "njpwerner.autodocstring",
        ],
        ProjectType.NodeJS: [],
    }

    extensions = set(
        [
            "/workspace/.devcontainer/devcontainer-utils.vsix",
            "esbenp.prettier-vscode",
            "rohit-gohri.format-code-action",
            "usernamehw.errorlens",
        ]
    )
    for workspace in config.workspaces:
        for project in workspace.projects:
            extensions.update(extension_map.get(project.type, []))

    return list(extensions)


def get_vscode_settings(config: Config):
    extensions = get_vscode_extensions(config)

    settings = {}

    python = "ms-python.python"
    prettier = "esbenp.prettier-vscode"
    black = "ms-python.black-formatter"
    isort = "ms-python.isort"
    format_document = "rohit-gohri.format-code-action"

    formatter_map = {
        prettier: [
            "dockercompose",
            "javascript",
            "javascriptreact",
            "json",
            "jsonc",
            "markdown",
            "typescript",
            "typescriptreact",
            "yaml",
        ],
        black: ["python"],
    }

    for formatter, syntaxes in formatter_map.items():
        for syntax in syntaxes:
            sub_key = f"[{syntax}]"
            sub_settings = settings.setdefault(sub_key, {})
            sub_settings["editor.defaultFormatter"] = formatter
            code_actions = sub_settings["editor.codeActionsOnSave"] = []

            # NOTE: prettier currently auto-deletes unused imports when 'source.organizeImports' is used.
            if formatter == prettier:
                code_actions.append("source.sortImports")
            else:
                code_actions.append("source.organizeImports")

            # NOTE: 'source.formatDocument' is provided by an extension
            if format_document in extensions:
                code_actions.append("source.formatDocument")

    if isort in extensions:
        if black in extensions:
            settings["isort.args"] = ["--profile", "black"]

    if python in extensions:
        settings[
            "python.defaultInterpreterPath"
        ] = "/devcontainer-utils/asdf/shims/python"

    return settings


def get_devcontainer_code_workspace(config: Config) -> dict:
    folders = [{"path": "/workspace/.devcontainer", "name": ".devcontainer"}]
    for workspace in config.workspaces:
        folder = {
            "path": str(workspace.get_devcontainer_path()),
            "name": workspace.name,
        }
        folders.append(folder)

    return {"folders": sorted(folders, key=lambda f: f["name"])}


def get_devcontainer_json(config: Config) -> dict:
    return {
        "name": "devcontainer",
        "dockerComposeFile": ["docker-compose.yaml"],
        "service": "devcontainer",
        "workspaceFolder": "/workspace",
        "postCreateCommand": "/workspace/.devcontainer/post-create.sh",
        "customizations": {
            "vscode": {
                "extensions": sorted(get_vscode_extensions(config)),
                "settings": get_vscode_settings(config),
            }
        },
    }


def get_docker_compose_yaml(config: Config) -> dict:
    devcontainer_volume = (
        f"{config.output_path}/.devcontainer:/workspace/.devcontainer:cached"
    )
    volumes = [devcontainer_volume]
    for workspace in config.workspaces:
        volume = f"{workspace.directory}:/workspace/{workspace.name}:cached"
        volumes.append(volume)

    return {
        "version": "3",
        "services": {
            "devcontainer": {
                "build": {"dockerfile": "Dockerfile", "context": "."},
                "volumes": sorted(volumes),
                "command": "/bin/sh -c 'while sleep 1000; do :; done'",
            }
        },
    }


def get_dockerfile(config: Config) -> str:
    lines = ["FROM docker.io/benfiola/devcontainer-utils:latest"]

    tool_install_commands = set()
    for workspace in config.workspaces:
        for project in workspace.projects:
            command = f"RUN {project.get_tool_install_command()}"
            tool_install_commands.add(command)
    lines.extend(sorted(tool_install_commands))

    return "\n".join(lines)


def get_post_create_sh(config: Config) -> str:
    lines = ["#!/bin/sh", "set -e"]

    project_setup_commands = []
    for workspace in config.workspaces:
        for project in workspace.projects:
            project_path = workspace.get_devcontainer_path(project.directory)
            project_setup_command = (
                f"cd {project_path} && {{ {project.get_project_setup_command()}; }}"
            )
            project_setup_commands.append(project_setup_command)
    lines.extend(sorted(project_setup_commands))

    return "\n".join(lines)


def render_template(config: Config):
    data = {
        "devcontainer_code_workspace": get_devcontainer_code_workspace(config),
        "devcontainer_json": get_devcontainer_json(config),
        "docker_compose_yaml": get_docker_compose_yaml(config),
        "dockerfile": get_dockerfile(config),
        "post_create_sh": get_post_create_sh(config),
    }
    copier.run_copy(str(template_path), config.output_path, data=data)
