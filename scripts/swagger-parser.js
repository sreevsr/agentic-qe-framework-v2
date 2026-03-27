#!/usr/bin/env node

/**
 * swagger-parser.js — Structured summary of OpenAPI/Swagger specs for the Explorer-Builder
 *
 * DESIGN PRINCIPLE: This script is a token-saving optimization for API scenario generation.
 * It parses the full Swagger/OpenAPI JSON spec and produces a compact, structured summary
 * with resolved schemas, CRUD groupings, sample request bodies, and auth detection.
 * The agent reads the summary (~5-10K tokens) instead of the raw spec (~50-200K tokens).
 *
 * - The script NEVER decides which scenarios to generate (that's LLM work)
 * - The script NEVER writes scenario .md files
 * - The script resolves $ref pointers, flattens schemas, detects CRUD patterns,
 *   and generates sample request bodies from schema definitions
 *
 * Supports: OpenAPI 3.0.x / 3.1.x and Swagger 2.0
 *
 * Usage:
 *   node scripts/swagger-parser.js --spec=<path-to-spec.json>
 *
 * Output:
 *   {spec-filename}.parsed.json (alongside the input spec file)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--(\S+?)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const specPath = args.spec ? path.resolve(args.spec) : null;

if (!specPath) {
  console.error('Usage: node scripts/swagger-parser.js --spec=<path-to-spec.json>');
  process.exit(1);
}

if (!fs.existsSync(specPath)) {
  console.error(`[swagger-parser] Spec file not found: ${specPath}`);
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const outputPath = specPath.replace(/\.(json|yaml|yml)$/, '.parsed.json');

// ---------------------------------------------------------------------------
// Spec loading
// ---------------------------------------------------------------------------
let spec;
try {
  const raw = fs.readFileSync(specPath, 'utf-8');
  spec = JSON.parse(raw);
} catch (e) {
  console.error(`[swagger-parser] Failed to parse spec: ${e.message}`);
  console.error('[swagger-parser] Note: Only JSON specs are supported. YAML support not yet implemented.');
  process.exit(1);
}

// Detect spec version
const isOpenApi3 = spec.openapi && spec.openapi.startsWith('3.');
const isSwagger2 = spec.swagger && spec.swagger.startsWith('2.');

if (!isOpenApi3 && !isSwagger2) {
  console.error('[swagger-parser] Unsupported spec format. Expected OpenAPI 3.x or Swagger 2.0.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// $ref resolver — inline schema references
// ---------------------------------------------------------------------------
function resolveRef(ref, root) {
  if (!ref || !ref.startsWith('#/')) return null;
  const parts = ref.replace('#/', '').split('/');
  let current = root;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined) return null;
  }
  return current;
}

const MAX_REF_DEPTH = 10;

/**
 * Recursively resolve $ref pointers in a schema object.
 * Handles nested objects, arrays, allOf/oneOf/anyOf.
 * Tracks visited refs to avoid infinite recursion on circular references.
 * Caps recursion at MAX_REF_DEPTH levels to handle deeply nested enterprise schemas.
 */
function resolveSchema(schema, root, visited = new Set(), depth = 0) {
  if (!schema) return null;

  if (depth > MAX_REF_DEPTH) {
    return { type: 'object', description: `[depth limit: exceeded ${MAX_REF_DEPTH} levels]` };
  }

  // Handle $ref
  if (schema.$ref) {
    if (visited.has(schema.$ref)) {
      return { type: 'object', description: `[circular: ${schema.$ref}]` };
    }
    visited.add(schema.$ref);
    const resolved = resolveRef(schema.$ref, root);
    if (!resolved) return { type: 'unknown', ref: schema.$ref };
    return resolveSchema(resolved, root, visited, depth + 1);
  }

  // Handle allOf (merge all schemas)
  if (schema.allOf) {
    const merged = { type: 'object', properties: {}, required: [] };
    for (const sub of schema.allOf) {
      const resolved = resolveSchema(sub, root, visited, depth + 1);
      if (resolved?.properties) Object.assign(merged.properties, resolved.properties);
      if (resolved?.required) merged.required.push(...resolved.required);
    }
    return merged;
  }

  // Handle oneOf/anyOf (take first option for sample generation)
  if (schema.oneOf || schema.anyOf) {
    const options = schema.oneOf || schema.anyOf;
    return resolveSchema(options[0], root, visited, depth + 1);
  }

  // Handle object with properties
  if (schema.type === 'object' || schema.properties) {
    const result = {
      type: 'object',
      required: schema.required || [],
      properties: {},
    };
    for (const [name, prop] of Object.entries(schema.properties || {})) {
      result.properties[name] = resolveSchema(prop, root, new Set(visited), depth + 1);
    }
    return result;
  }

  // Handle array
  if (schema.type === 'array' && schema.items) {
    return {
      type: 'array',
      items: resolveSchema(schema.items, root, visited, depth + 1),
    };
  }

  // Primitive types
  return {
    type: schema.type || 'string',
    format: schema.format || undefined,
    enum: schema.enum || undefined,
    description: schema.description || undefined,
  };
}

// ---------------------------------------------------------------------------
// Sample body generator — creates realistic test data from schema
// ---------------------------------------------------------------------------
function generateSampleValue(schema) {
  if (!schema) return null;

  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case 'string':
      if (schema.format === 'email') return 'test@example.com';
      if (schema.format === 'date') return '2026-01-15';
      if (schema.format === 'date-time') return '2026-01-15T10:30:00Z';
      if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com';
      if (schema.format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
      return 'test_value';
    case 'integer':
      return 1;
    case 'number':
      return 1.0;
    case 'boolean':
      return true;
    case 'array':
      if (schema.items) return [generateSampleValue(schema.items)];
      return [];
    case 'object':
      if (schema.properties) {
        const sample = {};
        // Include required fields first, then optionals
        const required = new Set(schema.required || []);
        for (const [name, prop] of Object.entries(schema.properties)) {
          if (required.has(name)) {
            sample[name] = generateSampleValue(prop);
          }
        }
        // Add a few optional fields for richer samples
        for (const [name, prop] of Object.entries(schema.properties)) {
          if (!required.has(name) && Object.keys(sample).length < 6) {
            sample[name] = generateSampleValue(prop);
          }
        }
        return sample;
      }
      return {};
    default:
      return 'test_value';
  }
}

// ---------------------------------------------------------------------------
// Extract API info (version-aware)
// ---------------------------------------------------------------------------
function extractApiInfo() {
  const info = spec.info || {};

  // Base URL
  let baseUrl = '';
  if (isOpenApi3 && spec.servers && spec.servers.length > 0) {
    baseUrl = spec.servers[0].url;
  } else if (isSwagger2) {
    const scheme = (spec.schemes && spec.schemes[0]) || 'https';
    baseUrl = `${scheme}://${spec.host || 'localhost'}${spec.basePath || ''}`;
  }

  // Auth scheme
  let auth = null;
  const securitySchemes = isOpenApi3
    ? spec.components?.securitySchemes
    : spec.securityDefinitions;

  if (securitySchemes) {
    const [firstName, firstScheme] = Object.entries(securitySchemes)[0] || [];
    if (firstScheme) {
      auth = {
        name: firstName,
        type: firstScheme.type,
        scheme: firstScheme.scheme || undefined,
        in: firstScheme.in || undefined,
        bearerFormat: firstScheme.bearerFormat || undefined,
      };
    }
  }

  return {
    title: info.title || 'Unknown API',
    description: info.description ? info.description.slice(0, 200) : null,
    version: info.version || 'unknown',
    baseUrl,
    auth,
  };
}

// ---------------------------------------------------------------------------
// Extract and group endpoints
// ---------------------------------------------------------------------------
function extractEndpoints() {
  const endpoints = [];

  for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'];

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      // Extract parameters
      const params = [...(pathItem.parameters || []), ...(operation.parameters || [])];
      const resolvedParams = params.map(p => {
        const resolved = p.$ref ? resolveRef(p.$ref, spec) : p;
        if (!resolved) return null;
        return {
          name: resolved.name,
          in: resolved.in,
          required: resolved.required || false,
          type: resolved.schema?.type || resolved.type || 'string',
          description: resolved.description ? resolved.description.slice(0, 100) : undefined,
        };
      }).filter(Boolean);

      // Extract request body (OpenAPI 3.x)
      let requestBody = null;
      if (isOpenApi3 && operation.requestBody) {
        const body = operation.requestBody.$ref
          ? resolveRef(operation.requestBody.$ref, spec)
          : operation.requestBody;
        const jsonContent = body?.content?.['application/json'];
        if (jsonContent?.schema) {
          const resolvedSchema = resolveSchema(jsonContent.schema, spec);
          requestBody = {
            required: body.required || false,
            schema: resolvedSchema,
            sampleBody: generateSampleValue(resolvedSchema),
          };
        }
      }
      // Swagger 2.0 body parameter
      if (isSwagger2) {
        const bodyParam = params.find(p => p.in === 'body');
        if (bodyParam?.schema) {
          const resolvedSchema = resolveSchema(bodyParam.schema, spec);
          requestBody = {
            required: bodyParam.required || false,
            schema: resolvedSchema,
            sampleBody: generateSampleValue(resolvedSchema),
          };
        }
      }

      // Extract responses
      const responses = {};
      for (const [code, resp] of Object.entries(operation.responses || {})) {
        const resolvedResp = resp.$ref ? resolveRef(resp.$ref, spec) : resp;
        responses[code] = {
          description: resolvedResp?.description || '',
        };
        // Extract response schema (for verification in tests)
        const respSchema = isOpenApi3
          ? resolvedResp?.content?.['application/json']?.schema
          : resolvedResp?.schema;
        if (respSchema) {
          const resolved = resolveSchema(respSchema, spec);
          if (resolved?.properties) {
            responses[code].fields = Object.keys(resolved.properties);
          }
        }
      }

      endpoints.push({
        method: method.toUpperCase(),
        path: pathStr,
        summary: operation.summary || '',
        description: operation.description ? operation.description.slice(0, 150) : undefined,
        operationId: operation.operationId || undefined,
        tags: operation.tags || [],
        parameters: resolvedParams.length > 0 ? resolvedParams : undefined,
        requestBody: requestBody || undefined,
        responses,
      });
    }
  }

  return endpoints;
}

// ---------------------------------------------------------------------------
// Group endpoints by resource and detect CRUD patterns
// ---------------------------------------------------------------------------
function groupByResource(endpoints) {
  // Group by the first path segment (e.g., /pets, /users, /store/order)
  const groups = {};

  for (const ep of endpoints) {
    // Extract resource key: /pets/{id} → pets, /store/order/{id} → store/order
    const segments = ep.path.split('/').filter(Boolean);
    let resourceKey = '';
    for (const seg of segments) {
      if (seg.startsWith('{')) break;
      resourceKey += (resourceKey ? '/' : '') + seg;
    }
    if (!resourceKey) resourceKey = 'root';

    if (!groups[resourceKey]) {
      groups[resourceKey] = {
        resource: resourceKey,
        basePath: '/' + resourceKey,
        tag: ep.tags[0] || resourceKey,
        endpoints: [],
      };
    }
    groups[resourceKey].endpoints.push(ep);
  }

  // Detect CRUD pattern for each group
  for (const group of Object.values(groups)) {
    const crud = {};
    for (const ep of group.endpoints) {
      const hasPathParam = ep.path.includes('{');
      if (ep.method === 'POST' && !hasPathParam) crud.create = `${ep.method} ${ep.path}`;
      if (ep.method === 'GET' && hasPathParam) crud.read = `${ep.method} ${ep.path}`;
      if (ep.method === 'GET' && !hasPathParam) crud.list = `${ep.method} ${ep.path}`;
      if (ep.method === 'PUT' && hasPathParam) crud.update = `${ep.method} ${ep.path}`;
      if (ep.method === 'PUT' && !hasPathParam) crud.update = `${ep.method} ${ep.path}`;
      if (ep.method === 'PATCH') crud.patch = `${ep.method} ${ep.path}`;
      if (ep.method === 'DELETE') crud.delete = `${ep.method} ${ep.path}`;
    }
    group.crudPattern = Object.keys(crud).length > 0 ? crud : null;
    group.endpointCount = group.endpoints.length;
    if (group.endpoints.length >= 20) {
      group.large = true;
      group.note = `Large resource group (${group.endpoints.length} endpoints). LLM should process this group incrementally — generate scenarios for a subset of endpoints at a time.`;
    }

    // Find tag description from spec tags
    const specTag = (spec.tags || []).find(t => t.name === group.tag);
    if (specTag?.description) {
      group.description = specTag.description.slice(0, 150);
    }
  }

  return Object.values(groups);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log(`[swagger-parser] Parsing: ${path.relative(ROOT, specPath)}`);
  console.log(`[swagger-parser] Format: ${isOpenApi3 ? 'OpenAPI ' + spec.openapi : 'Swagger ' + spec.swagger}`);

  const apiInfo = extractApiInfo();
  const endpoints = extractEndpoints();
  const resourceGroups = groupByResource(endpoints);

  // Build summary
  const crudResources = resourceGroups.filter(g => g.crudPattern?.create).map(g => g.resource);
  const readOnlyResources = resourceGroups
    .filter(g => !g.crudPattern?.create && (g.crudPattern?.read || g.crudPattern?.list))
    .map(g => g.resource);

  const parsed = {
    version: '1.0',
    parsedAt: new Date().toISOString(),
    specFile: path.relative(ROOT, specPath),
    specFormat: isOpenApi3 ? `OpenAPI ${spec.openapi}` : `Swagger ${spec.swagger}`,
    api: apiInfo,
    resourceGroups,
    summary: {
      totalEndpoints: endpoints.length,
      totalResources: resourceGroups.length,
      hasAuth: apiInfo.auth !== null,
      authType: apiInfo.auth?.type || null,
      crudResources,
      readOnlyResources,
      endpointsByMethod: {
        GET: endpoints.filter(e => e.method === 'GET').length,
        POST: endpoints.filter(e => e.method === 'POST').length,
        PUT: endpoints.filter(e => e.method === 'PUT').length,
        PATCH: endpoints.filter(e => e.method === 'PATCH').length,
        DELETE: endpoints.filter(e => e.method === 'DELETE').length,
      },
    },
  };

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));

  // Print summary
  console.log(`[swagger-parser] API: ${apiInfo.title} (${apiInfo.version})`);
  console.log(`[swagger-parser] Base URL: ${apiInfo.baseUrl}`);
  console.log(`[swagger-parser] Auth: ${apiInfo.auth ? `${apiInfo.auth.type} (${apiInfo.auth.name})` : 'None'}`);
  console.log(`[swagger-parser] Endpoints: ${endpoints.length} across ${resourceGroups.length} resources`);
  console.log(`[swagger-parser] CRUD resources: ${crudResources.length > 0 ? crudResources.join(', ') : 'none'}`);
  console.log(`[swagger-parser] Read-only resources: ${readOnlyResources.length > 0 ? readOnlyResources.join(', ') : 'none'}`);
  console.log(`[swagger-parser] Output: ${path.relative(ROOT, outputPath)}`);
}

main();
