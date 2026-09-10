---
name: create-skill
description: 'Create a reusable skill (SKILL.md) by extracting a workflow from conversation context.'
argument-hint: What should this skill produce?
disable-model-invocation: true
---

Use this skill to turn a conversational workflow into a workspace-scoped `SKILL.md` that captures the step-by-step process, decision logic, and quality checks.

## When to use
- A user asks to create or improve a reusable skill for the workspace.
- The task is to generalize a multi-step workflow or methodology into a repeatable authoring process.
- The conversation contains a sequence of actions, decisions, and completion criteria.

## Workflow
1. Review the conversation history and any attached prompts.
2. Identify the workflow being followed:
   - key steps
   - decision points and branches
   - acceptance criteria or quality checks
3. If the workflow is not clear, ask for clarification:
   - desired outcome
   - workspace scope vs personal preference
   - level of detail needed (quick checklist or full workflow)
4. Draft the skill file with:
   - name
   - description
   - input hint
   - usable instructions
5. Flag any ambiguous or weak parts and ask follow-up questions.
6. Save the final `SKILL.md` and summarize what it produces.

## Quality checks
- The skill clearly explains the output it should produce.
- The process is easy to follow for users and Copilot.
- Decisions and branching are explicit when needed.
- The skill is workspace-scoped by default unless the request says otherwise.

## Example prompts
- "Create a SKILL.md for reviewing frontend accessibility issues."
- "Draft a reusable skill that turns deployment checklists into code changes."
- "Help me write a workspace skill for triaging production bugs."
