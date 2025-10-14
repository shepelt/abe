#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sigrid, { createWorkspace } from 'sigrid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// Initialize sigrid client with API key
if (process.env.OPENAI_API_KEY) {
  sigrid.initializeClient(process.env.OPENAI_API_KEY);
}

/**
 * Step 1: Creates a temporary workspace
 * @returns {Promise<Workspace>} Workspace instance
 */
async function createTempWorkspace() {
  const workspace = await createWorkspace();
  console.log(`✅ [1/3] Workspace created: ${workspace.path}`);
  return workspace;
}

/**
 * Step 2: Populates workspace using test fixture tarball
 * @param {Workspace} workspace - Workspace instance
 */
async function populateWorkspace(workspace) {
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
 * @param {Workspace} workspace - Workspace instance
 * @param {string} prompt - Prompt to execute
 * @param {string} model - Model to use (default: gpt-4o-mini)
 * @returns {Promise<object>} Execution results
 */
async function buildAppWithPrompt(workspace, prompt, model = 'gpt-4o-mini') {
  console.log(`🤖 [3/3] Building app with sigrid...`);
  console.log(`   Model: ${model}`);
  console.log(`   Prompt: ${prompt}`);

  const startTime = Date.now();

  try {
    // Load AI_RULES.md from scaffold
    const aiRulesPath = path.join(workspace.path, 'AI_RULES.md');
    let aiRulesInstructions = [];
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
      error: error.message,
      duration
    };
  }
}

/**
 * Main benchmark function (exported for use as module)
 * @param {string} prompt - Prompt to execute
 * @param {string} model - Model to use (default: gpt-4o-mini)
 * @returns {Promise<object>} Benchmark results
 */
export async function runBenchmark(prompt, model = 'gpt-4o-mini') {
  let workspace;

  try {
    // Step 1: Create workspace
    workspace = await createTempWorkspace();

    // Step 2: Populate workspace
    await populateWorkspace(workspace);

    // Step 3: Build app with prompt
    const buildResult = await buildAppWithPrompt(workspace, prompt, model);

    // Return results
    const results = {
      prompt,
      model,
      timestamp: new Date().toISOString(),
      workspaceDir: workspace.path,
      workspaceId: workspace.id,
      build: {
        success: buildResult.success,
        duration: buildResult.duration,
        contentPreview: buildResult.content?.substring(0, 200) || null
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

