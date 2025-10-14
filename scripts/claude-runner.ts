#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import * as tar from 'tar';
import { randomBytes } from 'crypto';
import type { BenchmarkResult } from '../types.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

interface Workspace {
  path: string;
  id: string;
}

/**
 * Step 1: Creates a temporary workspace
 */
async function createTempWorkspace(): Promise<Workspace> {
  const id = randomBytes(8).toString('hex');
  const workspacePath = path.join('/tmp', 'claude-workspaces', id);

  await fs.mkdir(workspacePath, { recursive: true });

  console.log(`✅ [1/3] Workspace created: ${workspacePath}`);

  return {
    path: workspacePath,
    id
  };
}

/**
 * Step 2: Populates workspace using test fixture tarball
 */
async function populateWorkspace(workspace: Workspace): Promise<void> {
  // Use cached tarball if available (with pre-installed node_modules)
  const cachedTarballPath = path.join(PROJECT_ROOT, 'test-fixtures', 'react-scaffold-cached.tar.gz');
  const regularTarballPath = path.join(PROJECT_ROOT, 'test-fixtures', 'react-scaffold.tar.gz');

  let tarballPath = regularTarballPath;
  try {
    await fs.access(cachedTarballPath);
    tarballPath = cachedTarballPath;
    console.log(`✅ [2/3] Workspace populated from cached tarball`);
  } catch {
    console.log(`✅ [2/3] Workspace populated from tarball`);
  }

  // Extract tarball to workspace
  await tar.x({
    file: tarballPath,
    cwd: workspace.path
  });
}

/**
 * Step 3: Builds app using prompt given (via Claude Code CLI)
 */
async function buildAppWithPrompt(
  workspace: Workspace,
  prompt: string,
  model: string = 'sonnet'
): Promise<{
  success: boolean;
  content?: string;
  duration: number;
  error?: string;
}> {
  console.log(`🤖 [3/3] Building app with Claude Code...`);
  console.log(`   Model: ${model}`);
  console.log(`   Prompt: ${prompt}`);

  const startTime = Date.now();

  return new Promise((resolve) => {
    // Execute Claude Code CLI in simple print mode
    // -p: print mode (non-interactive, output response and exit)
    // --dangerously-skip-permissions: skip permission prompts
    // Note: Using simple text output (no JSON streaming) to avoid hang issues
    const child = spawn('claude', [
      '-p',
      '--model', model,
      '--dangerously-skip-permissions',
      prompt
    ], {
      cwd: workspace.path,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'] // stdin ignored, stdout/stderr piped
    });

    let stdout = '';
    let stderr = '';

    // Read stdout with setEncoding to handle text properly
    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (data) => {
        stdout += data;
        process.stdout.write('.'); // Progress indicator
      });
    }

    // Read stderr
    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (data) => {
        stderr += data;
      });
    }

    child.on('exit', (code) => {
      const duration = Date.now() - startTime;
      console.log(''); // New line after progress dots

      if (code === 0) {
        console.log(`✅ [3/3] App built successfully (${duration}ms)`);
        resolve({
          success: true,
          content: stdout,
          duration
        });
      } else {
        console.log(`❌ [3/3] App build failed with code ${code} (${duration}ms)`);
        if (stderr) {
          console.log(`   Error: ${stderr.substring(0, 200)}`);
        }
        resolve({
          success: false,
          error: `Process exited with code ${code}: ${stderr}`,
          duration
        });
      }
    });

    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.log(`❌ [3/3] App build failed (${duration}ms)`);
      resolve({
        success: false,
        error: error.message,
        duration
      });
    });
  });
}

/**
 * Delete workspace directory
 */
async function deleteWorkspace(workspace: Workspace): Promise<void> {
  try {
    await fs.rm(workspace.path, { recursive: true, force: true });
  } catch (error) {
    console.warn(`⚠️  Failed to delete workspace: ${error}`);
  }
}

/**
 * Main benchmark function (exported for use as module)
 * Implements the standard runner interface defined in types.ts
 */
export async function runBenchmark(
  prompt: string,
  model: string = 'sonnet'
): Promise<BenchmarkResult> {
  let workspace: Workspace | undefined;

  try {
    // Step 1: Create workspace
    workspace = await createTempWorkspace();

    // Step 2: Populate workspace
    await populateWorkspace(workspace);

    // Step 3: Build app with prompt
    const buildResult = await buildAppWithPrompt(workspace, prompt, model);

    // Return results
    const results: BenchmarkResult = {
      prompt,
      model,
      timestamp: new Date().toISOString(),
      workspaceDir: workspace.path,
      workspaceId: workspace.id,
      build: {
        success: buildResult.success,
        duration: buildResult.duration,
        contentPreview: buildResult.content?.substring(0, 200) || null,
        error: buildResult.error
      }
    };

    return results;

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    if (workspace) {
      console.log(`📁 Workspace: ${workspace.path}`);
    }
    throw error;
  }
}
