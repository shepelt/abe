#!/usr/bin/env node

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3456;

// Serve static files
app.use('/benchmarks', express.static(path.join(__dirname, 'benchmarks')));
app.use('/references', express.static(path.join(__dirname, 'references')));

// API: List all benchmark runs
app.get('/api/benchmarks', async (req, res) => {
  try {
    const benchmarksDir = path.join(__dirname, 'benchmarks');
    const timestamps = await fs.readdir(benchmarksDir);

    const benchmarks = [];

    for (const timestamp of timestamps) {
      const timestampPath = path.join(benchmarksDir, timestamp);
      const stat = await fs.stat(timestampPath);

      if (!stat.isDirectory()) continue;

      const apps = await fs.readdir(timestampPath);

      for (const appName of apps) {
        const appPath = path.join(timestampPath, appName);
        const appStat = await fs.stat(appPath);

        if (!appStat.isDirectory()) continue;

        const metadataPath = path.join(appPath, 'metadata.json');
        try {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

          // List screenshot files
          const files = await fs.readdir(appPath);
          const screenshots = files.filter(f => f.endsWith('.png'));

          benchmarks.push({
            timestamp,
            appName,
            metadata,
            screenshots: screenshots.map(s => `/benchmarks/${timestamp}/${appName}/${s}`),
            path: `${timestamp}/${appName}`
          });
        } catch (error) {
          console.warn(`Failed to load metadata for ${timestamp}/${appName}`);
        }
      }
    }

    // Sort by timestamp descending (newest first)
    benchmarks.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    res.json(benchmarks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load benchmarks' });
  }
});

// API: List all references
app.get('/api/references', async (req, res) => {
  try {
    const referencesDir = path.join(__dirname, 'references');

    try {
      await fs.access(referencesDir);
    } catch {
      return res.json([]);
    }

    const apps = await fs.readdir(referencesDir);
    const references = [];

    for (const appName of apps) {
      const appPath = path.join(referencesDir, appName);
      const stat = await fs.stat(appPath);

      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(appPath);
      const screenshots = files.filter(f => f.endsWith('.png'));

      // Try to load prompt.txt
      let prompt = null;
      try {
        const promptPath = path.join(appPath, 'prompt.txt');
        prompt = await fs.readFile(promptPath, 'utf-8');
      } catch {
        // No prompt file
      }

      references.push({
        appName,
        prompt,
        screenshots: screenshots.map(s => `/references/${appName}/${s}`)
      });
    }

    res.json(references);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load references' });
  }
});

// Serve the main HTML page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ABE Browser - Benchmark Results</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    .header {
      background: #2c3e50;
      color: white;
      padding: 30px;
      margin: -20px -20px 30px -20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 2.5em;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 1.1em;
    }
    .loading {
      text-align: center;
      padding: 40px;
      font-size: 1.2em;
      color: #666;
    }
    .benchmark {
      background: white;
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .benchmark-header {
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .benchmark-title {
      font-size: 1.8em;
      margin: 0 0 10px 0;
      color: #2c3e50;
    }
    .benchmark-meta {
      color: #666;
      font-size: 0.95em;
      margin: 5px 0;
    }
    .prompt {
      background: #f8f9fa;
      padding: 15px;
      border-left: 4px solid #3498db;
      margin: 15px 0;
      font-style: italic;
    }
    .summary {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      flex-wrap: wrap;
    }
    .summary-item {
      background: #ecf0f1;
      padding: 15px 20px;
      border-radius: 6px;
      flex: 1;
      min-width: 150px;
    }
    .summary-label {
      font-size: 0.85em;
      color: #666;
      margin-bottom: 5px;
    }
    .summary-value {
      font-size: 1.5em;
      font-weight: bold;
      color: #2c3e50;
    }
    .results-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .results-table th {
      background: #34495e;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    .results-table td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    .results-table tr:hover {
      background: #f8f9fa;
    }
    .status-success {
      color: #27ae60;
      font-weight: bold;
    }
    .status-failed {
      color: #e74c3c;
      font-weight: bold;
    }
    .winner {
      background: #fff9e6 !important;
      border-left: 4px solid #f39c12;
    }
    .screenshots {
      margin-top: 30px;
    }
    .screenshots h3 {
      margin: 0 0 15px 0;
      font-size: 1.3em;
    }
    .screenshot-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
    }
    .screenshot-item {
      background: #f8f9fa;
      border-radius: 6px;
      padding: 15px;
    }
    .screenshot-item h4 {
      margin: 0 0 10px 0;
      color: #2c3e50;
    }
    .screenshot-item img {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .screenshot-item img:hover {
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .references-section {
      background: white;
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .references-section h2 {
      margin: 0 0 20px 0;
      color: #2c3e50;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 15px;
    }
    .reference-app {
      margin-bottom: 30px;
    }
    .reference-app h3 {
      margin: 0 0 10px 0;
      color: #34495e;
    }
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      align-items: center;
      justify-content: center;
    }
    .modal.active {
      display: flex;
    }
    .modal-content {
      max-width: 90%;
      max-height: 90%;
    }
    .modal-content img {
      width: 100%;
      height: auto;
    }
    .close-modal {
      position: absolute;
      top: 20px;
      right: 40px;
      color: white;
      font-size: 40px;
      font-weight: bold;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ABE Browser</h1>
    <p>App Builder Benchmark Environment - Results Viewer</p>
  </div>

  <div id="content">
    <div class="loading">Loading benchmarks...</div>
  </div>

  <div id="modal" class="modal" onclick="closeModal()">
    <span class="close-modal">&times;</span>
    <div class="modal-content" onclick="event.stopPropagation()">
      <img id="modal-img" src="" alt="Full size screenshot">
    </div>
  </div>

  <script>
    async function loadData() {
      try {
        const [benchmarks, references] = await Promise.all([
          fetch('/api/benchmarks').then(r => r.json()),
          fetch('/api/references').then(r => r.json())
        ]);

        renderContent(benchmarks, references);
      } catch (error) {
        document.getElementById('content').innerHTML =
          '<div class="loading">Error loading data: ' + error.message + '</div>';
      }
    }

    function renderContent(benchmarks, references) {
      const content = document.getElementById('content');
      let html = '';

      // References section
      if (references.length > 0) {
        html += '<div class="references-section">';
        html += '<h2>Reference Implementations</h2>';

        for (const ref of references) {
          html += '<div class="reference-app">';
          html += '<h3>' + ref.appName.replace(/_/g, '-') + '</h3>';

          if (ref.prompt) {
            html += '<div class="prompt">' + escapeHtml(ref.prompt.trim()) + '</div>';
          }

          if (ref.screenshots.length > 0) {
            html += '<div class="screenshot-grid">';
            for (const screenshot of ref.screenshots) {
              const name = screenshot.split('/').pop().replace('.png', '');
              html += '<div class="screenshot-item">';
              html += '<h4>' + name + '</h4>';
              html += '<img src="' + screenshot + '" alt="' + name + '" onclick="showModal(this.src)">';
              html += '</div>';
            }
            html += '</div>';
          }

          html += '</div>';
        }

        html += '</div>';
      }

      // Benchmarks section
      if (benchmarks.length === 0) {
        html += '<div class="loading">No benchmarks found. Run a benchmark first!</div>';
      } else {
        for (const benchmark of benchmarks) {
          const { metadata, screenshots } = benchmark;

          html += '<div class="benchmark">';
          html += '<div class="benchmark-header">';
          html += '<h2 class="benchmark-title">' + metadata.appName + '</h2>';
          html += '<div class="benchmark-meta">Timestamp: ' + new Date(metadata.timestamp).toLocaleString() + '</div>';
          html += '<div class="benchmark-meta">Run ID: ' + benchmark.timestamp + '</div>';
          html += '<div class="prompt">' + escapeHtml(metadata.prompt) + '</div>';
          html += '</div>';

          // Summary
          html += '<div class="summary">';
          html += '<div class="summary-item">';
          html += '<div class="summary-label">Total Runners</div>';
          html += '<div class="summary-value">' + metadata.summary.totalRunners + '</div>';
          html += '</div>';

          html += '<div class="summary-item">';
          html += '<div class="summary-label">Successful</div>';
          html += '<div class="summary-value status-success">' + metadata.summary.successfulRunners + '</div>';
          html += '</div>';

          if (metadata.summary.failedRunners > 0) {
            html += '<div class="summary-item">';
            html += '<div class="summary-label">Failed</div>';
            html += '<div class="summary-value status-failed">' + metadata.summary.failedRunners + '</div>';
            html += '</div>';
          }

          if (metadata.summary.fastestRunner) {
            html += '<div class="summary-item">';
            html += '<div class="summary-label">Fastest Runner</div>';
            html += '<div class="summary-value">' + metadata.summary.fastestRunner + '</div>';
            html += '</div>';

            html += '<div class="summary-item">';
            html += '<div class="summary-label">Fastest Time</div>';
            html += '<div class="summary-value">' + (metadata.summary.fastestTime / 1000).toFixed(1) + 's</div>';
            html += '</div>';
          }
          html += '</div>';

          // Results table
          html += '<table class="results-table">';
          html += '<thead><tr>';
          html += '<th>Runner</th><th>Model</th><th>Status</th>';
          html += '<th>Total Time</th><th>Code Gen</th><th>Compile</th>';
          html += '<th>Server</th><th>Analysis</th><th>Errors</th>';
          html += '</tr></thead><tbody>';

          for (const result of metadata.runners) {
            const isWinner = result.runner === metadata.summary.fastestRunner && result.success;
            html += '<tr' + (isWinner ? ' class="winner"' : '') + '>';
            html += '<td><strong>' + result.runner + '</strong>' + (isWinner ? ' 🏆' : '') + '</td>';
            html += '<td>' + result.model + '</td>';
            html += '<td class="' + (result.success ? 'status-success' : 'status-failed') + '">';
            html += result.success ? '✓ Success' : '✗ Failed';
            html += '</td>';
            html += '<td>' + (result.totalDuration / 1000).toFixed(1) + 's</td>';
            html += '<td>' + (result.durations.codeGeneration / 1000).toFixed(1) + 's</td>';
            html += '<td>' + (result.durations.compilation / 1000).toFixed(1) + 's</td>';
            html += '<td>' + (result.durations.serverStartup / 1000).toFixed(1) + 's</td>';
            html += '<td>' + (result.durations.analysis / 1000).toFixed(1) + 's</td>';
            html += '<td>' + (result.errors.consoleErrors + result.errors.pageErrors) + '</td>';
            html += '</tr>';
          }

          html += '</tbody></table>';

          // Screenshots
          if (screenshots.length > 0) {
            html += '<div class="screenshots">';
            html += '<h3>Screenshots</h3>';
            html += '<div class="screenshot-grid">';

            for (const screenshot of screenshots) {
              const name = screenshot.split('/').pop().replace('.png', '');
              html += '<div class="screenshot-item">';
              html += '<h4>' + name + '</h4>';
              html += '<img src="' + screenshot + '" alt="' + name + '" onclick="showModal(this.src)">';
              html += '</div>';
            }

            html += '</div>';
            html += '</div>';
          }

          html += '</div>';
        }
      }

      content.innerHTML = html;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function showModal(src) {
      document.getElementById('modal-img').src = src;
      document.getElementById('modal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    loadData();
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║     ABE Browser - Results Viewer                     ║
╚═══════════════════════════════════════════════════════╝

Server running at: http://localhost:${PORT}

Press Ctrl+C to stop
  `);
});
