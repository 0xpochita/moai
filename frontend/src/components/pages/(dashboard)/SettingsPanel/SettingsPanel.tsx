"use client";

import { Check, RotateCcw, Settings as SettingsIcon, X } from "lucide-react";
import { useState } from "react";
import { MotionModal } from "@/components/ui";
import { formatProtocolName } from "@/lib";
import {
  ALL_TRUSTED_PROTOCOLS,
  type ProtocolKey,
  useSettingsStore,
} from "@/store";
import { RiskProfilePicker } from "./RiskProfilePicker";

export function SettingsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Agent settings"
        onClick={() => setOpen(true)}
        className="bg-elevated hover:bg-brand-soft text-muted flex h-9 w-9 items-center justify-center rounded-full transition-colors"
      >
        <SettingsIcon className="h-4 w-4" aria-hidden />
      </button>

      <MotionModal
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="Agent settings"
      >
        <SettingsModalBody onClose={() => setOpen(false)} />
      </MotionModal>
    </>
  );
}

function SettingsModalBody({ onClose }: { onClose: () => void }) {
  const minApyPct = useSettingsStore((s) => s.minApyPct);
  const maxGasUsd = useSettingsStore((s) => s.maxGasUsd);
  const allowedProtocols = useSettingsStore((s) => s.allowedProtocols);
  const setMinApyPct = useSettingsStore((s) => s.setMinApyPct);
  const setMaxGasUsd = useSettingsStore((s) => s.setMaxGasUsd);
  const toggleProtocol = useSettingsStore((s) => s.toggleProtocol);
  const resetDefaults = useSettingsStore((s) => s.resetDefaults);

  return (
    <div className="bg-surface ring-card relative mx-auto flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl">
      <header className="ring-soft flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border-soft)] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="bg-brand-soft text-brand inline-flex h-8 w-8 items-center justify-center rounded-xl">
            <SettingsIcon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <div className="text-muted text-[9px] font-medium tracking-wide uppercase">
              Agent
            </div>
            <div className="text-main text-sm font-semibold tracking-tight">
              Settings
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-muted hover:text-main inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
        <section>
          <SectionLabel>Risk profile</SectionLabel>
          <RiskProfilePicker variant="grid" />
          <p className="text-muted-soft mt-1.5 text-[10px] leading-snug">
            Tells the agent how to pick destination vaults on Li.Fi Earn.
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <SliderField
            id="min-apy"
            label="Minimum APY"
            value={`${minApyPct.toFixed(1)}%`}
            min={0}
            max={20}
            step={0.5}
            raw={minApyPct}
            onChange={setMinApyPct}
            hint="Hide vaults below this APY."
          />
          <SliderField
            id="max-gas"
            label="Max gas"
            value={`$${maxGasUsd.toFixed(2)}`}
            min={0}
            max={20}
            step={0.5}
            raw={maxGasUsd}
            onChange={setMaxGasUsd}
            hint="Skip if estimated gas exceeds this."
          />
        </div>

        <section>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <SectionLabel>Allowed protocols</SectionLabel>
            <span className="text-muted-soft text-[10px]">
              {allowedProtocols.length} / {ALL_TRUSTED_PROTOCOLS.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ALL_TRUSTED_PROTOCOLS.map((key) => (
              <ProtocolToggle
                key={key}
                protocol={key}
                checked={allowedProtocols.includes(key)}
                onToggle={() => toggleProtocol(key)}
              />
            ))}
          </div>
        </section>
      </div>

      <footer className="ring-soft flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-border-soft)] px-5 py-3">
        <button
          type="button"
          onClick={resetDefaults}
          className="text-muted hover:text-main inline-flex items-center gap-1.5 text-[11px] font-medium"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-brand hover:bg-brand-hover inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold tracking-tight text-white transition-colors active:scale-[0.98]"
        >
          Done
        </button>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-main mb-1.5 text-[11px] font-semibold tracking-tight">
      {children}
    </div>
  );
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  raw,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  raw: number;
  onChange: (next: number) => void;
  hint: string;
}) {
  return (
    <div className="bg-elevated flex flex-col gap-1.5 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-main text-[11px] font-semibold tracking-tight"
        >
          {label}
        </label>
        <span className="text-brand text-[11px] font-semibold tracking-tight tabular-nums">
          {value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={raw}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-brand h-1 w-full"
      />
      <p className="text-muted-soft text-[10px] leading-snug">{hint}</p>
    </div>
  );
}

function ProtocolToggle({
  protocol,
  checked,
  onToggle,
}: {
  protocol: ProtocolKey;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={`flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
        checked
          ? "bg-brand-soft text-brand"
          : "bg-elevated text-muted hover:text-main"
      }`}
    >
      <span className="truncate">{formatProtocolName(protocol)}</span>
      {checked && <Check className="h-3 w-3 shrink-0" aria-hidden />}
    </button>
  );
}
