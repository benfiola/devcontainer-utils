# devcontainer-utils

This repository hosts several subprojects intended to help create and maintain [devcontainer](https://containers.dev/) configurations for projects.

Primarily, this project exposes a _dc-utils_ CLI that can auto-generate devcontainer configurations.

## _dc-utils_

Install [dc-utils](./cli) with the following command:

```shell
pip install git+https://github.com/benfiola/devcontainer-utils#subdirectory=cli
```

Using the _dc-utils_ CLI is simple. When you run the following command:

```shell
dc-utils generate [workspace_folder] [workspace_folder...] [--output-path <output_path>]
```

_dc-utils_ will recursively search each workspace folder and discover projects (and the languages used by them). It will then generate a _.devcontainer_ folder at _<output_path>_ containing:

- A _Dockerfile_ that installs the tools for all discovered languages.
- A _docker-compose.yaml_ file that will mount all workspace folders into the docker container
- A _post-create.sh_ script (run after Docker image creation) that configures each discovered project with the discovered tool
- A _devcontainer.json_ file that glues the above together, installs recommended extensions per discovered language and configures them
- A _devcontainer.code-workspace_ file that defines a vscode workspace containing all workspace folders

Ideally, you should be able to open a folder containing this _.devcontainer_ folder, re-open the folder in a devcontainer, and everything should just work, leaving you with a reasonable development environment.

As an example, _dc-utils_ was run against this repo - and you can see the generated output in the [.devcontainer](./.devcontainer) folder.

You can read more about VSCode's devcontainers integration by reading their [docs](https://code.visualstudio.com/docs/devcontainers/containers).

## Base Image

Rather than use specialized docker images that provide a single pre-installed tool, we use a [custom base image](./base-image) that installs [asdf](https://asdf-vm.com/) along with common build dependencies. This allows us to more easily generate dynamic Dockerfiles when _dc-utils_ is run.

Core to the base image is the `dc-utils-install-tool` command. This command adds the required asdf plugin, installs a tool version using that plugin, and then sets that tool as the current (global) version for the image.

Here's an example image that installs nodejs-16.20.2 and python-3.10.13.

```
FROM docker.io/benfiola/devcontainer-utils:latest
dc-utils-install-tool nodejs 16.20.2
dc-utils-install-tool python 3.10.3
```

The resulting docker image will then have nodejs 16.20.2 and python 3.10.3 on the PATH.

There's a few additional commands included in the base image:

* `dc-utils-version` prints the current version of the image
* `dc-utils-finalize` is used to signal that post-create commands have finished running
* `dc-utils-is-finalized` is used to determine whether or not post-create commands have finished running.

## VSCode Extension

VSCode won't automatically open workspaces when reopening a project in a devcontainer. Because we generate a workspace via _dc-utils_, we smooth out this process (and save a click) by using a [custom vscode extension](./vscode-ext/). This extension will open the generated _code-workspace_ file when vscode is initially launched in a devcontainer (after the devcontainer is fully built).  This extension is automatically included for any template rendered by _dc-utils_.

## TODO

- Add yarn support
- Add 'sidecars' (e.g., redis/postgres/mysql)
