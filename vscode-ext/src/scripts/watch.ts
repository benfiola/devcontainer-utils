import * as childProcess from "child_process";
import * as chokidar from "chokidar";
import * as path from "path";

const projectPath = path.resolve(__dirname, "..");
const paths = ["./src/schema.ts"];

const main = async () => {
  /*
  This custom script runs alongside the typescript compiler watcher and performs additional side-effects on file change.
  */
  console.log("generating schema");
  await exec("npm run compile:schema");

  console.log("starting watcher");
  chokidar.watch(paths, { cwd: projectPath }).on("change", async (srcPath) => {
    if (srcPath === "src/schema.ts") {
      console.log(`change detected: regenerating schema`);
      await exec("npm run compile:schema");
    } else {
      console.log(`watcher function not implemented: ${srcPath}`);
    }
  });
};

const exec = (command: string) => {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, (error, stdout) => {
      if (error) {
        return reject(error);
      }
      return resolve(stdout);
    });
  });
};

(async function () {
  await main();
})();
