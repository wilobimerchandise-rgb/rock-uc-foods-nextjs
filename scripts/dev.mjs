import { spawn } from 'node:child_process';

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

if (!args.includes('-p') && !args.includes('--port')) {
  args.push('-p', '3000');
}

const child = spawn('npx', ['next', 'dev', ...args], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
