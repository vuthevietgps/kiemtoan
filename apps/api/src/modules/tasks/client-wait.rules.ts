/**
 * Số ngày chờ khách được tính vào hạn nội bộ khi đánh giá (đặc tả 05-D, G5): chỉ các khoảng đã
 * **xác nhận** và đã kết thúc; các khoảng chồng nhau không đếm trùng. Ngày theo lịch Việt Nam
 * (UTC+7); một khoảng [bắt đầu, kết thúc) tính theo số ngày lịch giữa hai ngày đó.
 */

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

export interface WaitInterval {
  startedAt: Date;
  endedAt: Date | null;
  confirmedAt: Date | null;
}

const vnDay = (date: Date) =>
  Math.floor((date.getTime() + VN_OFFSET_MS) / DAY_MS);

export function confirmedWaitDays(waits: WaitInterval[]): number {
  const ranges = waits
    .filter((w) => w.confirmedAt && w.endedAt)
    .map((w) => [vnDay(w.startedAt), vnDay(w.endedAt!)] as const)
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const [from, to] of ranges) {
    if (current && from <= current[1]) {
      current[1] = Math.max(current[1], to);
      continue;
    }
    if (current) total += current[1] - current[0];
    current = [from, to];
  }
  if (current) total += current[1] - current[0];
  return total;
}
