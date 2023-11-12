import * as vscode from "vscode";
import { getChannel } from "./utils";

export const buildContainer = async () => {
  /*
  Rebuilds the devcontainer configured for the current path, and then opens the devcontainer.
  */
  const channel = getChannel();

  channel.appendLine(`building container`);

  await vscode.commands.executeCommand(
    "remote-containers.rebuildAndReopenInContainer"
  );
};
