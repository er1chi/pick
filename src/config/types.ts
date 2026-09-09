import { type } from "arktype";

export const pickConfigSchema = type({
  kubbFetchBaseUrl: "string",
  githubAuthToken: "string",
  forgejoAuthToken: "string",
});

export type PickConfig = typeof pickConfigSchema.infer;
