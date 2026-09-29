const { spawn } = require('child_process');

const child = spawn('cmd.exe', ['/d', '/s', '/c', 'call start-frontend-localhost.bat'], {
  cwd: __dirname,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
});

child.unref();
console.log(`Started SLAR 2.0 frontend launcher pid=${child.pid}`);
