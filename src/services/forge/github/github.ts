import { Octokit } from "octokit";

export class GithubProvider {
  public readonly octokit: Octokit;

  constructor({ token }: { token: string }) {
    this.octokit = new Octokit({ auth: token });
  }
}
