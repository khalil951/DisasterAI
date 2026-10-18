import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, classifyBody, checkInput } from "./client";
import { degradedLines, imageMessage, incidentTypeLabel, repairDiscardedProblems, severityTone, short, slowestStep, statusBanner, timelineRows, validationView } from "./render";
import { STAGES, median, progressAt } from "./estimate";
import type { RunBody } from "./types";

const OK: RunBody = {
  status: "ok",
  incident_type: "forest_fire",
  severity: "high",
  report: { severity: "high", image_status: "analysed" },
  validation: { status: "pass", violations: [], repaired: false },
  degraded_steps: [],
  models_used: [
    { step: "incident", provider: "groq", model: "openai/gpt-oss-120b", seconds: 1.4, failed_attempts: [] },
    { step: "report", provider: "groq", model: "qwen/qwen3.8-27b", seconds: 5.0, failed_attempts: ["groq:x rate limit"] },
  ],
};

describe("checkInput", () => {
  it("accepts a normal description", () => expect(checkInput("A fire near the village")).toEqual([]));
  it("refuses an empty or too short description", () => {
    expect(checkInput("  ")).toHaveLength(1);
    expect(checkInput("ab")[0]).toContain("at least 3");
  });
  it("refuses an over-long description", () => expect(checkInput("x".repeat(4001))[0]).toContain("too long"));
  it("refuses unsupported or huge photos", () => {
    expect(checkInput("A fire", { size: 10, type: "image/gif" })[0]).toContain("not supported");
    expect(checkInput("A fire", { size: MAX_IMAGE_BYTES + 1, type: "image/png" })[0]).toContain("limit is 8 MB");
    expect(checkInput("A fire", { size: 1000, type: "image/jpeg" })).toEqual([]);
  });
});

describe("classifyBody", () => {
  it("follows the workflow status", () => {
    expect(classifyBody({ status: "ok" })).toBe("ok");
    expect(classifyBody({ status: "degraded" })).toBe("degraded");
    expect(classifyBody({ status: "flagged" })).toBe("flagged");
    expect(classifyBody({ status: "rejected" })).toBe("rejected");
  });
  it("treats an unknown status with a report as degraded, without one as not JSON", () => {
    expect(classifyBody({ status: "weird", report: {} })).toBe("degraded");
    expect(classifyBody({ status: "weird" })).toBe("not_json");
  });
});

describe("statusBanner", () => {
  it("success when ok", () => expect(statusBanner(OK).level).toBe("success"));
  it("warns when degraded and names the steps", () => {
    const b = statusBanner({ ...OK, status: "degraded", degraded_steps: [{ step: "vision", reason: "x" }, { step: "vision", reason: "y" }] });
    expect(b.level).toBe("warning");
    expect(b.message).toContain("vision");
    expect(b.message.match(/vision/g)).toHaveLength(1);
  });
  it("counts failed checks when flagged", () => {
    const b = statusBanner({ ...OK, status: "flagged", validation: { violations: [{ check: "scope", message: "m" }], repaired: true } });
    expect(b.title).toContain("1 automatic check failed");
    expect(b.message).toContain("repair pass did not remove");
  });
  it("explains a discarded repair in plain words", () => {
    const b = statusBanner({ ...OK, status: "flagged", validation: { violations: [{ check: "a", message: "m" }], repaired: true, repair_discarded: true } });
    expect(b.message).toContain("made the report worse");
  });
  it("errors when rejected or when there is no report", () => {
    expect(statusBanner({ status: "rejected", error: "too short" })).toMatchObject({ level: "error", message: "too short" });
    expect(statusBanner({ status: "degraded" }).level).toBe("warning");
    expect(statusBanner({ status: "weird" }).level).toBe("error");
  });
});

describe("imageMessage", () => {
  it("never calls a failed analysis an unusable image", () => {
    const m = imageMessage({ image_status: "analysis_failed" }, true);
    expect(m.level).toBe("warning");
    expect(m.text).not.toContain("too dark");
    expect(m.status).toBe("analysis_failed");
  });
  it("says so when no photo was sent", () => expect(imageMessage({ image_status: "not_provided" }, false).level).toBe("info"));
  it("falls back to the sent flag when the report has no status", () => {
    expect(imageMessage(null, true).status).toBe("analysis_failed");
    expect(imageMessage(null, false).status).toBe("not_provided");
  });
});

describe("timeline and validation", () => {
  it("builds rows with the short model name and failed attempts", () => {
    const rows = timelineRows(OK.models_used);
    expect(rows[0]?.model).toBe("gpt-oss-120b");
    expect(rows[1]?.failedAttempts).toBe(1);
    expect(slowestStep(rows)?.step).toBe("report");
    expect(slowestStep([])).toBeNull();
  });
  it("shows the first violations before a repair", () => {
    const v = validationView({ status: "pass", repaired: true, violations: [], first_violations: [{ check: "scope", message: "m" }] });
    expect(v).toMatchObject({ status: "pass", repaired: true });
    expect(v.first).toEqual([{ check: "scope", message: "m" }]);
  });
  it("lists what a thrown-away repair got wrong", () => {
    expect(repairDiscardedProblems({ repair_discarded: true, repair_violations: [{ check: "schema", message: "'disclaimer' is a required property" }] })).toHaveLength(1);
    expect(repairDiscardedProblems({ status: "pass" })).toEqual([]);
  });
  it("formats degraded steps", () => expect(degradedLines([{ step: "vision", reason: "failed" }])).toEqual(["vision: failed"]));
});

describe("small helpers", () => {
  it("maps severity to a tone, unknown to undetermined", () => {
    expect(severityTone("High")).toBe("high");
    expect(severityTone("undetermined")).toBe("undetermined");
    expect(severityTone(null)).toBe("undetermined");
  });
  it("labels incident types", () => {
    expect(incidentTypeLabel("forest_fire")).toBe("Forest fire");
    expect(incidentTypeLabel("something_new")).toBe("something new");
    expect(incidentTypeLabel(undefined)).toBe("-");
  });
  it("shortens text", () => {
    expect(short("a  b\nc", 10)).toBe("a b c");
    expect(short("x".repeat(30), 10)).toHaveLength(10);
  });
});

describe("estimate", () => {
  it("skips the photo stage without a photo", () => {
    expect(progressAt(0, false).stages.map((s) => s.key)).not.toContain("vision");
    expect(progressAt(0, true).stages).toHaveLength(STAGES.length);
  });
  it("moves through the stages and flags an overrun", () => {
    expect(progressAt(0, true).index).toBe(0);
    expect(progressAt(5, true).index).toBe(1);
    const late = progressAt(500, true);
    expect(late.overrun).toBe(true);
    expect(late.index).toBe(late.stages.length - 1);
  });
  it("scales to a typical total from past runs", () => {
    const fast = progressAt(10, true, 100);
    const slow = progressAt(10, true, 20);
    expect(slow.index).toBeGreaterThanOrEqual(fast.index);
    expect(fast.total).toBe(100);
  });
  it("median ignores junk", () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([0, NaN])).toBeNull();
  });
});
