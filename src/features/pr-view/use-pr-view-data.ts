import {
  useAppContext,
  type AppContextState,
  type ForgeContextError,
} from "@/context/app-context";
import {
  ApplicationContext,
  ForgeOperationErrorCode,
  type ForgeKind,
  type PullRequestDetails,
  type PullRequestList,
} from "@/services/forge/types";
import { moveInList } from "@/utils/navigation";
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";

type PullRequestLoadState<T> =
  | {
      readonly status: "idle";
      readonly value: undefined;
      readonly error: undefined;
    }
  | {
      readonly status: "loading";
      readonly value: T | undefined;
      readonly error: undefined;
    }
  | {
      readonly status: "ready";
      readonly value: T;
      readonly error: undefined;
    }
  | {
      readonly status: "error";
      readonly value: T | undefined;
      readonly error: ForgeContextError;
    };

export interface PullRequestViewData {
  readonly list: Accessor<PullRequestLoadState<PullRequestList>>;
  readonly details: Accessor<PullRequestLoadState<PullRequestDetails>>;
  readonly selectedNumber: Accessor<number | null>;
  readonly moveSelection: (offset: number) => void;
  readonly activateSelected: () => void;
  readonly activate: (number: number) => void;
  readonly retryList: () => void;
  readonly retryDetails: () => void;
  readonly retry: () => void;
}

function idle<T>(): PullRequestLoadState<T> {
  return { status: "idle", value: undefined, error: undefined };
}

function isCancelled(error: ForgeContextError): boolean {
  return error.code === ForgeOperationErrorCode.Cancelled;
}

function remoteKind(state: AppContextState): ForgeKind | undefined {
  if (
    state.kind !== ApplicationContext.GitHub &&
    state.kind !== ApplicationContext.Forgejo
  ) {
    return undefined;
  }
  return state.forgeError === undefined ? state.kind : undefined;
}

function hasFailedSection(details: PullRequestDetails): boolean {
  return Object.values(details.collections).some(
    (section) => section.status === "failed",
  );
}

export function usePullRequestData(): PullRequestViewData {
  const appContext = useAppContext();
  const [list, setList] =
    createSignal<PullRequestLoadState<PullRequestList>>(idle());
  const [details, setDetails] =
    createSignal<PullRequestLoadState<PullRequestDetails>>(idle());
  const [selectedNumber, setSelectedNumber] = createSignal<number | null>(null);

  let repositoryGeneration = 0;
  let detailGeneration = 0;
  let listController: AbortController | undefined;
  let detailController: AbortController | undefined;
  let activeRepositoryKey = "";
  const detailCache = new Map<string, PullRequestDetails>();

  function beginListLoad(generation: number, repositoryKey: string): void {
    const state = appContext.state();
    if (
      remoteKind(state) === undefined ||
      repositoryKey !== activeRepositoryKey
    ) {
      return;
    }

    listController?.abort();
    const controller = new AbortController();
    listController = controller;
    setList((current) => ({
      status: "loading",
      value: current.status === "ready" ? current.value : undefined,
      error: undefined,
    }));

    void appContext.forge
      .getPullRequests({ signal: controller.signal })
      .then((result) => {
        if (
          generation !== repositoryGeneration ||
          repositoryKey !== activeRepositoryKey
        ) {
          return;
        }
        if (result.isErr()) {
          if (!isCancelled(result.error)) {
            setList({ status: "error", value: undefined, error: result.error });
          }
          return;
        }

        setList({ status: "ready", value: result.value, error: undefined });
        const currentNumber = selectedNumber();
        const selectedItem = result.value.items.find(
          (item) => item.number === currentNumber,
        );
        setSelectedNumber(
          selectedItem?.number ?? result.value.items[0]?.number ?? null,
        );
      })
      .catch((cause: unknown) => {
        if (
          generation !== repositoryGeneration ||
          repositoryKey !== activeRepositoryKey ||
          controller.signal.aborted
        ) {
          return;
        }
        const diagnostic =
          cause instanceof Error
            ? cause.message
            : "Could not load pull requests";
        const currentState = appContext.state();
        const currentKind = remoteKind(currentState);
        if (currentKind === undefined) {
          return;
        }
        setList({
          status: "error",
          value: undefined,
          error: {
            code: ForgeOperationErrorCode.IncompatibleResponse,
            kind: currentKind,
            diagnostic,
          },
        });
      });
  }

  function beginDetailsLoad(number: number, includeDiff: boolean): void {
    const state = appContext.state();
    const kind = remoteKind(state);
    if (kind === undefined) {
      return;
    }

    const currentList = list();
    const repository =
      currentList.status === "ready" ? currentList.value.repository : undefined;
    const repositoryKey =
      repository === undefined ? undefined : `${repository.fullName}#${number}`;
    const repositoryGenerationAtStart = repositoryGeneration;

    detailController?.abort();
    detailController = undefined;
    const generation = ++detailGeneration;
    const cached =
      repositoryKey === undefined ? undefined : detailCache.get(repositoryKey);
    if (
      cached !== undefined &&
      (!includeDiff || cached.collections.patch.status !== "not-requested") &&
      !hasFailedSection(cached)
    ) {
      setDetails({ status: "ready", value: cached, error: undefined });
      return;
    }

    const controller = new AbortController();
    detailController = controller;
    setDetails((current) => ({
      status: "loading",
      value:
        current.status === "ready" && current.value.summary.number === number
          ? current.value
          : undefined,
      error: undefined,
    }));

    void appContext.forge
      .getPullRequestDetails(number, {
        signal: controller.signal,
        includeDiff,
      })
      .then((result) => {
        if (
          generation !== detailGeneration ||
          repositoryGenerationAtStart !== repositoryGeneration ||
          controller.signal.aborted
        ) {
          return;
        }
        if (result.isErr()) {
          if (!isCancelled(result.error)) {
            setDetails({
              status: "error",
              value: undefined,
              error: result.error,
            });
          }
          return;
        }
        if (
          repositoryKey !== undefined &&
          `${result.value.repository.fullName}#${number}` === repositoryKey &&
          !hasFailedSection(result.value)
        ) {
          detailCache.set(repositoryKey, result.value);
        }
        setDetails({ status: "ready", value: result.value, error: undefined });
      })
      .catch((cause: unknown) => {
        if (
          generation !== detailGeneration ||
          repositoryGenerationAtStart !== repositoryGeneration ||
          controller.signal.aborted
        ) {
          return;
        }
        const diagnostic =
          cause instanceof Error
            ? cause.message
            : "Could not load pull request details";
        setDetails({
          status: "error",
          value: undefined,
          error: {
            code: ForgeOperationErrorCode.IncompatibleResponse,
            kind,
            diagnostic,
          },
        });
      });
  }

  function activate(number: number): void {
    const currentList = list();
    if (
      currentList.status !== "ready" ||
      !currentList.value.items.some((item) => item.number === number)
    ) {
      return;
    }
    setSelectedNumber(number);
    beginDetailsLoad(number, true);
  }

  function activateSelected(): void {
    const number = selectedNumber();
    if (number !== null) {
      activate(number);
    }
  }

  function moveSelection(offset: number): void {
    const currentList = list();
    if (
      currentList.status !== "ready" ||
      currentList.value.items.length === 0
    ) {
      return;
    }

    const currentNumber = selectedNumber();
    const currentItem = currentList.value.items.find(
      (item) => item.number === currentNumber,
    );
    const firstItem = currentList.value.items[0];
    if (currentItem === undefined && firstItem === undefined) {
      return;
    }
    const anchorItem = currentItem ?? firstItem;
    if (anchorItem === undefined) {
      return;
    }
    const nextItem = moveInList(currentList.value.items, anchorItem, offset);
    setSelectedNumber(nextItem.number);
  }

  function retryList(): void {
    beginListLoad(repositoryGeneration, activeRepositoryKey);
  }

  function retryDetails(): void {
    const number = selectedNumber();
    if (number !== null) {
      beginDetailsLoad(number, true);
    }
  }

  function retry(): void {
    if (details().status === "error") {
      retryDetails();
      return;
    }
    retryList();
  }

  createEffect(() => {
    const state = appContext.state();
    const repositoryKey = `${state.cwd}:${state.kind}`;
    const generation = ++repositoryGeneration;
    activeRepositoryKey = repositoryKey;
    listController?.abort();
    detailController?.abort();
    detailGeneration += 1;
    setSelectedNumber(null);
    setList(idle<PullRequestList>());
    setDetails(idle<PullRequestDetails>());

    if (remoteKind(state) === undefined) {
      return;
    }

    beginListLoad(generation, repositoryKey);
    onCleanup(() => {
      listController?.abort();
      detailController?.abort();
    });
  });

  onCleanup(() => {
    listController?.abort();
    detailController?.abort();
    detailCache.clear();
  });

  return {
    list,
    details,
    selectedNumber,
    moveSelection,
    activateSelected,
    activate,
    retryList,
    retryDetails,
    retry,
  };
}
