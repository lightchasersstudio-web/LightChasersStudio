type Block = { id: string; start: Date; end: Date };
export type Placement = { id: string; column: number; columns: number };

/**
 * Side-by-side layout for a day timeline, like Google Calendar: bookings that
 * overlap (directly or through a chain) share a group, each takes the first
 * free column, and every booking in the group gets the group's column count.
 */
export function layoutDay(blocks: Block[]): Placement[] {
  const sorted = [...blocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
  );
  const placed = new Map<string, Placement>();
  let group: Placement[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -Infinity;

  const closeGroup = () => {
    for (const p of group) p.columns = columnEnds.length;
    group = [];
    columnEnds = [];
  };

  for (const b of sorted) {
    const start = b.start.getTime();
    const end = b.end.getTime();
    if (start >= groupEnd) closeGroup();
    let column = columnEnds.findIndex((e) => e <= start);
    if (column === -1) column = columnEnds.push(end) - 1;
    else columnEnds[column] = end;
    const p = { id: b.id, column, columns: 1 };
    group.push(p);
    placed.set(b.id, p);
    groupEnd = Math.max(start >= groupEnd ? end : groupEnd, end);
  }
  closeGroup();

  return blocks.map((b) => placed.get(b.id)!);
}
