import type { EChartsOption } from 'echarts';
import { CHART_COLORS, compactVnd } from './format';

const vndFull = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

function tooltipValue(value: unknown): string {
  return `${vndFull.format(Number(value))} đ`;
}

/** Biểu đồ cột tiền theo nhóm (doanh thu theo loại dịch vụ, theo tháng...). */
export function moneyBarChart(
  labels: string[],
  values: number[],
  seriesName: string,
): EChartsOption {
  return {
    color: CHART_COLORS,
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: tooltipValue },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { interval: 0, width: 90, overflow: 'truncate' },
    },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => compactVnd(v) } },
    series: [
      {
        name: seriesName,
        type: 'bar',
        data: values,
        barMaxWidth: 36,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

/** Donut 2+ phần, số tổng ở giữa. */
export function donutChart(
  items: { name: string; value: number; color: string }[],
  centerText: string,
  money = false,
): EChartsOption {
  return {
    tooltip: {
      trigger: 'item',
      valueFormatter: money ? tooltipValue : (v: unknown) => String(v),
    },
    legend: { bottom: 0, icon: 'circle' },
    title: {
      text: centerText,
      left: 'center',
      top: '38%',
      textStyle: { fontSize: 16, fontWeight: 600, color: '#0f2a4a' },
    },
    series: [
      {
        type: 'pie',
        radius: ['55%', '75%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: items.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } })),
      },
    ],
  };
}
