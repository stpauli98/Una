export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-32 bg-stone-200" />
        <div className="mt-2 h-3 w-48 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8">
        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border border-cream bg-white p-4 md:p-5">
              <div className="mb-3 size-9 rounded-full bg-stone-200" />
              <div className="mb-1 h-3 w-20 bg-stone-100" />
              <div className="h-7 w-12 bg-stone-200" />
            </div>
          ))}
        </div>

        {/* Termini list */}
        <div className="mb-3 h-6 w-24 bg-stone-200" />
        <div className="border border-cream bg-white">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-cream px-5 py-4 last:border-b-0"
            >
              <div className="h-6 w-14 bg-stone-200" />
              <div className="flex-1">
                <div className="h-3 w-32 bg-stone-200" />
                <div className="mt-1 h-2.5 w-48 bg-stone-100" />
              </div>
              <div className="h-5 w-16 bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
