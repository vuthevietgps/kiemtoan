import { CalendarYearStatus, Prisma } from '@prisma/client';
import {
  buildWorkingCalendar,
  type WorkingCalendar,
} from '../../common/working-calendar';

/** Lịch làm việc từ các năm đã xác nhận (đặc tả 06, I2); dùng chung cho 03/04/05. */
export async function loadWorkingCalendar(
  db: Pick<
    Prisma.TransactionClient,
    'businessCalendarYear' | 'businessCalendarDay'
  >,
): Promise<WorkingCalendar> {
  const years = await db.businessCalendarYear.findMany({
    where: { status: CalendarYearStatus.CONFIRMED },
    select: { year: true },
  });
  const confirmedYears = years.map((y) => y.year);
  const days = confirmedYears.length
    ? await db.businessCalendarDay.findMany({
        where: { year: { in: confirmedYears } },
        select: { date: true, kind: true },
      })
    : [];
  return buildWorkingCalendar({ confirmedYears, days });
}
