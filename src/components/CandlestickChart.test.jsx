import React from 'react';
import { render, screen } from '@testing-library/react';
import { CandlestickChart } from './Dashboard';

// Mock ResizeObserver which is often used by charting libraries or their parents
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('CandlestickChart', () => {
  // Generate sufficient mock data for indicators (EMA50 requires > 50 points)
  const generateMockData = (count = 60) => {
    return Array.from({ length: count }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (count - i));
      return {
        date,
        open: 150 + Math.random() * 10,
        high: 160 + Math.random() * 10,
        low: 140 + Math.random() * 10,
        close: 155 + Math.random() * 10,
        volume: 1000 + Math.random() * 500,
        status: i === count - 1 ? 'BUY' : undefined, // Add a signal
      };
    });
  };

  const defaultProps = {
    width: 800,
    height: 600,
    theme: 'light',
    chartType: 'candle',
  };

  test('renders message when data is empty', () => {
    render(<CandlestickChart {...defaultProps} data={[]} />);
    expect(
      screen.getByText(/Not enough data to display chart with current indicators/i)
    ).toBeInTheDocument();
  });

  test('renders chart canvas when valid data is provided', () => {
    const data = generateMockData(70);
    const { container } = render(<CandlestickChart {...defaultProps} data={data} />);
    
    // react-financial-charts renders an SVG when type="svg" (default in this component)
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    expect(svgElement).toHaveAttribute('width', '800');
    expect(svgElement).toHaveAttribute('height', '600');
  });

  test('renders without crashing with minimal data', () => {
    // Passing enough data for calculating indicators but potentially edge case length
    const data = generateMockData(51); 
    const { container } = render(<CandlestickChart {...defaultProps} data={data} />);
    
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });
});