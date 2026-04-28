import type { DestinationVault } from "./destination";
import type { Position } from "./position";

export type MigrationIntent = "migrate" | "withdraw";

export type MigrationLegKind = "burn" | "swap" | "deposit" | "withdraw";

export interface MigrationLeg {
  kind: MigrationLegKind;
  target: string;
  targetAddress: string;
  description: string;
  calldata?: string;
  value?: string;
}

export interface MigrationYield {
  perDayUsd: number;
  perMonthUsd: number;
  perYearUsd: number;
  apyPercent: number;
}

export interface MigrationPlan {
  intent: MigrationIntent;
  positionTokenId: string;
  positionId: string;
  source: {
    protocol: Position["protocol"];
    pair: string;
    chain: Position["network"];
    valueUsd: number;
    feeTier: number;
    poolAddress: string;
    status: Position["status"];
  };
  destination: DestinationVault;
  legs: MigrationLeg[];
  yield: MigrationYield;
  generatedAtSec: number;
}

export type MigrationStatus =
  | "idle"
  | "planning"
  | "ready"
  | "signing"
  | "executing"
  | "complete"
  | "error";
