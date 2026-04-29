export type AgentActionType = "migrate" | "delegation" | "exit" | "harvest";

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
