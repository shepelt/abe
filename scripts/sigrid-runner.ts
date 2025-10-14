#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sigrid, { createWorkspace } from 'sigrid';
import type { BenchmarkResult } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// Initialize sigrid client with API key
if (process.env.OPENAI_API_KEY) {
  sigrid.initializeClient(process.env.OPENAI_API_KEY);
}

interface Workspace {
  path: string;
  id: string;
  populateWithTarball(tarballPath: string): Promise<void>;
  execute(prompt: string, options: {
    model: string;
    instructions: string[];
  }): Promise<{ content: string; conversationID: string }>;
}

interface BuildInternalResult {
  success: boolean;
  content?: string;
  conversationID?: string;
  duration: number;
  error?: string;
}

/**
 * Step 1: Creates a temporary workspace
 */
async function createTempWorkspace(): Promise<Workspace> {
  const workspace = await createWorkspace() as Workspace;
  console.log(`✅ [1/3] Workspace created: ${workspace.path}`);
  return workspace;
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

  await workspace.populateWithTarball(tarballPath);
}

/**
 * Step 3: Builds app using prompt given (via sigrid workspace.execute)
 */
async function buildAppWithPrompt(
  workspace: Workspace,
  prompt: string,
  model: string = 'gpt-4o-mini'
): Promise<BuildInternalResult> {
  console.log(`🤖 [3/3] Building app with sigrid...`);
  console.log(`   Model: ${model}`);
  console.log(`   Prompt: ${prompt}`);

  const startTime = Date.now();

  try {
    // Load AI_RULES.md from scaffold
    const aiRulesPath = path.join(workspace.path, 'AI_RULES.md');
    let aiRulesInstructions: string[] = [];
    try {
      const aiRules = await fs.readFile(aiRulesPath, 'utf-8');
      console.log(`   ✅ AI_RULES.md loaded from workspace`);
      aiRulesInstructions = [aiRules];
    } catch (err) {
      console.log(`   ⚠️  AI_RULES.md not found in workspace, instructing LLM to load it`);
      aiRulesInstructions = [
        'Read and follow the guidelines in AI_RULES.md file in the project root'
      ];
    }

    const result = await workspace.execute(prompt, {
      model,
      instructions: [
        ...aiRulesInstructions,
        'Analyze the existing scaffold structure and create appropriate components',
        'Follow the project structure and conventions'
      ]
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [3/3] App built successfully (${duration}ms)`);

    return {
      success: true,
      content: result.content,
      conversationID: result.conversationID,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ [3/3] App build failed (${duration}ms)`);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration
    };
  }
}

/**
 * Main benchmark function (exported for use as module)
 * Implements the standard runner interface defined in types.ts
 */
export async function runBenchmark(
  prompt: string,
  model: string = 'gpt-4o-mini'
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
        conversationID: buildResult.conversationID,
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
