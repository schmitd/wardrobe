"use client";
import { revealDecodedImage } from "@/lib/revealDecodedImage";

import Image from "next/image";
import { ArrowUpRight, Folder, Pencil } from "lucide-react";
import type { CSSProperties } from "react";

interface RackItemCardProps {
  compact?: boolean;
  hasNote?: boolean;
  collectionLabel?: string;
  imageUrl: string;
  category: string | null;
  description: string | null;
  styleTags: string[] | null;
  badgeLabel?: string;
  className?: string;
}

const compactDescription = (text: string | null, maxLength = 120) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const fallbackAccent = "rgb(240 255 189)";

// Existing Convex descriptions/tags include garment color. Project a bounded
// tint from that same reactive row so the first render and updates agree.
// No image fetch, client cache, photo-pixel extraction or new stored field.
const garmentTints: Record<string, string> = {
  black: "rgb(194 190 196)", charcoal: "rgb(194 190 196)",
  navy: "rgb(192 204 221)", "dark blue": "rgb(192 204 221)",
  blue: "rgb(201 221 235)", denim: "rgb(201 221 235)",
  grey: "rgb(216 215 219)", gray: "rgb(216 215 219)", silver: "rgb(216 215 219)",
  beige: "rgb(235 222 201)", tan: "rgb(235 222 201)", khaki: "rgb(235 222 201)",
  brown: "rgb(221 199 180)", camel: "rgb(221 199 180)", chocolate: "rgb(221 199 180)",
  cream: "rgb(246 237 216)", ivory: "rgb(246 237 216)", "off-white": "rgb(246 237 216)",
  white: "rgb(238 235 233)", olive: "rgb(215 219 187)",
  green: "rgb(202 225 202)", sage: "rgb(202 225 202)",
  burgundy: "rgb(229 196 207)", maroon: "rgb(229 196 207)",
  red: "rgb(241 202 198)", pink: "rgb(242 214 228)",
  purple: "rgb(222 206 234)", lavender: "rgb(222 206 234)",
  orange: "rgb(248 221 191)", rust: "rgb(248 221 191)",
  yellow: "rgb(244 237 192)", gold: "rgb(244 237 192)", mustard: "rgb(244 237 192)",
};
const garmentColor = /\b(off-white|dark blue|black|charcoal|navy|blue|denim|grey|gray|silver|beige|tan|khaki|brown|camel|chocolate|cream|ivory|white|olive|green|sage|burgundy|maroon|red|pink|purple|lavender|orange|rust|yellow|gold|mustard)\b/i;
function synchronizedAccent(description: string | null, tags: string[] | null) {
  const text = [description?.slice(0, 2000) ?? "", ...(tags ?? []).slice(0, 20).map(tag => tag.slice(0, 80))].join(" ");
  const color = text.match(garmentColor)?.[1].toLowerCase();
  return color ? garmentTints[color] : fallbackAccent;
}


export default function RackItemCard({
  compact,
  hasNote,
  collectionLabel,
  imageUrl,
  category,
  description,
  styleTags,
  badgeLabel,
  className,
}: RackItemCardProps) {
  const accentColor = synchronizedAccent(description, styleTags);

  if (compact)
    return (
      <div
        data-private
        className={`rack-piece ${className ?? ""}`.trim()}
        style={{ "--rack-item-accent": accentColor } as CSSProperties}
      >
        <div className="rack-piece-stage">
          <svg
            className="rack-piece-silhouette"
            viewBox="0 0 100 100"
            aria-hidden="true"
            preserveAspectRatio="none"
          >
            <path d="M1 98V17Q1 14 5 13L42 2Q50 0 58 2L95 13Q99 14 99 17V98Z" />
          </svg>
          <svg
            className="rack-piece-hanger"
            viewBox="0 0 100 66"
            aria-hidden="true"
          >
            <path
              className="rack-piece-hook"
              d="M43 11A7 7 0 0 1 57 11C57 17 50 17 50 23V28"
            />
            <path
              className="rack-piece-frame"
              d="M50 28C43 28 37 31 31 35L7 47Q3 49 4 53Q4 56 8 56H92Q96 56 96 52Q96 49 93 47L69 35C63 31 57 28 50 28Z"
            />
          </svg>
          <div className="rack-piece-photo">
            <Image
              src={imageUrl}
              onLoad={revealDecodedImage}
              alt={description ?? category ?? "Closet item"}
              fill
              sizes="(max-width: 640px) 44vw, (max-width: 1024px) 40vw, 280px"
              className="object-contain"
            />
          </div>
          <div className="rack-piece-tag">
            <svg
              className="rack-piece-tag-outline"
              viewBox="0 0 44 68"
              aria-hidden="true"
            >
              <path
                className="rack-piece-tag-cord"
                d="M22 9C12 2 14 -9 21 -7C29 -6 29 4 22 9"
              />
              <path
                className="rack-piece-tag-paper"
                d="M16 3Q22 -2 28 3L30 10L40 17Q42 18 42 23V62Q42 66 38 66H6Q2 66 2 62V23Q2 18 4 17L14 10Z"
              />
              <circle cx="22" cy="7" r="2.5" />
            </svg>
            <span className="rack-piece-tag-icons">
              <Folder size={16} aria-hidden="true" />
              {hasNote && <Pencil size={12} aria-hidden="true" />}
            </span>
            <span className="sr-only">
              {collectionLabel
                ? `In ${collectionLabel}. `
                : "View collections. "}
              {hasNote ? "Has a note." : ""}
            </span>
          </div>
          {badgeLabel && <span className="rack-piece-badge">{badgeLabel}</span>}
        </div>
        <div className="rack-piece-caption">
          <span>{category ?? "Your piece"}</span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </div>
      </div>
    );

  return (
    <article
      data-private
      className={`rack-item-card ${className ?? ""}`.trim()}
      style={{ "--rack-item-accent": accentColor } as CSSProperties}
    >
      <svg
        className="rack-item-shape"
        viewBox="0 0 100 100"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <polygon points="1.5,5 87.5,5 95,35 95,65 87.5,95 1.5,95" />
      </svg>
      <svg
        className="rack-item-hanger"
        viewBox="0 0 60 42"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <path
          d="M1 21 H28 V26 A 15 15 0 0 0 58 26 A 15 15 0 0 0 52 13"
          strokeLinecap="round"
        />
      </svg>
      <div className="rack-item-image-wrap relative">
        <Image
          src={imageUrl}
          onLoad={revealDecodedImage}
          alt={description ?? category ?? "Closet item"}
          fill
          sizes="(max-width: 640px) 55vw, (max-width: 1024px) 45vw, 35vw"
          className="rack-item-image"
        />
      </div>

      <div className="rack-item-side">
        <div className="rack-item-tag-wrap">
          <div className="rack-item-tag">
            <svg
              className="rack-item-tag-string"
              viewBox="0 0 74 20"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <path d="M2 15 C18 19 32 18 43 10 S60 1 72 9" />
            </svg>
            <svg
              className="rack-item-tag-shape"
              viewBox="0 0 100 40"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <polygon points="2,2 84,2 98,20 84,38 2,38" />
              <circle cx="86" cy="20" r="4.8" />
            </svg>
            <span>{(category ?? "item").toUpperCase()}</span>
          </div>
        </div>
        {badgeLabel && <span className="rack-item-badge">{badgeLabel}</span>}
        <p className="rack-item-description">
          {compactDescription(description, 104)}
        </p>
        {(styleTags ?? []).length > 0 && (
          <p className="rack-item-meta" aria-label="Style notes">
            {(styleTags ?? []).slice(0, 3).join(" / ")}
          </p>
        )}
      </div>
    </article>
  );
}
