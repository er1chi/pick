import solidPlugin from "@opentui/solid/bun-plugin";
import { chmod, mkdir, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const nativePackages = [
  "@opentui/core-darwin-arm64",
  "@opentui/core-darwin-x64",
  "@opentui/core-linux-arm64",
  "@opentui/core-linux-arm64-musl",
  "@opentui/core-linux-x64",
  "@opentui/core-linux-x64-musl",
  "@opentui/core-win32-arm64",
  "@opentui/core-win32-x64",
] as const;

function currentNativePackage(): (typeof nativePackages)[number] {
  const { platform, arch } = process;
  if (arch !== "arm64" && arch !== "x64") {
    throw new Error(`Unsupported architecture: ${arch}`);
  }

  if (platform === "darwin") {
    return `@opentui/core-darwin-${arch}`;
  }

  if (platform === "linux") {
    const libcSuffix = process.env.OPENTUI_LIBC === "musl" ? "-musl" : "";
    return `@opentui/core-linux-${arch}${libcSuffix}`;
  }

  if (platform === "win32") {
    return `@opentui/core-win32-${arch}`;
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

const outputPath = resolve(process.env.PICK_EXECUTABLE_PATH ?? "/tmp/pick-bin");
const temporaryOutputPath = `${outputPath}.next`;
const bundledNativePackage = currentNativePackage();
const treeSitterWorkerPath = "opentui-tree-sitter-worker.js";
const treeSitterWorker = await Bun.file(
  fileURLToPath(import.meta.resolve("@opentui/core/parser.worker")),
).text();
const bunfsRoot =
  process.platform === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/";

await mkdir(dirname(outputPath), { recursive: true });
await rm(temporaryOutputPath, { force: true });

try {
  const result = await Bun.build({
    entrypoints: [resolve("index.tsx"), treeSitterWorkerPath],
    compile: {
      autoloadBunfig: false,
      outfile: temporaryOutputPath,
    },
    define: {
      OTUI_TREE_SITTER_WORKER_PATH: JSON.stringify(
        `${bunfsRoot}${treeSitterWorkerPath}`,
      ),
    },
    files: {
      [treeSitterWorkerPath]: treeSitterWorker,
    },
    plugins: [solidPlugin],
    external: nativePackages.filter(
      (packageName) => packageName !== bundledNativePackage,
    ),
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exitCode = 1;
  } else {
    await chmod(temporaryOutputPath, 0o755);
    await rename(temporaryOutputPath, outputPath);
    console.log(`Built Pick executable at ${outputPath}`);
  }
} finally {
  await rm(temporaryOutputPath, { force: true });
}
