export default function TerminiLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-24 bg-stone-200" />
        <div className="mt-2 h-3 w-36 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8">
        {/* Filter buttons */}
        <div className="mb-5 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-16 bg-stone-200" />
          ))}
        </div>

        {/* Appointment rows */}
        <div className="border border-cream">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-cream bg-white px-5 py-4 last:border-b-0"
            >
              <div className="h-12 w-16 bg-stone-200" />
              <div className="flex-1">
                <div className="h-4 w-40 bg-stone-200" />
                <div className="mt-1.5 h-3 w-56 bg-stone-100" />
              </div>
              <div className="h-6 w-20 bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
