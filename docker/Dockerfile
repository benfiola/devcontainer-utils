FROM ubuntu:latest AS base

ARG DC_ASDF_VERSION="0.13.1"

# prevent interactivity during apt operations
ENV DEBIAN_FRONTEND=noninteractive
ENV TEST="0"

# update apt
RUN apt -y update

# create dc directory
RUN mkdir -p /dc

# install asdf
RUN apt -y install \
      curl \
      git \ 
    && git clone https://github.com/asdf-vm/asdf.git /dc/asdf --branch "v${DC_ASDF_VERSION}"

# copy local files
ADD asdf-config /dc
ADD asdf-hook-plugin-python /dc
ADD dc-asdf-install /dc
ADD dc-wrapper /dc

# add public commands to PATH
RUN ln -s /dc/dc-asdf-install /usr/bin/dc-asdf-install
RUN ln -s /dc/dc-wrapper /usr/bin/dc-wrapper

ENTRYPOINT ["dc-wrapper"]
