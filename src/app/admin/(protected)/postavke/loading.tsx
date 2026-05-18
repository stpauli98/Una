export default function PostavkeLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-24 bg-stone-200" />
        <div className="mt-2 h-3 w-56 bg-stone-100" />
      </div>

      <div className="space-y-8 p-5 md:p-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <section key={i}>
            <div className="mb-3 h-5 w-40 bg-stone-200" />
            <div className="mb-4 h-3 w-72 bg-stone-100" />
            <div className="h-32 border border-cream bg-white" />
          </section>
        ))}
      </div>
    </div>
  );
}
