import * as vscode from "vscode";

export const activate = async (context: vscode.ExtensionContext) => {
  console.log("extension activated");

  if (vscode.workspace.workspaceFile) {
    console.log(
      `workspace '${vscode.workspace.workspaceFile}' already opened - exiting`
    );
    return;
  }

  const path = ".devcontainer/devcontainer.code-workspace";
  const uris = await vscode.workspace.findFiles(path);
  if (uris.length === 0) {
    console.log(`workspace '${path}' not found - exiting`);
    return;
  }
  const uri = uris[0];

  console.log(`workspace '${uri}' found - opening`);
  await vscode.commands.executeCommand("vscode.openFolder", uri);
};

export const deactivate = () => {};
