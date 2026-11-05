import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks, and starts with a BOM for Excel", () => {
    const csv = toCsv(
      ["Name", "Notes"],
      [
        ["Ana, Cruz", 'Said "hi"'],
        ["Ben", "Line 1\nLine 2"],
      ],
    );
    expect(csv).toBe('﻿Name,Notes\r\n"Ana, Cruz","Said ""hi"""\r\nBen,"Line 1\nLine 2"\r\n');
  });

  it("stops spreadsheet formulas from running", () => {
    expect(toCsv(["A"], [["=HYPERLINK(1)"], ["+1"], ["-2"], ["@x"]])).toBe(
      "﻿A\r\n'=HYPERLINK(1)\r\n'+1\r\n'-2\r\n'@x\r\n",
    );
  });

  it("writes numbers as they are", () => {
    expect(toCsv(["Amount"], [[1500.5], [-200]])).toBe("﻿Amount\r\n1500.5\r\n-200\r\n");
  });
});
