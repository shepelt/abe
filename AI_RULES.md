# AI Development Rules for ABE

## Project Overview
ABE (App Builder Benchmark Environment) is a benchmark and evaluation framework for testing and comparing LLM-based React app generation strategies using Sigrid.

## Purpose
- Provide standardized test prompts for React app generation
- Evaluate quality of generated applications across multiple dimensions
- Compare different generation strategies objectively
- Track experiments and improvements over time
- Derive winning strategies to apply in production (NOBI)

## Technology Stack
- **Language**: JavaScript (ES6+)
- **Runtime**: Node.js
- **LLM Library**: Sigrid (local dependency)
- **Testing**: Jest (or similar)
- **Module System**: ES Modules

## Project Structure
Keep it simple and flat initially:

```
/scripts
```

## Code Conventions

### File Organization
- Start with flat structure at root level
- Group related files only when patterns emerge
- Use descriptive file names (e.g., `react-app-evaluator.js`, not `evaluator.js`)

### Naming Conventions
- **Files**: kebab-case (e.g., `prompt-suite.js`)
- **Classes**: PascalCase (e.g., `QualityEvaluator`)
- **Functions**: camelCase (e.g., `runExperiment`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`)

### Module Patterns
- Use ES6 `import`/`export`
- Prefer named exports for better refactoring
- Use default export only for main entry points

## Development Philosophy

### Start Simple, Grow Naturally
- **Flat structure first**: Keep files at the root level until organization becomes necessary
  - ✅ `evaluator.js` (start here)
  - ❌ `evaluators/quality/react/v1/evaluator.js` (too early)

### YAGNI Principle
- Only build what you need right now
- Don't create abstractions before you have concrete use cases
- Examples to avoid:
  - Creating a plugin system before you have 2 strategies
  - Building a UI before you need to visualize results
  - Adding database before you have too much data for JSON files

### When to Refactor
- When you copy-paste code 3+ times → extract to function
- When a file exceeds 300 lines → consider splitting
- When a pattern becomes clear from actual usage → then abstract it
- Never before

### Scientific Approach
- Every experiment should be reproducible
- Track all parameters and results
- Use version control for prompts and strategies
- Document assumptions and decisions

## Development Workflow
- Write clear, self-documenting code
- Each experiment should save its results
- Use semantic versioning for strategies
- Keep benchmark prompts under version control
- **NEVER modify files without explicit user permission**
  - Always show the proposed changes first
  - Wait for user approval before applying
  - Exception: Only when user explicitly requests the change (e.g., "fix that", "do it")

## Quality Metrics to Consider
- **Functional**: Build success, runtime errors, intent match
- **Code Quality**: ESLint errors, complexity, duplication
- **UX**: UI polish, responsiveness, accessibility
- **Performance**: Bundle size, load time, lighthouse score

## Experiment Guidelines
- Each experiment should test ONE variable at a time
- Use same prompts across strategies for fair comparison
- Record all configuration and environment details
- Generate reports in both human-readable (markdown) and machine-readable (JSON) formats

## Notes
This file will evolve as experiments progress and patterns emerge.
