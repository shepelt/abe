# ABE Prompts

Test prompts for benchmarking LLM app generation, organized by complexity level.

## Complexity Levels

- **Level 0 (Trivial)**: Single state, minimal UI - 1-2 components
- **Level 1 (Medium)**: Array state, multiple inputs, filtering/sorting
- **Level 2 (Advanced)**: Complex UI layouts, multi-step flows, state transitions
- **Level 3 (Expert)**: Comprehensive features, data visualization, multiple sections

## Available Prompts

### Level 0 (Trivial)
- `todo-app.txt` - Simple todo with add, complete, delete
- `counter.txt` - Counter with increment, decrement, reset
- `color-picker.txt` - RGB color picker with preview

### Level 1 (Medium)
- `expense-tracker-1.txt` - Track expenses with categories and filtering
- `habit-tracker-1.txt` - Weekly habit tracking with progress calculation

### Level 2 (Advanced)
- `recipe-finder-2.txt` - Recipe search with grid layout and details view
- `kanban-board-2.txt` - Kanban board with task management across columns
- `quiz-app-2.txt` - Multi-step quiz with scoring and results

### Level 3 (Expert)
- `dashboard-3.txt` - Analytics dashboard with stats, charts, and activity feed

## Naming Convention

- Level 0: `[app-name].txt` (no number suffix)
- Level 1: `[app-name]-1.txt`
- Level 2: `[app-name]-2.txt`
- Level 3: `[app-name]-3.txt`

## Usage

### With benchmark tool:
```bash
# Level 0 (trivial)
npm run benchmark todo-app
npm run benchmark counter

# Level 1 (medium)
npm run benchmark expense-tracker-1
npm run benchmark habit-tracker-1

# Level 2 (advanced)
npm run benchmark recipe-finder-2
npm run benchmark quiz-app-2

# Level 3 (expert)
npm run benchmark dashboard-3
```

### With custom prompt:
```bash
npm run benchmark my-app -- --prompt "$(cat prompts/expense-tracker-1.txt)"
```

## Testing Strategy

### Phase 1: Baseline (Level 0)
Start with trivial prompts to establish baseline performance:
```bash
npm run benchmark todo-app
npm run benchmark counter
npm run benchmark color-picker
```

**Goal:** Understand current quality gap vs Base44/Dyad

### Phase 2: Scaling (Level 1)
Test medium complexity to see how performance degrades:
```bash
npm run benchmark expense-tracker-1
npm run benchmark habit-tracker-1
```

**Goal:** Identify which complexity factors cause issues

### Phase 3: Limits (Level 2-3)
Push to advanced complexity to find breaking points:
```bash
npm run benchmark recipe-finder-2
npm run benchmark quiz-app-2
npm run benchmark dashboard-3
```

**Goal:** Understand maximum capability and failure modes

## Reference Screenshots

For prompts tested with Base44/Dyad, store screenshots in:
```
references/
└── [app_name]/
    ├── base44_YYYYMMDD.png
    ├── dyad_YYYYMMDD.png
    └── prompt.txt
```

Example:
```
references/
├── todo_app/
│   ├── base44_20251015.png
│   ├── dyad_20251015.png
│   └── prompt.txt
└── expense_tracker_1/
    ├── base44_20251016.png
    ├── dyad_20251016.png
    └── prompt.txt
```

## Adding New Prompts

1. **Create file**: `[app-name]-[level].txt` (or `[app-name].txt` for level 0)
2. **Keep concise**: Clear requirements, not verbose
3. **Specify features**: Bullet list of required functionality
4. **Include UI guidance**: Mention shadcn/ui components to use
5. **Add sample data**: For consistent testing (hardcoded)
6. **Update README**: Add to appropriate level section

## Design Guidelines

All prompts should:
- Use shadcn/ui components for consistent styling
- Include specific feature requirements
- Provide sample/hardcoded data when needed
- Be single-shot (no multi-turn)
- Be realistic (buildable in one generation)
