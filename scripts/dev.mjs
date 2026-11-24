import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Next.js CLI accepts -H or --hostname, not --host.
// Vite and common dev runners pass --host. We translate --host to -H so both work seamlessly.
const args = [];
const rawArgs = process.argv.slice(2);

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === '--host') {
    args.push('-H');
    if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) {
      args.push(rawArgs[++i]);
    } else {
      args.push('0.0.0.0');
    }
  } else if (arg.startsWith('--host=')) {
    args.push('-H', arg.split('=')[1]);
  } else {
    args.push(arg);
  }
}

if (!args.includes('-H') && !args.includes('--hostname')) {
  args.push('-H', '0.0.0.0');
}

if (!args.includes('-p') && !args.includes('--port')) {
  args.push('-p', '3000');
}

const env = { ...process.env };
if (!env.NODE_OPTIONS || !env.NODE_OPTIONS.includes('--max-old-space-size')) {
  env.NODE_OPTIONS = [env.NODE_OPTIONS, '--max-old-space-size=1536']
    .filter(Boolean)
    .join(' ');
}

const localNextBin = path.resolve(process.cwd(), 'node_modules/next/dist/bin/next');
const useDirectNode = fs.existsSync(localNextBin);

const child = useDirectNode
  ? spawn(process.execPath, [localNextBin, 'dev', ...args], {
      stdio: 'inherit',
      env,
    })
  : spawn('npx', ['next', 'dev', ...args], {
      stdio: 'inherit',
      shell: true,
      env,
    });

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) {
      child.kill(sig);
    }
  });
}

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
