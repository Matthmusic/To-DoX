import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { setRequestErrorHandler, setUnauthorizedHandler, clearToken, ApiError } from '../services/api';

// Remonté à 10s (depuis 4s) : à 4s, chaque cycle déclenche 10 `set()` séparés (un par
// fetch*, résolus à des instants différents puisque ce sont 10 requêtes réseau
// indépendantes) -- constaté en usage réel : ralentissement perceptible de toute
// l'interface, même après avoir supprimé la duplication de l'effet de thème (24 copies
// -> 1). Le vrai correctif (regrouper les 10 fetch* en UN SEUL `set()`) demanderait de
// dupliquer la logique de post-traitement propre à chacun (fusion ganttDays/
// convertedFromSubtask de fetchTasks, normalisation de fetchUsers, éclatement en 3 slices
// de fetchProjects...) -- risqué à faire à la légère vu que cette même logique de fusion a
// déjà causé un bug critique plus tôt dans ce chantier. En attendant ce vrai correctif,
// revenir à un intervalle plus conservateur reste le levier le plus sûr.
const REFRESH_INTERVAL_MS = 10_000;

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message || 'Erreur de connexion au serveur';
  return 'Erreur de connexion au serveur';
}

export function useApiSync() {
  const {
    authToken, setIsLoadingData, setSaveError,
    fetchUsers, fetchProjects, fetchTasks, fetchComments, fetchAppNotifications,
    fetchNotificationSettings, fetchTimeEntries, fetchTemplates, fetchSavedReports, fetchOutlookConfig,
  } = useStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Canal d'erreur partagé (fixes I3/I4, review finale de branche) : enregistré une seule
  // fois au démarrage de l'app -- api.ts ne peut pas importer le store directement (import
  // circulaire, voir son commentaire). setUnauthorizedHandler gère un 401 hors login()
  // (token expiré/révoqué, cf spec du plan) en renvoyant proprement l'utilisateur à l'écran
  // de connexion plutôt que de le laisser bloqué avec chaque requête suivante en échec.
  useEffect(() => {
    setRequestErrorHandler(message => useStore.getState().setSaveError(message));
    setUnauthorizedHandler(() => {
      // clearToken doit être appelé avec l'id LOCAL (localAuthUserId), pas currentUser
      // (l'UUID backend) : saveToken() indexe le token sous l'id local (voir
      // LoginModal.tsx) -- clearToken(currentUser) purgerait une clé qui n'a jamais été
      // utilisée pour sauvegarder quoi que ce soit.
      const { localAuthUserId } = useStore.getState();
      if (localAuthUserId) clearToken(localAuthUserId).catch(() => {});
      useStore.getState().setAuthToken(null);
      useStore.getState().setCurrentUser(null);
      useStore.getState().setLocalAuthUserId(null);
    });
    return () => {
      setRequestErrorHandler(null);
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    if (!authToken) return;

    // Avant ce fix (I4) : si l'un des 10 fetch* rejetait (backend down, token expiré...),
    // l'appel initial ne remettait jamais isLoadingData à false (utilisateur bloqué sur le
    // spinner) et le timer / le handler focus produisaient une rejection non gérée à
    // chaque tick suivant, indéfiniment. `request()` (api.ts) a déjà reporté l'erreur via le
    // canal partagé ci-dessus pour toute requête individuelle -- on la reporte ici aussi
    // explicitement (plutôt que de l'avaler silencieusement) pour couvrir tout rejet qui ne
    // viendrait pas de `request()`, puis on avale l'exception : refreshAll() ne doit jamais
    // rejeter vers ses appelants.
    async function refreshAll() {
      try {
        await Promise.all([
          fetchUsers(), fetchProjects(), fetchTasks(), fetchComments(), fetchAppNotifications(),
          fetchNotificationSettings(), fetchTimeEntries(), fetchTemplates(), fetchSavedReports(), fetchOutlookConfig(),
        ]);
      } catch (e) {
        setSaveError(errorMessage(e));
      }
    }

    let cancelled = false;
    (async () => {
      try {
        await refreshAll();
      } finally {
        // Uniquement pour l'appel INITIAL : le timer / le focus ne doivent plus jamais
        // rebasculer isLoadingData après le premier chargement réussi.
        if (!cancelled) setIsLoadingData(false);
      }
    })();

    // .catch() défensif supplémentaire : refreshAll() avale déjà ses propres erreurs
    // ci-dessus, mais on ne laisse jamais une invocation fire-and-forget (timer/focus)
    // produire une rejection non gérée, même si ce comportement venait à changer.
    intervalRef.current = setInterval(() => { refreshAll().catch(e => setSaveError(errorMessage(e))); }, REFRESH_INTERVAL_MS);
    const onFocus = () => { refreshAll().catch(e => setSaveError(errorMessage(e))); };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);
}
