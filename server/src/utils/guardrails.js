/**
 * Guardrails for LLM Output Safety
 * Ensures legal analysis outputs are safe, ethical, and compliant
 */

// Prohibited content patterns
const PROHIBITED_PATTERNS = [
  // Hate speech / discrimination
  /\b(membunuh|membakar|menghancurkan|kekerasan fisik)\b/i,
  // Illegal advice
  /\b(cara menghindar hukum|trik ilegal|korupsi|suap|gratifikasi)\b/i,
  // PII leakage
  /\b(NIK|NPWP|nomor rekening|kartu kredit)\b/i,
  // Medical/legal advice disclaimer bypass
  /\b(jaminan mutlak|pasti menang|100% aman)\b/i,
];

// Required disclaimers for legal analysis
const REQUIRED_DISCLAIMERS = {
  fairness_score: ['HIGH_RISK_UNFAIR', 'MODERATE', 'FAIR', 'LOW_RISK_FAIR'],
  has_contradiction: [true, false, null],
};

// Indonesian legal context boundaries
const LEGAL_BOUNDARIES = {
  // Must reference actual Indonesian laws
  indonesian_law_refs: [
    'UU', 'Undang-Undang', 'Pasal', 'Ayat', 'Huruf',
    'PP', 'Peraturan Pemerintah', 'Perpres', 'Peraturan Presiden',
    'Perda', 'Peraturan Daerah', 'Perkada', 'Peraturan Kepala Daerah',
    'Permen', 'Peraturan Menteri', 'Kepmen', 'Keputusan Menteri',
    'KUHP', 'KUHAP', 'KUHPer', 'UU Tipikor', 'UU HAM'
  ],
  // Prohibited jurisdictions
  prohibited_jurisdictions: ['US Code', 'EU Directive', 'UK Act', 'Sharia Law (non-Indonesia)']
};

/**
 * Check for prohibited content in output
 */
export function checkProhibitedContent(text) {
  const violations = [];
  
  for (const pattern of PROHIBITED_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      violations.push({
        type: 'prohibited_content',
        pattern: pattern.source,
        matches: matches.slice(0, 5)
      });
    }
  }
  
  return violations;
}

/**
 * Validate legal analysis output for Indonesian context compliance
 */
export function validateLegalContext(output) {
  const violations = [];
  const text = JSON.stringify(output).toLowerCase();
  
  // Check for Indonesian legal references
  const hasIndonesianRef = LEGAL_BOUNDARIES.indonesian_law_refs.some(ref => 
    text.includes(ref.toLowerCase())
  );
  
  if (!hasIndonesianRef && output.loopholes_detected) {
    violations.push({
      type: 'missing_legal_context',
      message: 'Output tidak mengandung referensi hukum Indonesia yang valid',
      field: 'loopholes_detected'
    });
  }
  
  // Check fairness_score enum
  if (output.fairness_score && !REQUIRED_DISCLAIMERS.fairness_score.includes(output.fairness_score)) {
    violations.push({
      type: 'invalid_fairness_score',
      message: `fairness_score harus salah satu: ${REQUIRED_DISCLAIMERS.fairness_score.join(', ')}`,
      field: 'fairness_score',
      value: output.fairness_score
    });
  }
  
  // Check has_contradiction type
  if (output.has_contradiction !== null && typeof output.has_contradiction !== 'boolean') {
    violations.push({
      type: 'invalid_contradiction_type',
      message: 'has_contradiction harus boolean atau null',
      field: 'has_contradiction'
    });
  }
  
  // Check for hallucinated rule codes (basic pattern)
  const ruleCodePattern = /\b(UU|PP|PERPRES|PERDA|PERMEN|KEPMEN)\s*(-\s*)?\d+/gi;
  const mentionedCodes = (output.source_rule + ' ' + output.conflicting_rule).match(ruleCodePattern) || [];
  const citedCodes = (output.loopholes_detected + ' ' + output.humanitarian_impact).match(ruleCodePattern) || [];
  
  if (mentionedCodes.length > 0 && citedCodes.length === 0) {
    violations.push({
      type: 'uncited_rule_reference',
      message: 'Rule code disebut di source/conflicting tapi tidak dikutip di analisis',
      field: 'source_rule'
    });
  }
  
  // Check minimum content length for substantive fields
  if (output.loopholes_detected && output.loopholes_detected.length < 20) {
    violations.push({
      type: 'insufficient_analysis',
      message: 'loopholes_detected terlalu pendek untuk analisis substansial',
      field: 'loopholes_detected'
    });
  }
  
  if (output.humanitarian_impact && output.humanitarian_impact.length < 20) {
    violations.push({
      type: 'insufficient_analysis',
      message: 'humanitarian_impact terlalu pendek',
      field: 'humanitarian_impact'
    });
  }
  
  return violations;
}

/**
 * Sanitize output - remove/fix problematic content
 */
export function sanitizeOutput(output) {
  const sanitized = { ...output };
  
  // Ensure fairness_score is valid
  if (sanitized.fairness_score && !REQUIRED_DISCLAIMERS.fairness_score.includes(sanitized.fairness_score)) {
    sanitized.fairness_score = 'MODERATE';
  }
  
  // Ensure has_contradiction is boolean or null
  if (sanitized.has_contradiction !== null && typeof sanitized.has_contradiction !== 'boolean') {
    sanitized.has_contradiction = null;
  }
  
  // Truncate extremely long fields
  const maxLen = 10000;
  ['loopholes_detected', 'humanitarian_impact', 'recommended_sanction'].forEach(field => {
    if (sanitized[field] && sanitized[field].length > maxLen) {
      sanitized[field] = sanitized[field].slice(0, maxLen) + '... [dipotong]';
    }
  });
  
  // Remove potential PII patterns
  const piiPatterns = [
    /\b\d{16}\b/g, // Credit card
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN-like
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g // Email
  ];
  
  ['source_rule', 'conflicting_rule', 'loopholes_detected', 'humanitarian_impact', 'recommended_sanction'].forEach(field => {
    if (sanitized[field]) {
      for (const pattern of piiPatterns) {
        sanitized[field] = sanitized[field].replace(pattern, '[REDACTED]');
      }
    }
  });
  
  return sanitized;
}

/**
 * Add required disclaimers to output
 */
export function addDisclaimers(output) {
  const disclaimers = [];
  
  if (output.has_contradiction === true) {
    disclaimers.push(
      '⚠️ DITEMUKAN INDIKASI KONTRADIKSI: Analisis ini mengindikasikan potensi konflik antar peraturan. ' +
      'Disarankan konsultasi dengan ahli hukum untuk verifikasi hukum formal.'
    );
  }
  
  if (output.fairness_score === 'HIGH_RISK_UNFAIR') {
    disclaimers.push(
      '🚨 SKOR KEADILAN TINGGI RISIKO: Peraturan ini memiliki risiko ketidakadilan yang signifikan. ' +
      'Perlu tinjauan ulang oleh pembentuk peraturan atau pengadilan.'
    );
  }
  
  if (output.recommended_sanction && output.recommended_sanction.length > 10) {
    disclaimers.push(
      '📋 REKOMENDASI SANKSI: Rekomendasi ini bersifat analitis dan bukan keputusan hukum yang mengikat. ' +
      'Penjatuhan sanksi tetap berwenang pada pejabat/pengadilan berwenang.'
    );
  }
  
  // Standard disclaimer
  disclaimers.push(
    '📌 DISCLAIMER: Analisis ini dihasilkan oleh AI (Lex-Integrity Agent) berdasarkan data regulasi yang tersedia. ' +
    'Hasil tidak mengikat secara hukum dan tidak menggantikan konsultasi hukum profesional.'
  );
  
  return {
    ...output,
    _disclaimers: disclaimers
  };
}

/**
 * Main guardrails pipeline
 */
export function applyGuardrails(output) {
  const allViolations = [];
  
  // 1. Check prohibited content
  const fullText = JSON.stringify(output);
  const prohibitedViolations = checkProhibitedContent(fullText);
  allViolations.push(...prohibitedViolations);
  
  // 2. Validate legal context
  const contextViolations = validateLegalContext(output);
  allViolations.push(...contextViolations);
  
  // 3. Sanitize
  const sanitized = sanitizeOutput(output);
  
  // 4. Add disclaimers
  const final = addDisclaimers(sanitized);
  
  // Determine if output passes guardrails
  const criticalViolations = allViolations.filter(v => 
    v.type === 'prohibited_content' || v.type === 'invalid_fairness_score'
  );
  
  const passed = criticalViolations.length === 0;
  
  return {
    output: final,
    violations: allViolations,
    passed,
    critical_count: criticalViolations.length,
    warning_count: allViolations.length - criticalViolations.length
  };
}

/**
 * Content moderation for user queries (input guardrails)
 */
export function moderateInput(query) {
  const violations = [];
  
  // Check for malicious intent
  const maliciousPatterns = [
    /\b(cara hack|bobol|exploit|vulnerability|bypass)\b/i,
    /\b(bomb|ledakan|senjata|amunisi)\b/i,
    /\b(terorisme|radikalisme|ISIS|JAD|JI)\b/i
  ];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(query)) {
      violations.push({
        type: 'malicious_intent',
        message: 'Query mengandung pola yang tidak diizinkan',
        pattern: pattern.source
      });
    }
  }
  
  // Check length
  if (query.length > 5000) {
    violations.push({
      type: 'query_too_long',
      message: 'Query terlalu panjang (maks 5000 karakter)'
    });
  }
  
  return { safe: violations.length === 0, violations };
}

export { PROHIBITED_PATTERNS, LEGAL_BOUNDARIES, REQUIRED_DISCLAIMERS };