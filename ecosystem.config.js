module.exports = {
  apps: [
    {
      name: "emcoin-api",
      cwd: "/opt/emcoin/app",
      script: "dist-server/server/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        API_HOST: "127.0.0.1",
        API_PORT: "4000"
      },
      error_file: "/opt/emcoin/logs/api-error.log",
      out_file: "/opt/emcoin/logs/api-out.log",
      merge_logs: true,
      max_memory_restart: "500M"
    },
    {
      name: "emcoin-web",
      cwd: "/opt/emcoin/app",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/opt/emcoin/logs/web-error.log",
      out_file: "/opt/emcoin/logs/web-out.log",
      merge_logs: true,
      max_memory_restart: "1G"
    }
  ]
};
