# ABE - App Builder Benchmark Environment

A TypeScript framework for testing and comparing LLM-based React app generation strategies.

## Features

- 🎯 **Multiple Runners**: Compare different LLM tools (Sigrid/OpenAI, Claude Code CLI, etc.)
- 📊 **Complete Pipeline**: Code generation → Compilation → Server runtime → Screenshot analysis
- 🚀 **Optimized Performance**: Cached scaffolds with pre-installed dependencies
- 📸 **Quality Metrics**: Screenshot capture, console/page error detection
- 🔧 **TypeScript**: Full type safety and IDE support

## Installation

```bash
npm install
```

## Usage

### Run Benchmark

```bash
# Run all prompts with default runner (sigrid)
npm run benchmark

# Run with Claude Code CLI
npm run benchmark -- --runner claude

# Run specific prompt
npm run benchmark gpt-4o-mini counter

# Run with Claude runner and keep workspaces
npm run benchmark -- --runner claude sonnet counter --keep-workspaces
```

### CLI Options

```bash
npm run benchmark [model] [promptId] [flags]
```

**Arguments:**
- `model` - Model to use (default: runner's default model)
- `promptId` - Specific prompt to run (optional, runs all if omitted)

**Flags:**
- `--runner <id>` - Runner to use (default: `sigrid`)
- `--keep-workspaces` - Preserve workspaces after benchmark

**Available Runners:**
- `sigrid` - Sigrid (OpenAI API) - Default model: `gpt-4o-mini`
- `claude` - Claude Code CLI - Default model: `sonnet`

### Test Prompts

Built-in prompts:
- `todo-app` - Simple todo app with add, complete, delete
- `counter` - Counter with increment, decrement, reset
- `color-picker` - Color picker with RGB values and preview

## Architecture

### 6-Step Pipeline

1. **Create Workspace** - Temporary isolated directory
2. **Populate** - Extract scaffold tarball with React template
3. **Generate Code** - LLM creates components based on prompt
4. **Compile** - Run `npm run build`
5. **Run Server** - Start Vite dev server
6. **Analyze** - Capture screenshot, detect errors

### Runner System

Each runner implements the standard interface:

```typescript
interface Runner {
  runBenchmark(prompt: string, model?: string): Promise<BenchmarkResult>
}
```

Add new runners by:
1. Creating `scripts/<name>-runner.ts`
2. Implementing `runBenchmark()` function
3. Registering in `RUNNERS` in `benchmark.ts`

### Results

Results are saved to `results/`:
- `summary-<timestamp>.json` - Full benchmark data
- `screenshots/<id>-<timestamp>.png` - Screenshots

## Project Structure

```
abe/
├── benchmark.ts              # Main benchmark orchestrator
├── types.ts                  # TypeScript interfaces
├── scripts/
│   ├── sigrid-runner.ts     # OpenAI runner
│   └── claude-runner.ts     # Claude Code CLI runner
├── test-fixtures/
│   ├── react-scaffold.tar.gz        # Base scaffold
│   └── react-scaffold-cached.tar.gz # With node_modules
├── results/                  # Benchmark results (gitignored)
└── tsconfig.json            # TypeScript config
```

## Development

### Add a New Runner

```typescript
// scripts/my-runner.ts
import type { BenchmarkResult } from '../types.js';

export async function runBenchmark(
  prompt: string,
  model: string = 'default-model'
): Promise<BenchmarkResult> {
  // 1. Create workspace
  // 2. Populate with scaffold
  // 3. Execute prompt with LLM
  // 4. Return standardized result
}
```

Register in `benchmark.ts`:

```typescript
export const RUNNERS = {
  // ...
  myrunner: {
    id: 'myrunner',
    name: 'My Runner',
    defaultModel: 'default-model',
    runBenchmark: runMyBenchmark,
    cleanupWorkspace: async (dir) => { /* cleanup logic */ }
  }
};
```

### Build TypeScript

```bash
npm run build  # Compiles to dist/
```

## Examples

### Compare Runners

```bash
# Run counter prompt with both runners
npm run benchmark -- --runner sigrid gpt-4o-mini counter
npm run benchmark -- --runner claude sonnet counter

# Compare results
cat results/summary-*.json | jq '.model, .build.duration'
```

### Keep Workspaces for Debugging

```bash
npm run benchmark -- --runner claude --keep-workspaces

# Workspaces will be preserved in /tmp/claude-workspaces/
# or /var/folders/.../sigrid-workspaces/
```

## License

ISC
