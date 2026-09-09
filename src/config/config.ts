import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type } from "arktype";
import { Result } from "better-result";
import { pickConfigSchema, type PickConfig } from "./types";

type PickConfigLoadError = "pick-config-load-error";

export const missingConfigurationMessage =
  "Please complete missing configuration.";

const pickConfigLoadError: PickConfigLoadError = "pick-config-load-error";

const pickConfigPath = join(homedir(), ".config", "pick", "pick-config.json");

export function loadPickConfig(): Result<PickConfig, PickConfigLoadError> {
  return Result.try({
    try: () => readFileSync(pickConfigPath, "utf8"),
    catch: () => pickConfigLoadError,
  })
    .andThen((text) =>
      Result.try({
        try: () => JSON.parse(text),
        catch: () => pickConfigLoadError,
      }),
    )
    .andThen((json) => {
      const parsed = pickConfigSchema(json);
      if (parsed instanceof type.errors) {
        return Result.err(pickConfigLoadError);
      }

      return Result.ok(parsed);
    });
}

export const pickConfigResult = loadPickConfig();
