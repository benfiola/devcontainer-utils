import * as fs from "fs/promises";
import * as yaml from "js-yaml";
import * as jsonStringify from "json-stable-stringify";
import * as path from "path";
import * as vscode from "vscode";
import { devcontainerMountName, files, rootWorkspaceFolder } from "./constants";
import { Config, configSchema } from "./schema";
import { getChannel, getWorkspacePath, handleError, pathExists } from "./utils";

export const generateContainer = async (configFile: vscode.Uri) => {
  /*
  When invoked, generates the folders and files required to produce a devcontainer-utils compatible devcontainer.
  */
  try {
    const channel = getChannel();

    channel.appendLine(`generating dev container`);
    channel.appendLine(`config file: ${configFile.fsPath}`);
    const devcontainerPath = getDevcontainerPath(configFile);
    channel.appendLine(`devcontainer path: ${devcontainerPath}`);
    const config = await getConfig(configFile, devcontainerPath);
    channel.appendLine(`config: ${jsonStringify(config, { space: 2 })}`);

    if (!(await pathExists(devcontainerPath))) {
      channel.appendLine(`creating devcontainer path: ${devcontainerPath}`);
      await fs.mkdir(devcontainerPath);
    }

    const fileCreators = {
      [files.dockerfile]: createDockerfile,
      [files.dockerCompose]: createDockerComposeFile,
      [files.devcontainer]: createDevcontainerFile,
      [files.postCreate]: createPostCreateFile,
      [files.workspace]: createWorkspaceFile,
    };
    for (const [filename, creator] of Object.entries(fileCreators)) {
      const filePath = path.join(devcontainerPath, filename);
      channel.appendLine(`creating file: ${filePath}`);
      const content = await creator(config);
      await fs.writeFile(filePath, content);
      if (filePath.endsWith(".sh")) {
        await fs.chmod(filePath, "755");
      }
    }

    const templateCreators = {
      [files.userPostCreate]: createUserPostCreateFile,
    };
    for (const [filename, creator] of Object.entries(templateCreators)) {
      const filePath = path.join(devcontainerPath, filename);
      if (await pathExists(filePath)) {
        continue;
      }

      channel.appendLine(`creating template: ${filePath}`);
      const content = await creator(config);
      await fs.writeFile(filePath, content);
      if (filePath.endsWith(".sh")) {
        await fs.chmod(filePath, "755");
      }
    }
  } catch (e) {
    await handleError(e as Error);
  }
};

const getDevcontainerPath = (configFile: vscode.Uri) => {
  /*
  Derives the location of the .devcontainer folder based upon the location of `configFile`.
  */
  const workspace = vscode.workspace.getWorkspaceFolder(configFile);
  if (workspace === undefined) {
    throw new Error(`could not find workspace for: ${configFile.path}`);
  }

  let devcontainerPath = workspace.uri.fsPath;
  if (!devcontainerPath.endsWith(".devcontainer")) {
    devcontainerPath = path.join(devcontainerPath, ".devcontainer");
  }

  return devcontainerPath;
};

const getConfig = async (configFile: vscode.Uri, devcontainerPath: string) => {
  /*
  Parses the configuration file, amends it to additionally mount devcontainer metadata, replaces mount references with mount paths.
  */
  const data = JSON.parse((await fs.readFile(configFile.path)).toString());

  const config = await configSchema.parseAsync(data);

  config.mounts[devcontainerMountName] = devcontainerPath;
  config.folders[devcontainerMountName] = {
    path: `{${devcontainerMountName}}`,
    tools: [],
  };

  let mounts: Record<string, string> = {};
  for (const mountName of Object.keys(config.mounts)) {
    mounts[mountName] = getWorkspacePath(mountName);
  }
  const mountNameRegex = new RegExp("{([^}]+)}");
  for (const [folderName, folder] of Object.entries(config.folders)) {
    let match = folder.path.match(mountNameRegex);
    while (match !== null) {
      const mountName = match[1];
      const mount: string | undefined = mounts[mountName];
      if (mount === undefined) {
        throw new Error(
          `invalid mount reference: ${mountName} (folder: ${folderName})`
        );
      }
      folder.path = folder.path.replace(match[0], mount);
      match = folder.path.match(mountNameRegex);
    }
  }

  return config;
};

const createDockerfile = async (config: Config) => {
  /*
  Creates a dockerfile using the provided configuration
  */
  let text = ["FROM docker.io/benfiola/devcontainer-utils:latest"];

  const tools = [...config.tools].sort();
  for (const tool of tools) {
    const parts = tool.split(":");
    if (parts.length !== 2) {
      throw new Error(`malformed tool: ${tool}`);
    }
    const [plugin, version] = tool.split(":");
    text.push(
      `# tools (${tool})\nRUN dc-utils install-tool ${plugin} ${version}`
    );
  }

  return text.join("\n");
};

interface DockerComposeService {
  build?: {
    context: string;
    dockerfile: string;
  };
  image?: string;
  command?: string;
  volumes?: string[];
  environment?: { [k: string]: string };
}

interface DockerCompose {
  services: { [k: string]: DockerComposeService };
  version: "3";
}

const createDockerComposeFile = async (config: Config) => {
  /*
  Creates a docker compose YAML file using the provided configuration
  */
  let data: DockerCompose = {
    services: {
      devcontainer: {
        build: { context: ".", dockerfile: "Dockerfile" },
        command: "/bin/sh -c 'while sleep 1000; do :; done'",
      },
    },
    version: "3",
  };
  const devcontainer = data.services["devcontainer"];

  for (const [name, path] of Object.entries(config.mounts)) {
    const workspacePath = getWorkspacePath(name);
    const volume = `${path}:${workspacePath}:cached`;
    devcontainer.volumes = devcontainer.volumes || [];
    devcontainer.volumes.push(volume);
  }

  for (const image of config.sidecars) {
    const [imageName, _] = image.split(":");
    if (imageName === "redis") {
      data.services["redis"] = {
        image,
        command: "redis-server --requirepass password",
      };
    } else if (imageName === "postgres") {
      data.services["postgres"] = {
        image,
        environment: {
          POSTGRES_DATABASE: "postgres",
          POSTGRES_PASSWORD: "password",
          POSTGRES_USER: "postgres",
        },
      };
    } else {
      throw new Error(`unsupported sidecar: ${image}`);
    }
  }

  return yaml.dump(data, { lineWidth: -1, sortKeys: true });
};

interface VscodeBaseSettings {
  "editor.codeActionsOnSave"?: string[];
  "editor.defaultFormatter"?: string;
  "isort.args"?: string[];
  "python.defaultInterpreterPath"?: string;
}
interface VscodeSettings extends VscodeBaseSettings {
  "[python]"?: VscodeBaseSettings;
}
interface DevcontainerJsonVscodeCustomizations {
  settings: VscodeSettings;
  extensions: string[];
}
interface DevcontainerJson {
  dockerComposeFile: string;
  name: string;
  postCreateCommand: string;
  service: string;
  workspaceFolder: string;
  customizations: {
    vscode: DevcontainerJsonVscodeCustomizations;
  };
}

const createDevcontainerFile = async (config: Config) => {
  /*
  Creates a devcontainer.json file given the provided configuration
  */
  const postCreatePath = getWorkspacePath(
    devcontainerMountName,
    "post-create.sh"
  );

  const data: DevcontainerJson = {
    dockerComposeFile: "docker-compose.yaml",
    name: "devcontainer",
    postCreateCommand: postCreatePath,
    service: "devcontainer",
    workspaceFolder: rootWorkspaceFolder,
    customizations: {
      vscode: {
        extensions: [
          "benfiola.devcontainer-utils",
          "esbenp.prettier-vscode",
          "rohit-gohri.format-code-action",
          "usernamehw.errorlens",
        ],
        settings: {
          "editor.codeActionsOnSave": [
            "source.organizeImports",
            "source.formatDocument",
          ],
          "editor.defaultFormatter": "esbenp.prettier-vscode",
        },
      },
    },
  };
  const extensions = data.customizations.vscode.extensions;
  const settings = data.customizations.vscode.settings;

  const plugins = new Set<string>();
  for (const tool of config.tools) {
    const parts = tool.split(":");
    if (parts.length !== 2) {
      throw new Error(`malformed tool: ${tool}`);
    }
    const [plugin, _] = parts;
    plugins.add(plugin);
  }

  if (plugins.has("python")) {
    settings["[python]"] = {
      "editor.defaultFormatter": "ms-python.black-formatter",
    };
    settings["isort.args"] = ["--profile", "black"];
    settings["python.defaultInterpreterPath"] =
      "/devcontainer-utils/asdf/shims/python";
    extensions.push(
      ...[
        "ms-python.black-formatter",
        "ms-python.isort",
        "ms-python.python",
        "ms-python.vscode-pylance",
        "njpwerner.autodocstring",
      ]
    );
  }

  return jsonStringify(data, { space: 2 });
};

const createPostCreateFile = async (config: Config) => {
  /*
  Creates a post-create.sh file given the provided configuration
  */
  const lines = ["#!/bin/bash -e"];

  if (config.options.pypiServer) {
    lines.push(
      `# options.pypiServer (${config.options.pypiServer})\necho 'index-url = ${config.options.pypiServer}' > /etc/pip.conf`
    );
  }

  if (config.options.npmRegistry) {
    lines.push(
      `# options.npmRegistry (${config.options.npmRegistry})\nnpm config set registry ${config.options.npmRegistry}`
    );
  }

  if (config.options.useYarn) {
    lines.push(
      `# options.useYarn (${config.options.useYarn})\nnpm install -g yarn`
    );
    if (config.options.npmRegistry) {
      lines.push(
        `# options.useYarn (${config.options.useYarn}) + options.nmpRegistry (${config.options.npmRegistry})\nyarn config set registry ${config.options.npmRegistry}`
      );
    }
  }

  const folderNames = Object.keys(config.folders).sort();
  for (const folderName of folderNames) {
    const folder = config.folders[folderName];
    const hasPython = folder.tools.indexOf("python") !== -1;
    const hasNode = folder.tools.indexOf("nodejs") !== -1;

    if (hasPython) {
      getChannel().appendLine(folder.path);
      lines.push(
        `# folder.tools (${folder.path}, "python")\ncd "${folder.path}" \nif [ -f "./requirements.txt" ]; then\n\tpip install -r "./requirements.txt"\nfi\npip install -e .`
      );
    }

    if (hasNode) {
      if (config.options.useYarn) {
        lines.push(
          `# folder.tools (${folder.path}, "nodejs") + options.useYarn (${config.options.useYarn})\ncd "${folder.path}"\nyarn`
        );
      } else {
        lines.push(
          `# folder.tools (${folder.path}, "nodejs")\ncd "${folder.path}"\nnpm install --dev .`
        );
      }
    }
  }

  const userPostCreateShPath = getWorkspacePath(
    devcontainerMountName,
    "user-post-create.sh"
  );
  lines.push(
    `# hook to allow custom post-create behavior\n${userPostCreateShPath}`
  );

  lines.push("# finalize devcontainer creation\ndc-utils finalize");

  return lines.join("\n");
};

const createUserPostCreateFile = async (config: Config) => {
  /*
  Creates a user-post-create.sh file
  */
  const lines = [
    "#!/bin/bash -e",
    "# Additional setup scripts can be placed here - devcontainers-utils won't touch this file!",
  ];
  return lines.join("\n");
};

interface CodeWorkspaceFolder {
  path: string;
  name?: string;
}
interface CodeWorkspace {
  folders?: CodeWorkspaceFolder[];
}

const createWorkspaceFile = async (config: Config) => {
  /*
  Creates a .code-workspace file given the provided configuration
  */
  let data: CodeWorkspace = {};

  for (const [folderName, folder] of Object.entries(config.folders)) {
    data.folders = data.folders || [];
    data.folders.push({
      path: folder.path,
      name: folderName,
    });
  }
  return jsonStringify(data, { space: 2 });
};
