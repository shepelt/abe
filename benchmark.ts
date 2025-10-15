#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import { chromium } from 'playwright';
import { Command } from 'commander';
import { runBenchmark as runSigridBenchmark } from './scripts/sigrid-runner.js';
import { runBenchmark as runClaudeBenchmark } from './scripts/claude-runner.js';
import { openWorkspace } from 'sigrid';
import type { BenchmarkResult } from './types.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Runner registry
type RunnerFunction = (prompt: string, model?: string) => Promise<BenchmarkResult>;

interface RunnerConfig {
  id: string;
  name: string;
  defaultModel: string;
  runBenchmark: RunnerFunction;
  cleanupWorkspace?: (workspaceDir: string) => Promise<void>;
}

export const RUNNERS: Record<string, RunnerConfig> = {
  sigrid: {
    id: 'sigrid',
    name: 'Sigrid (OpenAI)',
    defaultModel: 'gpt-5',
    runBenchmark: runSigridBenchmark,
    cleanupWorkspace: async (workspaceDir: string) => {
      const workspace = await openWorkspace(workspaceDir);
      await workspace.delete();
    }
  },
  claude: {
    id: 'claude',
    name: 'Claude Code CLI',
    defaultModel: 'sonnet',
    runBenchmark: runClaudeBenchmark,
    cleanupWorkspace: async (workspaceDir: string) => {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  }
};

/**
 * Get list of available runner IDs
 */
export function getAvailableRunners(): string[] {
  return Object.keys(RUNNERS);
}

/**
 * Get runner config by ID
 */
export function getRunner(runnerId: string): RunnerConfig | undefined {
  return RUNNERS[runnerId];
}

// Test prompt type
export interface TestPrompt {
  id: string;
  prompt: string;
}

/**
 * Parse and validate runner filter
 */
function parseRunnerFilter(filter: string, allRunners: string[]): string[] {
  if (!filter) {
    return allRunners;
  }

  const requested = filter.split(',').map(r => r.trim());
  const invalid = requested.filter(r => !allRunners.includes(r));

  if (invalid.length > 0) {
    throw new Error(
      `Invalid runner(s): ${invalid.join(', ')}. ` +
      `Available runners: ${allRunners.join(', ')}`
    );
  }

  return requested;
}

/**
 * Load a prompt from a file
 */
async function loadPromptFromFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return content.trim();
}

/**
 * Load all built-in prompts from prompts/ directory
 */
async function loadAllPrompts(): Promise<TestPrompt[]> {
  const promptsDir = path.join(__dirname, 'prompts');

  try {
    const files = await fs.readdir(promptsDir);
    const txtFiles = files.filter(f => f.endsWith('.txt'));

    const prompts: TestPrompt[] = [];
    for (const file of txtFiles) {
      const id = file.replace('.txt', '');
      const filePath = path.join(promptsDir, file);
      const prompt = await loadPromptFromFile(filePath);
      prompts.push({ id, prompt });
    }

    return prompts.sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    // If prompts directory doesn't exist, return empty array
    console.warn(`Warning: Could not load prompts from ${promptsDir}`);
    return [];
  }
}

/**
 * Resolve prompt input to a TestPrompt object
 * Can handle:
 * - Built-in prompt ID (e.g., 'todo-app')
 * - File path (e.g., 'prompts/todo-app.txt' or '../my-prompt.txt')
 * - Direct prompt string (e.g., 'Build a calculator app')
 */
async function resolvePrompt(input: string): Promise<TestPrompt> {
  // Check if input looks like a file path
  const isFilePath = input.includes('/') || input.includes('\\') || input.endsWith('.txt');

  if (isFilePath) {
    // Try to load from file
    try {
      const prompt = await loadPromptFromFile(input);
      const id = path.basename(input, '.txt');
      return { id, prompt };
    } catch (error) {
      throw new Error(`Failed to load prompt from file "${input}": ${(error as Error).message}`);
    }
  }

  // Check if it's a built-in prompt ID
  const promptsDir = path.join(__dirname, 'prompts');
  const builtInPath = path.join(promptsDir, `${input}.txt`);

  try {
    await fs.access(builtInPath);
    const prompt = await loadPromptFromFile(builtInPath);
    return { id: input, prompt };
  } catch {
    // Not a built-in prompt ID, treat as direct prompt string
    return { id: 'custom', prompt: input };
  }
}

// Extended benchmark result with all pipeline steps
export interface FullBenchmarkResult extends BenchmarkResult {
  id: string;
  success: boolean;
  compile?: CompileResult;
  run?: RunResult;
  analyze?: AnalyzeResult;
  error?: string;
}

export interface CompileResult {
  success: boolean;
  duration: number;
  buildDuration?: number;
  installDuration?: number;
  installNeeded?: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface RunResult {
  success: boolean;
  serverUrl?: string;
  process?: ChildProcess;
  duration: number;
  output?: string;
  error?: string;
}

export interface AnalyzeResult {
  success: boolean;
  duration: number;
  navigationDuration?: number;
  screenshotPath?: string;
  title?: string;
  metrics?: {
    url: string;
    readyState: string;
    bodyChildren: number;
  };
  consoleMessages?: Array<{ type: string; text: string }>;
  consoleErrors?: string[];
  pageErrors?: string[];
  hasErrors?: boolean;
  error?: string;
}

export interface BenchmarkOptions {
  model?: string;
  runner?: string;
  resultsDir?: string;
  keepWorkspaces?: boolean;
}

export interface BenchmarkSummary {
  runner: string;
  model: string;
  timestamp: string;
  totalDuration: number;
  totalPrompts: number;
  successCount: number;
  failureCount: number;
  keepWorkspaces: boolean;
  results: FullBenchmarkResult[];
  summaryFile?: string;
}

// New interfaces for multi-runner benchmark
export interface RunnerBenchmarkResult {
  runner: string;
  model: string;
  success: boolean;
  totalDuration: number;
  durations: {
    codeGeneration: number;
    compilation: number;
    serverStartup: number;
    analysis: number;
  };
  errors: {
    consoleErrors: number;
    pageErrors: number;
  };
  screenshotPath?: string;
  workspaceDir?: string;
  error?: string;
}

export interface BenchmarkMetadata {
  appName: string;
  timestamp: string;
  dateStr: string;
  prompt: string;
  runners: RunnerBenchmarkResult[];
  summary: {
    totalRunners: number;
    successfulRunners: number;
    failedRunners: number;
    fastestRunner: string | null;
    fastestTime: number | null;
  };
}

/**
 * Copy screenshot to benchmark directory
 */
async function copyScreenshot(
  sourcePath: string,
  benchmarkDir: string,
  runnerId: string,
  dateStr: string
): Promise<string> {
  const dateOnly = dateStr.split('-')[0]; // YYYYMMDD
  const filename = `${runnerId}_${dateOnly}.png`;
  const destPath = path.join(benchmarkDir, filename);
  await fs.copyFile(sourcePath, destPath);
  return filename;
}

/**
 * Run a single runner through the full benchmark pipeline
 */
async function runSingleRunner(
  runnerId: string,
  prompt: string,
  keepWorkspaces: boolean
): Promise<RunnerBenchmarkResult> {
  const runnerConfig = RUNNERS[runnerId];
  const model = runnerConfig.defaultModel;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${runnerConfig.name} (${model})`);
  console.log(`Prompt: "${prompt}"`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  let serverProcess: ChildProcess | null = null;

  try {
    // 1. Code generation
    const buildResult = await runnerConfig.runBenchmark(prompt, model);

    if (!buildResult.build.success) {
      return {
        runner: runnerId,
        model,
        success: false,
        error: 'Code generation failed',
        totalDuration: Date.now() - startTime,
        durations: {
          codeGeneration: buildResult.build.duration,
          compilation: 0,
          serverStartup: 0,
          analysis: 0
        },
        errors: {
          consoleErrors: 0,
          pageErrors: 0
        }
      };
    }

    console.log(`✅ Code generated (${buildResult.build.duration}ms)`);

    // 2. Compile
    const compileResult = await compileApp(buildResult.workspaceDir);

    if (!compileResult.success) {
      return {
        runner: runnerId,
        model,
        success: false,
        error: 'Compilation failed',
        totalDuration: Date.now() - startTime,
        durations: {
          codeGeneration: buildResult.build.duration,
          compilation: compileResult.duration,
          serverStartup: 0,
          analysis: 0
        },
        errors: {
          consoleErrors: 0,
          pageErrors: 0
        },
        workspaceDir: buildResult.workspaceDir
      };
    }

    console.log(`✅ Compiled (${compileResult.duration}ms)`);

    // 3. Run server
    const runResult = await runApp(buildResult.workspaceDir);
    serverProcess = runResult.process || null;

    if (!runResult.success) {
      return {
        runner: runnerId,
        model,
        success: false,
        error: 'Server startup failed',
        totalDuration: Date.now() - startTime,
        durations: {
          codeGeneration: buildResult.build.duration,
          compilation: compileResult.duration,
          serverStartup: runResult.duration,
          analysis: 0
        },
        errors: {
          consoleErrors: 0,
          pageErrors: 0
        },
        workspaceDir: buildResult.workspaceDir
      };
    }

    console.log(`✅ Server started (${runResult.duration}ms)`);

    // 4. Analyze app
    const resultsDir = path.join(__dirname, 'results');
    const analyzeResult = await analyzeApp(
      runResult.serverUrl!,
      `${runnerId}-temp`,
      resultsDir
    );

    console.log(`✅ Analysis complete (${analyzeResult.duration}ms)`);

    // 5. Stop server
    if (serverProcess) {
      await stopApp(serverProcess);
    }

    const totalDuration = Date.now() - startTime;
    console.log(`✅ Total: ${(totalDuration / 1000).toFixed(1)}s`);

    const result: RunnerBenchmarkResult = {
      runner: runnerId,
      model,
      success: true,
      totalDuration,
      durations: {
        codeGeneration: buildResult.build.duration,
        compilation: compileResult.duration,
        serverStartup: runResult.duration,
        analysis: analyzeResult.duration
      },
      errors: {
        consoleErrors: analyzeResult.consoleErrors?.length || 0,
        pageErrors: analyzeResult.pageErrors?.length || 0
      },
      screenshotPath: analyzeResult.screenshotPath,
      workspaceDir: buildResult.workspaceDir
    };

    // 6. Cleanup workspace if requested
    if (!keepWorkspaces && runnerConfig.cleanupWorkspace && buildResult.workspaceDir) {
      await runnerConfig.cleanupWorkspace(buildResult.workspaceDir);
    }

    return result;

  } catch (error) {
    // Cleanup server if running
    if (serverProcess) {
      try {
        await stopApp(serverProcess);
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      runner: runnerId,
      model,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      totalDuration: Date.now() - startTime,
      durations: {
        codeGeneration: 0,
        compilation: 0,
        serverStartup: 0,
        analysis: 0
      },
      errors: {
        consoleErrors: 0,
        pageErrors: 0
      }
    };
  }
}

/**
 * Run multi-runner benchmark for a single app/prompt
 * Saves results to benchmarks/YYYYMMDD-HHmmss/app-name/
 */
export async function runMultiRunnerBenchmark(
  appName: string,
  prompt: string,
  options: {
    filter?: string;
    keepWorkspaces?: boolean;
  } = {}
): Promise<{ benchmarkDir: string; metadata: BenchmarkMetadata }> {
  const { filter, keepWorkspaces = false } = options;

  // Parse runners to use
  const allRunners = Object.keys(RUNNERS);
  const runnersToRun = parseRunnerFilter(filter || '', allRunners);

  // Create timestamped benchmark directory
  const now = new Date();
  const dateStr = now.toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '')
    .replace(/\..+/, '')
    .replace(/-/g, (match, offset) => offset < 8 ? match : '');
  const dateOnly = dateStr.substring(0, 8); // YYYYMMDD

  const benchmarkDir = path.join(
    __dirname,
    'benchmarks',
    dateStr.substring(0, 15), // YYYYMMDD-HHMMSS
    appName
  );

  await fs.mkdir(benchmarkDir, { recursive: true });

  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     ABE - App Builder Benchmark Environment          ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\nApp: ${appName}`);
  console.log(`Prompt: "${prompt}"`);
  console.log(`Runners: ${runnersToRun.join(', ')} (${runnersToRun.length} total)\n`);

  const results: RunnerBenchmarkResult[] = [];

  // Run each runner
  for (let i = 0; i < runnersToRun.length; i++) {
    const runnerId = runnersToRun[i];

    console.log(`\n[${ i + 1}/${runnersToRun.length}] Running: ${RUNNERS[runnerId].name}`);
    console.log('='.repeat(60));

    try {
      const result = await runSingleRunner(runnerId, prompt, keepWorkspaces);
      results.push(result);

      // Copy screenshot if successful
      if (result.success && result.screenshotPath) {
        try {
          const filename = await copyScreenshot(
            result.screenshotPath,
            benchmarkDir,
            runnerId,
            dateStr
          );
          console.log(`📸 Screenshot saved: ${filename}`);
        } catch (error) {
          console.warn(`⚠️  Failed to copy screenshot: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      console.error(`❌ Runner ${runnerId} failed: ${(error as Error).message}`);
      results.push({
        runner: runnerId,
        model: RUNNERS[runnerId].defaultModel,
        success: false,
        error: (error as Error).message,
        totalDuration: 0,
        durations: {
          codeGeneration: 0,
          compilation: 0,
          serverStartup: 0,
          analysis: 0
        },
        errors: {
          consoleErrors: 0,
          pageErrors: 0
        }
      });
    }
  }

  // Generate summary
  const successfulRunners = results.filter(r => r.success);
  const failedRunners = results.filter(r => !r.success);

  let fastestRunner: string | null = null;
  let fastestTime: number | null = null;

  if (successfulRunners.length > 0) {
    const fastest = successfulRunners.reduce((min, r) =>
      r.totalDuration < min.totalDuration ? r : min
    );
    fastestRunner = fastest.runner;
    fastestTime = fastest.totalDuration;
  }

  // Create metadata
  const metadata: BenchmarkMetadata = {
    appName,
    timestamp: now.toISOString(),
    dateStr,
    prompt,
    runners: results.map(r => ({
      ...r,
      screenshotPath: r.screenshotPath ? path.basename(r.screenshotPath!) : undefined
    })),
    summary: {
      totalRunners: results.length,
      successfulRunners: successfulRunners.length,
      failedRunners: failedRunners.length,
      fastestRunner,
      fastestTime
    }
  };

  // Save metadata
  const metadataPath = path.join(benchmarkDir, 'metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  // Print summary
  console.log('\n\n╔═══════════════════════════════════════════════════════╗');
  console.log('║            Benchmark Results                          ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  console.log('┌─────────┬─────────┬──────────┬──────────┬─────────┐');
  console.log('│ Runner  │ Model   │ Total    │ Success  │ Errors  │');
  console.log('├─────────┼─────────┼──────────┼──────────┼─────────┤');

  results.forEach(r => {
    const runner = r.runner.padEnd(7);
    const model = r.model.padEnd(7);
    const total = r.success ? `${(r.totalDuration / 1000).toFixed(1)}s`.padEnd(8) : 'FAILED'.padEnd(8);
    const success = r.success ? '✅' : '❌';
    const errors = `${r.errors.consoleErrors + r.errors.pageErrors}`.padEnd(7);
    console.log(`│ ${runner} │ ${model} │ ${total} │ ${success}       │ ${errors} │`);
  });

  console.log('└─────────┴─────────┴──────────┴──────────┴─────────┘\n');

  if (fastestRunner) {
    console.log(`🏆 Fastest: ${fastestRunner} (${(fastestTime! / 1000).toFixed(1)}s)`);
  }

  console.log(`📊 Success rate: ${successfulRunners.length}/${results.length} (${Math.round(successfulRunners.length / results.length * 100)}%)\n`);
  console.log(`📦 Benchmark saved: ${benchmarkDir}/`);

  results.forEach(r => {
    if (r.screenshotPath) {
      console.log(`   ✅ ${r.runner}_${dateOnly}.png`);
    }
  });

  console.log(`   ✅ metadata.json`);

  return { benchmarkDir, metadata };
}

/**
 * Run benchmarks for given prompts (legacy function)
 */
export async function runBenchmark(
  prompts: TestPrompt[] | string,
  options: BenchmarkOptions = {}
): Promise<BenchmarkSummary> {
  const {
    runner: runnerId = 'sigrid',
    resultsDir = path.join(__dirname, 'results'),
    keepWorkspaces = false
  } = options;

  // Get runner config
  const runnerConfig = RUNNERS[runnerId];
  if (!runnerConfig) {
    const availableRunners = Object.keys(RUNNERS).join(', ');
    throw new Error(`Runner "${runnerId}" not found. Available runners: ${availableRunners}`);
  }

  // Use model from options or runner's default
  const model = options.model || runnerConfig.defaultModel;

  // Normalize prompts to array format
  let promptsToRun: TestPrompt[] = [];
  if (typeof prompts === 'string') {
    promptsToRun = [{ id: 'custom', prompt: prompts }];
  } else if (Array.isArray(prompts)) {
    promptsToRun = prompts.map(p =>
      typeof p === 'string' ? { id: 'custom', prompt: p } : p
    );
  } else {
    throw new Error('prompts must be a string or array of strings/objects');
  }

  const results: FullBenchmarkResult[] = [];
  const startTime = Date.now();
  const runningProcesses: Array<{ id: string; process: ChildProcess }> = [];

  // Ensure results directory exists
  await fs.mkdir(resultsDir, { recursive: true });

  for (let i = 0; i < promptsToRun.length; i++) {
    const testPrompt = promptsToRun[i];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${promptsToRun.length}] Running: ${testPrompt.id}`);
    console.log(`Prompt: "${testPrompt.prompt}"`);
    console.log('='.repeat(60));

    let serverProcess: ChildProcess | null = null;

    try {
      // Step 1-3: Run benchmark (generate code)
      const benchmarkResult = await runnerConfig.runBenchmark(testPrompt.prompt, model);

      if (!benchmarkResult.build.success) {
        console.log(`\n❌ ${testPrompt.id} - Code generation failed`);
        if (keepWorkspaces) {
          console.log(`   Workspace: ${benchmarkResult.workspaceDir}`);
        }

        results.push({
          id: testPrompt.id,
          prompt: testPrompt.prompt,
          success: false,
          ...benchmarkResult
        });
        continue;
      }

      console.log(`\n✅ ${testPrompt.id} - Code generated (${benchmarkResult.build.duration}ms)`);

      // Step 4: Compile the app
      const compileResult = await compileApp(benchmarkResult.workspaceDir);

      if (!compileResult.success) {
        console.log(`\n❌ ${testPrompt.id} failed at compilation`);
        if (keepWorkspaces) {
          console.log(`   Workspace: ${benchmarkResult.workspaceDir}`);
        }

        results.push({
          id: testPrompt.id,
          prompt: testPrompt.prompt,
          success: false,
          ...benchmarkResult,
          compile: compileResult
        });
        continue;
      }

      console.log(`✅ ${testPrompt.id} - Compiled (${compileResult.duration}ms)`);

      // Step 5: Run the app
      let runResult: RunResult;
      try {
        runResult = await runApp(benchmarkResult.workspaceDir);
        serverProcess = runResult.process || null;
        if (serverProcess) {
          runningProcesses.push({ id: testPrompt.id, process: serverProcess });
        }
      } catch (runError) {
        console.log(`\n❌ ${testPrompt.id} failed to start server`);
        runResult = {
          success: false,
          error: runError instanceof Error ? runError.message : String(runError),
          duration: 0
        };
      }

      // Step 6: Analyze the app (only if server started successfully)
      let analyzeResult: AnalyzeResult;
      if (runResult.success) {
        try {
          analyzeResult = await analyzeApp(runResult.serverUrl!, testPrompt.id, resultsDir);
        } catch (analyzeError) {
          console.log(`\n⚠️  ${testPrompt.id} analysis failed but continuing...`);
          analyzeResult = {
            success: false,
            error: analyzeError instanceof Error ? analyzeError.message : String(analyzeError),
            duration: 0
          };
        }
      } else {
        analyzeResult = {
          success: false,
          error: 'Server not running',
          duration: 0
        };
      }

      const overallSuccess = benchmarkResult.build.success &&
                            compileResult.success &&
                            runResult.success &&
                            analyzeResult.success;

      results.push({
        id: testPrompt.id,
        prompt: testPrompt.prompt,
        success: overallSuccess,
        ...benchmarkResult,
        compile: compileResult,
        run: {
          success: runResult.success,
          serverUrl: runResult.serverUrl,
          duration: runResult.duration,
          error: runResult.error,
          output: runResult.output
        },
        analyze: {
          success: analyzeResult.success,
          duration: analyzeResult.duration,
          screenshotPath: analyzeResult.screenshotPath,
          title: analyzeResult.title,
          consoleErrors: analyzeResult.consoleErrors,
          pageErrors: analyzeResult.pageErrors,
          hasErrors: analyzeResult.hasErrors,
          error: analyzeResult.error
        }
      });

      if (overallSuccess) {
        console.log(`\n✅ ${testPrompt.id} completed successfully`);
        console.log(`   Code generation: ${benchmarkResult.build.duration}ms`);
        console.log(`   Compilation: ${compileResult.duration}ms`);
        console.log(`   Server startup: ${runResult.duration}ms`);
        console.log(`   Analysis: ${analyzeResult.duration}ms`);
        console.log(`   Server URL: ${runResult.serverUrl}`);
        if (keepWorkspaces) {
          console.log(`   Workspace: ${benchmarkResult.workspaceDir}`);
        }
      } else {
        console.log(`\n❌ ${testPrompt.id} failed`);
        if (keepWorkspaces) {
          console.log(`   Workspace: ${benchmarkResult.workspaceDir}`);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Error running ${testPrompt.id}:`, errorMessage);
      results.push({
        id: testPrompt.id,
        prompt: testPrompt.prompt,
        success: false,
        error: errorMessage,
        model,
        timestamp: new Date().toISOString(),
        workspaceDir: '',
        workspaceId: '',
        build: {
          success: false,
          duration: 0,
          contentPreview: null,
          error: errorMessage
        }
      });
    }
  }

  // Stop all running servers
  if (runningProcesses.length > 0) {
    console.log(`\n🛑 Stopping ${runningProcesses.length} server(s)...`);
    for (const { id, process } of runningProcesses) {
      try {
        await stopApp(process);
        console.log(`   ✅ Stopped ${id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`   ⚠️  Failed to stop ${id}: ${errorMessage}`);
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;

  // Clean up workspaces if requested
  if (!keepWorkspaces && runnerConfig.cleanupWorkspace) {
    console.log('\n🧹 Cleaning up workspaces...');
    let cleanedCount = 0;
    for (const result of results) {
      if (result.workspaceDir) {
        try {
          await runnerConfig.cleanupWorkspace(result.workspaceDir);
          cleanedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️  Failed to delete workspace ${result.workspaceDir}: ${errorMessage}`);
        }
      }
    }
    console.log(`✅ Cleaned up ${cleanedCount}/${results.length} workspaces`);
  } else {
    console.log('\n📁 Workspaces preserved');
  }

  // Save summary
  const summaryFile = path.join(resultsDir, `summary-${Date.now()}.json`);
  const summary: BenchmarkSummary = {
    runner: runnerId,
    model,
    timestamp: new Date().toISOString(),
    totalDuration,
    totalPrompts: results.length,
    successCount,
    failureCount: results.length - successCount,
    keepWorkspaces,
    results
  };

  await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));

  return {
    ...summary,
    summaryFile
  };
}

/**
 * Step 4 - Compile the app
 */
async function compileApp(workspacePath: string): Promise<CompileResult> {
  console.log(`🔨 [4/6] Compiling app...`);

  const startTime = Date.now();

  try {
    // Check if node_modules exists, if not run npm install
    const nodeModulesPath = path.join(workspacePath, 'node_modules');
    let installNeeded = false;
    try {
      await fs.access(nodeModulesPath);
    } catch {
      installNeeded = true;
    }

    if (installNeeded) {
      console.log(`   📦 Installing dependencies...`);
      const installStart = Date.now();
      try {
        await execAsync('npm install', {
          cwd: workspacePath,
          maxBuffer: 10 * 1024 * 1024,
          timeout: 5 * 60 * 1000 // 5 minutes
        });
        const installDuration = Date.now() - installStart;
        console.log(`   ✅ Dependencies installed (${installDuration}ms)`);
      } catch (installError: any) {
        const installDuration = Date.now() - installStart;
        console.log(`   ❌ Install failed (${installDuration}ms)`);
        return {
          success: false,
          duration: Date.now() - startTime,
          installDuration,
          error: 'npm install failed',
          stderr: installError.stderr || installError.message
        };
      }
    } else {
      console.log(`   ✅ Dependencies already installed`);
    }

    // Run build
    console.log(`   🏗️  Building app...`);
    const buildStart = Date.now();
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: workspacePath,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 3 * 60 * 1000 // 3 minutes
    });

    const buildDuration = Date.now() - buildStart;
    const totalDuration = Date.now() - startTime;

    console.log(`✅ [4/6] Compilation succeeded (${totalDuration}ms)`);

    return {
      success: true,
      duration: totalDuration,
      buildDuration,
      installNeeded,
      stdout: stdout.substring(0, 500),
      stderr: stderr.substring(0, 500)
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ [4/6] Compilation failed (${duration}ms)`);

    return {
      success: false,
      duration,
      error: error.message,
      stderr: error.stderr || '',
      stdout: error.stdout || ''
    };
  }
}

/**
 * Step 5 - Run the app (using vite)
 */
async function runApp(workspacePath: string): Promise<RunResult> {
  console.log(`🚀 [5/6] Running app...`);

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    let output = '';
    let resolved = false;

    // Start vite dev server
    const child = spawn('npm', ['run', 'dev'], {
      cwd: workspacePath,
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error('Server startup timeout (30s)'));
      }
    }, 30000);

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (process.env.DEBUG) {
        console.log('[DEBUG]', text);
      }

      // Strip ANSI color codes for pattern matching
      const cleanText = text.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

      const localMatch = cleanText.match(/Local:\s+(http:\/\/localhost:\d+)/i);
      if (localMatch && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        const serverUrl = localMatch[1];

        const duration = Date.now() - startTime;
        console.log(`✅ [5/6] App running at ${serverUrl} (${duration}ms)`);

        resolve({
          success: true,
          serverUrl,
          process: child,
          duration,
          output: output.substring(0, 1000)
        });
      }
    });

    child.stderr?.on('data', (data) => {
      output += data.toString();
    });

    child.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        console.log(`❌ [5/6] Failed to start app (${duration}ms)`);
        reject(error);
      }
    });

    child.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        console.log(`❌ [5/6] Server exited unexpectedly (code: ${code}, ${duration}ms)`);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

/**
 * Stop a running vite dev server
 */
async function stopApp(childProcess: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!childProcess || childProcess.killed) {
      resolve();
      return;
    }

    childProcess.on('exit', () => {
      resolve();
    });

    childProcess.kill();

    setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill('SIGKILL');
      }
      resolve();
    }, 5000);
  });
}

/**
 * Step 6 - Analyze the app (using Playwright)
 */
async function analyzeApp(
  serverUrl: string,
  testId: string,
  resultsDir: string
): Promise<AnalyzeResult> {
  console.log(`🔍 [6/6] Analyzing app...`);

  const startTime = Date.now();
  const consoleMessages: Array<{ type: string; text: string }> = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    const navigationStart = Date.now();
    await page.goto(serverUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const navigationDuration = Date.now() - navigationStart;

    await page.waitForTimeout(1000);

    const screenshotsDir = path.join(resultsDir, 'screenshots');
    await fs.mkdir(screenshotsDir, { recursive: true });

    const screenshotPath = path.join(screenshotsDir, `${testId}-${Date.now()}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    const title = await page.title();

    const metrics = await page.evaluate(() => ({
      url: window.location.href,
      readyState: document.readyState,
      bodyChildren: document.body ? document.body.children.length : 0
    }));

    await browser.close();

    const duration = Date.now() - startTime;
    console.log(`✅ [6/6] Analysis complete (${duration}ms)`);
    console.log(`   Screenshot: ${screenshotPath}`);
    console.log(`   Console errors: ${consoleErrors.length}`);
    console.log(`   Page errors: ${pageErrors.length}`);

    return {
      success: true,
      duration,
      navigationDuration,
      screenshotPath,
      title,
      metrics,
      consoleMessages: consoleMessages.slice(0, 20),
      consoleErrors,
      pageErrors,
      hasErrors: consoleErrors.length > 0 || pageErrors.length > 0
    };

  } catch (error) {
    if (browser) {
      await browser.close();
    }

    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`❌ [6/6] Analysis failed (${duration}ms)`);
    console.log(`   Error: ${errorMessage}`);

    return {
      success: false,
      duration,
      error: errorMessage,
      consoleErrors,
      pageErrors
    };
  }
}

/**
 * CLI entry point
 */
async function main() {
  const program = new Command();

  program
    .name('abe')
    .description('ABE - App Builder Benchmark Environment')
    .version('1.0.0')
    .argument('<app-name>', 'App name (must match a built-in prompt ID or provide custom prompt)')
    .option('-f, --filter <runners>', 'Filter specific runners (comma-separated)', '')
    .option('-p, --prompt <text>', 'Custom prompt text (overrides built-in prompt)', '')
    .option('-k, --keep-workspaces', 'Keep workspaces after completion', false)
    .option('-l, --list-prompts', 'List all built-in test prompts and exit')
    .addHelpText('after', `
Available Runners:
  ${Object.values(RUNNERS).map(r => `${r.id.padEnd(10)} - ${r.name} (default: ${r.defaultModel})`).join('\n  ')}

Prompt Input Options:
  Built-in prompts are loaded from the prompts/ directory.
  You can provide prompts in three ways:
    1. Built-in prompt ID (e.g., 'todo-app', 'counter')
    2. File path (e.g., 'prompts/todo-app.txt', '../my-prompt.txt')
    3. Custom string with --prompt flag

Examples:
  $ npm run benchmark todo-app                           # Run all runners with built-in prompt
  $ npm run benchmark -- --list-prompts                  # List all built-in prompts
  $ npm run benchmark todo-app -- --filter sigrid        # Run only sigrid runner
  $ npm run benchmark todo-app -- --filter sigrid,claude # Run multiple runners
  $ npm run benchmark prompts/todo-app.txt               # Run from file path
  $ npm run benchmark my-app -- --prompt "build a calc"  # Run with custom prompt
  $ npm run benchmark todo-app -- --keep-workspaces      # Keep workspaces after run
    `);

  // Handle --list-prompts flag before parsing
  if (process.argv.includes('--list-prompts') || process.argv.includes('-l')) {
    const allPrompts = await loadAllPrompts();
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║          Built-in Test Prompts                        ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    allPrompts.forEach(p => {
      console.log(`${p.id.padEnd(12)} - ${p.prompt}`);
    });
    console.log(`\nTotal: ${allPrompts.length} prompts`);
    console.log(`\nPrompts are loaded from: prompts/`);
    process.exit(0);
  }

  program.parse();

  const options = program.opts();
  const [appName] = program.args;

  const filter = options.filter;
  const keepWorkspaces = options.keepWorkspaces;
  const customPrompt = options.prompt;

  // Validate runner filter if provided
  if (filter) {
    try {
      parseRunnerFilter(filter, Object.keys(RUNNERS));
    } catch (error) {
      console.error(`❌ ${(error as Error).message}`);
      process.exit(1);
    }
  }

  // Resolve prompt
  let prompt: string;
  let resolvedAppName: string = appName;

  if (customPrompt) {
    // Custom prompt provided via --prompt flag
    prompt = customPrompt;
  } else {
    // Try to resolve appName as prompt ID or file path
    try {
      const resolved = await resolvePrompt(appName);
      prompt = resolved.prompt;
      resolvedAppName = resolved.id;
    } catch (error) {
      const allPrompts = await loadAllPrompts();
      console.error(`❌ App/Prompt "${appName}" not found`);
      console.error(`Available prompt IDs: ${allPrompts.map(p => p.id).join(', ')}`);
      console.error(`\nUse --list-prompts to see all available prompts`);
      console.error(`Or provide a file path (e.g., prompts/todo-app.txt)`);
      console.error(`Or use --prompt to provide a custom prompt string`);
      process.exit(1);
    }
  }

  try {
    const { benchmarkDir, metadata } = await runMultiRunnerBenchmark(
      resolvedAppName,
      prompt,
      { filter, keepWorkspaces }
    );

    // Exit with error code if any runner failed
    const hasFailures = metadata.summary.failedRunners > 0;
    process.exit(hasFailures ? 1 : 0);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Unexpected error:', errorMessage);
    process.exit(1);
  }
}

// Only run main if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
