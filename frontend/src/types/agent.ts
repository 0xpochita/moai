export type AgentActionType = "migrate" | "delegation" | "exit";

export interface AgentAction {
  id: string;
  type: AgentActionType;
  title: string;
  description: string;
  destination?: string;
  txHash?: string;
  positionTokenId?: string;
  createdAtSec: number;
}
