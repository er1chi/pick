export class ForgejoProvider {
  public readonly baseUrl: string;
  private readonly authorization: string;

  constructor({ baseUrl, token }: { baseUrl: string; token: string }) {
    this.baseUrl = baseUrl;
    this.authorization = `token ${token}`;
  }

  public request(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", this.authorization);
    return fetch(new URL(path, this.baseUrl), { ...init, headers });
  }
}
