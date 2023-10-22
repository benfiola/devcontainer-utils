#!/bin/sh -e
PUSH="${PUSH:-0}"
LATEST="${LATEST:-0}"

confirm() {
    value="n"
    while [ ! "$value" = "y" ]; do
        printf "confirm [y/n]:"
        read value
        if [ "$value" = "n" ]; then
            1>&2 echo "user aborted operation"
            exit 1
        fi
    done
}

image="docker.io/benfiola/devcontainer-utils"
version="$(cat version.txt)"
latest_image="${image}:latest"
version_image="${image}:${version}"

cmd="docker buildx build --platform linux/arm64,linux/amd64"
if [ "$LATEST" = "1" ]; then
    cmd="${cmd} -t ${latest_image}"
fi
cmd="${cmd} -t ${version_image}"
if [ "$PUSH" = "1" ]; then
    cmd="${cmd} --push"
fi
cmd="${cmd} ."

echo "cmd: ${cmd}"
confirm

eval "${cmd}"
