/**
 * Adaptive Legal Document Chunking
 * Splits Indonesian legal documents by semantic structure:
 * - BAB (Chapter) → BAGIAN (Section) → PARAGRAF → PASAL (Article) → AYAT (Paragraph)
 */

const LEGAL_HEADING_PATTERNS = [
  { pattern: /^BAB\s+[IVX]+\s+/i, level: 1, type: 'BAB' },
  { pattern: /^BAGIAN\s+[IVX]+\s+/i, level: 2, type: 'BAGIAN' },
  { pattern: /^PARAGRAF\s+[IVX]+\s+/i, level: 3, type: 'PARAGRAF' },
  { pattern: /^Pasal\s+\d+[A-Z]?\s*/i, level: 4, type: 'PASAL' },
  { pattern: /^\(\d+\)\s+/i, level: 5, type: 'AYAT' },
  { pattern: /^[a-z]\)\s+/i, level: 6, type: 'HURUF' },
  { pattern: /^\d+\.\s+/i, level: 6, type: 'ANGKA' },
];

function detectHeading(line) {
  for (const { pattern, level, type } of LEGAL_HEADING_PATTERNS) {
    const match = line.match(pattern);
    if (match) return { level, type, match: match[0].trim() };
  }
  return null;
}

function splitIntoLines(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

function buildChunkMetadata(headings) {
  return headings
    .filter(h => h.level <= 4)
    .map(h => `${h.type} ${h.match}`)
    .join(' > ');
}

export function chunkLegalDocument(text, options = {}) {
  const {
    maxChunkSize = 1200,
    minChunkSize = 100,
    overlapSize = 150,
    preserveHeadings = true,
  } = options;

  const lines = splitIntoLines(text);
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;
  let currentHeadings = [];
  let lastHeadingLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = detectHeading(line);

    if (heading) {
      if (heading.level <= 4) {
        currentHeadings = currentHeadings.filter(h => h.level < heading.level);
        currentHeadings.push({ ...heading, lineIndex: i });
      } else if (heading.level === 5) {
        currentHeadings = currentHeadings.filter(h => h.level < 5);
        currentHeadings.push({ ...heading, lineIndex: i });
      }
    }

    const lineSize = line.length;

    if (currentSize + lineSize > maxChunkSize && currentSize >= minChunkSize) {
      const chunkText = currentChunk.join('\n');
      chunks.push({
        text: chunkText,
        metadata: {
          headings: [...currentHeadings],
          headingPath: buildChunkMetadata(currentHeadings),
          charCount: chunkText.length,
          startLine: i - currentChunk.length,
          endLine: i - 1,
        },
      });

      if (overlapSize > 0 && currentChunk.length > 0) {
        const overlapLines = [];
        let overlapChars = 0;
        for (let j = currentChunk.length - 1; j >= 0; j--) {
          if (overlapChars + currentChunk[j].length <= overlapSize) {
            overlapLines.unshift(currentChunk[j]);
            overlapChars += currentChunk[j].length;
          } else break;
        }
        currentChunk = overlapLines;
        currentSize = overlapChars;
      } else {
        currentChunk = [];
        currentSize = 0;
      }
    }

    currentChunk.push(line);
    currentSize += lineSize;
  }

  if (currentChunk.length > 0 && currentSize >= minChunkSize) {
    const chunkText = currentChunk.join('\n');
    chunks.push({
      text: chunkText,
      metadata: {
        headings: [...currentHeadings],
        headingPath: buildChunkMetadata(currentHeadings),
        charCount: chunkText.length,
        startLine: lines.length - currentChunk.length,
        endLine: lines.length - 1,
      },
    });
  }

  return chunks.filter(c => c.text.trim().length >= minChunkSize);
}

export function chunkByPasal(text, options = {}) {
  const { maxChunkSize = 1500, includeContext = true } = options;
  const lines = splitIntoLines(text);
  
  const pasalIndices = [];
  lines.forEach((line, idx) => {
    const heading = detectHeading(line);
    if (heading && heading.type === 'PASAL') {
      pasalIndices.push({ index: idx, heading: heading.match });
    }
  });

  if (pasalIndices.length === 0) {
    return chunkLegalDocument(text, { maxChunkSize, ...options });
  }

  const chunks = [];
  for (let i = 0; i < pasalIndices.length; i++) {
    const start = pasalIndices[i].index;
    const end = i + 1 < pasalIndices.length ? pasalIndices[i + 1].index : lines.length;
    
    let chunkLines = lines.slice(start, end);
    
    if (includeContext && i > 0) {
      const prevLines = lines.slice(Math.max(0, start - 3), start);
      chunkLines = [...prevLines, ...chunkLines];
    }

    const chunkText = chunkLines.join('\n');
    
    if (chunkText.length > maxChunkSize) {
      const subChunks = chunkLegalDocument(chunkText, { maxChunkSize, ...options });
      chunks.push(...subChunks);
    } else {
      chunks.push({
        text: chunkText,
        metadata: {
          pasal: pasalIndices[i].heading,
          charCount: chunkText.length,
        },
      });
    }
  }

  return chunks;
}

export function extractPasalReferences(text) {
  const refs = new Set();
  
  const patterns = [
    /Pasal\s+\d+[A-Z]?(?:\s+ayat\s+\(\d+\))?/gi,
    /Ps\.\s*\d+/gi,
    /Pasal\s+\d+[A-Z]?\s+huruf\s+[a-z]/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) matches.forEach(m => refs.add(m.trim()));
  }
  
  return Array.from(refs);
}

export function enrichChunkWithReferences(chunks) {
  return chunks.map(chunk => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      pasalRefs: extractPasalReferences(chunk.text),
    },
  }));
}