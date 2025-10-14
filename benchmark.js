#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { chromium } from 'playwright';
import { runBenchmark as runSigridBenchmark } from './scripts/sigrid-runner.js';
import { openWorkspace } from 'sigrid';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Embedded test prompts
export const TEST_PROMPTS = [
  {
    id: 'todo-app',
    prompt: 'Build a simple todo app with add, complete, and delete functionality'
  },
  {
    id: 'counter',
    prompt: 'Create a counter app with increment, decrement, and reset buttons'
  },
  {
    id: 'color-picker',
    prompt: 'Build a color picker that shows RGB values and a preview square'
  }
];

/**
 * Run benchmarks for given prompts
 * @param {Array|string} prompts - Array of prompt objects with {id, prompt} or single prompt string
 * @param {object} options - Benchmark options
 * @param {string} options.model - Model to use (default: gpt-4o-mini)
 * @param {string} options.runner - Runner to use (default: sigrid)
 * @param {string} options.resultsDir - Results directory path
 * @param {boolean} options.keepWorkspaces - Keep workspaces after benchmark (default: false)
 * @returns {Promise<object>} Benchmark results summary
 */
export async function runBenchmark(prompts, options = {}) {
  const {
    model = 'gpt-4o-mini',
    runner = 'sigrid',
    resultsDir = path.join(__dirname, 'results'),
    keepWorkspaces = false
  } = options;

  // Normalize prompts to array format
  let promptsToRun = [];
  if (typeof prompts === 'string') {
    promptsToRun = [{ id: 'custom', prompt: prompts }];
  } else if (Array.isArray(prompts)) {
    promptsToRun = prompts.map(p =>
      typeof p === 'string' ? { id: 'custom', prompt: p } : p
    );
  } else {
    throw new Error('prompts must be a string or array of strings/objects');
  }

  // Only support sigrid runner for now
  if (runner !== 'sigrid') {
    throw new Error(`Runner "${runner}" not supported yet`);
  }

  const results = [];
  const startTime = Date.now();
  const runningProcesses = []; // Track running dev servers

  // Ensure results directory exists
  await fs.mkdir(resultsDir, { recursive: true });

  for (let i = 0; i < promptsToRun.length; i++) {
    const testPrompt = promptsToRun[i];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${promptsToRun.length}] Running: ${testPrompt.id}`);
    console.log(`Prompt: "${testPrompt.prompt}"`);
    console.log('='.repeat(60));

    let serverProcess = null;

    try {
      // Step 1-3: Run benchmark (generate code with sigrid)
      const benchmarkResult = await runSigridBenchmark(testPrompt.prompt, model);

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
      let runResult;
      try {
        runResult = await runApp(benchmarkResult.workspaceDir);
        serverProcess = runResult.process;
        runningProcesses.push({ id: testPrompt.id, process: serverProcess });
      } catch (runError) {
        console.log(`\n❌ ${testPrompt.id} failed to start server`);
        runResult = {
          success: false,
          error: runError.message,
          duration: 0
        };
      }

      // Step 6: Analyze the app (only if server started successfully)
      let analyzeResult;
      if (runResult.success) {
        try {
          analyzeResult = await analyzeApp(runResult.serverUrl, testPrompt.id, resultsDir);
        } catch (analyzeError) {
          console.log(`\n⚠️  ${testPrompt.id} analysis failed but continuing...`);
          analyzeResult = {
            success: false,
            error: analyzeError.message,
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
      console.error(`\n❌ Error running ${testPrompt.id}:`, error.message);
      results.push({
        id: testPrompt.id,
        prompt: testPrompt.prompt,
        success: false,
        error: error.message
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
        console.warn(`   ⚠️  Failed to stop ${id}: ${error.message}`);
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;

  // Clean up workspaces if requested
  if (!keepWorkspaces) {
    console.log('\n🧹 Cleaning up workspaces...');
    let cleanedCount = 0;
    for (const result of results) {
      if (result.workspaceDir) {
        try {
          const workspace = await openWorkspace(result.workspaceDir);
          await workspace.delete();
          cleanedCount++;
        } catch (error) {
          console.warn(`⚠️  Failed to delete workspace ${result.workspaceDir}: ${error.message}`);
        }
      }
    }
    console.log(`✅ Cleaned up ${cleanedCount}/${results.length} workspaces`);
  } else {
    console.log('\n📁 Workspaces preserved');
  }

  // Save summary
  const summaryFile = path.join(resultsDir, `summary-${Date.now()}.json`);
  const summary = {
    runner,
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
 * @param {string} workspacePath - Path to workspace
 * @returns {Promise<object>} Compilation results
 */
async function compileApp(workspacePath) {
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
      } catch (installError) {
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
      stdout: stdout.substring(0, 500), // Truncate for storage
      stderr: stderr.substring(0, 500)
    };

  } catch (error) {
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
 * @param {string} workspacePath - Path to workspace
 * @returns {Promise<object>} Server info with URL and process handle
 */
async function runApp(workspacePath) {
  console.log(`🚀 [5/6] Running app...`);

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    let output = '';
    let serverUrl = null;
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
    }, 30000); // 30 second timeout

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      // Debug: log output chunks
      if (process.env.DEBUG) {
        console.log('[DEBUG]', text);
      }

      // Strip ANSI color codes for pattern matching
      // eslint-disable-next-line no-control-regex
      const cleanText = text.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

      // Look for Local URL pattern: "Local:   http://localhost:5173/"
      const localMatch = cleanText.match(/Local:\s+(http:\/\/localhost:\d+)/i);
      if (localMatch && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        serverUrl = localMatch[1];

        const duration = Date.now() - startTime;
        console.log(`✅ [5/6] App running at ${serverUrl} (${duration}ms)`);

        resolve({
          success: true,
          serverUrl,
          process: child,
          duration,
          output: output.substring(0, 1000) // Increase truncation limit for debugging
        });
      }
    });

    child.stderr.on('data', (data) => {
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
 * @param {object} childProcess - Process handle from runApp
 * @returns {Promise<void>}
 */
async function stopApp(childProcess) {
  return new Promise((resolve) => {
    if (!childProcess || childProcess.killed) {
      resolve();
      return;
    }

    childProcess.on('exit', () => {
      resolve();
    });

    childProcess.kill();

    // Force kill after 5 seconds if not stopped
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
 * @param {string} serverUrl - URL of the running app
 * @param {string} testId - ID of the test (for screenshot filename)
 * @param {string} resultsDir - Directory to save screenshots
 * @returns {Promise<object>} Analysis results
 */
async function analyzeApp(serverUrl, testId, resultsDir) {
  console.log(`🔍 [6/6] Analyzing app...`);

  const startTime = Date.now();
  const consoleMessages = [];
  const consoleErrors = [];
  const pageErrors = [];

  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Navigate to page
    const navigationStart = Date.now();
    await page.goto(serverUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const navigationDuration = Date.now() - navigationStart;

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(1000);

    // Take screenshot
    const screenshotsDir = path.join(resultsDir, 'screenshots');
    await fs.mkdir(screenshotsDir, { recursive: true });

    const screenshotPath = path.join(screenshotsDir, `${testId}-${Date.now()}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    // Get page title
    const title = await page.title();

    // Get basic page metrics
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
      consoleMessages: consoleMessages.slice(0, 20), // Limit to first 20
      consoleErrors,
      pageErrors,
      hasErrors: consoleErrors.length > 0 || pageErrors.length > 0
    };

  } catch (error) {
    if (browser) {
      await browser.close();
    }

    const duration = Date.now() - startTime;
    console.log(`❌ [6/6] Analysis failed (${duration}ms)`);
    console.log(`   Error: ${error.message}`);

    return {
      success: false,
      duration,
      error: error.message,
      consoleErrors,
      pageErrors
    };
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const keepWorkspaces = args.includes('--keep-workspaces');
  const regularArgs = args.filter(arg => !arg.startsWith('--'));

  const model = regularArgs[0] || 'gpt-4o-mini';
  const promptId = regularArgs[1]; // Optional: specific prompt ID to run

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is not set');
    process.exit(1);
  }

  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     ABE - App Builder Benchmark Environment          ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\nModel: ${model}`);
  console.log(`Total prompts: ${TEST_PROMPTS.length}`);
  console.log(`Keep workspaces: ${keepWorkspaces}\n`);

  // Filter prompts if specific ID provided
  const promptsToRun = promptId
    ? TEST_PROMPTS.filter(p => p.id === promptId)
    : TEST_PROMPTS;

  if (promptsToRun.length === 0) {
    console.error(`❌ Prompt ID "${promptId}" not found`);
    process.exit(1);
  }

  try {
    const summary = await runBenchmark(promptsToRun, { model, keepWorkspaces });

    // Print summary
    console.log('\n\n╔═══════════════════════════════════════════════════════╗');
    console.log('║                  Benchmark Summary                    ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log(`Total: ${summary.totalPrompts}`);
    console.log(`Success: ${summary.successCount}`);
    console.log(`Failed: ${summary.failureCount}`);
    console.log(`Duration: ${summary.totalDuration}ms\n`);

    summary.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.id}`);
    });

    console.log(`\n💾 Summary saved: ${summary.summaryFile}`);

    if (keepWorkspaces && summary.results.length > 0) {
      console.log('\n📁 Workspaces:');
      summary.results.forEach(result => {
        if (result.workspaceDir) {
          console.log(`   ${result.id}: ${result.workspaceDir}`);
        }
      });
    }

    process.exit(summary.successCount === summary.totalPrompts ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Only run main if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
