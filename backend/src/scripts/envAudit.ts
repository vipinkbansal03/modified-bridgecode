import { printBackendEnvInfo, validateBackendEnv } from "../config/env";

const mode = process.argv[2] || "check";

if (mode === "info") {
  printBackendEnvInfo();
} else {
  validateBackendEnv();
  console.log("Backend environment validation passed.");
}
