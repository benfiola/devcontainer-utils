import typing
from enum import Enum
from pathlib import Path
from typing import Annotated, Literal, Optional, Type, TypeVar, Union

import pydantic
from devcontainer_utils.terminal import Terminal

unknown = "__unknown__"


class ProjectType(str, Enum):
    NodeJS = "nodejs"
    Perl = "perl"
    Python = "python"


SomeProject = TypeVar("SomeProject", bound="Project")


class ProjectBase(pydantic.BaseModel):
    directory: Path
    type: ProjectType

    @classmethod
    def get_type(cls) -> ProjectType:
        field = cls.model_fields["type"]
        annotation = field.annotation
        args = typing.get_args(annotation)
        return args[0]

    @classmethod
    def create_project(cls, directory: Path) -> "Project":
        raise NotImplementedError(cls)

    def get_project_setup_command(self) -> str:
        raise NotImplementedError(type(self))

    def get_tool_install_command(self) -> str:
        raise NotImplementedError(type(self))

    def prompt(self, terminal: Terminal):
        raise NotImplementedError(type(self))

    def finalize(self):
        raise NotImplementedError(type(self))


class NodeJS(ProjectBase):
    type: Literal[ProjectType.NodeJS] = ProjectType.NodeJS
    version: str

    @classmethod
    def create_project(cls, directory: Path) -> "NodeJS":
        package_json = directory.joinpath("package.json")
        if not package_json.exists():
            raise ValueError(directory)

        return cls(directory=directory, version=unknown)

    def get_project_setup_command(self) -> str:
        return "npm install ."

    def get_tool_install_command(self) -> str:
        return f"dc-utils-install-tool nodejs {self.version}"

    def prompt(self, terminal: Terminal):
        if self.version == unknown:
            self.version = terminal.prompt(f"Enter '{self.type.value}' version")

    def finalize(self):
        if self.version == unknown:
            raise ValueError("version is unknown")


class Perl(ProjectBase):
    type: Literal[ProjectType.Perl] = ProjectType.Perl
    version: str

    @classmethod
    def create_project(cls, directory: Path) -> "Perl":
        makefile_pl = directory.joinpath("Makefile.PL")
        if not makefile_pl.exists():
            raise ValueError(directory)

        return cls(directory=directory, version=unknown)

    def get_project_setup_command(self) -> str:
        return "PERL_MM_USE_DEFAULT=1 cpan App:cpanminus && cpanm --notest PLS Perl::LanguageServer && asdf reshim && cpanm --notest ."

    def get_tool_install_command(self) -> str:
        return f"dc-utils-install-tool perl {self.version}"

    def prompt(self, terminal: Terminal):
        if self.version == unknown:
            self.version = terminal.prompt(f"Enter '{self.type.value}' version")

    def finalize(self):
        if self.version == unknown:
            raise ValueError("version is unknown")


class Python(ProjectBase):
    type: Literal[ProjectType.Python] = ProjectType.Python
    version: str

    @classmethod
    def create_project(cls, directory: Path) -> "Python":
        pyproject_toml = directory.joinpath("pyproject.toml")
        setup_py = directory.joinpath("setup.py")
        if not pyproject_toml.exists() and not setup_py.exists():
            raise ValueError(directory)

        return cls(directory=directory, version=unknown)

    def get_project_setup_command(self) -> str:
        return "[ -f requirements.txt ] && pip install -r requirements.txt; pip install -e ."

    def get_tool_install_command(self) -> str:
        return f"dc-utils-install-tool python {self.version}"

    def prompt(self, terminal: Terminal):
        if self.version == unknown:
            self.version = terminal.prompt(f"Enter '{self.type.value}' version")

    def finalize(self):
        if self.version == unknown:
            raise ValueError("version is unknown")


Project = Annotated[Union[NodeJS, Perl, Python], pydantic.Field(discriminator="type")]


ProjectMap = dict[ProjectType, Type[ProjectBase]]
_project_map: ProjectMap = {lc.get_type(): lc for lc in ProjectBase.__subclasses__()}


def get_language_map() -> ProjectMap:
    global _project_map
    return _project_map


def set_project_map(project_map: ProjectMap):
    global _project_map
    _project_map = project_map


def find_projects(
    workspace_folder: Path, terminal: Optional[Terminal] = None
) -> list[Project]:
    search_paths = [workspace_folder]
    exclude_patterns = ["**/node_modules", "**/.git"]

    projects = []
    while search_paths:
        search_path = search_paths.pop()

        if not search_path.exists():
            continue
        if not search_path.is_dir():
            continue
        for exclude_pattern in exclude_patterns:
            if search_path.match(exclude_pattern):
                continue

        found = []
        language_classes = list(get_language_map().values())
        language_classes = sorted(language_classes, key=lambda lc: lc.get_type().value)
        for language_cls in language_classes:
            try:
                language = language_cls.create_project(search_path)
                if terminal:
                    terminal.echo(
                        f"Found {language_cls.get_type().value}' project: {search_path}"
                    )
                    language.prompt(terminal)
                language.finalize()

                found.append(language)
            except ValueError:
                continue
        if found:
            projects.extend(found)
            continue

        search_paths.extend(search_path.iterdir())

    return projects
