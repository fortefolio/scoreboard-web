import { describe, expect, it } from "vitest";
import { validatePassword } from "./passwordValidation";

describe("validatePassword", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const res = validatePassword("Ab1!");
    expect(res.isValid).toBe(false);
    expect(res.errors.minLength).toBe(false);
  });

  it("rejects passwords without lowercase letters", () => {
    const res = validatePassword("ABCDEF1!");
    expect(res.isValid).toBe(false);
    expect(res.errors.hasLower).toBe(false);
  });

  it("rejects passwords without uppercase letters", () => {
    const res = validatePassword("abcdef1!");
    expect(res.isValid).toBe(false);
    expect(res.errors.hasUpper).toBe(false);
  });

  it("rejects passwords without numbers", () => {
    const res = validatePassword("Abcdefgh!");
    expect(res.isValid).toBe(false);
    expect(res.errors.hasNumber).toBe(false);
  });

  it("rejects passwords without symbols", () => {
    const res = validatePassword("Abcdefg1");
    expect(res.isValid).toBe(false);
    expect(res.errors.hasSymbol).toBe(false);
  });

  it("accepts a password meeting all criteria", () => {
    const res = validatePassword("SecurePass123!");
    expect(res.isValid).toBe(true);
    expect(res.errors).toEqual({
      minLength: true,
      hasLower: true,
      hasUpper: true,
      hasNumber: true,
      hasSymbol: true,
    });
  });
});
