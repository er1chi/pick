import { pluginFetch } from "@kubb/plugin-fetch";
import { pluginTs } from "@kubb/plugin-ts";
import { defineConfig } from "kubb/config";
import {
  loadPickConfig,
  missingConfigurationMessage,
} from "./src/config/config";

const pickConfig = loadPickConfig();

if (pickConfig.isErr()) {
  throw new Error(missingConfigurationMessage);
}

export default defineConfig({
  input: "./stale/forgejo15-0-2.swagger.json",
  output: {
    path: "./src/gen",
    clean: true,
  },
  plugins: [
    pluginTs(),
    pluginFetch({ baseURL: pickConfig.value.kubbFetchBaseUrl }),
  ],
});
