/**
 * Build phase results
 */
export interface BuildResult {
  /** Whether the build completed successfully */
  success: boolean;
  /** Build duration in milliseconds */
  duration: number;
  /** Preview of LLM response content (first 200 chars) */
  contentPreview: string | null;
  /** Conversation ID (if applicable) */
  conversationID?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Complete benchmark result
 */
export interface BenchmarkResult {
  /** The prompt that was executed */
  prompt: string;
  /** The model used for generation */
  model: string;
  /** ISO timestamp of when benchmark started */
  timestamp: string;
  /** Path to workspace directory */
  workspaceDir: string;
  /** Unique workspace identifier */
  workspaceId: string;
  /** Build phase results */
  build: BuildResult;
}

/**
 * Runner interface that all runners must implement
 */
export interface Runner {
  /**
   * Execute a benchmark with the given prompt
   * @param prompt - The prompt to execute
   * @param model - The model to use (optional, runner-specific default)
   * @returns Benchmark results
   */
  runBenchmark(prompt: string, model?: string): Promise<BenchmarkResult>;
}
