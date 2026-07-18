const GITHUB_HANDLE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/;

export function normalizeGitHubHandle(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return GITHUB_HANDLE.test(normalized) ? normalized : null;
}
