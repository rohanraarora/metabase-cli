import { describe, it, expect } from "vitest";
import { Command, InvalidArgumentError } from "commander";
import { parseIntArg } from "../src/commands/helpers.js";

// Regression coverage for the bug where `dashboard add-card --width 12 --height 8`
// failed with a 400 ("dashcards: [object Object]") or silently used the wrong
// size. The root cause was passing the global `parseInt` directly as a Commander
// coercion function. Commander invokes a coercion as `fn(value, previous)`, and
// on the first parse `previous` is the option's *default value*. Because
// `parseInt(string, radix)` treats its second argument as the radix, a numeric
// default became the parsing base — e.g. `--width 12` (default 6) parsed as
// `parseInt("12", 6) === 8`, and `--height 8` (default 4) as
// `parseInt("8", 4) === NaN` (8 is not a valid base-4 digit).

describe("parseIntArg", () => {
  it("parses a decimal string in base 10", () => {
    expect(parseIntArg("12")).toBe(12);
    expect(parseIntArg("0")).toBe(0);
    expect(parseIntArg("100")).toBe(100);
  });

  it("ignores a second argument instead of treating it as a radix", () => {
    // The whole point of the fix: parseInt("12", 6) === 8 and
    // parseInt("8", 4) === NaN, but parseIntArg must always use base 10.
    const coerce = parseIntArg as (value: string, previous?: unknown) => number;
    expect(coerce("12", 6)).toBe(12);
    expect(coerce("8", 4)).toBe(8);
  });

  it("throws InvalidArgumentError on a non-integer", () => {
    expect(() => parseIntArg("abc")).toThrow(InvalidArgumentError);
    expect(() => parseIntArg("")).toThrow(InvalidArgumentError);
  });
});

describe("parseIntArg as a Commander coercion with a numeric default", () => {
  // Mirrors the exact `dashboard add-card` option setup.
  function buildCmd() {
    let captured: Record<string, unknown> = {};
    const cmd = new Command();
    cmd
      .command("add-card")
      .option("--col <n>", "Column position", parseIntArg, 0)
      .option("--width <n>", "Card width", parseIntArg, 6)
      .option("--height <n>", "Card height", parseIntArg, 4)
      .action((opts) => {
        captured = opts;
      });
    return { cmd, getOpts: () => captured };
  }

  it("uses the provided value, not the default, as the parsing base", () => {
    const { cmd, getOpts } = buildCmd();
    cmd.parse(["node", "x", "add-card", "--width", "12", "--height", "8", "--col", "6"]);
    expect(getOpts()).toMatchObject({ width: 12, height: 8, col: 6 });
  });

  it("falls back to the numeric default when the option is omitted", () => {
    const { cmd, getOpts } = buildCmd();
    cmd.parse(["node", "x", "add-card"]);
    expect(getOpts()).toMatchObject({ width: 6, height: 4, col: 0 });
  });
});
