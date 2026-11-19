export interface PasswordValidationResult {
  isValid: boolean;
  errors: {
    minLength: boolean;
    maxLength: boolean;
  };
}

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Validates password length according to OWASP ASVS 5.0 V6.2.5:
 * - Minimum 8 characters (15+ recommended for passphrases)
 * - Maximum 128 characters
 * - No character-class composition restrictions
 */
export function validatePassword(password: string): PasswordValidationResult {
  const pwd = password || "";
  const minLength = pwd.length >= MIN_PASSWORD_LENGTH;
  const maxLength = pwd.length <= MAX_PASSWORD_LENGTH;

  const isValid = minLength && maxLength;

  return {
    isValid,
    errors: {
      minLength,
      maxLength,
    },
  };
}
