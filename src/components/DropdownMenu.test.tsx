import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu } from 'lucide-react';
import { DropdownItem, DropdownMenu } from './DropdownMenu';

afterEach(cleanup);

describe('DropdownMenu', () => {
  it('focuses the first action and restores the trigger on Escape', () => {
    render(
      <DropdownMenu icon={Menu} label="Menu">
        <DropdownItem label="Rapport hebdomadaire" />
      </DropdownMenu>,
    );
    const trigger = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(trigger);
    const action = screen.getByRole('button', { name: 'Rapport hebdomadaire' });
    expect(action).toHaveFocus();
    fireEvent.keyDown(action, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Rapport hebdomadaire' })).toBeNull();
  });

  it('runs a secondary action once and closes the panel', () => {
    const openReport = vi.fn();
    render(
      <DropdownMenu icon={Menu} label="Menu">
        <DropdownItem label="Rapport hebdomadaire" onClick={openReport} />
      </DropdownMenu>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rapport hebdomadaire' }));
    expect(openReport).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Rapport hebdomadaire' })).toBeNull();
  });
});
