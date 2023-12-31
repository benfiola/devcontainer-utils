import { z as zod } from "zod";

export const configSchema = zod.object({
  tools: zod
    .array(zod.string().regex(/[^:]+:.+/))
    .optional()
    .default([]),
  sidecars: zod
    .array(zod.string().regex(/[^:]+:.+/))
    .optional()
    .default([]),
  mounts: zod.record(zod.string()),
  folders: zod.record(
    zod.object({
      path: zod.string().regex(/{[^}]+}.*/),
      tools: zod.array(zod.enum(["python", "nodejs", "perl"])).default([]),
    })
  ),
  options: zod
    .object({
      pypiServer: zod
        .string()
        .regex(/https?:\/\/.*/)
        .optional(),
      trustedPypiServers: zod.array(zod.string()).optional(),
      extraPypiServers: zod
        .array(zod.string().regex(/https?:\/\/.*/))
        .optional(),
      npmRegistry: zod
        .string()
        .regex(/https?:\/\/.*/)
        .optional(),
      useYarn: zod.boolean().default(false).optional(),
    })
    .optional()
    .default({}),
});

export type Config = zod.infer<typeof configSchema>;
