import * as vscode from "vscode";
import { getChannel } from "./utils";

export const openWorkspace = async (workspacePath: vscode.Uri) => {
  /*
  Reopens vscode using the provided workspace path.
  */
  const channel = getChannel();

  channel.appendLine(`opening workspace ${workspacePath}`);

  await vscode.commands.executeCommand("vscode.openFolder", workspacePath);
};
