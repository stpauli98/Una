"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ManualAppointmentForm } from "./ManualAppointmentForm";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

export function TerminiToolbar({ services }: { services: Service[] }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-1.5 bg-rose px-4 py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover cursor-pointer"
      >
        <Plus size={14} />
        Dodaj termin
      </button>
      {showForm && (
        <ManualAppointmentForm
          services={services}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}
