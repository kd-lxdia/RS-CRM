const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = __dirname;
const backendEnv = dotenv.config({ path: path.join(root, 'backend', '.env') }).parsed || {};
const out = fs.openSync(path.join(root, 'backend-localhost.log'), 'a');
const err = fs.openSync(path.join(root, 'backend-localhost.err.log'), 'a');

fs.writeSync(out, `starting backend at ${new Date().toISOString()}\n`);

const child = spawn(process.execPath, [
  '-r',
  'ts-node/register/transpile-only',
  'backend\\src\\index.ts',
], {
  cwd: root,
  detached: true,
  env: {
    ...process.env,
    ...backendEnv,
    TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: 'commonjs', moduleResolution: 'node' }),
  },
  stdio: ['ignore', out, err],
  windowsHide: true,
});

child.unref();
console.log(`Started SLAR 2.0 backend launcher pid=${child.pid}`);
