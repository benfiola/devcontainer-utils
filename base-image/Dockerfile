FROM ubuntu:jammy AS base

ARG DC_ASDF_VERSION="0.13.1"

# prevent interactivity during apt operations
ENV DEBIAN_FRONTEND=noninteractive

# update apt
RUN apt -y update

# create devcontainer-utils directory
RUN mkdir -p /devcontainer-utils

# install asdf
RUN apt -y install \
  curl \
  git \ 
  && git clone https://github.com/asdf-vm/asdf.git /devcontainer-utils/asdf --branch "v${DC_ASDF_VERSION}"
ENV ASDF_DIR="/devcontainer-utils/asdf"
ENV ASDF_DATA_DIR="${ASDF_DIR}"
ENV PATH="${ASDF_DIR}/shims:${ASDF_DIR}/bin:${PATH}"
ADD asdf-config /devcontainer-utils
ENV ASDF_CONFIG_FILE="/devcontainer-utils/asdf-config"

# install asdf-python compilation dependencies (https://github.com/asdf-community/asdf-python)
RUN apt -y install \
  build-essential \
  libssl-dev \
  zlib1g-dev \
  libbz2-dev \
  libreadline-dev \
  libsqlite3-dev \
  curl \
  libncursesw5-dev \
  xz-utils \
  tk-dev \
  libxml2-dev \
  libxmlsec1-dev \
  libffi-dev \
  liblzma-dev

# copy local files
ADD version.txt /devcontainer-utils
ADD dc-utils-install-tool /devcontainer-utils
ADD dc-utils-version /devcontainer-utils

# add public commands to PATH
RUN ln -s /devcontainer-utils/dc-utils-install-tool /usr/bin/dc-utils-install-tool
RUN ln -s /devcontainer-utils/dc-utils-version /usr/bin/dc-utils-version
