; ─────────────────────────────────────────────────────────────────────────────
; installer.nsh — Script NSIS personnalisé pour To-DoX
; Ajoute une checkbox "Lancer au démarrage de Windows" sur la page de fin
; ─────────────────────────────────────────────────────────────────────────────

; Injecté avant la définition des pages MUI (macro customHeader)
!macro customHeader
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Lancer To-DoX au démarrage de Windows"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION todox_AddToStartup
!macroend

; Fonction appelée si la checkbox est cochée au clic sur Terminer
Function todox_AddToStartup
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "To-DoX" '"$INSTDIR\To-DoX.exe"'
FunctionEnd

; Nettoyage au désinstallation (supprime l'entrée si présente)
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "To-DoX"
!macroend
