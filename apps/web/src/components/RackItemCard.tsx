'use client';

import Image from 'next/image';
import { useEffect, useState, type CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';

interface RackItemCardProps {
  imageUrl: string;
  category: string | null;
  description: string | null;
  styleTags: string[] | null;
  badgeLabel?: string;
  className?: string;
}

const compactDescription = (text: string | null, maxLength = 120) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const fallbackAccent = 'rgb(240 255 189)';

const getImageAverageColor = async (imageUrl: string) => {
  const image = document.createElement('img');
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.src = imageUrl;

  await image.decode();

  const canvas = document.createElement('canvas');
  const size = 24;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return fallbackAccent;

  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;

  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 32) continue;

    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
    count += 1;
  }

  if (count === 0) return fallbackAccent;

  const soften = (channel: number) => Math.round(channel / count + (255 - channel / count) * 0.34);

  return `rgb(${soften(red)} ${soften(green)} ${soften(blue)})`;
};

export default function RackItemCard({
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

  return (
    <article
      className={`rack-item-card ${className ?? ''}`.trim()}
      style={{ '--rack-item-accent': accentColor } as CSSProperties}
    >
      <svg className="rack-item-shape" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
        <polygon points="1.5,5 87.5,5 95,35 95,65 87.5,95 1.5,95" />
      </svg>
      <svg className="rack-item-hanger" viewBox="0 0 60 42" aria-hidden="true" preserveAspectRatio="none">
        <path d="M1 21 H28 V26 A 15 15 0 0 0 58 26 A 15 15 0 0 0 52 13" strokeLinecap="round" />
      </svg>
      <div className="rack-item-image-wrap relative">
        <Image
          src={imageUrl}
          alt={description ?? category ?? 'Closet item'}
          fill
          sizes="(max-width: 640px) 55vw, (max-width: 1024px) 45vw, 35vw"
          className="rack-item-image"
        />
      </div>

      <div className="rack-item-side">
        <div className="rack-item-tag-wrap">
          <div className="rack-item-tag">
            <svg className="rack-item-tag-string" viewBox="0 0 74 20" aria-hidden="true" preserveAspectRatio="none">
              <path d="M2 15 C18 19 32 18 43 10 S60 1 72 9" />
            </svg>
            <svg className="rack-item-tag-shape" viewBox="0 0 100 40" aria-hidden="true" preserveAspectRatio="none">
              <polygon points="2,2 84,2 98,20 84,38 2,38" />
              <circle cx="86" cy="20" r="4.8" />
            </svg>
            <span>{(category ?? 'item').toUpperCase()}</span>
          </div>
        </div>
        {badgeLabel && (
          <Badge variant="outline" className="rack-item-badge rounded-none border-2 border-black">
            {badgeLabel}
          </Badge>
        )}
        <p className="rack-item-description">{compactDescription(description, 104)}</p>
        <div className="rack-item-meta">
          {(styleTags ?? []).slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="rack-item-chip rounded-none border-2 border-black">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </article>
  );
}
