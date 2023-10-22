from pathlib import Path
from typing import Optional

import click
from devcontainer_utils.config import create_config
from devcontainer_utils.template import render_template
from devcontainer_utils.terminal import Terminal


def main():
    grp_main()


@click.group()
def grp_main():
    pass


@grp_main.command("generate")
@click.argument("workspace_folders", type=Path, nargs=-1)
@click.option("--output_path", type=Path)
def cmd_generate(workspace_folders: tuple[Path], output_path: Optional[Path] = None):
    workspace_folders = workspace_folders or (Path.cwd(),)
    output_path = output_path or Path.cwd()

    terminal = Terminal(echo=click.echo, prompt=click.prompt)
    config = create_config(
        workspace_folders=workspace_folders, output_path=output_path, terminal=terminal
    )
    render_template(config)


if __name__ == "__main__":
    main()
