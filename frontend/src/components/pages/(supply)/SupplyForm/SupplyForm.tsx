import { Card } from "@/components/ui";
import { SupplyAmountInput } from "./SupplyAmountInput";
import { SupplyEstimatedBalance } from "./SupplyEstimatedBalance";
import { SupplyEstimatedYield } from "./SupplyEstimatedYield";
import { SupplyStrategyReview } from "./SupplyStrategyReview";

export function SupplyForm() {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="bg-elevated text-main inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium tracking-tight">
          Supply
        </span>
        <span className="bg-elevated text-main inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium tracking-tight">
          <span className="bg-brand inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-semibold text-white">
            E
          </span>
          Ethereum
        </span>
      </div>
      <SupplyAmountInput />
      <SupplyEstimatedYield />
      <SupplyStrategyReview />
      <SupplyEstimatedBalance />
    </Card>
  );
}
