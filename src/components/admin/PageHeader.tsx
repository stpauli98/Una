type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="border-b border-cream bg-white px-5 py-5 md:px-8 md:py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-light text-dark md:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-[12px] text-light">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
