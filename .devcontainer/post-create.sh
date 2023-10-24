#!/bin/sh
set -e
cd /workspace/devcontainer-utils/cli && { [ -f requirements.txt ] && pip install -r requirements.txt; pip install -e .; }
cd /workspace/devcontainer-utils/vscode-ext && { npm install .; }
dc-utils-finalize