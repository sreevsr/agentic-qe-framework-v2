/**
 * security.ts — Shared security utilities for the replay engine.
 *
 * Provides path validation, expression sanitization, and input guards
 * to prevent path traversal, code injection, and information disclosure
 * from untrusted plan JSON content.
 */

import * as path from 'path';

/** Project root directory (where the framework is installed). */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Validate that a file path resolves within the project directory.
 * Prevents path traversal attacks from plan JSON content.
 *
 * @param filePath The path to validate (can be relative or absolute)
 * @param context Description for error messages (e.g., "WRITE_DATA file")
 * @throws Error if the path escapes the project directory
 */
export function validatePathWithinProject(filePath: string, context: string): string {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error(`${context}: path traversal detected. Path "${filePath}" resolves outside the project directory.`);
  }
  return resolved;
}

/**
 * Validate that a file path resolves within a specific allowed directory.
 *
 * @param filePath The path to validate
 * @param allowedDir The directory the path must stay within
 * @param context Description for error messages
 */
export function validatePathWithinDir(filePath: string, allowedDir: string, context: string): string {
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(allowedDir);
  if (!resolved.startsWith(resolvedDir)) {
    throw new Error(`${context}: path "${filePath}" must be within "${allowedDir}".`);
  }
  return resolved;
}

/**
 * Validate that a CALCULATE expression contains only safe arithmetic characters.
 * Defense-in-depth: even though we use new Function(), the expression is validated first.
 *
 * Allowed: digits, whitespace, +, -, *, /, (, ), ., comma, %
 * Blocked: letters (prevents function calls), brackets, semicolons, backticks, etc.
 */
export function validateArithmeticExpression(expr: string): void {
  // Primary check: whitelist of safe characters
  const SAFE_CHARS = /^[\d\s+\-*/().,%]+$/;
  if (!SAFE_CHARS.test(expr)) {
    throw new Error(`CALCULATE: expression contains unsafe characters: "${expr}". Only numbers and arithmetic operators allowed.`);
  }

  // Secondary check: reject patterns that could be code even with safe chars
  // Empty parentheses () could be function calls in some edge cases
  if (/\(\s*\)/.test(expr)) {
    throw new Error(`CALCULATE: expression contains empty parentheses: "${expr}".`);
  }

  // Sanity: expression should evaluate to a number
  // (this check happens after execution, but we validate structure pre-execution)
}

/**
 * Validate that a skill name doesn't contain path traversal.
 * Skill names should be simple identifiers: alphanumeric + hyphens.
 */
export function validateSkillName(skillName: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(skillName)) {
    throw new Error(`SKILL: invalid skill name "${skillName}". Only letters, numbers, hyphens, underscores allowed.`);
  }
}

/**
 * Mask sensitive values in strings for safe logging/reporting.
 * Detects common sensitive field names and masks their values.
 */
export function maskSensitiveValue(key: string, value: string): string {
  const SENSITIVE_PATTERNS = ['password', 'token', 'secret', 'cvc', 'cvv', 'card', 'key', 'auth', 'credential', 'ssn'];
  const keyLower = key.toLowerCase();
  if (SENSITIVE_PATTERNS.some(p => keyLower.includes(p))) {
    return '***';
  }
  return value;
}
