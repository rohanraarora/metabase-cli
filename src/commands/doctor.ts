import { Command } from "commander";
import { resolveClient } from "./helpers.js";

export function doctorCommand(): Command {
  const cmd = new Command("doctor")
    .description("Check Metabase instance compatibility and connectivity")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli doctor`,
    )
    .action(async () => {
      const client = await resolveClient();

      console.log("Running diagnostics...\n");

      let passed = 0;
      let failed = 0;
      let warnings = 0;

      // 1. Check connectivity & version
      try {
        const props = await client.get<Record<string, any>>("/api/session/properties");
        const version = props.version?.tag || props.version || "unknown";
        console.log(`✓ Connected to Metabase ${version}`);
        console.log(`  Instance: ${client.getProfile().domain}`);
        passed++;

        // Check for known compatibility issues
        if (typeof version === "string" && version.startsWith("v0.")) {
          const minor = parseInt(version.split(".")[1], 10);
          if (minor >= 59) {
            console.log(`  ⚠ Metabase v0.59+ detected — dataset_query uses stages format`);
            warnings++;
          }
        }
      } catch (e: any) {
        console.log(`✗ Failed to connect: ${e.message}`);
        failed++;
        // Can't continue if we can't connect
        printSummary(passed, failed, warnings);
        return;
      }

      // 2. Check authentication
      try {
        const user = await client.get<any>("/api/user/current");
        console.log(`✓ Authenticated as ${user.first_name} ${user.last_name} (${user.email})`);
        if (user.is_superuser) {
          console.log(`  Admin: yes`);
        }
        passed++;
      } catch (e: any) {
        console.log(`✗ Authentication check failed: ${e.message}`);
        failed++;
      }

      // 3. Check database list
      try {
        const dbs = await client.get<any>("/api/database");
        const dbList = Array.isArray(dbs) ? dbs : (dbs as any).data || [];
        console.log(`✓ Databases accessible: ${dbList.length} found`);
        passed++;
      } catch (e: any) {
        console.log(`✗ Database list failed: ${e.message}`);
        failed++;
      }

      // 4. Check card/question API
      try {
        await client.get<any>("/api/card", { limit: "1" });
        console.log(`✓ Card API responsive`);
        passed++;
      } catch (e: any) {
        console.log(`✗ Card API failed: ${e.message}`);
        failed++;
      }

      // 5. Check dashboard API (detect deprecation)
      try {
        const res = await client.requestRaw("GET", "/api/dashboard");
        if (res.status === 404) {
          console.log(`⚠ Dashboard list endpoint deprecated (404) — search fallback will be used`);
          warnings++;
        } else if (res.ok) {
          console.log(`✓ Dashboard API responsive`);
          passed++;
        } else {
          console.log(`✗ Dashboard API returned ${res.status}`);
          failed++;
        }
      } catch (e: any) {
        console.log(`✗ Dashboard API failed: ${e.message}`);
        failed++;
      }

      // 6. Check collection API
      try {
        await client.get<any>("/api/collection");
        console.log(`✓ Collection API responsive`);
        passed++;
      } catch (e: any) {
        console.log(`✗ Collection API failed: ${e.message}`);
        failed++;
      }

      // 7. Check notification API (replaces alerts)
      try {
        await client.get<any>("/api/notification");
        console.log(`✓ Notification API responsive`);
        passed++;
      } catch (e: any) {
        console.log(`⚠ Notification API unavailable: ${e.message}`);
        warnings++;
      }

      // 8. Check search API
      try {
        await client.get<any>("/api/search", { q: "", limit: "1" });
        console.log(`✓ Search API responsive`);
        passed++;
      } catch (e: any) {
        console.log(`✗ Search API failed: ${e.message}`);
        failed++;
      }

      printSummary(passed, failed, warnings);
    });

  return cmd;
}

function printSummary(passed: number, failed: number, warnings: number) {
  console.log(`\n─────────────────────────────`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  if (failed > 0) {
    console.log(`\nSome checks failed. Your Metabase instance may not be fully compatible.`);
    process.exitCode = 1;
  } else if (warnings > 0) {
    console.log(`\nAll checks passed with warnings.`);
  } else {
    console.log(`\nAll checks passed. Your Metabase instance is fully compatible.`);
  }
}
