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
      [files.userBeforePostCreate]: createUserBeforePostCreateFile,
      [files.userAfterPostCreate]: createUserAfterPostCreateFile,
    };
    for (const [filename, creator] of Object.entries(templateCreators)) {
      const filePath = path.join(devcontainerPath, filename);
      if (await pathExists(filePath)) {
        channel.appendLine(`not creating template: ${filePath} - file exists`);
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
  let text = ["FROM docker.io/benfiola/devcontainer-utils:0.0.3"];

  const tools = [...config.tools].sort();
  for (const tool of tools) {
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
}

interface VscodePythonSettings extends VscodeBaseSettings {}

interface VscodeSettings extends VscodeBaseSettings {
  "[python]"?: VscodePythonSettings;
  "isort.args"?: string[];
  "python.defaultInterpreterPath"?: string;
  "perl.perlCmd"?: string;
  "perl.perlInc"?: string[];
  "pls.syntax.perl"?: string;
  "pls.inc"?: string[];
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
    const [plugin, _] = tool.split(":");
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

  if (plugins.has("perl")) {
    extensions.push(...["fractalboy.pls", "richterger.perl"]);
    settings["perl.perlCmd"] = "/devcontainer-utils/asdf/shims/perl";
    settings["perl.perlInc"] = [];
    settings["pls.syntax.perl"] = "/devcontainer-utils/asdf/shims/perl";
    settings["pls.inc"] = [];
  }

  return jsonStringify(data, { space: 2 });
};

const createPostCreateFile = async (config: Config) => {
  /*
  Creates a post-create.sh file given the provided configuration
  */
  const lines = ["#!/bin/bash -e"];

  const userBeforePostCreatePath = getWorkspacePath(
    devcontainerMountName,
    files.userBeforePostCreate
  );
  lines.push(`# hook to allow custom before post-create behavior`);
  lines.push(`${userBeforePostCreatePath}`);

  if (hasPlugin(config, "nodejs")) {
    lines.push(`# tool (nodejs:*)`);

    if (config.options.npmRegistry) {
      lines.push(`# options.npmRegistry (${config.options.npmRegistry})`);
      lines.push(`npm config set registry ${config.options.npmRegistry}`);
    }
    if (config.options.useYarn) {
      lines.push(`# options.useYarn (${config.options.useYarn})`);
      lines.push(`npm install -g yarn`);
      if (config.options.npmRegistry) {
        lines.push(
          `# options.useYarn (${config.options.useYarn}) + options.nmpRegistry (${config.options.npmRegistry})`
        );
        lines.push(`yarn config set registry ${config.options.npmRegistry}`);
      }
    }
  }

  if (hasPlugin(config, "perl")) {
    lines.push(`# tools (perl:*)`);
    lines.push(`export PERL_MM_USE_DEFAULT=1`);
    lines.push(`cpan App::cpanminus`);
    lines.push(`asdf reshim`);
    lines.push(`cpanm --notest PLS Perl::LanguageServer`);
    lines.push(`asdf reshim`);
  }

  if (hasPlugin(config, "python")) {
    lines.push(`# tools (python:*)`);

    lines.push(`echo "[global]" > /etc/pip.conf`);

    if (config.options.pypiServer) {
      lines.push(`# options.pypiServer (${config.options.pypiServer})`);
      lines.push(
        `echo "index-url = ${config.options.pypiServer}" >> /etc/pip.conf`
      );

      if (config.options.extraPypiServers) {
        lines.push(
          `# options.extraPypiServers (${config.options.extraPypiServers})`
        );
        lines.push(`echo "extra-index-url = " >> /etc/pip.conf`);
        for (const extraPypiServer of config.options.extraPypiServers) {
          lines.push(`echo "\t${extraPypiServer}" >> /etc/pip.conf`);
        }
      }

      if (config.options.trustedPypiServers) {
        lines.push(
          `# options.trustedPypiServers (${config.options.trustedPypiServers})`
        );
        lines.push(`echo "trusted-host = " >> /etc/pip.conf`);
        for (const trustedPypiServer of config.options.trustedPypiServers) {
          lines.push(`echo "\t${trustedPypiServer}" >> /etc/pip.conf`);
        }
      }
    }
  }

  const folderNames = Object.keys(config.folders).sort();
  for (const folderName of folderNames) {
    const folder = config.folders[folderName];

    lines.push(`# folder (${folder.path})`);

    if (hasPlugin(config, "nodejs") && usesTool(folder, "nodejs")) {
      if (config.options.useYarn) {
        lines.push(
          `# tools (nodejs:*) + options.useYarn (${config.options.useYarn})`
        );
        lines.push(`cd "${folder.path}"`);
        lines.push(`yarn`);
      } else {
        lines.push(`# tools (nodejs:*)`);
        lines.push(`cd "${folder.path}"`);
        lines.push(`if [ -f "./package.json" ]; then`);
        lines.push(`    npm install --dev .`);
        lines.push(`fi`);
      }
    }

    if (hasPlugin(config, "perl") && usesTool(folder, "perl")) {
      lines.push(`# tools (perl:*)`);
      lines.push(`cd "${folder.path}"`);
      lines.push(`if [ -f "./Makefile.PL" ]; then`);
      lines.push(`   cpanm --notest .`);
      lines.push(`fi`);
    }

    if (hasPlugin(config, "python") && usesTool(folder, "python")) {
      lines.push(`# tools (python:*)`);
      lines.push(`cd "${folder.path}"`);
      lines.push(`if [ -f "./requirements.txt" ]; then`);
      lines.push(`    pip install -r "./requirements.txt"`);
      lines.push(`fi`);
      lines.push(`if [ -f "./setup.py" ]; then`);
      lines.push(`    pip install -e .`);
      lines.push(`fi`);
    }
  }

  const userAfterPostCreateShPath = getWorkspacePath(
    devcontainerMountName,
    files.userAfterPostCreate
  );
  lines.push(`# hook to allow custom after post-create behavior`);
  lines.push(`${userAfterPostCreateShPath}`);

  lines.push(`# finalize devcontainer creation`);
  lines.push(`dc-utils finalize`);

  return lines.join("\n");
};

const createUserBeforePostCreateFile = async (config: Config) => {
  /*
  Creates a user-before-post-create.sh file
  */
  const lines = [
    "#!/bin/bash -e",
    "# Additional setup scripts that need to be run before post-creation can be placed here - devcontainers-utils won't touch this file!",
  ];
  return lines.join("\n");
};

const createUserAfterPostCreateFile = async (config: Config) => {
  /*
  Creates a user-after-post-create.sh file
  */
  const lines = [
    "#!/bin/bash -e",
    "# Additional setup scripts that need to be run after post-creation can be placed here - devcontainers-utils won't touch this file!",
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

const hasPlugin = (config: Config, plugin: string) => {
  for (const tool of config.tools) {
    const [toolPlugin] = tool.split(":");
    if (toolPlugin === plugin) {
      return true;
    }
  }
  return false;
};

type Folder = Config["folders"][string];
const usesTool = (folder: Folder, tool: string) => {
  for (const folderTool of folder.tools) {
    if (folderTool === tool) {
      return true;
    }
  }
  return false;
};
