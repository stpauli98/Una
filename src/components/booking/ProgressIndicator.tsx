import { cn } from "@/lib/utils/cn";

const STEPS = [
  { num: 1, label: "Usluga" },
  { num: 2, label: "Termin" },
  { num: 3, label: "Potvrda" },
] as const;

export function ProgressIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <div className="mx-auto flex max-w-[460px] items-center justify-center gap-3">
      {STEPS.map((step, i) => {
        const completed = currentStep > step.num;
        const active = currentStep === step.num;
        return (
          <div key={step.num} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-colors",
                active && "bg-rose text-white",
                completed && "bg-rose/20 text-rose",
                !active &&
                  !completed &&
                  "border border-blush bg-transparent text-light",
              )}
              aria-current={active ? "step" : undefined}
            >
              {completed ? "✓" : step.num}
            </div>
            <span
              className={cn(
                "text-[10px] uppercase tracking-[0.15em]",
                active ? "text-dark" : "text-light",
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "ml-2 h-px flex-1 transition-colors",
                  completed ? "bg-rose/40" : "bg-cream",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
