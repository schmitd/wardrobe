type StyleProfile = {
  skinTone?: string | null;
  complexion?: string | null;
  hairColor?: string | null;
  colorSeason?: string | null;
  bodyType?: string | null;
};

const sentence = (parts: string[]) => {
  if (parts.length === 0) return null;
  if (parts.length === 1) return `${parts[0]}.`;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}.`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}.`;
};

export const styleContextNote = (profile: StyleProfile | null | undefined) => {
  if (!profile) return null;
  return sentence([
    profile.skinTone ? `${profile.skinTone} skin tone` : null,
    profile.complexion ? `${profile.complexion} complexion` : null,
    profile.hairColor ? `${profile.hairColor} hair` : null,
    profile.colorSeason ? `${profile.colorSeason} color palette` : null,
    profile.bodyType ? `${profile.bodyType} fit context` : null,
  ].filter((value): value is string => Boolean(value)));
};
