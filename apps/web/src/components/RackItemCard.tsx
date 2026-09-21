"use client";

import Image from "next/image";
import { ArrowUpRight, Folder, Pencil } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

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

const getImageAverageColor = async (imageUrl: string) => {
  const image = document.createElement("img");
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = imageUrl;

  await image.decode();

  const canvas = document.createElement("canvas");
  const size = 24;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return fallbackAccent;

  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;

  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    // White photo backdrops should not wash every garment's accent to grey.
    if (
      alpha < 32 ||
      Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) > 238
    )
      continue;

    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
    count += 1;
  }

  if (count === 0) return fallbackAccent;

  const soften = (channel: number) =>
    Math.round(channel / count + (255 - channel / count) * 0.34);

  return `rgb(${soften(red)} ${soften(green)} ${soften(blue)})`;
};

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
  const [accentColor, setAccentColor] = useState(fallbackAccent);

  useEffect(() => {
    let isActive = true;

    getImageAverageColor(imageUrl)
      .then((color) => {
        if (isActive) setAccentColor(color);
      })
      .catch(() => {
        if (isActive) setAccentColor(fallbackAccent);
      });

    return () => {
      isActive = false;
    };
  }, [imageUrl]);

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
            viewBox="0 0 100 60"
            aria-hidden="true"
          >
            <path
              className="rack-piece-hook"
              d="M45 12C42 2 59 1 57 11C56 15 50 16 50 21V26"
            />
            <path
              className="rack-piece-wood"
              d="M46 25Q50 21 54 25L91 43Q95 47 90 49Q70 50 53 44Q50 43 47 44Q30 50 10 49Q5 47 9 43Z"
            />
            <path
              className="rack-piece-grain"
              d="M12 45L46 28Q50 26 54 28L88 45"
            />
          </svg>
          <div className="rack-piece-photo">
            <Image
              src={imageUrl}
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
              <Folder size={17} aria-hidden="true" />
              {hasNote && <Pencil size={14} aria-hidden="true" />}
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
