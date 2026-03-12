; ─────────────────────────────────────────────────────────────────────────────
; installer.nsh — Script NSIS personnalisé pour To-DoX
; Ajoute une checkbox "Lancer au démarrage de Windows" sur la page de fin
; ─────────────────────────────────────────────────────────────────────────────

; La Function est définie DANS le macro customHeader (pas au niveau du fichier).
; Ainsi, !ifndef BUILD_UNINSTALLER est évalué lors de !insertmacro customHeader
; dans le script principal — après propagation des defines CLI — et non au
; moment du !include où les defines peuvent ne pas encore être visibles.
!macro customHeader
  !ifndef BUILD_UNINSTALLER
    !define MUI_FINISHPAGE_SHOWREADME ""
    !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
    !define MUI_FINISHPAGE_SHOWREADME_TEXT "Lancer To-DoX au démarrage de Windows"
    !define MUI_FINISHPAGE_SHOWREADME_FUNCTION todox_AddToStartup

    Function todox_AddToStartup
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
        "To-DoX" '"$INSTDIR\To-DoX.exe"'
    FunctionEnd
  !endif
!macroend

; Nettoyage à la désinstallation (supprime l'entrée si présente)
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "To-DoX"
!macroend
