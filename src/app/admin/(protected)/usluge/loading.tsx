export default function UslugeLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-20 bg-stone-200" />
        <div className="mt-2 h-3 w-56 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border border-cream bg-white p-4">
            <div className="flex justify-between gap-4">
              <div className="flex-1">
                <div className="h-4 w-48 bg-stone-200" />
                <div className="mt-2 h-3 w-72 bg-stone-100" />
              </div>
              <div className="h-4 w-16 bg-stone-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
