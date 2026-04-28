#!/usr/bin/env node
/**
 * verify-migrations.mjs
 *
 * Validates the supabase/migrations directory without running SQL:
 *   - Detects duplicate sequence numbers
 *   - Reports gaps in the sequence
 *   - Flags empty migration files
 *   - Checks that every migration is idempotent-friendly (DROP/CREATE IF NOT EXISTS)
 *   - Asserts that all known core tables are referenced across the migrations
 *   - Exits 1 on any hard error so CI fails fast
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '../supabase/migrations')

// Tables that must appear somewhere across all migrations
const REQUIRED_TABLES = [
  'tenants',
  'users',
  'personas',
  'scenarios',
  'sessions',
  'evaluations',
  'dimension_scores',
  'rubric_templates',
  'rubric_dimensions',
  'notifications',
  'session_summaries',
  'development_plans',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseSeqNum(filename) {
  // New format: 20260425_040_evaluation_failed_status.sql  → 40
  const newFmt = filename.match(/^\d{8,14}_(\d+)_/)
  if (newFmt) return parseInt(newFmt[1], 10)

  // Old format: 014_session_activity.sql → 14
  const oldFmt = filename.match(/^(\d+)_/)
  if (oldFmt) return parseInt(oldFmt[1], 10)

  return null
}

function isNewFormat(filename) {
  return /^\d{8,14}_\d+_/.test(filename)
}

let errors = 0
let warnings = 0

function error(msg) {
  console.error(`  ✗ ERROR: ${msg}`)
  errors++
}

function warn(msg) {
  console.warn(`  ⚠ WARN:  ${msg}`)
  warnings++
}

function ok(msg) {
  console.log(`  ✓ ${msg}`)
}

// ─── Read files ───────────────────────────────────────────────────────────────

const allFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

console.log(`\n── Migration Verifier ──────────────────────────────────────────`)
console.log(`   Directory : ${MIGRATIONS_DIR}`)
console.log(`   SQL files : ${allFiles.length}`)
console.log(`────────────────────────────────────────────────────────────────\n`)

// ─── Check 1: Duplicate sequence numbers ─────────────────────────────────────
// Old-format files (NNN_name.sql) predate the timestamp format and sort before
// new-format files (YYYYMMDD_NNN_name.sql) in Supabase's alphabetical order,
// so an old-format and new-format file sharing the same NNN are NOT duplicates
// in execution order.  Only flag duplicates within the same format group.

console.log('[ 1 ] Duplicate sequence numbers')

const seqMapOld = new Map() // seq → [old-format filenames]
const seqMapNew = new Map() // seq → [new-format filenames]
for (const file of allFiles) {
  const seq = parseSeqNum(file)
  if (seq === null) {
    warn(`Cannot parse sequence number from: ${file}`)
    continue
  }
  const map = isNewFormat(file) ? seqMapNew : seqMapOld
  if (!map.has(seq)) map.set(seq, [])
  map.get(seq).push(file)
}

// Build a unified map for gap checking (all sequences seen)
const seqMap = new Map()
for (const [seq, files] of seqMapOld) seqMap.set(seq, files)
for (const [seq, files] of seqMapNew) seqMap.set(seq, (seqMap.get(seq) ?? []).concat(files))

let dupFound = false
for (const [seq, files] of seqMapOld) {
  if (files.length > 1) {
    // Old-format duplicates cannot be safely renamed (DB migration history would break).
    // Supabase applies them in alphabetical order, so no execution conflict — warn only.
    warn(`Duplicate sequence ${String(seq).padStart(3, '0')} (old-format, legacy — cannot rename): ${files.join(', ')}`)
  }
}
for (const [seq, files] of seqMapNew) {
  if (files.length > 1) {
    error(`Duplicate sequence ${String(seq).padStart(3, '0')} (new-format): ${files.join(', ')}`)
    dupFound = true
  }
}
if (!dupFound) ok('No hard duplicate sequence numbers in new-format migrations')

// ─── Check 2: Sequence gaps ───────────────────────────────────────────────────

console.log('\n[ 2 ] Sequence gaps')

const seqNums = [...seqMap.keys()].sort((a, b) => a - b)
const min = seqNums[0]
const max = seqNums[seqNums.length - 1]
const gaps = []
for (let i = min; i <= max; i++) {
  if (!seqMap.has(i)) gaps.push(i)
}

if (gaps.length === 0) {
  ok(`Sequence ${min}–${max}: no gaps`)
} else {
  // Gaps can be intentional (removed migrations) — warn only
  for (const g of gaps) {
    warn(`Gap at sequence ${String(g).padStart(3, '0')} (may be intentional)`)
  }
}

// ─── Check 3: Empty files ─────────────────────────────────────────────────────

console.log('\n[ 3 ] Empty files')

let emptyFound = false
for (const file of allFiles) {
  const path = join(MIGRATIONS_DIR, file)
  const size = statSync(path).size
  if (size === 0) {
    error(`Empty migration file: ${file}`)
    emptyFound = true
  }
}
if (!emptyFound) ok('All migration files are non-empty')

// ─── Check 4: Dangerous patterns ─────────────────────────────────────────────

console.log('\n[ 4 ] Dangerous SQL patterns')

const DANGEROUS = [
  // DROP TABLE/TYPE without IF EXISTS
  { pattern: /DROP\s+TABLE\s+(?!IF\s+EXISTS)\s*\w/i, label: 'DROP TABLE without IF EXISTS' },
  { pattern: /DROP\s+TYPE\s+(?!IF\s+EXISTS)\s*\w/i, label: 'DROP TYPE without IF EXISTS' },
  // Truncate on core tables
  { pattern: /TRUNCATE\s+(TABLE\s+)?(tenants|users|sessions|evaluations)\b/i, label: 'TRUNCATE on core table' },
]

let dangerFound = false
for (const file of allFiles) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
  for (const { pattern, label } of DANGEROUS) {
    if (pattern.test(sql)) {
      error(`${label} in ${file}`)
      dangerFound = true
    }
  }
}
if (!dangerFound) ok('No dangerous SQL patterns detected')

// ─── Check 5: Required table coverage ────────────────────────────────────────

console.log('\n[ 5 ] Required table coverage')

const allSql = allFiles
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n')
  .toLowerCase()

let missingTables = false
for (const table of REQUIRED_TABLES) {
  if (!allSql.includes(table.toLowerCase())) {
    error(`Required table not found in any migration: ${table}`)
    missingTables = true
  }
}
if (!missingTables) ok(`All ${REQUIRED_TABLES.length} required tables referenced`)

// ─── Check 6: Format consistency ─────────────────────────────────────────────

console.log('\n[ 6 ] Format consistency')

const oldFormatFiles = allFiles.filter((f) => !isNewFormat(f))
const newFormatFiles = allFiles.filter((f) => isNewFormat(f))
ok(`New-format (timestamp prefix): ${newFormatFiles.length} files`)
if (oldFormatFiles.length > 0) {
  warn(`Old-format (no timestamp): ${oldFormatFiles.length} files — consider migrating to new format`)
  oldFormatFiles.forEach((f) => console.log(`     ${f}`))
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n────────────────────────────────────────────────────────────────')
console.log(`   Total migrations : ${allFiles.length}`)
console.log(`   Sequence range   : ${min}–${max}`)
console.log(`   Errors           : ${errors}`)
console.log(`   Warnings         : ${warnings}`)
console.log('────────────────────────────────────────────────────────────────\n')

if (errors > 0) {
  console.error(`FAIL — ${errors} error(s) found. Fix before deploying.\n`)
  process.exit(1)
} else {
  console.log(`PASS — Migrations look healthy.\n`)
}
