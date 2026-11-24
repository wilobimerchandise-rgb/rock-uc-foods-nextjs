#!/usr/bin/env node
/**
 * ROCK UC FOODS - One-Command Verification Runner
 * Playbook v2 Section 31.6:
 * Runs TypeScript check, full Vitest test suite, and source secret scan,
 * then writes exact counts to VERIFICATION_REPORT.md.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VITEST_JSON_PATH = path.join('/tmp', 'rockuc_vitest_report.json');
const REPORT_PATH = path.join(ROOT, 'VERIFICATION_REPORT.md');

function runTypeCheck() {
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    return { passed: true, errorCount: 0, output: '' };
  } catch (err) {
    const out = `${err.stdout || ''}\n${err.stderr || ''}`.trim();
    const lines = out.split('\n').filter((l) => /error TS\d+:/.test(l));
    return { passed: false, errorCount: lines.length || 1, output: out };
  }
}

function runTestSuite() {
  if (fs.existsSync(VITEST_JSON_PATH)) {
    fs.unlinkSync(VITEST_JSON_PATH);
  }

  let commandOk = true;
  let stdout = '';
  try {
    stdout = execSync(
      `npx vitest run --test-timeout=30000 --fileParallelism=false --maxWorkers=1 --reporter=json --outputFile=${VITEST_JSON_PATH}`,
      { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' }
    );
  } catch (err) {
    commandOk = false;
    stdout = `${err.stdout || ''}\n${err.stderr || ''}`;
  }

  if (fs.existsSync(VITEST_JSON_PATH)) {
    const json = JSON.parse(fs.readFileSync(VITEST_JSON_PATH, 'utf8'));
    return {
      passed: commandOk && json.numFailedTestSuites === 0 && json.numFailedTests === 0,
      totalFiles: json.numTotalTestSuites ?? 0,
      passedFiles: json.numPassedTestSuites ?? 0,
      failedFiles: json.numFailedTestSuites ?? 0,
      totalTests: json.numTotalTests ?? 0,
      passedTests: json.numPassedTests ?? 0,
      failedTests: json.numFailedTests ?? 0,
    };
  }

  return {
    passed: false,
    totalFiles: 0,
    passedFiles: 0,
    failedFiles: 1,
    totalTests: 0,
    passedTests: 0,
    failedTests: 1,
    rawError: stdout.slice(0, 500),
  };
}

function walkFiles(dirPath, collected = []) {
  if (!fs.existsSync(dirPath)) return collected;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') {
      continue;
    }
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, collected);
    } else if (/\.(ts|tsx|js|jsx|mjs|sql|env|json)$/.test(entry.name)) {
      collected.push(full);
    }
  }
  return collected;
}

function runSecretScan() {
  const scanDirs = ['src', 'app', 'supabase', 'scripts'].map((d) => path.join(ROOT, d));
  const files = [];
  for (const d of scanDirs) {
    walkFiles(d, files);
  }

  const extraFiles = ['.env.example', 'next.config.ts', 'package.json']
    .map((f) => path.join(ROOT, f))
    .filter((f) => fs.existsSync(f));
  files.push(...extraFiles);

  // Build patterns dynamically so this file does not match itself
  const secretRules = [
    { name: 'Live payment secret key', regex: new RegExp('sk_' + 'live_[0-9A-Za-z]{16,}') },
    { name: 'Live payment public key', regex: new RegExp('pk_' + 'live_[0-9A-Za-z]{16,}') },
    { name: 'Google API key', regex: new RegExp('AI' + 'za[0-9A-Za-z\\-_]{35}') },
    { name: 'GitHub PAT', regex: new RegExp('gh' + 'p_[0-9A-Za-z]{20,}') },
    { name: 'Slack bot token', regex: new RegExp('xo' + 'xb-[0-9A-Za-z-]{10,}') },
    { name: 'PEM private key', regex: new RegExp('-----BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----') },
    { name: 'Hardcoded JWT/Supabase token', regex: new RegExp('eyJ' + 'hbGciOi[0-9A-Za-z\\-_]+\\.[0-9A-Za-z\\-_]+') },
  ];

  const findings = [];
  for (const filePath of files) {
    const rel = path.relative(ROOT, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const rule of secretRules) {
        if (rule.regex.test(lines[i])) {
          findings.push({ file: rel, line: i + 1, rule: rule.name });
        }
      }
    }
  }

  return {
    passed: findings.length === 0,
    filesScanned: files.length,
    findings,
  };
}

const startedAt = new Date().toISOString();
const typeCheck = runTypeCheck();
const testSuite = runTestSuite();
const secretScan = runSecretScan();

const overallPassed = typeCheck.passed && testSuite.passed && secretScan.passed;

const reportMarkdown = `# ROCK UC FOODS - Automated Verification Report

Generated: ${startedAt}  
Command: \`npm run verify\`

| Gate | Status | Counts |
| :--- | :--- | :--- |
| TypeScript (\`tsc --noEmit\`) | ${typeCheck.passed ? 'PASS' : 'FAIL'} | ${typeCheck.errorCount} error(s) |
| Vitest Suite | ${testSuite.passed ? 'PASS' : 'FAIL'} | ${testSuite.passedFiles}/${testSuite.totalFiles} files, ${testSuite.passedTests}/${testSuite.totalTests} tests passed (${testSuite.failedTests} failed) |
| Secret Scan | ${secretScan.passed ? 'PASS' : 'FAIL'} | ${secretScan.findings.length} finding(s) across ${secretScan.filesScanned} files |

**Overall Verification Status**: ${overallPassed ? 'PASS' : 'FAIL'}
`;

fs.writeFileSync(REPORT_PATH, reportMarkdown, 'utf8');
console.log(reportMarkdown);

if (!typeCheck.passed) {
  console.error('\nTypeScript errors:\n' + typeCheck.output);
}
if (!secretScan.passed) {
  console.error('\nSecret scan findings:\n', secretScan.findings);
}

process.exit(overallPassed ? 0 : 1);
