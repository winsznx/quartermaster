/**
 * EWMA helper math tests — PRD §8.3.
 * NOT an upstream test. Phase 3.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  DEFAULT_ALPHA,
  ewmaSeries,
  ewmaStep,
  meanHourlyBurn,
} from "../lib/qm/ewma.js";

describe("ewmaStep", () => {
  it("with previous=0 reduces to alpha * recent", () => {
    assert.equal(ewmaStep(0, 5, 0.3), 0.3 * 5);
  });

  it("blends previous and recent per the formula", () => {
    // ewma = 0.3 * 10 + 0.7 * 1 = 3.7
    assert.equal(ewmaStep(1, 10, 0.3).toFixed(4), "3.7000");
  });

  it("default alpha is 0.30", () => {
    assert.equal(DEFAULT_ALPHA, 0.30);
  });

  it("rejects alpha out of (0, 1]", () => {
    assert.throws(() => ewmaStep(0, 1, 0));
    assert.throws(() => ewmaStep(0, 1, 1.1));
    assert.throws(() => ewmaStep(0, 1, -0.5));
  });

  it("rejects negative inputs", () => {
    assert.throws(() => ewmaStep(-1, 1));
    assert.throws(() => ewmaStep(0, -1));
  });
});

describe("ewmaSeries — closed-form behaviour", () => {
  it("steady-state series of 1/h converges to ~1", () => {
    const { final } = ewmaSeries(new Array(7 * 24).fill(1));
    // After 168 steps with α=0.3 the residual is (0.7)^168 ≈ 4e-27 — final
    // should be effectively 1.
    assert.ok(Math.abs(final - 1) < 1e-9, `expected ≈1, got ${final}`);
  });

  it("zero series stays zero", () => {
    const { final, trace } = ewmaSeries(new Array(24).fill(0));
    assert.equal(final, 0);
    assert.ok(trace.every((v) => v === 0));
  });

  it("steady 1/h then a single 11 spike: spike still pulls EWMA above baseline", () => {
    const series = [...new Array(7 * 24).fill(1), 11];
    const { final } = ewmaSeries(series);
    // After convergence to ~1, one step with input 11 → 0.3*11 + 0.7*1 = 4.0
    assert.ok(Math.abs(final - 4.0) < 1e-6, `expected ≈4.0, got ${final}`);
  });

  it("real ramp 0.5 → 2 → 4 (one hour each, after warmup) trends upward", () => {
    const warmup = new Array(7 * 24).fill(0.5);
    const series = [...warmup, 2, 4];
    const { trace, final } = ewmaSeries(series);
    // Warm-up converges to ~0.5, then 2 → 0.95, then 4 → 1.865
    const afterWarmup = trace[warmup.length - 1];
    assert.ok(
      Math.abs(afterWarmup - 0.5) < 1e-6,
      `warmup expected ≈0.5, got ${afterWarmup}`,
    );
    assert.ok(Math.abs(final - 1.865) < 1e-3, `final expected ≈1.865, got ${final}`);
    assert.ok(final > afterWarmup, "EWMA should trend upward on ramp");
  });

  it("alpha=1 makes EWMA == latest value (no smoothing)", () => {
    const { final } = ewmaSeries([0, 0, 7], 1);
    assert.equal(final, 7);
  });
});

describe("meanHourlyBurn", () => {
  it("returns 0 on empty input", () => {
    assert.equal(meanHourlyBurn([]), 0);
    assert.equal(meanHourlyBurn(undefined), 0);
  });

  it("averages an array", () => {
    assert.equal(meanHourlyBurn([1, 2, 3, 4]), 2.5);
  });
});
