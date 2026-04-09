import { cn } from "@/lib/utils/cn";

type Status = "ceka" | "potvrdjen" | "otkazan" | "zavrsen";

const STYLES: Record<Status, { bg: string; text: string; label: string }> = {
  ceka: { bg: "bg-amber-100 text-amber-700", text: "text-amber-700", label: "Čeka" },
  potvrdjen: { bg: "bg-green-100 text-green-700", text: "text-green-700", label: "Potvrđen" },
  otkazan: { bg: "bg-red-100 text-red-700", text: "text-red-700", label: "Otkazan" },
  zavrsen: { bg: "bg-stone-200 text-stone-700", text: "text-stone-700", label: "Završen" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        s.bg,
      )}
    >
      {s.label}
    </span>
  );
}
