from pathlib import Path
from typing import Optional

import copier

template_path = Path(__file__).parent.joinpath("template")


def generate(dest_path: Path):
    copier.run_copy(str(template_path), str(dest_path), unsafe=True)


def str_clean(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if v == "":
        return None
    return v


def get_vscode_extensions(python: bool = False) -> list[str]:
    vscode_extensions = {
        "esbenp.prettier-vscode",
        "rohit-gohri.format-code-action",
        "usernamehw.errorlens",
    }
    if python:
        vscode_extensions.update(
            {
                "ms-python.black-formatter",
                "ms-python.isort",
                "ms-python.python",
                "ms-python.vscode-pylance",
                "njpwerner.autodocstring",
            }
        )

    vscode_extensions = list(vscode_extensions)
    vscode_extensions.sort()

    return vscode_extensions


def get_asdf_tool_versions(
    python_version: Optional[str], nodejs_version: Optional[str]
) -> list[tuple[str, str]]:
    plugin_map = {"python": python_version, "nodejs": nodejs_version}

    tool_versions = []
    for key, value in plugin_map.items():
        if value is None:
            continue
        tool_versions.append((key, value))

    tool_versions.sort(key=lambda tv: tv[0])

    return tool_versions


def get_vscode_settings(extensions: list[str]):
    settings = {}

    python = "ms-python.python"
    prettier = "esbenp.prettier-vscode"
    black = "ms-python.black-formatter"
    isort = "ms-python.isort"
    format_document = "rohit-gohri.format-code-action"

    formatter_map = {
        prettier: [
            "[dockercompose]",
            "[javascript]",
            "[javascriptreact]",
            "[json]",
            "[jsonc]",
            "[markdown]",
            "[typescript]",
            "[typescriptreact]",
            "[yaml]"
        ],
        black: ["[python]"],
    }
    for formatter, sub_keys in formatter_map.items():
        for sub_key in sub_keys:
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
        settings["python.defaultInterpreterPath"] = "/dc/asdf/shims/python"
    
    return settings
