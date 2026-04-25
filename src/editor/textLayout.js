function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeAgentText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\\n/g, '\n');
}

export function estimateCharacterWidth(fontSize = 16, letterSpacing = 0) {
  return Math.max(1, safeNumber(fontSize, 16) * 0.56 + safeNumber(letterSpacing, 0));
}

function chunkWord(word, maxChars) {
  if (!word) return [''];
  if (word.length <= maxChars) return [word];
  const chunks = [];
  for (let i = 0; i < word.length; i += maxChars) {
    chunks.push(word.slice(i, i + maxChars));
  }
  return chunks;
}

function wrapParagraph(paragraph, maxChars) {
  if (!paragraph) return [''];
  const words = paragraph.trim().split(/\s+/).flatMap((word) => chunkWord(word, maxChars));
  if (!words.length) return [''];

  const lines = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const next = words[i];
    const candidate = `${current} ${next}`;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = next;
    }
  }

  lines.push(current);
  return lines;
}

export function wrapTextContent(text, options = {}) {
  const normalized = normalizeAgentText(text);
  const width = safeNumber(options.width, 0);
  const fontSize = safeNumber(options.fontSize, 16);
  const letterSpacing = safeNumber(options.letterSpacing, 0);
  const textWrap = options.textWrap !== false;

  const paragraphs = normalized.split('\n');
  if (!textWrap || width <= fontSize * 1.5) {
    return paragraphs.length ? paragraphs : [''];
  }

  const maxChars = Math.max(1, Math.floor(width / estimateCharacterWidth(fontSize, letterSpacing)));
  return paragraphs.flatMap((paragraph) => wrapParagraph(paragraph, maxChars));
}

export function measureWrappedTextHeight(text, options = {}) {
  const lines = wrapTextContent(text, options);
  const fontSize = safeNumber(options.fontSize, 16);
  const lineHeight = safeNumber(options.lineHeight, 1.2);
  return Math.max(fontSize * lineHeight, lines.length * fontSize * lineHeight);
}
