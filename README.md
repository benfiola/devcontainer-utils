# devcontainer-utils

This repository hosts several subprojects intended to help create and maintain [devcontainer](https://containers.dev/) configurations for projects.

## Getting started

* Install the [benfiola.devcontainer-utils](https://marketplace.visualstudio.com/items?itemName=benfiola.devcontainer-utils) VSCode extension
* Create a _devcontainer-utils.json_ file in your current directory
* Right click the _devcontainer-utils.json_ file, then click _Generate Container_
* Right click on the _.devcontainer_ folder, then click _Build Container_
* Wait for the devcontainer to finish building, and the IDE to load the workspace.

## VSCode Extension

The primary mechanism to interact with devcontainer-utils is via the [vscode-extension](./vscode-ext).

This extension is hosted on the VSCode Extension Marketplace: [benfiola.devcontainer-utils](https://marketplace.visualstudio.com/items?itemName=benfiola.devcontainer-utils).

### Configuration

The _devcontainer-utils.json_ file provides the configuration used to generate the resulting devcontainer. 

The schema is defined using _zod_ at [vscode-ext/src/schema.ts](./vscode-ext/src/schema.ts). Additionally, when editing a _devcontainer-utils.json_ file within VSCode - this extension utilizes this schema to perform live validation of the file.

An example _devcontainer-utils.json_ file for this repo is located at [devcontainer-utils.json](./devcontainer-utils.json)

### Generating a devcontainer

The `devcontainer-utils.generateContainer` VSCode command generates the container.

This command can be run by right-clicking a _devcontainer-utils.json_ file and selecting _Generate Container_ from the context menu.

### Opening a devcontainer

The `devcontainer-utils.openContainer` VSCode command will open a devcontainer within VSCode.  If the container doesn't exist, VSCode will attempt to build it.

This command can be run by right-clicking a _.devcontainer_ folder or any file within, and selecting _Open Container_ from the context menu.

### Fore (re-)building a devcontainer

The `devcontainer-utils.buildContainer` VSCode command will force a (re-)build the devcontainer and re-open it within VSCode.  

This command can be run by right-clicking a _.devcontainer_ folder or any file within, and selecting _Build Container_ from the context menu.

### Auto-open Workspaces

When opening a devcontainer produced by _devcontainer-utils_, the VSCode extension will automatically open the generated _devcontainer-utils.code-workspace_ file after the devcontainer has finished building.

## Base Image

All devcontainers utilize a base docker image.

Rather than use specialized docker images that provide a single pre-installed tool, we use a [custom base image](./base-image) that installs [asdf](https://asdf-vm.com/) along with common build dependencies. This allows us to more easily generate dynamic Dockerfiles when _dc-utils_ is run.  

This base image is hosted on Docker Hub: [benfiola/devcontainer-utils](https://hub.docker.com/r/benfiola/devcontainer-utils).

Core to the base image is the `dc-utils` CLI. 

The `dc-utils` CLI exposes a few commands - most notably, the `install-tool` subcommand.  This command adds the required asdf plugin, installs a tool version using that plugin, and then sets that tool as the current (global) version for the image.

Here's an example image that installs nodejs-16.20.2 and python-3.10.13.

```
FROM docker.io/benfiola/devcontainer-utils:latest
dc-utils install-tool nodejs 16.20.2
dc-utils install-tool python 3.10.3
```

The resulting docker image will then have nodejs 16.20.2 and python 3.10.3 on the PATH.

There's a few additional commands included in the base image:

* `dc-utils version` prints the current version of the image
* `dc-utils finalize` is used to signal that post-create commands have finished running
* `dc-utils is-finalized` is used to determine whether or not post-create commands have finished running.
