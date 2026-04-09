"use client";

import { useState } from "react";
import { ProgressIndicator } from "./ProgressIndicator";
import { StepServices } from "./StepServices";
import { StepCalendar } from "./StepCalendar";
import { StepDetails } from "./StepDetails";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

type Props = {
  services: Service[];
};

export function BookingFlow({ services }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [service, setService] = useState<Service | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);

  return (
    <div>
      <div className="mx-auto mb-10 max-w-[520px]">
        <ProgressIndicator currentStep={step} />
      </div>

      {step === 1 && (
        <StepServices
          services={services}
          onSelect={(s) => {
            setService(s);
            setStep(2);
          }}
        />
      )}

      {step === 2 && service && (
        <StepCalendar
          serviceId={service.id}
          serviceName={service.name}
          onSelect={(iso) => {
            setStartTime(iso);
            setStep(3);
          }}
          onBack={() => {
            setService(null);
            setStartTime(null);
            setStep(1);
          }}
        />
      )}

      {step === 3 && service && startTime && (
        <StepDetails
          service={service}
          startTimeIso={startTime}
          onBack={() => {
            setStartTime(null);
            setStep(2);
          }}
        />
      )}
    </div>
  );
}
