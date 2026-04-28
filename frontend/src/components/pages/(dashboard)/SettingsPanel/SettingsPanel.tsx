"use client";

import { Check, RotateCcw, Settings as SettingsIcon, X } from "lucide-react";
import { useState } from "react";
import { formatProtocolName } from "@/lib";
import {
  ALL_TRUSTED_PROTOCOLS,
  type ProtocolKey,
  useSettingsStore,
} from "@/store";

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

      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const minApyPct = useSettingsStore((s) => s.minApyPct);
  const maxGasUsd = useSettingsStore((s) => s.maxGasUsd);
  const allowedProtocols = useSettingsStore((s) => s.allowedProtocols);
  const setMinApyPct = useSettingsStore((s) => s.setMinApyPct);
  const setMaxGasUsd = useSettingsStore((s) => s.setMaxGasUsd);
  const toggleProtocol = useSettingsStore((s) => s.toggleProtocol);
  const resetDefaults = useSettingsStore((s) => s.resetDefaults);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agent settings"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="bg-foreground/40 absolute inset-0 backdrop-blur-sm"
      />

      <div className="bg-surface ring-card relative flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-brand-soft text-brand inline-flex h-9 w-9 items-center justify-center rounded-2xl">
              <SettingsIcon className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
                Agent
              </div>
              <div className="text-main text-base font-semibold tracking-tight">
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

        <section className="bg-elevated flex flex-col gap-2 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="min-apy"
              className="text-main text-xs font-semibold tracking-tight"
            >
              Minimum APY
            </label>
            <span className="text-brand text-xs font-semibold tracking-tight tabular-nums">
              {minApyPct.toFixed(1)}%
            </span>
          </div>
          <input
            id="min-apy"
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={minApyPct}
            onChange={(e) => setMinApyPct(Number(e.target.value))}
            className="accent-brand h-1 w-full"
          />
          <p className="text-muted-soft text-[10px] leading-snug">
            Vaults below this APY are hidden from suggestions.
          </p>
        </section>

        <section className="bg-elevated flex flex-col gap-2 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="max-gas"
              className="text-main text-xs font-semibold tracking-tight"
            >
              Max gas / migration
            </label>
            <span className="text-brand text-xs font-semibold tracking-tight tabular-nums">
              ${maxGasUsd.toFixed(2)}
            </span>
          </div>
          <input
            id="max-gas"
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={maxGasUsd}
            onChange={(e) => setMaxGasUsd(Number(e.target.value))}
            className="accent-brand h-1 w-full"
          />
          <p className="text-muted-soft text-[10px] leading-snug">
            The agent will skip migrations whose estimated gas exceeds this cap.
          </p>
        </section>

        <section className="bg-elevated flex flex-col gap-2 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-main text-xs font-semibold tracking-tight">
              Allowed protocols
            </span>
            <span className="text-muted-soft text-[10px]">
              {allowedProtocols.length} / {ALL_TRUSTED_PROTOCOLS.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
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

        <button
          type="button"
          onClick={resetDefaults}
          className="text-muted hover:text-main inline-flex items-center justify-center gap-1.5 self-start text-[11px] font-medium"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Reset to defaults
        </button>
      </div>
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
      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors ${
        checked
          ? "bg-brand-soft text-brand"
          : "bg-surface text-muted hover:text-main ring-soft"
      }`}
    >
      <span className="truncate">{formatProtocolName(protocol)}</span>
      {checked && <Check className="h-3 w-3 shrink-0" aria-hidden />}
    </button>
  );
}
