import { type } from "arktype";

export const safeIntegerSchema = type("number.integer & number.safe");
const nullableString = type("string | null");
export const optionalNullableString = nullableString.optional();
export const optionalDate = type("string.date.parse | null").optional();
export const optionalNumber = type("number | null").optional();
export const optionalBoolean = type("boolean | null").optional();
export const optionalIdentifier = type("number | string | null").optional();
