import { type } from "arktype";

export const safeIntegerSchema = type("number.integer & number.safe");
export const optionalNullableString = type("string | null").optional();
export const optionalNumber = type("number | null").optional();
export const optionalBoolean = type("boolean | null").optional();

export const userSchema = type({ login: "string" });
export const optionalUser = userSchema.or("null").optional();
export const teamSchema = type({ name: "string" });

export type UserPayload = typeof userSchema.infer;
export type TeamPayload = typeof teamSchema.infer;
