import type { DestinationVault } from "./destination";
import type { Position } from "./position";

export type MigrationLegKind = "burn" | "swap" | "deposit";

export interface MigrationLeg {
  kind: MigrationLegKind;
  target: string;
  targetAddress: string;
  description: string;
}

export interface MigrationYield {
  perDayUsd: number;
  perMonthUsd: number;
  perYearUsd: number;
  apyPercent: number;
}

export interface MigrationPlan {
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
