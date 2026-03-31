/**
 * variable-resolver.ts — Resolves {{variable}} references in plan step payloads.
 *
 * Three namespaces:
 *   {{ENV.BASE_URL}}           — from output/.env
 *   {{testData.signupName}}    — from dataSources files
 *   {{blueTopPrice}}           — from captured variables (runtime)
 *   {{_runtime.timestamp}}     — system-generated runtime values
 *   {{_downloads.invoice}}     — download file paths (runtime)
 *   {{dataSources.orders[0]}}  — from loaded external data files
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';

export interface VariableContext {
  ENV: Record<string, string>;
  testData: Record<string, any>;
  dataSources: Record<string, any>;
  _runtime: RuntimeVars;
  _downloads: Record<string, string>;
  [key: string]: any; // captured variables are added at top level
}

export interface RuntimeVars {
  timestamp: string;
  runId: string;
  stepNumber: number;
  sectionName: string;
}

/**
 * Build the initial variable context from .env and data sources.
 */
export function buildContext(
  envPath: string,
  testDataOverride?: Record<string, any>,
  dataSources?: Record<string, any>,
): VariableContext {
  // Load .env
  const envResult = dotenv.config({ path: envPath });
  const envVars: Record<string, string> = {};
  if (envResult.parsed) {
    Object.assign(envVars, envResult.parsed);
  }
  // Also include process.env for any pre-set variables
  for (const key of Object.keys(process.env)) {
    if (!envVars[key] && process.env[key]) {
      envVars[key] = process.env[key]!;
    }
  }

  return {
    ENV: envVars,
    testData: testDataOverride || {},
    dataSources: dataSources || {},
    _runtime: {
      timestamp: new Date().toISOString(),
      runId: crypto.randomUUID(),
      stepNumber: 0,
      sectionName: '',
    },
    _downloads: {},
  };
}

/**
 * Resolve all {{variable}} references in a string.
 * Throws if a variable cannot be resolved.
 */
export function resolveString(template: string, context: VariableContext): string {
  if (!template || typeof template !== 'string') return template;
  if (!template.includes('{{')) return template;

  return template.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
    const trimmed = varPath.trim();
    const value = getNestedValue(context, trimmed);
    if (value === undefined) {
      throw new Error(`Unresolved variable: {{${trimmed}}}`);
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

/**
 * Deep-resolve all string values in an object or array.
 * Returns a new object with all {{variables}} replaced.
 */
export function resolveDeep(obj: any, context: VariableContext): any {
  if (typeof obj === 'string') {
    return resolveString(obj, context);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => resolveDeep(item, context));
  }
  if (obj !== null && typeof obj === 'object') {
    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip _fingerprint — healer-only metadata
      if (key === '_fingerprint') {
        resolved[key] = value;
        continue;
      }
      resolved[key] = resolveDeep(value, context);
    }
    return resolved;
  }
  return obj;
}

/**
 * Get a nested value from an object by dot-separated path.
 * Supports array indexing: "dataSources.orders[0].name"
 */
function getNestedValue(obj: any, path: string): any {
  // Split path by dots, handling array brackets
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.');

  let current = obj;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;

    // Try direct property access
    if (segment in current) {
      current = current[segment];
    } else if (!isNaN(Number(segment))) {
      // Array index
      current = current[Number(segment)];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Set a captured variable in the context (top-level namespace).
 */
export function setCapturedVariable(context: VariableContext, name: string, value: any): void {
  context[name] = value;
}

/**
 * Validate that all required ENV variables are present.
 * Returns list of missing variable names.
 */
export function validateEnvVariables(
  requiredVars: string[],
  context: VariableContext,
): string[] {
  const missing: string[] = [];
  for (const varName of requiredVars) {
    if (!context.ENV[varName]) {
      missing.push(varName);
    }
  }
  return missing;
}

/**
 * Collect all {{variable}} references from a plan (for dry-run validation).
 */
export function collectVariableRefs(obj: any): string[] {
  const refs = new Set<string>();
  const json = JSON.stringify(obj);
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(json)) !== null) {
    refs.add(match[1].trim());
  }
  return Array.from(refs);
}
