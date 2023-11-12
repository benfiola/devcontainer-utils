import * as childProcess from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { rootWorkspaceFolder } from "./constants";

let _channel: vscode.OutputChannel | null = null;
export const setChannel = (channel: vscode.OutputChannel) => {
  /*
  Sets the global logging channel for the extension
  */
  _channel = channel;
};

export const getChannel = () => {
  /*
  Gets the global logging channel for the extension
  */
  if (_channel === null) {
    throw new Error(`channel not set`);
  }
  return _channel;
};

export const handleError = async (error: any) => {
  /*
  Helper method to log errors and notify the user that an error occurred
  */
  const channel = getChannel();
  channel.appendLine(`Error: '${error}'`);

  const selection = await vscode.window.showErrorMessage(
    `An error occurred.  View logs for more information.`,
    "Logs"
  );
  if (selection === "Logs") {
    await vscode.commands.executeCommand("workbench.panel.output.focus");
    await vscode.commands.executeCommand(
      "workbench.action.output.show.extension-output-benfiola.devcontainer-utils-#1-devcontainer-utils"
    );
  }
};

export const pathExists = async (filePath: string) => {
  /*
  Helper method imitating fs.existsSync (because a similar function does not exist in fs/promises).
  */
  try {
    await fs.lstat(filePath);
    return true;
  } catch (e) {
    return false;
  }
};

export const isInDevcontainer = () => {
  /*
  Uses the existence of the `dc-utils` CLI to indicate whether vscode is currently running in a benfiola/devcontainer-utils docker image.
  */
  return new Promise((resolve) => {
    childProcess.exec("which dc-utils", (error) => {
      if (error) {
        return resolve(false);
      }
      return resolve(true);
    });
  });
};

const sleep = (milis: number) => {
  /*
  Performs a 'sleep' for the provided number of milliseconds - used primarily to reduce frequency of polling behavior.
  */
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, milis);
  });
};

const isDevcontainerFinalized = () => {
  /*
  Uses the `dc-utils is-finalized` command to determine whether the devcontainer has finished creation.
  */
  return new Promise((resolve) => {
    childProcess.exec("dc-utils is-finalized", (error) => {
      if (error) {
        return resolve(false);
      }
      return resolve(true);
    });
  });
};

export const waitForDevcontainerFinalized = async () => {
  /*
  Allows the caller to wait until the devcontainer has finished building
  */
  while (!(await isDevcontainerFinalized())) {
    await sleep(500);
  }
};

export const getWorkspacePath = (mountName: string, ...subpaths: string[]) => {
  /*
  Derives the workspace path given a mount name
  */
  return path.join(rootWorkspaceFolder, mountName, ...subpaths);
};
