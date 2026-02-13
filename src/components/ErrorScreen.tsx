/**
 * 🚨 ERROR SCREEN COMPONENT
 * Interface utilisateur friendly affichée quand une erreur est capturée
 * Propose des actions: Réessayer, Signaler le bug, Voir les détails
 */

import { AlertTriangle, RefreshCw, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface ErrorScreenProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onReset: () => void;
  boundaryName?: string;
}

export function ErrorScreen({ error, errorInfo, onReset, boundaryName }: ErrorScreenProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleReportBug = () => {
    const title = encodeURIComponent(`[Bug] ${error?.message || 'Erreur inconnue'}`);
    const body = encodeURIComponent(
      `**Description de l'erreur**\n\n` +
      `Boundary: ${boundaryName || 'Unknown'}\n` +
      `Message: ${error?.message || 'N/A'}\n\n` +
      `**Stack Trace**\n\`\`\`\n${error?.stack || 'N/A'}\n\`\`\`\n\n` +
      `**Component Stack**\n\`\`\`\n${errorInfo?.componentStack || 'N/A'}\n\`\`\`\n\n` +
      `**Version**\nTo-DoX v2.0.1\n\n` +
      `**Étapes pour reproduire**\n1. ...\n2. ...\n3. ...`
    );

    const issueUrl = `https://github.com/Matthmusic/To-DoX/issues/new?title=${title}&body=${body}`;

    if (window.electronAPI?.openExternalUrl) {
      window.electronAPI.openExternalUrl(issueUrl);
    } else {
      window.open(issueUrl, '_blank');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#1a1f35] to-[#0a0e1a] p-6">
      <div className="max-w-2xl w-full">
        {/* Card d'erreur principale */}
        <div className="rounded-2xl border border-red-500/30 bg-[#161b2e]/90 backdrop-blur-xl p-8 shadow-2xl">
          {/* Icône et titre */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">
                Oups ! Une erreur est survenue
              </h1>
              <p className="text-slate-400 text-sm">
                {boundaryName ? `Dans: ${boundaryName}` : 'Une erreur inattendue s\'est produite'}
              </p>
            </div>
          </div>

          {/* Message d'erreur */}
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-red-300 font-mono text-sm">
              {error?.message || 'Erreur inconnue'}
            </p>
          </div>

          {/* Suggestions */}
          <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <h3 className="text-blue-300 font-bold text-sm mb-2">💡 Suggestions :</h3>
            <ul className="text-slate-300 text-sm space-y-1 list-disc list-inside">
              <li>Cliquez sur "Réessayer" pour tenter de récupérer</li>
              <li>Rafraîchissez la page si le problème persiste (Ctrl+R)</li>
              <li>Vérifiez vos données dans les paramètres</li>
              <li>Signalez le bug pour nous aider à l'améliorer</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={onReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
            <button
              onClick={handleReportBug}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl"
            >
              <Bug className="w-4 h-4" />
              Signaler le bug
            </button>
          </div>

          {/* Toggle détails */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showDetails ? 'Masquer les détails' : 'Voir les détails techniques'}
          </button>

          {/* Détails techniques */}
          {showDetails && (
            <div className="mt-4 p-4 rounded-lg bg-black/50 border border-white/10 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {/* Stack trace */}
                {error?.stack && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">Stack Trace</h4>
                    <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
                      {error.stack}
                    </pre>
                  </div>
                )}

                {/* Component stack */}
                {errorInfo?.componentStack && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">Component Stack</h4>
                    <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info supplémentaire */}
        <p className="text-center text-slate-500 text-xs mt-4">
          L'erreur a été enregistrée automatiquement. Vos données sont toujours en sécurité.
        </p>
      </div>
    </div>
  );
}
