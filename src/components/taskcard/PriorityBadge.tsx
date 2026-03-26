/** Badge priorité rond : H / M / B */
export function PriorityBadge({ priority }: { priority: 'high' | 'med' | 'low' }) {
    return (
        <span className={`shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none border ${
            priority === 'high' ? 'bg-rose-500/30 text-rose-300 border-rose-500/50' :
            priority === 'med'  ? 'bg-amber-500/30 text-amber-300 border-amber-500/50' :
                                  'bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
        }`}>
            {priority === 'high' ? 'H' : priority === 'med' ? 'M' : 'B'}
        </span>
    );
}
