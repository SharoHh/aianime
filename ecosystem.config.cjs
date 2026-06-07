module.exports = {
  apps: [
    {
      name: 'aianime',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3000',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      time: true,
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1'
      }
    }
  ]
}
