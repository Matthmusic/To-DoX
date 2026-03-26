import { ExternalLink } from "lucide-react";
import {
  getLinkedPartDisplayName,
  parseFilePaths,
  type ParsedTextPart,
} from "../utils/taskLinks";

interface LinkedTextContentProps {
  text: string;
  textClassName?: string;
}

function openLinkedPart(part: Exclude<ParsedTextPart, { type: 'text' }>) {
  if (part.targetType === 'url') {
    if (window.electronAPI?.openExternalUrl) {
      void window.electronAPI.openExternalUrl(part.content);
      return;
    }

    window.open(part.content, '_blank', 'noopener,noreferrer');
    return;
  }

  if (window.electronAPI?.openFolder) {
    void window.electronAPI.openFolder(part.content);
    return;
  }

  window.alert(`Chemin detecte: ${part.content}\n(Disponible uniquement en mode Electron)`);
}

function copyLinkedPart(content: string) {
  void navigator.clipboard.writeText(content);
}

function getBadgeClassName(part: Exclude<ParsedTextPart, { type: 'text' }>): string {
  if (part.type === 'outlook') {
    return "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200 border border-amber-500/30";
  }

  if (part.type === 'path') {
    return "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-blue-200 border border-blue-500/30";
  }

  return "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 border border-emerald-500/30";
}

function getLinkTitle(part: Exclude<ParsedTextPart, { type: 'text' }>): string {
  return `${part.targetType === 'url' ? 'Ouvrir' : 'Ouvrir'} : ${part.content}\nClic droit : copier`;
}

export function LinkedTextContent({ text, textClassName = "text-slate-300" }: LinkedTextContentProps) {
  return (
    <>
      {parseFilePaths(text).map((part, idx) => {
        if (part.type === 'text') {
          return (
            <span key={idx} className={textClassName}>
              {part.content}
            </span>
          );
        }

        return (
          <button
            key={idx}
            type="button"
            data-link-type={part.type}
            onClick={(e) => {
              e.stopPropagation();
              openLinkedPart(part);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copyLinkedPart(part.content);
            }}
            className={`inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded transition text-xs ${getBadgeClassName(part)} ${part.targetType === 'path' ? 'font-mono' : ''}`}
            title={getLinkTitle(part)}
          >
            <ExternalLink className="h-3 w-3" />
            {getLinkedPartDisplayName(part)}
          </button>
        );
      })}
    </>
  );
}
