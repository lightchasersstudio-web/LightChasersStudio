"use client";

import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/** Jumps to another employee's time record for the same cut-off. */
export function EmployeePicker({
  employees,
  value,
  cutoff,
}: {
  employees: { id: string; name: string }[];
  value: string;
  cutoff: string;
}) {
  const router = useRouter();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="dtr-employee">Employee</Label>
      <NativeSelect
        id="dtr-employee"
        value={value}
        className="w-full sm:w-64"
        onChange={(e) => router.push(`/admin/dtr?cutoff=${cutoff}&employee=${e.target.value}`)}
      >
        {employees.map((e) => (
          <NativeSelectOption key={e.id} value={e.id}>
            {e.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
