import { describe, expect, it } from "vitest";
import { deriveState } from "./index";

describe("deriveState", () => {
  it("returns an object", () => {
    expect(deriveState()).toEqual({});
  });
});
