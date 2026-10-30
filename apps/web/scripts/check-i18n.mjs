#!/usr/bin/env node
/**
 * Dictionary linter — the checks TypeScript cannot make.
 *
 * The compiler already guarantees key parity (each `de` namespace is typed
 * `Record<keyof EnNamespace, string>`). What it cannot see is the *content* of
 * the strings, so this script checks:
 *
 *   1. interpolation placeholders match across locales  ({name} typo'd in one
 *      language renders "{nam}" to a user and nothing fails)
 *   2. every plural key has the CLDR categories its locale actually requires
 *      (adding Polish demands `_few`/`_many`; English never would)
 *   3. no key is orphaned — defined but referenced nowhere in src/
 *
 * Run: npm run i18n:check
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(root, 'src/lib/i18n/locales');

const LOCALES = readdirSync(localesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const INTL_TAG = { en: 'en-US', de: 'de-DE' };
const SOURCE = 'en';

/** Transpile a namespace file and pull out its exported object. */
function loadNamespace(file) {
  const src = readFileSync(file, 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', js)(module.exports, module);
  const name = basename(file, '.ts');
  return module.exports[name] ?? {};
}

function loadLocale(locale) {
  const dir = join(localesDir, locale);
  const out = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
    Object.assign(out, loadNamespace(join(dir, f)));
  }
  return out;
}

const dicts = Object.fromEntries(LOCALES.map((l) => [l, loadLocale(l)]));
const errors = [];
const placeholders = (s) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

// 1. placeholder parity ------------------------------------------------------
for (const key of Object.keys(dicts[SOURCE])) {
  const expected = placeholders(dicts[SOURCE][key]);
  for (const locale of LOCALES.filter((l) => l !== SOURCE)) {
    const value = dicts[locale][key];
    if (value === undefined) continue; // key parity is TypeScript's job
    const actual = placeholders(value);
    const missing = [...expected].filter((p) => !actual.has(p));
    const extra = [...actual].filter((p) => !expected.has(p));
    if (missing.length || extra.length) {
      errors.push(
        `${locale}: "${key}" placeholder mismatch` +
          (missing.length ? ` — missing {${missing.join('} {')}}` : '') +
          (extra.length ? ` — unexpected {${extra.join('} {')}}` : ''),
      );
    }
  }
}

// 2. plural completeness -----------------------------------------------------
const pluralBases = new Set(
  Object.keys(dicts[SOURCE])
    .filter((k) => k.endsWith('_other'))
    .map((k) => k.slice(0, -'_other'.length)),
);
for (const key of Object.keys(dicts[SOURCE])) {
  const m = key.match(/^(.*)_(zero|one|two|few|many|other)$/);
  if (m && !pluralBases.has(m[1])) {
    errors.push(`${SOURCE}: "${key}" has a plural suffix but no "${m[1]}_other" form`);
  }
}
for (const locale of LOCALES) {
  const required = new Intl.PluralRules(INTL_TAG[locale] ?? locale).resolvedOptions()
    .pluralCategories;
  for (const base of pluralBases) {
    for (const category of required) {
      if (dicts[locale][`${base}_${category}`] === undefined) {
        errors.push(`${locale}: "${base}" is missing the required "_${category}" form`);
      }
    }
  }
}

// 3. orphaned keys -----------------------------------------------------------
function sources(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!p.includes('i18n/locales')) sources(p, acc);
    } else if (/\.tsx?$/.test(e.name)) {
      acc.push(readFileSync(p, 'utf8'));
    }
  }
  return acc;
}
const haystack = sources(join(root, 'src')).join('\n');
const orphans = Object.keys(dicts[SOURCE]).filter((key) => {
  // Plural forms are reached via `${base}_${category}`, so credit the base.
  const lookup = key.replace(/_(zero|one|two|few|many|other)$/, '');
  return !haystack.includes(`'${key}'`) && !haystack.includes(`'${lookup}'`);
});

const total = Object.keys(dicts[SOURCE]).length;
if (errors.length) {
  console.error(`✖ i18n check failed (${errors.length} problem(s)):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`✓ i18n check passed — ${total} keys × ${LOCALES.length} locales (${LOCALES.join(', ')})`);
if (orphans.length) {
  console.log(`\n  ${orphans.length} key(s) defined but never referenced:`);
  for (const o of orphans) console.log(`    ${o}`);
}
