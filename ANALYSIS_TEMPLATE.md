# Quality Analysis Template

## Usage

Request Claude Code to analyze benchmark results:

```
"ANALYSIS_TEMPLATE.md 를 참고해서 todo-app 분석해줘"
```

Claude will:
1. Find latest benchmark for the app
2. Locate reference screenshots
3. Confirm files with you
4. Run Vision API analysis
5. Create analysis directory and copy screenshots
6. Generate `analysis/[timestamp]_[app-name]/analysis.html`

---

## Analysis Workflow

### Step 1: Locate Files

Given app name (e.g., `todo-app`), find:

```bash
# 1. Find latest benchmark
LATEST_BENCHMARK=$(ls -td benchmarks/*/[app-name] | head -1)
# Example: benchmarks/20251015-123456/todo-app

# 2. Get benchmark screenshots
SIGRID_SCREENSHOT=${LATEST_BENCHMARK}/sigrid_*.png
CLAUDE_SCREENSHOT=${LATEST_BENCHMARK}/claude_*.png

# 3. Get reference screenshots
APP_NAME_UNDERSCORE=$(echo [app-name] | tr '-' '_')
BASE44_REF=references/${APP_NAME_UNDERSCORE}/base44_*.png
DYAD_REF=references/${APP_NAME_UNDERSCORE}/dyad_*.png

# 4. Read metadata
METADATA=${LATEST_BENCHMARK}/metadata.json
```

### Step 2: Confirm with User

Present found files and ask for confirmation:

```
Found benchmark results for todo-app:

Benchmark: benchmarks/20251015-123456/todo-app
- Sigrid: sigrid_20251015.png
- Claude: claude_20251015.png

References:
- Base44: references/todo_app/base44_20251015.png
- Dyad: references/todo_app/dyad_20251015.png

Metadata:
- Prompt: "Build a simple todo app with add, complete, and delete functionality"
- Runners: sigrid (gpt-5), claude (sonnet)

Proceed with analysis? (yes/no)
```

### Step 3: Extract Required Features

From metadata or app name, determine required features:

#### todo-app
- Input field to add new todos
- Button to submit new todo
- List displaying existing todos
- Checkbox or button to mark complete
- Visual indication of completion (strikethrough/checkmark)
- Delete button for each todo

#### counter
- Display showing current count
- Increment button (+)
- Decrement button (-)
- Reset button

#### color-picker
- RGB input controls (sliders or number inputs)
- Color preview square
- RGB values displayed
- Real-time color update when values change

---

## Vision API Analysis

### Evaluation Framework

Compare 4 screenshots using Vision API:
1. **Base44** (reference/baseline)
2. **Dyad** (reference/baseline)
3. **Sigrid** (our implementation)
4. **Claude** (our implementation)

### Criteria (Relative Ranking)

**Important**: Use RELATIVE comparison, not absolute scoring.

#### 1. Feature Completeness (40% weight)
Compare which implementation has more complete features:
- Are ALL required features visible?
- Do they appear functional (not broken/placeholder)?
- Any features missing compared to others?

#### 2. UI Quality (30% weight)
Compare visual polish:
- Layout: Which has better organization, spacing, alignment?
- Styling: Which looks more professional and finished?
- Visual design: Which has better use of color, typography, whitespace?
- Consistency: Which maintains better design language throughout?

#### 3. UX Design (30% weight)
Compare user experience:
- Clarity: Which is easier to understand at first glance?
- Usability: Which has more obvious interactive elements?
- Visual hierarchy: Which guides the user better?
- Affordances: Which makes actions more obvious (button sizes, labels)?

### Analysis Prompt for Vision API

```
You are analyzing 4 implementations of the same app to RANK them.

Context:
- App: [app-name]
- Required features: [feature list]
- Images: Base44, Dyad, Sigrid, Claude (in order)

Task:
RANK these 4 implementations from BEST (1st) to WORST (4th).

Evaluation Criteria:
1. Feature Completeness (40%): All features present and functional?
2. UI Quality (30%): Professional appearance, layout, styling?
3. UX Design (30%): Clarity, usability, visual hierarchy?

Requirements:
- Be SPECIFIC: Point to concrete elements/features
- Be COMPARATIVE: "X has Y, but Z lacks it"
- Explain WHY: Not just "better" but "better BECAUSE..."
- Focus on FUNCTIONAL differences first, style differences second

For EACH screenshot, identify:
- Which required features are present/missing
- UI strengths and weaknesses (specific elements)
- UX issues or advantages (specific interactions)

Then provide RELATIVE RANKING with clear reasoning.
```

---

## Output Format

Save analysis to: `analysis/[timestamp]_[app-name]/analysis.html`

Copy all screenshots to the analysis directory for easy access.

### HTML Structure

Create an HTML file with relative screenshot paths and professional styling.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quality Analysis: todo-app</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    h1 {
      font-size: 32px;
      margin-bottom: 10px;
      color: #1a1a1a;
    }

    .meta {
      color: #666;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }

    .meta p { margin: 5px 0; }

    h2 {
      font-size: 24px;
      margin: 40px 0 20px;
      color: #1a1a1a;
      border-bottom: 2px solid #4CAF50;
      padding-bottom: 8px;
    }

    h3 {
      font-size: 20px;
      margin: 25px 0 15px;
      color: #2c3e50;
    }

    /* Screenshot Grid */
    .screenshot-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 30px 0;
    }

    .screenshot-item {
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      background: white;
    }

    .screenshot-item img {
      width: 100%;
      height: auto;
      display: block;
    }

    .screenshot-label {
      padding: 12px;
      background: #f8f9fa;
      font-weight: 600;
      text-align: center;
      border-top: 1px solid #ddd;
    }

    /* Rankings */
    .ranking {
      margin: 25px 0;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #ccc;
    }

    .ranking.rank-1 { border-left-color: #FFD700; background: #fffbf0; }
    .ranking.rank-2 { border-left-color: #C0C0C0; background: #f8f8f8; }
    .ranking.rank-3 { border-left-color: #CD7F32; background: #fff5f0; }
    .ranking.rank-4 { border-left-color: #999; background: #f5f5f5; }

    .ranking-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .ranking-title {
      font-size: 22px;
      font-weight: 700;
    }

    .ranking-score {
      font-size: 28px;
      font-weight: 700;
      color: #4CAF50;
    }

    .score-breakdown {
      display: flex;
      gap: 20px;
      margin: 10px 0;
      font-size: 14px;
      color: #666;
    }

    .score-bar {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      margin: 10px 0;
    }

    .score-fill {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #66BB6A);
      transition: width 0.3s ease;
    }

    .strengths, .weaknesses, .missing {
      margin: 15px 0;
    }

    .strengths h4 { color: #4CAF50; }
    .weaknesses h4 { color: #FF9800; }
    .missing h4 { color: #F44336; }

    ul {
      margin: 10px 0 10px 20px;
    }

    li {
      margin: 5px 0;
    }

    /* Feature Matrix Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    th, td {
      padding: 12px;
      text-align: center;
      border: 1px solid #ddd;
    }

    th {
      background: #2c3e50;
      color: white;
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: #f8f9fa;
    }

    .check-yes { color: #4CAF50; font-size: 18px; }
    .check-no { color: #F44336; font-size: 18px; }
    .check-unknown { color: #999; font-size: 18px; }

    /* Alert Boxes */
    .alert {
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 6px;
      border-left: 4px solid;
    }

    .alert-critical {
      background: #ffebee;
      border-left-color: #F44336;
      color: #c62828;
    }

    .alert-high {
      background: #fff3e0;
      border-left-color: #FF9800;
      color: #e65100;
    }

    .alert-medium {
      background: #e3f2fd;
      border-left-color: #2196F3;
      color: #0d47a1;
    }

    .alert-low {
      background: #f1f8e9;
      border-left-color: #8BC34A;
      color: #33691e;
    }

    /* Recommendations */
    .recommendation-card {
      background: #f8f9fa;
      padding: 15px;
      margin: 10px 0;
      border-radius: 6px;
      border-left: 3px solid #2196F3;
    }

    .priority-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 10px;
    }

    .priority-1 { background: #F44336; color: white; }
    .priority-2 { background: #FF9800; color: white; }
    .priority-3 { background: #2196F3; color: white; }

    .effort-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      background: #e0e0e0;
      color: #333;
    }

    /* Summary Box */
    .summary-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 8px;
      margin: 30px 0;
    }

    .summary-box h3 {
      color: white;
      margin-top: 0;
    }

    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .stat-card {
      background: rgba(255,255,255,0.1);
      padding: 15px;
      border-radius: 6px;
      backdrop-filter: blur(10px);
    }

    .stat-label {
      font-size: 12px;
      opacity: 0.9;
      margin-bottom: 5px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
    }

    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }

    .next-steps {
      background: #e8f5e9;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #4CAF50;
    }

    .next-steps ol {
      margin-left: 20px;
    }

    .next-steps li {
      margin: 10px 0;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Quality Analysis: todo-app</h1>

    <div class="meta">
      <p><strong>Analysis Date:</strong> 2025-10-15T12:34:56.789Z</p>
      <p><strong>Benchmark:</strong> benchmarks/20251015-123456/todo-app</p>
      <p><strong>Prompt:</strong> "Build a simple todo app with add, complete, and delete functionality"</p>
    </div>

    <!-- Screenshots Section -->
    <h2>📸 Screenshots Comparison</h2>
    <div class="screenshot-grid">
      <div class="screenshot-item">
        <img src="base44.png" alt="Base44">
        <div class="screenshot-label">🥇 Base44 (Reference) - 97/100</div>
      </div>
      <div class="screenshot-item">
        <img src="dyad.png" alt="Dyad">
        <div class="screenshot-label">🥈 Dyad (Reference) - 92/100</div>
      </div>
      <div class="screenshot-item">
        <img src="sigrid.png" alt="Sigrid">
        <div class="screenshot-label">🥉 Sigrid (Ours) - 75/100</div>
      </div>
      <div class="screenshot-item">
        <img src="claude.png" alt="Claude">
        <div class="screenshot-label">4th - Claude (Ours) - 70/100</div>
      </div>
    </div>

    <!-- Summary -->
    <div class="summary-box">
      <h3>Analysis Summary</h3>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Our Best Rank</div>
          <div class="stat-value">3rd (Sigrid)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Gap to Leader</div>
          <div class="stat-value">22 points</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Expected Improvement</div>
          <div class="stat-value">+23 pts</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Missing Features</div>
          <div class="stat-value">1-2</div>
        </div>
      </div>
    </div>

    <!-- Rankings -->
    <h2>🏆 Rankings</h2>

    <div class="ranking rank-1">
      <div class="ranking-header">
        <div class="ranking-title">1st Place: Base44 (Reference)</div>
        <div class="ranking-score">97/100</div>
      </div>
      <div class="score-breakdown">
        <span>Features: 40/40</span>
        <span>UI: 29/30</span>
        <span>UX: 28/30</span>
      </div>
      <div class="score-bar"><div class="score-fill" style="width: 97%"></div></div>

      <div class="strengths">
        <h4>✅ Strengths</h4>
        <ul>
          <li>All 6 features present and fully functional</li>
          <li>Professional shadcn/ui styling throughout</li>
          <li>Clear visual hierarchy with proper spacing (16px grid)</li>
          <li>Intuitive layout: input at top, list below, actions on each item</li>
        </ul>
      </div>

      <div class="weaknesses">
        <h4>⚠️ Weaknesses</h4>
        <ul>
          <li>Delete button could be more prominent (small X icon)</li>
        </ul>
      </div>
    </div>

    <div class="ranking rank-2">
      <div class="ranking-header">
        <div class="ranking-title">2nd Place: Dyad (Reference)</div>
        <div class="ranking-score">92/100</div>
      </div>
      <div class="score-breakdown">
        <span>Features: 38/40</span>
        <span>UI: 27/30</span>
        <span>UX: 27/30</span>
      </div>
      <div class="score-bar"><div class="score-fill" style="width: 92%"></div></div>

      <div class="strengths">
        <h4>✅ Strengths</h4>
        <ul>
          <li>All core features implemented</li>
          <li>Good use of checkboxes for completion</li>
          <li>Clean, minimal design</li>
        </ul>
      </div>

      <div class="weaknesses">
        <h4>⚠️ Weaknesses</h4>
        <ul>
          <li>Slightly cramped layout (less whitespace than Base44)</li>
          <li>Delete action less obvious (no icon, just text)</li>
        </ul>
      </div>
    </div>

    <div class="ranking rank-3">
      <div class="ranking-header">
        <div class="ranking-title">3rd Place: Sigrid (Ours)</div>
        <div class="ranking-score">75/100</div>
      </div>
      <div class="score-breakdown">
        <span>Features: 32/40</span>
        <span>UI: 21/30</span>
        <span>UX: 22/30</span>
      </div>
      <div class="score-bar"><div class="score-fill" style="width: 75%"></div></div>

      <div class="strengths">
        <h4>✅ Strengths</h4>
        <ul>
          <li>Basic structure present (input, list, buttons)</li>
          <li>Uses modern React patterns</li>
        </ul>
      </div>

      <div class="weaknesses">
        <h4>⚠️ Weaknesses</h4>
        <ul>
          <li>Minimal styling - appears unfinished</li>
          <li>Poor spacing and alignment</li>
          <li>No clear visual feedback for completed items</li>
        </ul>
      </div>

      <div class="missing">
        <h4>❌ Missing Features</h4>
        <ul>
          <li>Visual indication of completion (no strikethrough or checkmark)</li>
        </ul>
      </div>
    </div>

    <div class="ranking rank-4">
      <div class="ranking-header">
        <div class="ranking-title">4th Place: Claude (Ours)</div>
        <div class="ranking-score">70/100</div>
      </div>
      <div class="score-breakdown">
        <span>Features: 30/40</span>
        <span>UI: 20/30</span>
        <span>UX: 20/30</span>
      </div>
      <div class="score-bar"><div class="score-fill" style="width: 70%"></div></div>

      <div class="strengths">
        <h4>✅ Strengths</h4>
        <ul>
          <li>All interactive elements present</li>
        </ul>
      </div>

      <div class="weaknesses">
        <h4>⚠️ Weaknesses</h4>
        <ul>
          <li>Very basic styling with default browser appearance</li>
          <li>Poor layout organization</li>
          <li>Buttons lack proper styling (look like links)</li>
          <li>No visual polish</li>
        </ul>
      </div>

      <div class="missing">
        <h4>❌ Missing Features</h4>
        <ul>
          <li>Professional styling</li>
          <li>Clear completion indicator</li>
        </ul>
      </div>
    </div>

    <!-- Feature Matrix -->
    <h2>📊 Feature Comparison Matrix</h2>
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Base44</th>
          <th>Dyad</th>
          <th>Sigrid</th>
          <th>Claude</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Input field</strong></td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
        </tr>
        <tr>
          <td><strong>Add button</strong></td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
        </tr>
        <tr>
          <td><strong>Todo list display</strong></td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
        </tr>
        <tr>
          <td><strong>Complete checkbox</strong></td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
        </tr>
        <tr style="background: #fff3cd;">
          <td><strong>Completion indicator</strong></td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-no">❌</td>
          <td class="check-no">❌</td>
        </tr>
        <tr>
          <td><strong>Delete button</strong></td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
          <td class="check-yes">✅</td>
        </tr>
      </tbody>
    </table>

    <!-- Main Gaps -->
    <h2>🔍 Main Gaps</h2>

    <div class="alert alert-critical">
      <h4>1. Missing clear visual completion feedback (FEATURES)</h4>
      <p><strong>Impact:</strong> High | <strong>Fix Difficulty:</strong> Low</p>
      <p>Need strikethrough + checkmark for completed todos. This is the most critical gap affecting user experience.</p>
    </div>

    <div class="alert alert-high">
      <h4>2. Insufficient styling - appears unfinished (UI)</h4>
      <p><strong>Impact:</strong> High | <strong>Fix Difficulty:</strong> Medium</p>
      <p>Use shadcn/ui components for professional appearance. Current implementation looks basic compared to references.</p>
    </div>

    <div class="alert alert-medium">
      <h4>3. Inconsistent spacing and layout (UI)</h4>
      <p><strong>Impact:</strong> Medium | <strong>Fix Difficulty:</strong> Medium</p>
      <p>Apply 16px grid system like Base44 for better visual hierarchy and spacing consistency.</p>
    </div>

    <div class="alert alert-low">
      <h4>4. Weak visual hierarchy (UX)</h4>
      <p><strong>Impact:</strong> Medium | <strong>Fix Difficulty:</strong> Low</p>
      <p>Improve header, typography, and section separation for better user guidance.</p>
    </div>

    <!-- Recommendations -->
    <h2>💡 Recommendations</h2>

    <h3>Priority Improvements</h3>

    <div class="recommendation-card">
      <span class="priority-badge priority-1">Priority 1</span>
      <span class="effort-badge">Low Effort</span>
      <h4>Ensure visual completion feedback (strikethrough + checkmark)</h4>
      <p><strong>Expected Impact:</strong> +10 points</p>
      <p>Add CSS: <code>text-decoration: line-through</code> and green checkmark icon for completed todos.</p>
    </div>

    <div class="recommendation-card">
      <span class="priority-badge priority-2">Priority 2</span>
      <span class="effort-badge">Medium Effort</span>
      <h4>Apply shadcn/ui component styling consistently</h4>
      <p><strong>Expected Impact:</strong> +8 points</p>
      <p>Use Button and Card components from shadcn/ui library for professional polish.</p>
    </div>

    <div class="recommendation-card">
      <span class="priority-badge priority-3">Priority 3</span>
      <span class="effort-badge">Medium Effort</span>
      <h4>Improve layout with proper spacing and alignment</h4>
      <p><strong>Expected Impact:</strong> +5 points</p>
      <p>Implement consistent 16px spacing grid throughout the application.</p>
    </div>

    <h3>Prompt Improvements</h3>
    <ol>
      <li>Explicitly request: "Show completed todos with strikethrough AND checkmark"</li>
      <li>Add constraint: "Use shadcn/ui Card and Button components"</li>
      <li>Specify layout: "Input field at top with Add button, list below with 16px spacing"</li>
      <li>Require polish: "Ensure professional appearance with proper styling"</li>
    </ol>

    <!-- Next Steps -->
    <div class="next-steps">
      <h2>🎯 Next Steps</h2>
      <ol>
        <li>Run prompt improvement experiment with explicit completion indicator requirement</li>
        <li>Test if adding "Use shadcn/ui components" improves UI quality</li>
        <li>Benchmark counter and color-picker to confirm pattern consistency</li>
      </ol>
      <p style="margin-top: 20px; font-weight: 700; font-size: 18px;">
        Expected improvement with all recommendations: <span style="color: #4CAF50;">+23 points</span> (75 → 98)
      </p>
    </div>

  </div>
</body>
</html>
```

**Key Features:**
- Screenshots copied to analysis directory with simple filenames (base44.png, dyad.png, etc.)
- Side-by-side screenshot comparison
- Color-coded rankings (gold, silver, bronze)
- Visual score bars
- Styled feature matrix table
- Alert boxes for gaps (color-coded by severity)
- Priority badges for recommendations
- Professional, print-friendly styling
- Easy to share entire directory

---

## Additional Analysis (Optional)

### Deep Dive Analysis
If user requests more detail on specific aspects:

```
"UI 레이아웃만 집중 분석해줘"
→ Focus on spacing, alignment, grid usage, whitespace

"기능 완성도만 체크리스트로"
→ Binary checklist for each required feature

"Base44와 Sigrid만 비교"
→ Detailed pairwise comparison of two specific runners
```

### Screenshot Files
All screenshots are copied to the analysis directory with standardized names.

```bash
analysis/[timestamp]_[app-name]/
├── analysis.html              # HTML report with relative image paths
├── base44.png                 # Base44 reference screenshot
├── dyad.png                   # Dyad reference screenshot
├── sigrid.png                 # Sigrid benchmark screenshot
└── claude.png                 # Claude benchmark screenshot
```

---

## Directory Structure

```
abe/
├── benchmarks/
│   └── 20251015-123456/
│       └── todo-app/
│           ├── sigrid_20251015.png
│           ├── claude_20251015.png
│           └── metadata.json
│
├── references/
│   └── todo_app/
│       ├── base44_20251015.png
│       ├── dyad_20251015.png
│       └── prompt.txt
│
└── analysis/                          # ← Analysis output
    └── 20251015-134500_todo-app/     # ← [timestamp]_[app-name]
        ├── analysis.html              # HTML report
        ├── base44.png                 # Copied screenshots
        ├── dyad.png
        ├── sigrid.png
        └── claude.png
```

---

## Example Request

```
"ANALYSIS_TEMPLATE.md 참고해서 todo-app 분석해줘"
```

Claude will:
1. Find: `benchmarks/20251015-123456/todo-app/`
2. Locate: 4 screenshots (2 references + 2 ours)
3. Confirm: "Found these files, proceed?"
4. Analyze: Vision API comparative ranking
5. Create: `analysis/20251015-134500_todo-app/` directory
6. Copy: All 4 screenshots to analysis directory with standard names
7. Generate: `analysis/20251015-134500_todo-app/analysis.html`
8. Display: Summary with link to open HTML report

---

## Notes

- **Always use latest benchmark**: `ls -td benchmarks/*/[app-name] | head -1`
- **App name format**: Use hyphens in command, convert to underscores for references lookup
- **Timestamps**: Use ISO format for analysis directories (YYYYMMDD-HHmmss)
- **Relative ranking**: No absolute scores - always compare to others
- **Be specific**: Point to concrete UI elements, not vague qualities
- **Action-oriented**: Every finding should have a clear next step
