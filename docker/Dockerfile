FROM ubuntu:latest AS base

ARG DC_ASDF_VERSION="0.13.1"

# prevent interactivity during apt operations
ENV DEBIAN_FRONTEND=noninteractive

# update apt
RUN apt -y update

# create dc directory
RUN mkdir -p /dc

# install asdf
RUN apt -y install \
      curl \
      git \ 
    && git clone https://github.com/asdf-vm/asdf.git /dc/asdf --branch "v${DC_ASDF_VERSION}"
ENV ASDF_DIR="/dc/asdf"
ENV ASDF_DATA_DIR="${ASDF_DIR}"
ENV PATH="${ASDF_DIR}/shims:${ASDF_DIR}/bin:${PATH}"
ADD asdf-config /dc
ADD asdf-hook-plugin-python /dc
ENV ASDF_CONFIG_FILE="/dc/asdf-config"

# copy local files
ADD dc-asdf-install /dc

# add public commands to PATH
RUN ln -s /dc/dc-asdf-install /usr/bin/dc-asdf-install
