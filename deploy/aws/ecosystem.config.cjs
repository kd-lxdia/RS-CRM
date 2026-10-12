// pm2 process for the backend. Env comes from backend/.env (loaded by dotenv in src/index.ts).
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'rs-crm',
      cwd: path.resolve(__dirname, '../../backend'),
      script: 'dist/index.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '900M',
      time: true,
    },
  ],
};
