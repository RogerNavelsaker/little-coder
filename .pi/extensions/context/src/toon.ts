/**
 * TOON encoding utilities for structural tool output.
 *
 * Wraps @toon-format/toon with sensible defaults for pi tool outputs.
 */
import { encode, encodeLines, type EncodeOptions } from '@toon-format/toon';

export type ToonMode = 'toon' | 'json' | 'raw';

export interface ToonEncodeOptions extends EncodeOptions {
  /** Output mode: 'toon' (compact), 'json' (pretty), or 'raw' (plain text) */
  mode?: ToonMode;
}

export interface ToonEncodeResult {
  /** The encoded output string */
  text: string;
  /** The output mode used */
  mode: ToonMode;
  /** Token savings estimate (vs raw JSON) */
  tokenSavings?: number;
}

/**
 * Encode a value to TOON format with mode handling.
 *
 * @param input - Any JavaScript value to encode
 * @param options - Encoding options including mode
 * @returns Structured result with text and metadata
 */
export function encodeToon(
  input: unknown,
  options: ToonEncodeOptions = {}
): ToonEncodeResult {
  const { mode = 'toon', ...toonOpts } = options;

  if (mode === 'raw') {
    // For raw mode, return the input as-is (caller handles formatting)
    return {
      text: typeof input === 'string' ? input : String(input),
      mode: 'raw',
    };
  }

  if (mode === 'json') {
    return {
      text: JSON.stringify(input, null, 2),
      mode: 'json',
    };
  }

  // TOON mode (default)
  const toonString = encode(input, toonOpts);
  const rawJson = JSON.stringify(input);
  const savings = rawJson.length > 0
    ? Math.round((1 - toonString.length / rawJson.length) * 100)
    : 0;

  return {
    text: toonString,
    mode: 'toon',
    tokenSavings: savings,
  };
}

/**
 * Stream large data as TOON lines.
 *
 * @param input - Any JavaScript value to encode
 * @param options - Encoding options
 * @returns Iterable of TOON lines
 */
export function streamToon(
  input: unknown,
  options: EncodeOptions = {}
): Iterable<string> {
  return encodeLines(input, options);
}
