#!/usr/bin/env bash
#
# Fails on any high or critical npm advisory that is not explicitly allowed.
#
# `npm audit --audit-level=high` already exits non-zero on exactly these, so the
# only thing this adds is the allowlist — and the allowlist is the reason the
# check can be binding at all. Before it, the CI step carried
# `continue-on-error: true` because two advisories in the tree had no fix short
# of a semver-major upgrade, so a binding gate would have blocked every pull
# request on a problem unrelated to whatever was being merged. That is how a
# security gate gets deleted rather than satisfied. An allowlist lets the known
# ones be named, with a reason, while everything new still stops the build.
#
# It also reports an allowlisted advisory that no longer appears, because a
# permanent exception for a problem that has been fixed is how the list rots
# into a way of ignoring things.
#
# Reads the lockfile only — no install, no new dependency. Run it anywhere:
#
#     ./scripts/audit-gate.sh
#     AUDIT_JSON=/tmp/some-audit.json ./scripts/audit-gate.sh    # a saved report
#
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Advisories we knowingly ship with. One GHSA id per line, each with a comment
# saying why it is here and what removes it.
#
# Empty, and worth keeping that way. It was expected to hold sharp's two
# advisories (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c), on the assumption that
# clearing them needed Next 16 — but next 15.5.24 declares
# `optionalDependencies: sharp "^0.34.3 || ^0.35.3"`, so sharp 0.35.4 installs
# within the range npm already accepts. No exception is needed, and writing one
# anyway would have been a standing excuse for a problem that was already gone.
# ─────────────────────────────────────────────────────────────────────────────
ALLOWED=$(
  cat <<'EOF'
EOF
)

AUDIT_JSON="${AUDIT_JSON:-}"
if [ -z "$AUDIT_JSON" ]; then
  AUDIT_JSON="$(mktemp)"
  # npm audit exits non-zero when it finds anything; the report is what matters.
  npm audit --json >"$AUDIT_JSON" || true
fi

# Each entry under .vulnerabilities carries a `via` array whose object members
# are the advisories themselves. A package can be flagged only because a
# dependency of it is vulnerable, in which case its `via` holds plain strings —
# those are skipped, so every id below names a real advisory.
found=$(
  jq -r '
    (.vulnerabilities // {})
    | .[]
    | (.via // [])[]
    | select(type == "object")
    | select(.severity == "high" or .severity == "critical")
    | (.url // "")
  ' "$AUDIT_JSON" | sed 's#.*/##' | sed '/^$/d' | sort -u
)

# sed, not tr: tr works on the whole stream and would splice every id onto
# one line, which quietly turns the allowlist into a single entry that
# matches nothing. sed applies per line.
allowed=$(printf '%s\n' "$ALLOWED" | sed 's/#.*//' | sed 's/[[:space:]]//g' | sed '/^$/d' | sort -u)

unexpected=$(comm -23 <(printf '%s\n' "$found" | sed '/^$/d') <(printf '%s\n' "$allowed"))
stale=$(comm -13 <(printf '%s\n' "$found" | sed '/^$/d') <(printf '%s\n' "$allowed"))

if [ -n "$stale" ]; then
  echo "::warning::These advisories are allowlisted but no longer reported — remove them from scripts/audit-gate.sh:"
  printf '  %s\n' $stale
fi

if [ -n "$unexpected" ]; then
  echo "High or critical advisories that are not allowlisted:"
  printf '  https://github.com/advisories/%s\n' $unexpected
  echo
  echo "Fix them, or — if there is genuinely no fix yet — add the id to ALLOWED"
  echo "in scripts/audit-gate.sh with a comment saying what will remove it."
  echo
  npm audit --audit-level=high || true
  exit 1
fi

echo "No unallowlisted high or critical advisories."
