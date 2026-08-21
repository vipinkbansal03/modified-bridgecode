module.exports = {
  apps: [
    {
      name: "modern-backend",
      cwd: "/var/www/html/backend",
      script: "dist/server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        APP_ENV: "production",
        PORT: "3001",
        DOTENV_CONFIG_PATH: ".env.production",
      },
    },
    {
      name: "modern-frontend",
      cwd: "/var/www/html/frontend",
      script: "npm",
      args: "run start:production",
      env: {
        NODE_ENV: "production",
        APP_ENV: "production",
        PORT: "3000",
      },
    },
    {
      name: "modern-backend-staging",
      cwd: "/var/www/staging/backend",
      script: "dist/server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        APP_ENV: "staging",
        PORT: "4001",
        DOTENV_CONFIG_PATH: ".env.staging",
      },
    },
    {
      name: "modern-frontend-staging",
      cwd: "/var/www/staging/frontend",
      script: "npm",
      args: "run start:staging",
      env: {
        NODE_ENV: "production",
        APP_ENV: "staging",
        PORT: "4000",
      },
    },
  ],
};
