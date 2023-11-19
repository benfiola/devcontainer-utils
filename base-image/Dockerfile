FROM ubuntu:jammy AS base

ARG DC_ASDF_VERSION="0.13.1"

# prevent interactivity during apt operations
ENV DEBIAN_FRONTEND=noninteractive

RUN \
  # update apt
  apt -y update \
  # install apt dependencies
  && apt -y install \
    # dependencies
    locales \
    vim \
    python3 \
    # apt asdf dependencies
    curl \
    git \ 
    # apt asdf-python dependencies
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
    liblzma-dev \
  # generate locales
  && locale-gen en_US.UTF-8 \
  # install asdf
  && git clone https://github.com/asdf-vm/asdf.git /devcontainer-utils/asdf --branch "v${DC_ASDF_VERSION}" \
  # create devcontainer-utils directory
  && mkdir -p /devcontainer-utils

# finish asdf installation
ENV ASDF_DIR="/devcontainer-utils/asdf"
ENV ASDF_DATA_DIR="${ASDF_DIR}"
ENV PATH="${ASDF_DIR}/shims:${ASDF_DIR}/bin:${PATH}"
ADD asdf-config /devcontainer-utils
ENV ASDF_CONFIG_FILE="/devcontainer-utils/asdf-config"

# copy local files
ADD version.txt /devcontainer-utils
ADD dc-utils /devcontainer-utils

# add cli to PATH
RUN ln -s /devcontainer-utils/dc-utils /usr/bin/dc-utils
