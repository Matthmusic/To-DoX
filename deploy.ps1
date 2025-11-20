# Script de déploiement automatique pour To-DoX
# Usage: .\deploy.ps1 -Version "1.4.1" -Message "Description de la release"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$true)]
    [string]$Message,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Déploiement de To-DoX v$Version" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier qu'on est dans le bon répertoire
$rootPath = "c:\DEV\ToolBox CEAI\To-DoX"
if ((Get-Location).Path -ne $rootPath) {
    Set-Location $rootPath
    Write-Host "✅ Changement de répertoire vers $rootPath" -ForegroundColor Green
}

# 2. Vérifier qu'il n'y a pas de changements non commités (sauf package.json)
$status = git status --porcelain
if ($status -and -not $Force) {
    Write-Host "⚠️  Il y a des changements non commités:" -ForegroundColor Yellow
    Write-Host $status
    $continue = Read-Host "Continuer quand même ? (o/N)"
    if ($continue -ne "o") {
        Write-Host "❌ Déploiement annulé" -ForegroundColor Red
        exit 1
    }
}

# 3. Mettre à jour la version dans package.json
Write-Host "📝 Mise à jour de package.json à la version $Version..." -ForegroundColor Cyan
$packagePath = "smart-todo\package.json"
$packageContent = Get-Content $packagePath -Raw
$packageContent = $packageContent -replace '"version": ".*"', "`"version`": `"$Version`""
Set-Content $packagePath $packageContent -NoNewline
Write-Host "✅ Version mise à jour dans package.json" -ForegroundColor Green

# 4. Commiter le changement de version
Write-Host "📦 Commit du changement de version..." -ForegroundColor Cyan
git add smart-todo/package.json
git commit -m "chore: bump version to $Version"
Write-Host "✅ Changement de version commité" -ForegroundColor Green

# 5. Commiter les autres changements s'il y en a
$status = git status --porcelain
if ($status) {
    Write-Host "📦 Commit des autres changements..." -ForegroundColor Cyan
    git add .

    $commitMessage = @"
feat: $Message

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
"@

    git commit -m $commitMessage
    Write-Host "✅ Changements commités" -ForegroundColor Green
}

# 6. Créer le tag
Write-Host "🏷️  Création du tag v$Version..." -ForegroundColor Cyan
$tagExists = git tag -l "v$Version"
if ($tagExists) {
    if ($Force) {
        git tag -d "v$Version"
        Write-Host "⚠️  Tag v$Version supprimé (mode force)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Le tag v$Version existe déjà. Utilisez -Force pour le recréer" -ForegroundColor Red
        exit 1
    }
}
git tag -a "v$Version" -m "Release v$Version - $Message"
Write-Host "✅ Tag v$Version créé" -ForegroundColor Green

# 7. Pousser vers GitHub
Write-Host "📤 Push vers GitHub..." -ForegroundColor Cyan
if ($Force) {
    git push --force origin main
    git push --force origin "v$Version"
    Write-Host "✅ Push forcé effectué" -ForegroundColor Yellow
} else {
    git push origin main
    git push origin "v$Version"
    Write-Host "✅ Push effectué" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Déploiement terminé avec succès !" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Vérifier le workflow: https://github.com/Matthmusic/To-DoX/actions" -ForegroundColor White
Write-Host "  2. Attendre la release: https://github.com/Matthmusic/To-DoX/releases" -ForegroundColor White
Write-Host ""
