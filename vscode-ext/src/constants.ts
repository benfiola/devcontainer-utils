export const displayName = "devcontainer-utils";
export const rootWorkspaceFolder = "/workspace";
export const devcontainerMountName = ".devcontainer";
export const files = {
  dockerfile: "Dockerfile",
  devcontainer: "devcontainer.json",
  dockerCompose: "docker-compose.yaml",
  postCreate: "post-create.sh",
  userPostCreate: "user-post-create.sh",
  workspace: "devcontainer-utils.code-workspace",
} as const;
