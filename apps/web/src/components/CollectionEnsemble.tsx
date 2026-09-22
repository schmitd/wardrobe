import Image from "next/image";
import { FolderOpen, Grid2X2 } from "lucide-react";

type Preview = { id: string; imageUrl: string; category: string | null };

/** Decorative preview of actual owned pieces/references; the enclosing button names the collection. */
export default function CollectionEnsemble({
  pieces,
  all = false,
}: {
  pieces: Preview[];
  all?: boolean;
}) {
  const preview = pieces.slice(0, 3);
  return (
    <span className="collection-orb" aria-hidden="true" data-private>
      {preview.length ? (
        <span
          className={`collection-ensemble collection-ensemble--${preview.length}`}
        >
          {preview.map((piece, index) => (
            <span
              key={piece.id}
              className={`collection-ensemble-piece collection-ensemble-piece--${index}`}
            >
              <Image
                src={piece.imageUrl}
                alt=""
                fill
                sizes="60px"
                className="object-contain"
              />
            </span>
          ))}
        </span>
      ) : all ? (
        <Grid2X2 />
      ) : (
        <FolderOpen />
      )}
    </span>
  );
}
