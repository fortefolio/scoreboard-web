"use client";

export function SkeletonBox({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-container-highest ${className}`}
    />
  );
}

export function MatchListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" data-testid="web-match-list-skeleton">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-outline-variant bg-surface-container p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-5 w-2/5" />
            <SkeletonBox className="h-6 w-10" />
          </div>
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-5 w-1/3" />
            <SkeletonBox className="h-6 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TournamentListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="web-tournament-list-skeleton">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-outline-variant bg-surface-container p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-4 w-20" />
            <SkeletonBox className="h-5 w-16 rounded-full" />
          </div>
          <SkeletonBox className="h-6 w-3/4" />
          <SkeletonBox className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="min-h-screen bg-background py-6 sm:py-8 px-4 sm:px-8" data-testid="web-detail-skeleton">
      <div className="max-w-4xl mx-auto space-y-6">
        <SkeletonBox className="h-4 w-28" />
        <div className="space-y-2">
          <SkeletonBox className="h-8 w-56" />
          <SkeletonBox className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <SkeletonBox className="h-9 w-24 rounded-lg" />
          <SkeletonBox className="h-9 w-28 rounded-lg" />
          <SkeletonBox className="h-9 w-28 rounded-lg" />
        </div>
        <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 sm:p-8 space-y-4">
          <SkeletonBox className="h-6 w-44" />
          <SkeletonBox className="h-10 w-full max-w-md" />
          <SkeletonBox className="h-10 w-full max-w-md" />
          <SkeletonBox className="h-10 w-36" />
        </div>
      </div>
    </div>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" data-testid="web-notification-list-skeleton">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-outline-variant bg-surface-container p-4 flex items-center gap-3"
        >
          <SkeletonBox className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-4 w-3/4" />
            <SkeletonBox className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
