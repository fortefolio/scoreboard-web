import { describe, expect, it } from "vitest";
import { MAX_PASSWORD_LENGTH, validatePassword } from "./passwordValidation";

describe("validatePassword", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const res = validatePassword("Ab1!567");
    expect(res.isValid).toBe(false);
    expect(res.errors.minLength).toBe(false);
  });

  it("rejects passwords exceeding maximum length", () => {
    const res = validatePassword("a".repeat(MAX_PASSWORD_LENGTH + 1));
    expect(res.isValid).toBe(false);
    expect(res.errors.maxLength).toBe(false);
  });

  it("accepts passphrases without uppercase, digits, or symbols", () => {
    const res = validatePassword("correct horse battery staple");
    expect(res.isValid).toBe(true);
    expect(res.errors).toEqual({
      minLength: true,
      maxLength: true,
    });
  });

  it("accepts an 8-character lowercase password", () => {
    const res = validatePassword("abcdefgh");
    expect(res.isValid).toBe(true);
  });
});
