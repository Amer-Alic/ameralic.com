import { execFileSync } from 'node:child_process';

export function writingGitHubEnv() {
  try {
    const token = execFileSync('gh', ['auth', 'token', '--hostname', 'github.com', '--user', 'Amer-Alic'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }).trim();
    if (!token) throw new Error('Missing token');
    return { ...process.env, GH_TOKEN: token };
  } catch {
    throw new Error('Sign in to GitHub CLI as Amer-Alic to access the private writing inbox.');
  }
}
