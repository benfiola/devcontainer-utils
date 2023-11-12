import * as fs from "fs/promises";
import * as path from "path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { configSchema } from "../schema";

const projectPath = path.resolve(__dirname, "..");

const main = async () => {
  /*
  This script takes the zod schema defined in 'schema.ts' and generates a JSON schema from it.
  */
  console.log("generating schema");
  const schema = zodToJsonSchema(configSchema, "configSchema");

  const outPath = path.join(projectPath, "../out");
  if (!(await exists(outPath))) {
    console.log(`creating directory ${outPath}`);
    await fs.mkdir(outPath);
  }

  const schemaGenPath = path.join(outPath, "schema.gen.json");
  console.log(`writing schema to ${schemaGenPath}`);
  await fs.writeFile(schemaGenPath, JSON.stringify(schema, null, 2));
};

const exists = async (path: string) => {
  /*
  Helper method that determines whether a path exists
  */
  try {
    await fs.lstat(path);
    return true;
  } catch (e) {
    return false;
  }
};

(async function () {
  await main();
})();
