import * as vscode from "vscode";
import * as childProcess from "child_process"

let channel: vscode.OutputChannel

export const waitForFinalize = async () => {
  let check = () => {
    return new Promise<boolean>((resolve, reject) => {
      childProcess.exec("dc-utils-is-finalized", (error, stdout) => {
        if(error) {
          if(error.code !== 1) {
            return reject(error);
          }
          return resolve(false);
        }
        return resolve(true);
      })
    })
  }

  let sleep = (timeMs: number) => {
    return new Promise((resolve) => {
      setTimeout(resolve, timeMs)
    })
  }

  while(! await check()) {
    await sleep(1000)
  }
}

export const activate = async (context: vscode.ExtensionContext) => {
  channel = vscode.window.createOutputChannel("devcontainer-utils")
  channel.appendLine("extension activated");

  if (vscode.workspace.workspaceFile) {
    channel.appendLine(
      `workspace '${vscode.workspace.workspaceFile}' already opened - exiting`
    );
    return;
  }

  const workspacePath = ".devcontainer/devcontainer.code-workspace";
  const workspaceUris = await vscode.workspace.findFiles(workspacePath);
  if (workspaceUris.length === 0) {
    channel.appendLine(`workspace '${workspacePath}' not found - exiting`);
    return;
  }
  const workspaceUri = workspaceUris[0];

  channel.appendLine(`workspace '${workspaceUri}' found - waiting for docker build to finalize`);
  await waitForFinalize()
  channel.appendLine(`docker build finalized`);

  channel.appendLine(`opening workspace '${workspaceUri}'`);
  await vscode.commands.executeCommand("vscode.openFolder", workspaceUri);
};

export const deactivate = () => {};
