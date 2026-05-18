export default function GalerijaLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-24 bg-stone-200" />
        <div className="mt-2 h-3 w-48 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-stone-200" />
          ))}
        </div>
      </div>
    </div>
  );
}
