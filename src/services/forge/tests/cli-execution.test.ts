import { describe, expect, test } from "bun:test";
import { executeCli } from "../cli-execution";
import {
  ForgeCommandFailedError,
  ForgeInvalidConnectionUrlError,
  ForgeKind,
} from "../types";

const corruptResponse = `Error: error sending request for url (https://100.111.2.25:222/api/v1/repos/o/r?)

Caused by:
   0: client error (Connect)
   1: received corrupt message of type InvalidContentType`;

function failWith(kind: ForgeKind, stderr: string) {
  return executeCli(
    kind,
    "sh",
    ["-c", 'printf "%s\\n" "$0" >&2; exit 1', stderr],
    process.cwd(),
  );
}

describe("executeCli", () => {
  test("reports a non-TLS answer to fj as an invalid connection URL", async () => {
    const result = await failWith(ForgeKind.Forgejo, corruptResponse);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(ForgeInvalidConnectionUrlError.is(result.error)).toBe(true);
      expect(result.error).toMatchObject({
        url: "https://100.111.2.25:222",
        message: "Could not connect to the Forgejo API",
      });
    }
  });

  test("keeps other request failures as command failures", async () => {
    const result = await failWith(
      ForgeKind.Forgejo,
      "Error: error sending request for url (https://forge.example/api/v1)\n\nCaused by:\n   0: dns error",
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(ForgeCommandFailedError.is(result.error)).toBe(true);
    }
  });
});
