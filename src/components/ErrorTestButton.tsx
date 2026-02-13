/**
 * 🧪 ERROR TEST BUTTON
 * Composant temporaire pour tester les Error Boundaries
 * À SUPPRIMER en production
 */

import { useState } from 'react';
import { Bug } from 'lucide-react';

export function ErrorTestButton() {
  const [shouldThrowError, setShouldThrowError] = useState(false);

  if (shouldThrowError) {
    // Déclencher une erreur React
    throw new Error('🧪 Test Error: This is a deliberate error to test Error Boundaries!');
  }

  return (
    <button
      onClick={() => setShouldThrowError(true)}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold hover:from-red-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl"
      title="Déclencher une erreur de test"
    >
      <Bug className="w-4 h-4" />
      Test Error Boundary
    </button>
  );
}
