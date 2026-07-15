import { spawnSync } from 'node:child_process';

function runNpm(script) {
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) throw new Error('npm_execpath is unavailable');

  const result = spawnSync(process.execPath, [npmCliPath, 'run', script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm run ${script} failed`);
}

if (process.env.VERCEL_ENV === 'production') {
  console.log('Production build detected; applying database migrations before build.');
  runNpm('db:migrate:deploy');
} else {
  console.log('Non-production build detected; database migrations skipped.');
}

runNpm('build');
