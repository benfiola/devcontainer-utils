import * as vscode from "vscode";
import { getChannel } from "./utils";

export const openContainer = async () => {
  /*
  Opens the devcontainer attached to the current path.
  */
  const channel = getChannel();

  channel.appendLine("opening container");

  await vscode.commands.executeCommand("remote-containers.reopenInContainer");
};
