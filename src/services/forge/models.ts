export interface ForgeUser {
  readonly login: string;
}

interface ForgeResource {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: "open" | "closed";
  readonly author: ForgeUser;
}

export interface PullRequest extends ForgeResource {}

export interface Issue extends ForgeResource {}

export interface Comment {
  readonly id: number;
  readonly author: ForgeUser;
  readonly body: string;
  readonly createdAt: string;
}
