// The design guide served to agents by the `get_editor_guide` WebMCP tool.
// Single source of truth: the `salesive-canvas-designer` Claude Code skill
// (.claude/skills/salesive-canvas-designer/SKILL.md). Imported as raw text at
// build time; the BOM and YAML frontmatter are stripped.
import skill from '../../.claude/skills/salesive-canvas-designer/SKILL.md?raw';

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

export const EDITOR_GUIDE = String(skill)
  .replace(/^\uFEFF/, '')
  .replace(FRONTMATTER, '')
  .trim();
