// src/hooks/useApiSync.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApiSync } from './useApiSync';
import useStore from '../store/useStore';

describe('useApiSync', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchAll = vi.fn().mockResolvedValue(undefined);
    useStore.setState({
      authToken: 'tok', currentUser: 'u1', isLoadingData: true,
      fetchUsers: fetchAll, fetchProjects: fetchAll, fetchTasks: fetchAll, fetchComments: fetchAll,
      fetchAppNotifications: fetchAll, fetchNotificationSettings: fetchAll, fetchTimeEntries: fetchAll,
      fetchTemplates: fetchAll, fetchSavedReports: fetchAll, fetchOutlookConfig: fetchAll,
      setIsLoadingData: vi.fn((v: boolean) => useStore.setState({ isLoadingData: v })),
    });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('calls every fetch* action once on mount and sets isLoadingData to false when done', async () => {
    renderHook(() => useApiSync());

    await waitFor(() => expect(useStore.getState().isLoadingData).toBe(false));
    // All 10 fetch* store actions above are the same shared `fetchAll` mock instance,
    // so one refreshAll() pass (which calls all 10 distinct actions) increments its
    // shared call count by 10, not 1.
    expect(useStore.getState().fetchTasks).toHaveBeenCalledTimes(10);
  });

  it('does nothing when there is no authToken yet (not logged in)', () => {
    useStore.setState({ authToken: null, isLoadingData: true });
    renderHook(() => useApiSync());
    expect(useStore.getState().fetchTasks).not.toHaveBeenCalled();
  });

  it('re-fetches on a 10s interval', async () => {
    renderHook(() => useApiSync());
    await waitFor(() => expect(useStore.getState().isLoadingData).toBe(false));
    const callsBefore = (useStore.getState().fetchTasks as any).mock.calls.length;

    vi.advanceTimersByTime(10_000);
    await vi.waitFor(() => expect((useStore.getState().fetchTasks as any).mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
