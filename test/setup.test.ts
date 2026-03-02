import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Project Setup", () => {
  it("should have package.json with correct name", () => {
    const pkgPath = resolve(__dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("opencode-plugin-apprise");
  });

  it("should be able to import src/index.ts as a module", async () => {
    const plugin = await import("../src/index.ts");
    expect(plugin.default).toBeDefined();
    expect(typeof plugin.default).toBe("function");
  });

  it("should generate dist/opencode-plugin-apprise.js after build", async () => {
    const { execSync } = require("child_process");
    execSync("bun run build", { cwd: resolve(__dirname, "..") });
    
    const distPath = resolve(__dirname, "../dist/opencode-plugin-apprise.js");
    const fs = require("fs");
    expect(fs.existsSync(distPath)).toBe(true);
  });
});
