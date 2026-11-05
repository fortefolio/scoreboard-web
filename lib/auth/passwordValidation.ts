export interface PasswordValidationResult {
  isValid: boolean;
  errors: {
    minLength: boolean;
    hasLower: boolean;
    hasUpper: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Validates password strength according to security standards:
 * - Minimum 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one digit
 * - At least one special character / symbol
 */
export function validatePassword(password: string): PasswordValidationResult {
  const pwd = password || "";
  const minLength = pwd.length >= MIN_PASSWORD_LENGTH;
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pwd);

  const isValid = minLength && hasLower && hasUpper && hasNumber && hasSymbol;

  return {
    isValid,
    errors: {
      minLength,
      hasLower,
      hasUpper,
      hasNumber,
      hasSymbol,
    },
  };
}
