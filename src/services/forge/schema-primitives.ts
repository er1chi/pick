import { type } from "arktype";

export const safeIntegerSchema = type("number.integer & number.safe");
export const optionalNullableString = type("string | null").optional();
export const optionalNumber = type("number | null").optional();
export const optionalBoolean = type("boolean | null").optional();

export const userSchema = type({ login: "string" });
export const optionalUser = userSchema.or("null").optional();
export const teamSchema = type({ name: "string" });

const gitIdentitySchema = type({ date: optionalNullableString })
  .or("null")
  .optional();

/** A commit as the GitHub REST API returns it; Forgejo's API matches it. */
export const commitSchema = type({
  sha: "string",
  commit: type({
    message: "string",
    author: gitIdentitySchema,
    committer: gitIdentitySchema,
  }),
  author: optionalUser,
  committer: optionalUser,
  html_url: optionalNullableString,
});

export type UserPayload = typeof userSchema.infer;
export type TeamPayload = typeof teamSchema.infer;
export type CommitPayload = typeof commitSchema.infer;
