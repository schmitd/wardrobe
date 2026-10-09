import RackItemCard from "./RackItemCard";
import {
  PIECE_GRID,
  STYLE_ROW,
  STYLE_TITLE,
  STYLE_BIO,
} from "./LayoutGeometry";
/** Public geometry, never an inventory count or a prior account preview. */
export function StyleLoading() {
  return (
    <section aria-label="Your style" aria-busy="true">
      <div className={STYLE_ROW}>
        <span className="min-w-0 flex-1">
          <h2 className={STYLE_TITLE}>Your style</h2>
          <span className={STYLE_BIO}>
            <span aria-hidden="true" className="loading-text-line" />
            <span
              aria-hidden="true"
              className="loading-text-line loading-text-line--short"
            />
          </span>
        </span>
        <span aria-hidden="true" className="size-4 shrink-0" />
      </div>
      <span className="sr-only" role="status">
        Loading style notes…
      </span>
    </section>
  );
}
export function CollectionRailLoading() {
  return (
    <>
      {[0, 1, 2].map((slot) => (
        <span key={slot} aria-hidden="true" className="collection-shortcut">
          <span className="collection-orb" />
          <span>
            <span className="loading-text-line" />
          </span>
        </span>
      ))}
    </>
  );
}
export function PiecesLoading() {
  return (
    <section aria-label="Closet rack" aria-busy="true" className="space-y-4">
      <span role="status" className="sr-only">
        Loading pieces…
      </span>
      <div className={PIECE_GRID} aria-hidden="true">
        {[0, 1, 2, 3].map((slot) => (
          <div key={slot}>
            <RackItemCard
              compact
              loading
              imageUrl=""
              category={null}
              description={null}
              styleTags={null}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
export function CollectionsLoading() {
  return (
    <section
      aria-label="Wardrobe collections"
      className="space-y-5"
      aria-busy="true"
    >
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[#56345c]">
          Collections
        </h2>
        <div className="collection-rail" aria-hidden="true">
          <span className="collection-shortcut">
            <span className="collection-orb" />
            <span>All pieces</span>
          </span>
          <CollectionRailLoading />
          <span className="collection-shortcut">
            <span className="collection-orb collection-orb--new" />
            <span>New collection</span>
          </span>
        </div>
      </div>
      <div className="collection-heading">
        <h2 className="truncate text-2xl font-bold">All pieces</h2>
        <span className="size-9" />
        <span className="size-9" />
      </div>
      <div className="flex h-11 border-b border-[#d8c9dc]">
        <span className="border-b-2 border-[#241426] px-5 text-sm font-semibold leading-[44px]">
          Pieces
        </span>
      </div>
      <PiecesLoading />
    </section>
  );
}
export default function WardrobeShell() {
  return (
    <div className="space-y-6" data-home-shell>
      <h1 className="sr-only">Wardrobe</h1>
      <StyleLoading />
      <CollectionsLoading />
    </div>
  );
}
