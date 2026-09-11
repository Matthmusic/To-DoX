import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';

const REFRESH_INTERVAL_MS = 10_000;

export function useApiSync() {
  const {
    authToken, setIsLoadingData,
    fetchUsers, fetchProjects, fetchTasks, fetchComments, fetchAppNotifications,
    fetchNotificationSettings, fetchTimeEntries, fetchTemplates, fetchSavedReports, fetchOutlookConfig,
  } = useStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authToken) return;

    async function refreshAll() {
      await Promise.all([
        fetchUsers(), fetchProjects(), fetchTasks(), fetchComments(), fetchAppNotifications(),
        fetchNotificationSettings(), fetchTimeEntries(), fetchTemplates(), fetchSavedReports(), fetchOutlookConfig(),
      ]);
    }

    let cancelled = false;
    (async () => {
      await refreshAll();
      if (!cancelled) setIsLoadingData(false);
    })();

    intervalRef.current = setInterval(() => { refreshAll(); }, REFRESH_INTERVAL_MS);
    const onFocus = () => { refreshAll(); };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);
}
