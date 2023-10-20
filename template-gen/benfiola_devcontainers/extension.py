import jinja2.ext
import jinja2.runtime
from benfiola_devcontainers.main import (
    get_asdf_tool_versions,
    get_vscode_extensions,
    get_vscode_settings,
    str_clean,
)


class Context(jinja2.runtime.Context):
    def __init__(self, env: jinja2.Environment, parent: dict, *args, **kwargs):
        if "_copier_conf" in parent:
            extension = env.extensions[Extension.identifier]
            if not isinstance(extension, Extension):
                raise NotImplementedError(type(extension))
            extension.process_globals(parent)
        super().__init__(env, parent, *args, **kwargs)


class Extension(jinja2.ext.Extension):
    def __init__(self, environment):
        super().__init__(environment)
        self.environment.context_class = Context

    def process_globals(self, data: dict):
        keys = ["python_version", "nodejs_version"]
        for key in keys:
            data[key] = str_clean(data.get(key))

        data["asdf_tool_versions"] = get_asdf_tool_versions(
            nodejs_version=data["nodejs_version"], python_version=data["python_version"]
        )
        vscode_extensions = get_vscode_extensions(
            python=data.get("python_version") is not None
        )
        data["vscode_extensions"] = vscode_extensions
        data["vscode_settings"] = get_vscode_settings(vscode_extensions)
