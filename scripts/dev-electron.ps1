# Lance le serveur Vite puis Electron en DEV, sans passer par le chemin "npx electron"/
# child_process.spawn depuis Node -- ce chemin est bloqué silencieusement (exit code 0,
# aucune fenêtre, aucune erreur) par certains antivirus/EDR d'entreprise sur certains postes,
# alors qu'un lancement direct du binaire electron.exe depuis le shell fonctionne normalement.
# Voir la discussion de diagnostic si besoin de contexte -- en résumé : Node qui *spawn*
# electron.exe programmatiquement peut être bloqué ; le shell qui lance electron.exe
# directement ne l'est pas.

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."

Write-Host "Démarrage de Vite..."
$viteProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" `
    -WorkingDirectory $root -PassThru -NoNewWindow

function Stop-ViteTree {
    if ($viteProcess -and -not $viteProcess.HasExited) {
        # /T tue aussi les processus enfants (le vrai node.exe qui exécute vite) -- sans ça,
        # Stop-Process seul ne tuerait que le wrapper npm.cmd et laisserait Vite orphelin,
        # ce qui a causé des ports 5173/5174/... qui s'accumulent entre deux lancements.
        taskkill /PID $viteProcess.Id /T /F 2>$null | Out-Null
    }
}

try {
    Write-Host "En attente de Vite sur http://localhost:5173..."
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch {
            # Pas encore prêt (ou pas encore lancé) -- on réessaie.
        }
        Start-Sleep -Milliseconds 500
    }

    if (-not $ready) {
        Write-Host "Vite n'a pas répondu après 30s -- abandon."
        Stop-ViteTree
        exit 1
    }

    Write-Host "Vite prêt. Lancement d'Electron (appel direct du binaire)..."
    $env:NODE_ENV = "development"
    $electronExe = Join-Path $root "node_modules\electron\dist\electron.exe"
    # Start-Process -Wait, PAS `&` : `&` ne bloque pas de façon fiable pour une appli GUI
    # (sous-système Windows, pas console) quand ce script est lui-même lancé avec une
    # sortie standard redirigée -- exactement le cas ici puisque npm lance
    # `powershell -File ...` via cmd.exe. Constaté en direct : `&` rendait la main
    # immédiatement, ce qui déclenchait le `finally` ci-dessous et tuait Vite AVANT
    # qu'Electron n'ait eu la moindre chance de charger la page.
    $electronProcess = Start-Process -FilePath $electronExe -ArgumentList "`"$root`"" -Wait -PassThru
    $electronExitCode = $electronProcess.ExitCode
} finally {
    Write-Host "Arrêt de Vite..."
    Stop-ViteTree
}

exit $electronExitCode
