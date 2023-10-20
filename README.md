# devcontainers

This repository hosts various files and tools used to help create and maintain [devcontainers](https://containers.dev/).

## Base Image

The [docker](./docker) folder contains files used to produce a base image that reduces some of the boilerplate required to produce devcontainer images.  It installs and uses `asdf` to aid in the installation  of various development toolchains.

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
