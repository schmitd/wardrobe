'use client';

import Image from 'next/image';
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

export default function RackItemCard({
  imageUrl,
  category,
  description,
  styleTags,
  badgeLabel,
  className,
}: RackItemCardProps) {
  return (
    <article className={`rack-item-card ${className ?? ''}`.trim()}>
      <svg className="rack-item-shape" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
        <polygon points="1.5,1.5 87.5,1.5 98.5,35 98.5,58 87.5,98.5 1.5,98.5" />
      </svg>
      <svg className="rack-item-hanger" viewBox="0 0 60 42" aria-hidden="true" preserveAspectRatio="none">
        <path d="M1 21 H25 C25 33 40 37 51 26 C56 21 58 13 55 7" />
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
            <svg className="rack-item-tag-shape" viewBox="0 0 100 40" aria-hidden="true" preserveAspectRatio="none">
              <polygon points="2,2 84,2 98,20 84,38 2,38" />
            </svg>
            <span>{(category ?? 'item').toUpperCase()}</span>
          </div>
          <span className="rack-item-tag-dot" />
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
