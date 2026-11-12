import { describe, expect, it } from "vitest";

import { contractForWizard, contractHash, packageContract } from "./contract";

describe("package contracts", () => {
  it("treats empty or blank wording as no contract", () => {
    expect(packageContract(null)).toBeNull();
    expect(packageContract("  \n ")).toBeNull();
    expect(contractForWizard("")).toEqual({ contract: null, contractHash: null });
  });

  it("fingerprints the trimmed wording, changing whenever the wording does", () => {
    const a = contractForWizard("  1. Deposit is non-refundable.\n");
    expect(a.contract).toBe("1. Deposit is non-refundable.");
    expect(a.contractHash).toBe(contractHash("1. Deposit is non-refundable."));
    expect(a.contractHash).toMatch(/^[0-9a-f]{32}$/);
    expect(contractHash("1. Deposit is non-refundable!")).not.toBe(a.contractHash);
  });
});
