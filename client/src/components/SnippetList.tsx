import React from "react";
import { Button } from "./ui/button";
import { Copy, Edit, Trash2 } from "lucide-react";

interface SnippetListProps {
  items: Array<any>;
  type: "snippet" | "clipboard";
  onCopy: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  selectedIndex?: number;
  setSelectedIndex?: (index: number) => void;
}

export default function SnippetList({ items, type, onCopy, onEdit, onDelete, selectedIndex, setSelectedIndex }: SnippetListProps) {
  return (
    <ul className="space-y-1">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={`group flex items-center gap-3 px-4 py-4 rounded-xl cursor-pointer select-none transition-all duration-200 text-[16px] font-sans
            ${selectedIndex === index ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 shadow-lg" : "hover:bg-slate-800/50 border border-transparent"}
          `}
          onClick={() => onCopy(item)}
          onMouseEnter={() => setSelectedIndex && setSelectedIndex(index)}
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: 16 }}
        >
          <div className="flex-1 min-w-0">
            <div className="truncate font-semibold text-white text-lg leading-5">
              {type === "snippet" ? item.title : item.content.slice(0, 40) + (item.content.length > 40 ? "…" : "")}
            </div>
            {type === "snippet" && (
              <div className="text-slate-400 text-sm truncate mt-1">{item.content.length > 80 ? item.content.slice(0, 80) + "…" : item.content}</div>
            )}
            {type === "clipboard" && (
              <div className="text-slate-400 text-xs mt-1">{new Date(item.createdAt).toLocaleString()}</div>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); onCopy(item); }} className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/20 rounded-lg" tabIndex={-1}>
              <Copy className="h-4 w-4" />
            </Button>
            {onEdit && type === "snippet" && (
              <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); onEdit(item); }} className="h-8 w-8 text-slate-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg" tabIndex={-1}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); onDelete(item.id); }} className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg" tabIndex={-1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
} 