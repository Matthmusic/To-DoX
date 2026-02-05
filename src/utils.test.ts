import { describe, it, expect } from 'vitest';
import { formatDateFull, addDaysISO, businessDaysBetween, getProjectColor } from './utils';

describe('Utils', () => {
    describe('formatDateFull', () => {
        it('should format ISO date correctly', () => {
            const date = '2025-01-01'; // Wednesday
            // Implementation uses hardcoded format dd/mm/yyyy
            expect(formatDateFull(date)).toBe('01/01/2025');
        });

        it('should return empty string for null/undefined', () => {
            expect(formatDateFull(null)).toBe('');
            expect(formatDateFull(undefined)).toBe('');
        });
    });

    describe('addDaysISO', () => {
        it('should return a valid ISO date string', () => {
            const result = addDaysISO(1);
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should add days correctly relative to today', () => {
            // Mocking date would be better, but for now we trust the Date object logic
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const expected = tomorrow.toISOString().slice(0, 10);
            expect(addDaysISO(1)).toBe(expected);
        });
    });

    describe('businessDaysBetween', () => {
        it('should exclude weekends', () => {
            // Friday to Monday = 1 business day (Monday itself if inclusive? or just the gap?)
            // Implementation: while(current <= end) count++ if not weekend.
            // So Fri (1) + Sat(0) + Sun(0) + Mon(1) = 2 days?
            // Let's check implementation:
            // current starts at startDate. Loop while current <= endDate.
            // if not weekend, count++. increment day.

            const friday = new Date('2025-01-03');
            const monday = new Date('2025-01-06');

            // Fri (3), Sat(4), Sun(5), Mon(6)
            // Fri is work day -> 1
            // Sat is weekend -> 0
            // Sun is weekend -> 0
            // Mon is work day -> 2

            expect(businessDaysBetween(friday, monday)).toBe(2);
        });
    });

    describe('getProjectColor', () => {
        it('should return a consistent color for a given project', () => {
            const color1 = getProjectColor('Project A');
            const color2 = getProjectColor('Project A');
            expect(color1).toEqual(color2);
            expect(color1).toHaveProperty('bg');
            expect(color1).toHaveProperty('text');
        });
    });
});
