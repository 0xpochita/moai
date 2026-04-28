import type { CaliburCall, CaliburSignedBatchedCall } from "@/lib/calibur";

/// JSON-safe shape: every bigint becomes a decimal string. Lets us send
/// typed-data envelopes through fetch without TypeError on JSON.stringify.
export type Jsonable<T> = T extends bigint
  ? string
  : T extends Array<infer U>
    ? Array<Jsonable<U>>
    : T extends object
      ? { [K in keyof T]: Jsonable<T[K]> }
      : T;

export function bigintToString<T>(value: T): Jsonable<T> {
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );
}

/// Reverse of `bigintToString` for `CaliburSignedBatchedCall`. Walks the
/// known struct shape to convert string -> bigint at the right keys.
export function reviveSignedBatchedCall(
  raw: Jsonable<CaliburSignedBatchedCall>,
): CaliburSignedBatchedCall {
  return {
    batchedCall: {
      calls: raw.batchedCall.calls.map(
        (c): CaliburCall => ({
          to: c.to as `0x${string}`,
          value: BigInt(c.value),
          data: c.data as `0x${string}`,
        }),
      ),
      revertOnFailure: raw.batchedCall.revertOnFailure,
    },
    nonce: BigInt(raw.nonce),
    keyHash: raw.keyHash as `0x${string}`,
    executor: raw.executor as `0x${string}`,
    deadline: BigInt(raw.deadline),
  };
}
