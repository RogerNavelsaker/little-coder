/**
 * Structured result and error envelopes for tool output.
 *
 * Provides consistent wrapping of success and error responses
 * with metadata for context hygiene and debugging.
 */

export interface ToolSuccess<T = unknown> {
  /** Success indicator */
  success: true;
  /** Tool-specific data payload */
  data: T;
  /** Metadata about the operation */
  metadata: {
    /** Tool name */
    tool: string;
    /** File path (if applicable) */
    path?: string;
    /** Output mode used */
    mode?: string;
    /** Token savings (if TOON was used) */
    tokenSavings?: number;
    /** Timestamp of the operation */
    timestamp: string;
  };
}

export interface ToolError {
  /** Error indicator */
  success: false;
  /** Error type/category */
  errorType: 'not-found' | 'permission-denied' | 'binary-failed' | 'parse-error' | 'invalid-params' | 'unknown';
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Metadata about the failed operation */
  metadata: {
    /** Tool name */
    tool: string;
    /** File path (if applicable) */
    path?: string;
    /** Output mode that was attempted */
    mode?: string;
    /** Timestamp of the operation */
    timestamp: string;
  };
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolError;

/**
 * Create a success envelope.
 *
 * @param data - Tool-specific data payload
 * @param options - Optional metadata
 * @returns Structured success result
 */
export function success<T>(
  data: T,
  options: {
    tool?: string;
    path?: string;
    mode?: string;
    tokenSavings?: number;
  } = {}
): ToolSuccess<T> {
  return {
    success: true,
    data,
    metadata: {
      tool: options.tool ?? 'unknown',
      path: options.path,
      mode: options.mode,
      tokenSavings: options.tokenSavings,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create an error envelope.
 *
 * @param errorType - Type of error
 * @param message - Human-readable error message
 * @param options - Optional details and metadata
 * @returns Structured error result
 */
export function error(
  errorType: ToolError['errorType'],
  message: string,
  options: {
    tool?: string;
    path?: string;
    mode?: string;
    details?: Record<string, unknown>;
  } = {}
): ToolError {
  return {
    success: false,
    errorType,
    message,
    details: options.details,
    metadata: {
      tool: options.tool ?? 'unknown',
      path: options.path,
      mode: options.mode,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Format a tool result for display.
 *
 * @param result - Tool result (success or error)
 * @param mode - Display mode
 * @returns Formatted string for display
 */
export function formatResult(result: ToolResult, mode: 'toon' | 'json' | 'raw' = 'json'): string {
  if (!result.success) {
    return `[${result.errorType}] ${result.message}`;
  }

  if (mode === 'json') {
    return JSON.stringify(result.data, null, 2);
  }

  if (mode === 'toon') {
    // Use @toon-format/toon for TOON encoding
    return JSON.stringify(result.data);
  }

  // Raw mode
  return typeof result.data === 'string' ? result.data : String(result.data);
}
