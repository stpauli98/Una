/**
 * Default loading skeleton za sve admin tabove. Pojedinačni tabovi
 * mogu override-ovati svojim loading.tsx ako žele preciznije skeletone.
 *
 * Next.js automatski renderuje ovo dok se server component fetch-a.
 * Sa `loading.tsx` u mjestu, klik na tab daje instant feedback umjesto
 * praznog ekrana tokom SSR-a.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header skeleton */}
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-40 bg-stone-200" />
        <div className="mt-2 h-3 w-64 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8">
        {/* Content blocks */}
        <div className="space-y-3">
          <div className="h-16 border border-cream bg-white" />
          <div className="h-16 border border-cream bg-white" />
          <div className="h-16 border border-cream bg-white" />
          <div className="h-16 border border-cream bg-white" />
        </div>
      </div>
    </div>
  );
}
