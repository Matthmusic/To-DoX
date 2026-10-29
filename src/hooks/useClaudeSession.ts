import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { getApiBaseUrl } from '../services/api';

/**
 * Partage la session courante (URL backend + JWT) avec le serveur MCP de Claude Desktop.
 * Le processus principal ne l'écrit que si l'intégration Claude est activée
 * (voir claude-integration.js) : ce hook peut donc tourner sans condition.
 *
 * Au démarrage, `authToken` vaut null tant que la reconnexion automatique n'a pas eu
 * lieu : on n'efface la session partagée que lors d'une vraie transition
 * connecté → déconnecté (déconnexion ou token expiré), pas à l'ouverture de l'app.
 */
export function useClaudeSession() {
  const authToken = useStore((s) => s.authToken);
  const userId = useStore((s) => s.localAuthUserId);
  const hadToken = useRef(false);

  useEffect(() => {
    const claude = window.electronAPI?.claude;
    if (!claude) return;
    if (authToken) {
      hadToken.current = true;
      void claude.syncSession({ apiUrl: getApiBaseUrl(), token: authToken, userId });
    } else if (hadToken.current) {
      hadToken.current = false;
      void claude.syncSession(null);
    }
  }, [authToken, userId]);
}
