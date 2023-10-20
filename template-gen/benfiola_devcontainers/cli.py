from pathlib import Path

import click

import benfiola_devcontainers.main


def main():
    cmd_main()


@click.command()
@click.argument("dest-path", type=Path)
def cmd_main(dest_path: Path):
    benfiola_devcontainers.main.generate(dest_path)


if __name__ == "__main__":
    main()
