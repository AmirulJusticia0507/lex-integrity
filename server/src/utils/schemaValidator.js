/**
 * JSON Schema Validator for Structured LLM Output
 * Validates agent responses against strict schema
 */

const FINAL_RESPONSE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'has_contradiction',
    'source_rule',
    'conflicting_rule',
    'loopholes_detected',
    'humanitarian_impact',
    'fairness_score',
    'recommended_sanction'
  ],
  properties: {
    has_contradiction: { type: 'boolean' },
    source_rule: { type: 'string', minLength: 1, maxLength: 200 },
    conflicting_rule: { type: 'string', minLength: 1, maxLength: 200 },
    loopholes_detected: { type: 'string', minLength: 10, maxLength: 5000 },
    humanitarian_impact: { type: 'string', minLength: 10, maxLength: 5000 },
    fairness_score: { 
      type: 'string', 
      enum: ['HIGH_RISK_UNFAIR', 'MODERATE', 'FAIR', 'LOW_RISK_FAIR'] 
    },
    recommended_sanction: { type: 'string', minLength: 1, maxLength: 2000 },
    reasoning_chain: {
      type: 'array',
      items: {
        type: 'object',
        required: ['step', 'sub_question', 'evidence_used', 'conclusion', 'confidence'],
        properties: {
          step: { type: 'integer', minimum: 1 },
          sub_question: { type: 'string', minLength: 5 },
          evidence_used: { type: 'array', items: { type: 'string' } },
          conclusion: { type: 'string', minLength: 10 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          needs_more_search: { type: 'boolean' }
        }
      },
      minItems: 1,
      maxItems: 10
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    meta: {
      type: 'object',
      properties: {
        total_steps: { type: 'integer' },
        sub_questions: { type: 'integer' },
        timestamp: { type: 'string', format: 'date-time' }
      }
    }
  },
  additionalProperties: false
};

const DECOMPOSITION_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['sub_questions'],
  properties: {
    sub_questions: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        required: ['id', 'question', 'focus'],
        properties: {
          id: { type: 'integer', minimum: 1 },
          question: { type: 'string', minLength: 10 },
          focus: { 
            type: 'string', 
            enum: ['hierarchy', 'loophole', 'sanction', 'impact', 'definition', 'general'] 
          }
        }
      }
    },
    reasoning: { type: 'string' }
  }
};

const REASONING_STEP_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['step', 'sub_question', 'evidence_used', 'conclusion', 'confidence'],
  properties: {
    step: { type: 'integer', minimum: 1 },
    sub_question: { type: 'string', minLength: 5 },
    evidence_used: { type: 'array', items: { type: 'string' } },
    conclusion: { type: 'string', minLength: 10 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    needs_more_search: { type: 'boolean' }
  }
};

// Simple validator without external dependency (AJV alternative)
class SchemaValidator {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
  }

  validate(data) {
    this.errors = [];
    const valid = this._validateObject(data, this.schema, '');
    return { valid, errors: this.errors };
  }

  _validateObject(data, schema, path) {
    if (schema.type === 'object') {
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        this.errors.push({ path, message: 'Expected object', received: typeof data });
        return false;
      }
      
      let valid = true;
      
      // Required fields
      if (schema.required) {
        for (const req of schema.required) {
          if (!(req in data)) {
            this.errors.push({ path: `${path}.${req}`, message: 'Required field missing' });
            valid = false;
          }
        }
      }
      
      // Properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in data) {
            if (!this._validateValue(data[key], propSchema, `${path}.${key}`)) {
              valid = false;
            }
          }
        }
      }
      
      // Additional properties
      if (schema.additionalProperties === false && schema.properties) {
        const allowedKeys = new Set(Object.keys(schema.properties));
        for (const key of Object.keys(data)) {
          if (!allowedKeys.has(key)) {
            this.errors.push({ path: `${path}.${key}`, message: 'Unexpected property' });
            valid = false;
          }
        }
      }
      
      return valid;
    }
    
    return this._validateValue(data, schema, path);
  }

  _validateValue(data, schema, path) {
    // Type check
    if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        this.errors.push({ path, message: 'Expected array', received: typeof data });
        return false;
      }
      if (schema.minItems && data.length < schema.minItems) {
        this.errors.push({ path, message: `Array too short (min ${schema.minItems})` });
        return false;
      }
      if (schema.maxItems && data.length > schema.maxItems) {
        this.errors.push({ path, message: `Array too long (max ${schema.maxItems})` });
        return false;
      }
      if (schema.items) {
        let valid = true;
        for (let i = 0; i < data.length; i++) {
          if (!this._validateValue(data[i], schema.items, `${path}[${i}]`)) {
            valid = false;
          }
        }
        return valid;
      }
      return true;
    }
    
    if (schema.type === 'string') {
      if (typeof data !== 'string') {
        this.errors.push({ path, message: 'Expected string', received: typeof data });
        return false;
      }
      if (schema.minLength && data.length < schema.minLength) {
        this.errors.push({ path, message: `String too short (min ${schema.minLength})` });
        return false;
      }
      if (schema.maxLength && data.length > schema.maxLength) {
        this.errors.push({ path, message: `String too long (max ${schema.maxLength})` });
        return false;
      }
      if (schema.enum && !schema.enum.includes(data)) {
        this.errors.push({ path, message: `Invalid enum value`, received: data, allowed: schema.enum });
        return false;
      }
      if (schema.format === 'date-time') {
        const dt = new Date(data);
        if (isNaN(dt.getTime())) {
          this.errors.push({ path, message: 'Invalid date-time format' });
          return false;
        }
      }
      return true;
    }
    
    if (schema.type === 'number') {
      if (typeof data !== 'number' || isNaN(data)) {
        this.errors.push({ path, message: 'Expected number', received: typeof data });
        return false;
      }
      if (schema.minimum !== undefined && data < schema.minimum) {
        this.errors.push({ path, message: `Number too small (min ${schema.minimum})` });
        return false;
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        this.errors.push({ path, message: `Number too large (max ${schema.maximum})` });
        return false;
      }
      return true;
    }
    
    if (schema.type === 'integer') {
      if (!Number.isInteger(data)) {
        this.errors.push({ path, message: 'Expected integer', received: typeof data });
        return false;
      }
      if (schema.minimum !== undefined && data < schema.minimum) {
        this.errors.push({ path, message: `Integer too small (min ${schema.minimum})` });
        return false;
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        this.errors.push({ path, message: `Integer too large (max ${schema.maximum})` });
        return false;
      }
      return true;
    }
    
    if (schema.type === 'boolean') {
      if (typeof data !== 'boolean') {
        this.errors.push({ path, message: 'Expected boolean', received: typeof data });
        return false;
      }
      return true;
    }
    
    return true;
  }
}

// Pre-compiled validators
export const finalResponseValidator = new SchemaValidator(FINAL_RESPONSE_SCHEMA);
export const decompositionValidator = new SchemaValidator(DECOMPOSITION_SCHEMA);
export const reasoningStepValidator = new SchemaValidator(REASONING_STEP_SCHEMA);

/**
 * Validate and repair LLM output
 * Attempts to fix common issues before giving up
 */
export function validateAndRepair(jsonText, validator, context = '') {
  let parsed = null;
  
  // Try direct parse
  try { parsed = JSON.parse(jsonText); } catch (_) {}
  
  // Try extracting from markdown fences
  if (!parsed) {
    const fence = jsonText.match(/```json\s*([\s\S]*?)```/i)?.[1] 
      || jsonText.match(/```\s*([\s\S]*?)```/)?.[1];
    if (fence) { try { parsed = JSON.parse(fence.trim()); } catch (_) {} }
  }
  
  // Try extracting first valid JSON object
  if (!parsed) {
    const bs = jsonText.indexOf('{'), be = jsonText.lastIndexOf('}');
    if (bs !== -1 && be > bs) {
      try { parsed = JSON.parse(jsonText.slice(bs, be + 1)); } catch (_) {}
    }
  }
  
  if (!parsed) {
    return { valid: false, errors: [{ path: '', message: 'No valid JSON found' }], data: null };
  }
  
  // Validate against schema
  const { valid, errors } = validator.validate(parsed);
  
  // Auto-repair common issues
  if (!valid) {
    const repaired = attemptRepair(parsed, errors);
    if (repaired) {
      const { valid: v2, errors: e2 } = validator.validate(repaired);
      if (v2) {
        return { valid: true, errors: [], data: repaired, repaired: true };
      }
    }
  }
  
  return { valid, errors, data: parsed, repaired: false };
}

function attemptRepair(data, errors) {
  const repaired = { ...data };
  let changed = false;
  
  for (const err of errors) {
    const pathParts = err.path.split('.').filter(Boolean);
    if (pathParts.length === 0) continue;
    
    const field = pathParts[pathParts.length - 1];
    const parent = pathParts.length > 1 
      ? pathParts.slice(0, -1).reduce((obj, p) => obj?.[p], repaired)
      : repaired;
    
    if (!parent || typeof parent !== 'object') continue;
    
    // Fix missing required fields with defaults
    if (err.message === 'Required field missing') {
      switch (field) {
        case 'has_contradiction': parent[field] = false; changed = true; break;
        case 'source_rule': parent[field] = 'Tidak diketahui'; changed = true; break;
        case 'conflicting_rule': parent[field] = '-'; changed = true; break;
        case 'loopholes_detected': parent[field] = 'Analisis tidak tersedia'; changed = true; break;
        case 'humanitarian_impact': parent[field] = 'Dampak tidak dianalisis'; changed = true; break;
        case 'fairness_score': parent[field] = 'MODERATE'; changed = true; break;
        case 'recommended_sanction': parent[field] = 'Perlu kajian lebih lanjut'; changed = true; break;
        case 'confidence': parent[field] = 0.5; changed = true; break;
      }
    }
    
    // Fix enum violations
    if (err.message?.includes('Invalid enum')) {
      if (field === 'fairness_score') {
        parent[field] = 'MODERATE';
        changed = true;
      }
    }
    
    // Fix confidence out of range
    if (field === 'confidence' && err.message?.includes('too large')) {
      parent[field] = 1.0;
      changed = true;
    }
    if (field === 'confidence' && err.message?.includes('too small')) {
      parent[field] = 0.0;
      changed = true;
    }
    
    // Fix string length issues
    if (err.message?.includes('too short') && typeof parent[field] === 'string') {
      if (field === 'loopholes_detected' || field === 'humanitarian_impact') {
        parent[field] = parent[field] + ' (perlu detail lebih lanjut)';
        changed = true;
      }
    }
  }
  
  return changed ? repaired : null;
}

/**
 * Create fallback response when validation fails completely
 */
export function createFallbackResponse(rawText, errorMsg) {
  return {
    has_contradiction: null,
    source_rule: 'Validasi gagal',
    conflicting_rule: '-',
    loopholes_detected: rawText?.slice(0, 500) || 'Respons LLM tidak valid',
    humanitarian_impact: `Validasi schema gagal: ${errorMsg}`,
    fairness_score: 'MODERATE',
    recommended_sanction: '-',
    reasoning_chain: [],
    confidence: 0.1,
    meta: { validation_error: errorMsg, fallback: true }
  };
}

export { FINAL_RESPONSE_SCHEMA, DECOMPOSITION_SCHEMA, REASONING_STEP_SCHEMA };