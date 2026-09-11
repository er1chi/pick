import { Result } from "better-result";
import { checkCli, type CliCheckError } from "./cli-check";
import type {
  ForgeKind,
  ForgeOperation,
  ForgeOperationError,
  ForgeService,
  IssueOperations,
  PullRequestOperations,
} from "./forge-service";
import type { Comment, Issue, PullRequest } from "./models";

type ForgeCapabilities = Pick<ForgeService, "pullRequests" | "issues">;

async function notImplemented<T>(
  kind: ForgeKind,
  operation: ForgeOperation,
): Promise<Result<T, ForgeOperationError>> {
  return Result.err<T, ForgeOperationError>({
    code: "not-implemented",
    kind,
    operation,
  });
}

export async function initializeForgeService<
  Service extends ForgeService,
  Executable extends string,
>(
  executable: Executable,
  args: readonly string[],
  create: () => Service,
): Promise<Result<Service, CliCheckError<Executable>>> {
  return (await checkCli(executable, args)).map(create);
}

export function createScaffoldCapabilities(kind: ForgeKind): ForgeCapabilities {
  const pullRequests: PullRequestOperations = {
    get: () => notImplemented<PullRequest>(kind, "pullRequests.get"),
    getComments: () =>
      notImplemented<readonly Comment[]>(kind, "pullRequests.getComments"),
  };
  const issues: IssueOperations = {
    create: () => notImplemented<Issue>(kind, "issues.create"),
    getComments: () =>
      notImplemented<readonly Comment[]>(kind, "issues.getComments"),
  };

  return { pullRequests, issues };
}

export abstract class ForgeServiceAdapter<
  Kind extends ForgeKind,
> implements ForgeService {
  public readonly kind: Kind;
  public readonly pullRequests: PullRequestOperations;
  public readonly issues: IssueOperations;

  protected constructor(kind: Kind) {
    this.kind = kind;
    const capabilities = createScaffoldCapabilities(kind);
    this.pullRequests = capabilities.pullRequests;
    this.issues = capabilities.issues;
  }
}
