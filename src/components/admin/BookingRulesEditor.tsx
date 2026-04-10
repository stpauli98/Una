"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateSetting } from "@/app/admin/(protected)/postavke/actions";

type SettingsMap = Record<string, string>;

const RULES = [
  {
    key: "min_hours_before",
    label: "Najranija rezervacija",
    description: "Koliko sati prije termina klijent može zakazati online.",
    options: [
      { value: "0", label: "Bez ograničenja" },
      { value: "1", label: "1 sat" },
      { value: "2", label: "2 sata" },
      { value: "3", label: "3 sata" },
      { value: "6", label: "6 sati" },
      { value: "12", label: "12 sati" },
      { value: "24", label: "24 sata" },
    ],
  },
  {
    key: "advance_booking_days",
    label: "Najdalja rezervacija",
    description: "Koliko dana unaprijed klijent može zakazati.",
    options: [
      { value: "7", label: "1 sedmica" },
      { value: "14", label: "2 sedmice" },
      { value: "30", label: "1 mjesec" },
      { value: "60", label: "2 mjeseca" },
      { value: "90", label: "3 mjeseca" },
    ],
  },
  {
    key: "cancellation_hours",
    label: "Besplatno otkazivanje",
    description:
      "Do koliko sati prije termina klijent može besplatno otkazati.",
    options: [
      { value: "0", label: "Bez ograničenja" },
      { value: "1", label: "1 sat" },
      { value: "2", label: "2 sata" },
      { value: "3", label: "3 sata" },
      { value: "6", label: "6 sati" },
      { value: "12", label: "12 sati" },
      { value: "24", label: "24 sata" },
    ],
  },
  {
    key: "break_between_min",
    label: "Pauza između termina",
    description:
      "Minuta pauze nakon svakog termina za čišćenje i pripremu.",
    options: [
      { value: "0", label: "Bez pauze" },
      { value: "30", label: "30 minuta" },
    ],
  },
] as const;

export function BookingRulesEditor({
  currentSettings,
}: {
  currentSettings: SettingsMap;
}) {
  return (
    <div className="space-y-3">
      {RULES.map((rule) => (
        <RuleRow
          key={rule.key}
          ruleKey={rule.key}
          label={rule.label}
          description={rule.description}
          options={rule.options}
          currentValue={currentSettings[rule.key] ?? ""}
        />
      ))}
    </div>
  );
}

function RuleRow({
  ruleKey,
  label,
  description,
  options,
  currentValue,
}: {
  ruleKey: string;
  label: string;
  description: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  currentValue: string;
}) {
  const [value, setValue] = useState(currentValue);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const changed = value !== currentValue;

  return (
    <div className="grid items-center gap-3 border border-cream bg-white p-4 md:grid-cols-[1fr_auto_auto]">
      <div>
        <p className="text-[13px] font-medium text-dark">{label}</p>
        <p className="mt-0.5 text-[11px] text-light">{description}</p>
      </div>
      <select
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        {saved && (
          <span className="flex items-center gap-1 text-[10px] text-green-600">
            <Check size={12} /> Sačuvano
          </span>
        )}
        <button
          type="button"
          disabled={pending || !changed}
          onClick={() => {
            setSaved(false);
            startTransition(async () => {
              const r = await updateSetting(ruleKey, value);
              if (r.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }
            });
          }}
          className="bg-rose px-4 py-2 text-[10px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          {pending ? "..." : "Sačuvaj"}
        </button>
      </div>
    </div>
  );
}
