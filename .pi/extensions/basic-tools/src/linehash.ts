/**
 * Linehash parsing utilities.
 *
 * Parses output from the `linehash` binary (JSONL format with line, anchor, text).
 */

export interface LineHashRecord {
  /** 1-indexed line number */
  line: number;
  /** 4-char hex anchor (xxhash32) of line content */
  anchor: string;
  /** Line content */
  text: string;
}

export interface LineHashResult {
  /** Parsed records */
  records: LineHashRecord[];
  /** Total lines in the original file (only accurate when whole file was read) */
  totalLines: number;
  /** Lines returned (may be fewer if limit was applied) */
  returnedLines: number;
  /** Malformed JSONL lines that were skipped */
  parseErrors: string[];
}

/**
 * Parse linehash JSONL output into structured records.
 *
 * @param jsonl - Raw JSONL output from `linehash read`
 * @returns Parsed records with metadata
 */
export function parseLineHash(jsonl: string): LineHashResult {
  const lines = jsonl.split('\n').filter(l => l.trim() !== '');
  const records: LineHashRecord[] = [];
  const parseErrors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    try {
      const record = JSON.parse(line) as Partial<LineHashRecord>;
      if (record.line !== undefined && record.anchor !== undefined) {
        records.push({
          line: record.line,
          anchor: record.anchor,
          text: record.text ?? '',
        });
      } else {
        parseErrors.push(`Line ${i + 1}: missing required fields (line/anchor): ${line.slice(0, 100)}`);
      }
    } catch {
      parseErrors.push(`Line ${i + 1}: malformed JSON: ${line.slice(0, 100)}`);
    }
  }

  // totalLines is only accurate when we have the complete file
  // (i.e., records are contiguous from line 1 with no gaps)
  let totalLines = 0;
  if (records.length > 0) {
    const lastLine = records[records.length - 1].line;
    const firstLine = records[0].line;
    // Only accurate for full reads starting at line 1 with no gaps
    if (firstLine === 1 && records.length === lastLine) {
      totalLines = lastLine;
    }
    // Otherwise totalLines stays 0 (unknown for partial reads)
  }

  return {
    records,
    totalLines,
    returnedLines: records.length,
    parseErrors,
  };
}

/**
 * Extract text content from linehash records.
 *
 * @param records - Parsed linehash records
 * @returns Concatenated text with newlines
 */
export function extractText(records: LineHashRecord[]): string {
  return records.map(r => r.text).join('\n');
}

/**
 * Build a linehash index for quick lookup by anchor.
 *
 * @param records - Parsed linehash records
 * @returns Map from anchor to record index
 */
export function buildAnchorIndex(records: LineHashRecord[]): Map<string, number> {
  const index = new Map<string, number>();
  records.forEach((r, i) => index.set(r.anchor, i));
  return index;
}
