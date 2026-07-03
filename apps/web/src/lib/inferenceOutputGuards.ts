const TOKENS_PER_WORD_ESTIMATE = 1.4;
const OUTPUT_TOKEN_WIGGLE_ROOM = 30;

export const ITEM_DESCRIPTION_WORD_LIMIT = 40;
export const STYLE_TAG_COUNT_LIMIT = 5;
export const STYLE_TAG_WORD_LIMIT = 3;
const STYLE_LABEL_WORD_BUDGET = STYLE_TAG_COUNT_LIMIT * STYLE_TAG_WORD_LIMIT + 6;

export const DESCRIPTION_MAX_OUTPUT_TOKENS =
  Math.ceil(ITEM_DESCRIPTION_WORD_LIMIT * TOKENS_PER_WORD_ESTIMATE) +
  OUTPUT_TOKEN_WIGGLE_ROOM;

export const STYLE_LABEL_MAX_OUTPUT_TOKENS =
  Math.max(
    120,
    Math.ceil(STYLE_LABEL_WORD_BUDGET * TOKENS_PER_WORD_ESTIMATE) +
    OUTPUT_TOKEN_WIGGLE_ROOM
  );

const WORD_SPLIT_REGEX = /\s+/;

export const truncateWords = (value: string, limit: number) => {
  const normalized = value.trim();
  if (!normalized) return "";
  const words = normalized.split(WORD_SPLIT_REGEX).filter(Boolean);
  return words.slice(0, Math.max(0, limit)).join(" ");
};

export const sanitizeStyleTags = (styleTags: string[]) =>
  styleTags
    .map((tag) => truncateWords(tag, STYLE_TAG_WORD_LIMIT))
    .filter((tag) => tag.length > 0)
    .slice(0, STYLE_TAG_COUNT_LIMIT);
