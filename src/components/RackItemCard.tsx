'use client';

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
      <div className="rack-item-image-wrap">
        <img
          src={imageUrl}
          alt={description ?? category ?? 'Closet item'}
          className="rack-item-image"
          loading="lazy"
        />
      </div>

      <div className="rack-item-side">
        <div className="rack-item-hanger" />
        <div className="rack-item-tag-wrap">
          <div className="rack-item-tag">
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
