const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Limited Draft 7 subset used by the evidence schemas, not a general JSON Schema library.
// Schemas are checked on load; unknown keywords fail closed.
const keywords = new Set(['$schema', 'title', 'type', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'uniqueItems', 'contains', 'minLength', 'maxLength', 'pattern', 'format', 'enum', 'const', 'anyOf', 'allOf', 'if', 'then']);
function inspectSchema(s) {
  for (const key of Object.keys(s)) assert.ok(keywords.has(key), `Unsupported schema keyword: ${key}`);
  for (const sub of Object.values(s.properties || {})) inspectSchema(sub);
  for (const key of ['items', 'contains', 'if', 'then']) if (s[key]) inspectSchema(s[key]);
  for (const key of ['anyOf', 'allOf']) for (const sub of s[key] || []) inspectSchema(sub);
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function formatValid(value, format) {
  if (format === 'date') return validDate(value);
  if (format === 'date-time') return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) && validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
  if (format === 'uri') { try { return Boolean(new URL(value).protocol); } catch { return false; } }
  throw new Error(`Unsupported format ${format}`);
}
function equal(a, b) { return require('node:util').isDeepStrictEqual(a, b); }
function errors(s, value, location = '$') {
  const out = [];
  const fail = reason => out.push(`${location}: ${reason}`);
  if (s.type) {
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (type !== s.type) fail(`expected ${s.type}`);
  }
  if ('const' in s && !equal(value, s.const)) fail('const');
  if (s.enum && !s.enum.some(v => equal(v, value))) fail('enum');
  if (s.anyOf && !s.anyOf.some(sub => errors(sub, value).length === 0)) fail('anyOf');
  for (const sub of s.allOf || []) out.push(...errors(sub, value, location));
  if (s.if && !errors(s.if, value).length && s.then) out.push(...errors(s.then, value, location));
  if (typeof value === 'string') {
    if (s.minLength !== undefined && [...value].length < s.minLength) fail('minLength');
    if (s.maxLength !== undefined && [...value].length > s.maxLength) fail('maxLength');
    if (s.pattern && !new RegExp(s.pattern).test(value)) fail('pattern');
    if (s.format && !formatValid(value, s.format)) fail('format');
  }
  if (Array.isArray(value)) {
    if (s.minItems !== undefined && value.length < s.minItems) fail('minItems');
    if (s.maxItems !== undefined && value.length > s.maxItems) fail('maxItems');
    if (s.uniqueItems && value.some((v, i) => value.slice(0, i).some(w => equal(v, w)))) fail('uniqueItems');
    if (s.contains && !value.some(v => errors(s.contains, v).length === 0)) fail('contains');
    if (s.items) value.forEach((v, i) => out.push(...errors(s.items, v, `${location}[${i}]`)));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of s.required || []) if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
    for (const [key, v] of Object.entries(value)) {
      if (s.properties && Object.hasOwn(s.properties, key)) out.push(...errors(s.properties[key], v, `${location}.${key}`));
      else if (s.additionalProperties === false) fail(`unexpected ${key}`);
    }
  }
  return out;
}

function loadSchema(filename, stack = []) {
  const absolute = path.resolve(filename);
  if (stack.includes(absolute)) throw new Error('Cyclic schema reference');
  function expand(node) {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (node.$ref) {
      if (Object.keys(node).length !== 1 || !/^(?:1\.0\.0|1\.1\.0|2\.0\.0)\/[a-z-]+\.schema\.json$/.test(node.$ref)) throw new Error('Unsupported schema reference');
      return loadSchema(path.join(path.dirname(absolute), node.$ref), [...stack, absolute]);
    }
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, expand(value)]));
  }
  const schema = expand(JSON.parse(fs.readFileSync(absolute, 'utf8')));
  inspectSchema(schema);
  return schema;
}
module.exports = { errors, loadSchema, inspectSchema };
