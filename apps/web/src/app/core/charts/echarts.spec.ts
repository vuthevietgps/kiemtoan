import { setPlatformAPI, use } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { init } from './echarts';

describe('Lazy chart module rendering', () => {
  beforeAll(() => {
    // SVG SSR verifies chart registration without requiring a browser canvas in jsdom.
    use(SVGRenderer);
    setPlatformAPI({ measureText: (text) => ({ width: text.length * 8 }) });
  });

  it('renders stacked bars with axes, legend and tooltip configuration', () => {
    const error = vi.spyOn(console, 'error');
    const chart = init(null, undefined, { renderer: 'svg', ssr: true, width: 600, height: 300 });
    try {
      chart.setOption({
        animation: false,
        title: { text: 'Tiến độ' },
        tooltip: { trigger: 'axis' },
        legend: { bottom: 0 },
        grid: { containLabel: true },
        xAxis: { type: 'category', data: ['Tháng 10'] },
        yAxis: { type: 'value' },
        series: [
          { name: 'Đúng hạn', type: 'bar', stack: 'tasks', data: [3] },
          { name: 'Trễ hạn', type: 'bar', stack: 'tasks', data: [1] },
        ],
      });
      const svg = chart.renderToSVGString();
      expect(svg).toContain('Tiến độ');
      expect(svg).toContain('Tháng 10');
      expect(svg).toContain('Đúng hạn');
      expect(svg).toContain('Trễ hạn');
      expect(chart.getOption()['series']).toHaveLength(2);
      expect(error).not.toHaveBeenCalled();
    } finally {
      chart.dispose();
      error.mockRestore();
    }
  });

  it('renders a donut with a center title and selectable legend', () => {
    const error = vi.spyOn(console, 'error');
    const chart = init(null, undefined, { renderer: 'svg', ssr: true, width: 400, height: 300 });
    try {
      chart.setOption({
        animation: false,
        title: { text: '4 dịch vụ', left: 'center', top: '38%' },
        legend: { bottom: 0 },
        tooltip: { trigger: 'item' },
        series: [{
          type: 'pie', radius: ['55%', '75%'], avoidLabelOverlap: true,
          data: [{ name: 'Hoàn tất', value: 3 }, { name: 'Đang làm', value: 1 }],
        }],
      });
      expect(chart.renderToSVGString()).toContain('4 dịch vụ');
      chart.dispatchAction({ type: 'legendUnSelect', name: 'Đang làm' });
      const legend = chart.getOption()['legend'] as { selected: Record<string, boolean> }[];
      expect(legend[0].selected['Đang làm']).toBe(false);
      expect(error).not.toHaveBeenCalled();
    } finally {
      chart.dispose();
      error.mockRestore();
    }
  });
});
