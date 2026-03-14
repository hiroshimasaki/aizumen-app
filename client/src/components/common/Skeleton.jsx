import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-800/50",
        className
      )}
      {...props}
    />
  );
}

export function QuotationCardSkeleton() {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 h-[200px] flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="w-20 h-6 rounded-full" />
      </div>
      <div className="flex-1 space-y-3 mt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-slate-700/30">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}
