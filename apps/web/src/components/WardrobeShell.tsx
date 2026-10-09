/** Public layout placeholders. Their number is geometry, never an inventory count. */
export function StyleLoading() {
  return <section className="home-style-loading" aria-label="Your style" aria-busy="true">
    <h2>Your style</h2><div aria-hidden="true" className="home-loading-line" /><div aria-hidden="true" className="home-loading-line home-loading-line--short" />
    <span className="sr-only" role="status">Loading style notes…</span>
  </section>;
}
export function CollectionRailLoading() {
  return <div className="home-collection-loading" aria-hidden="true"><span /><span /><span /></div>;
}
export function PiecesLoading() {
  return <section aria-label="Closet rack" aria-busy="true" className="space-y-4">
    <p role="status" className="text-sm font-medium text-[#56345c]">Loading pieces…</p>
    <div className="collection-piece-grid grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {[0,1,2,3].map(slot=><div key={slot} className="home-piece-loading"><div /><span /></div>)}
    </div>
  </section>;
}
export function CollectionsLoading() {
  return <section aria-label="Wardrobe collections" className="space-y-5">
    <div><h2 className="mb-3 text-sm font-semibold text-[#56345c]">Collections</h2><CollectionRailLoading /></div>
    <h2 className="collection-heading truncate text-2xl font-bold">All pieces</h2>
    <div className="flex h-11 border-b border-[#d8c9dc]"><span className="border-b-2 border-[#241426] px-5 text-sm font-semibold leading-[44px]">Pieces</span></div>
    <PiecesLoading />
  </section>;
}
export default function WardrobeShell() {
  return <div className="space-y-6" data-home-shell><h1 className="sr-only">Wardrobe</h1><StyleLoading /><CollectionsLoading /></div>;
}
