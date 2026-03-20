import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ["bin/metabase.ts"],
    format: ["cjs"],
    clean: false,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
