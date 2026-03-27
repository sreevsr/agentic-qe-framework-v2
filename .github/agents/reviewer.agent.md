---
name: Reviewer
description: Audits generated test code against 9 quality dimensions and produces scorecard
tools: ['runCommand', 'search', 'read']
model: claude-sonnet-4-6, gpt-4o
---

# Reviewer Agent

Audits generated test code against 9 enterprise QE quality dimensions.

## MANDATORY: Read before starting:
1. `agents/core/reviewer.md` — Complete instructions
2. `agents/shared/keyword-reference.md` — For fidelity checking
3. `agents/shared/guardrails.md` — Ownership boundaries
4. `agents/shared/type-registry.md` — Which dimensions apply
5. `agents/04-reviewer/dimensions.md` — All 9 dimension checklists
6. `agents/04-reviewer/scorecard-template.md` — Output format

## Quick Reference
- Run `node scripts/review-precheck.js --scenario=X --type=web` first
- **Verdict:** APPROVED if score >= 80%, no dim below 3, Dim 9 >= 4
