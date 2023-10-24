from pathlib import Path

import copier
from devcontainer_utils.config import Config
from devcontainer_utils.project import ProjectType

template_path = Path(__file__).parent.joinpath("template_")


ext_black = "ms-python.black-formatter"
ext_isort = "ms-python.isort"
ext_perl = "richterger.perl"
ext_pls = "fractalboy.pls"
ext_python = "ms-python.python"
ext_pylance = "ms-python.vscode-pylance"
ext_autodocstring = "njpwerner.autodocstring"
ext_format_code_action = "rohit-gohri.format-code-action"
ext_prettier = "esbenp.prettier-vscode"
ext_errorlens = "usernamehw.errorlens"
ext_devcontainer_utils = "/workspace/.devcontainer/devcontainer-utils.vsix"


def get_vscode_extensions(config: Config) -> list[str]:
    extension_map = {
        ProjectType.NodeJS: [],
        ProjectType.Perl: [
            ext_perl,
            ext_pls
        ],
        ProjectType.Python: [
            ext_black,
            ext_isort,
            ext_python,
            ext_pylance,
            ext_autodocstring,
        ],
    }

    extensions = set(
        [
            ext_devcontainer_utils,
            ext_prettier,
            ext_format_code_action,
            ext_errorlens,
        ]
    )
    for workspace in config.workspaces:
        for project in workspace.projects:
            extensions.update(extension_map.get(project.type, []))

    return list(extensions)


def get_vscode_settings(config: Config):
    extensions = get_vscode_extensions(config)

    settings = {}

    formatter_map = {
        ext_prettier: [
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
        ext_black: ["python"],
    }

    for formatter, syntaxes in formatter_map.items():
        if formatter not in extensions:
            continue

        for syntax in syntaxes:
            sub_key = f"[{syntax}]"
            sub_settings = settings.setdefault(sub_key, {})
            sub_settings["editor.defaultFormatter"] = formatter
            code_actions = sub_settings["editor.codeActionsOnSave"] = []

            # NOTE: prettier currently auto-deletes unused imports when 'source.organizeImports' is used.
            if formatter == ext_prettier:
                code_actions.append("source.sortImports")
            else:
                code_actions.append("source.organizeImports")

            # NOTE: 'source.formatDocument' is provided by an extension
            if ext_format_code_action in extensions:
                code_actions.append("source.formatDocument")

    if ext_isort in extensions:
        if ext_black in extensions:
            settings["isort.args"] = ["--profile", "black"]

    if ext_python in extensions:
        settings[
            "python.defaultInterpreterPath"
        ] = "/devcontainer-utils/asdf/shims/python"

    if any([ext_perl in extensions, ext_pls in extensions]):
        inc_folders = []
        for workspace in config.workspaces:
            for project in workspace.projects:
                if project.type != ProjectType.Perl:
                    continue
                inc_folders.append(str(project.directory))
        
        perl_inc = sorted(inc_folders)
        perl_cmd = "/devcontainer-utils/asdf/shims/perl"

        if ext_perl in extensions:
            settings.update({
                "pls.syntax.perl": perl_cmd,
                "pls.inc": perl_inc,
            })
        
        if ext_pls in extensions:
            settings.update({            
                "perl.perlCmd": perl_cmd,
                "perl.perlInc": perl_inc
            })

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

    lines.append("dc-utils-finalize")

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
