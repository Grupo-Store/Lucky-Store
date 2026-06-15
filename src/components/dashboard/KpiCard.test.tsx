import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('renders label and value correctly', () => {
    render(<KpiCard label="Total Orders" value="42" />);
    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('applies accent class to value element when provided', () => {
    render(<KpiCard label="Revenue" value="R$ 1.000" accent="text-green-700" />);
    const valueEl = screen.getByText('R$ 1.000');
    expect(valueEl).toHaveClass('text-green-700');
  });

  it('falls back to the default ink color when accent is not provided', () => {
    render(<KpiCard label="Revenue" value="R$ 1.000" />);
    const valueEl = screen.getByText('R$ 1.000');
    expect(valueEl).toHaveClass('text-[#16273F]');
  });

  it('renders sub text when provided', () => {
    render(<KpiCard label="Revenue" value="R$ 1.000" sub="vs last month" />);
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('does not render sub text when absent', () => {
    render(<KpiCard label="Revenue" value="R$ 1.000" />);
    expect(screen.queryByText('vs last month')).not.toBeInTheDocument();
  });
});
