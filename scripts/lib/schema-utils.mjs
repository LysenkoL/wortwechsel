// Prepares a JSON Schema for the AI provider: removes `title` and `$schema`
// on every level (some providers reject these keywords in structured output).
const DROP = new Set(['title', '$schema']);

export function toProviderSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toProviderSchema);
  if (schema === null || typeof schema !== 'object') return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (DROP.has(key)) continue;
    // Keys inside "properties" are field names, not keywords — keep them all.
    if (key === 'properties' && value && typeof value === 'object') {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, sub]) => [name, toProviderSchema(sub)]),
      );
      continue;
    }
    out[key] = toProviderSchema(value);
  }
  return out;
}
