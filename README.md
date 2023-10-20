# devcontainers

This repository hosts various files and tools used to help create and maintain [devcontainers](https://containers.dev/).

## Base Image

The [docker](./docker) folder contains files used to produce a base image that reduces some of the boilerplate required to produce devcontainer images. It installs and uses `asdf` to aid in the installation of various development toolchains.

`dc-asdf-install` is a command that adds the desired plugin, installs the specified tool version and sets that version as the global version within the image.

An example dockerfile might look like:

```Dockerfile
FROM docker.io/benfiola/devcontainers:latest
# install tools via asdf using `dc-asdf-install`
RUN dc-asdf-install python 3.9.18
```

Using this dockerfile might look like:

```
> docker run ... python --version
Python 3.9.18
```

## Template Generation

The [template-gen](./template-gen/) folder contains a python CLI that's capable of bootstrapping an existing project with all the necessary settings files to quickly get started with devcontainers within vscode.

The [template-gen/example](./template-gen/example) folder was created from the following invocation:

```shell
> benfiola-devcontainers-gen template-gen/example
🎤 project_name
   example
🎤 python_version
   3.10.13
🎤 nodejs_version
   16.20.2

Copying from template version None
    create  .
    create  .copier-answers.yml
    create  .devcontainer
    create  .devcontainer/docker-compose.yml
    create  .devcontainer/Dockerfile
    create  .devcontainer/devcontainer.json
    create  .devcontainer/post-create.sh
    create  .vscode
    create  .vscode/settings.json
```

You should be able to open the [template-gen/example](./template-gen/example/) folder within vscode - and should then be able to perform the `Reopen in Container` action without issue.

At a high-level:

- [.devcontainer/devcontainer.json](./template-gen/example/.devcontainer/devcontainer.json) contains the dev container metadata - this not only contains pointers to other necessary files, but also contains vscode-specific customizations (including desired extensions)
- [.devcontainer/Dockerfile](./template-gen/example/.devcontainer/Dockerfile) is the Dockerfile from which the dev container will be created
- [.devcontainer/post-create.sh](./template-gen/example/.devcontainer/post-create.sh) is a script run after the dev container has been created, and local source has been mounted into the container. This allows you to perform additional setup - like installing project dependencies, and applying migrations to local databases.
- [.devcontainer/docker-compose.yml](./template-gen/example/.devcontainer/docker-compose.yml) provides additional arguments to docker when creating the dev container - and additionally allows you to define auxillary containers (databases, redis) that will be started alongside the dev container
- [.vscode/settings.json](./template-gen/example/.vscode/settings.json) provides vscode-specific settings - often configuring details like extension settings (installed via `.devcontainer/devcontainer.json`) and tool locations (installed via `.devcontainer/Dockerfile`)
