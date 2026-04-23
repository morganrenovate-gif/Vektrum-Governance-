import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for /dashboard/settings.
 *
 * Mirrors the SettingsShell layout:
 *   1. PageHeader (Settings eyebrow + title + description)
 *   2. Two-column layout: sidebar nav (4 tabs) + main form area
 *      - Sidebar: vertical on desktop, horizontal pills on mobile
 *      - Form area: card with field groups (Profile tab default view)
 */
export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="dash-page">

        {/* 1. Page header */}
        <div className="pb-7 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-4 w-[3px] rounded-full bg-white/[0.12] flex-shrink-0" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="h-9 w-52" />
          <Skeleton className="mt-2.5 h-3 w-80" />
        </div>

        {/* 2. Settings layout: sidebar + content */}
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10 pt-2">

          {/* Sidebar nav — horizontal pill row on mobile, vertical list on desktop */}
          <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:w-48 lg:flex-shrink-0">
            {/* Active tab — first one (Profile) */}
            <Skeleton className="h-10 w-28 lg:w-full rounded-lg bg-white/[0.10] flex-shrink-0" />
            {/* Inactive tabs */}
            {[28, 32, 24, 28].map((w, i) => (
              <Skeleton
                key={i}
                className={`h-10 rounded-lg flex-shrink-0 lg:w-full`}
                style={{ width: `${w * 4}px` }}
              />
            ))}
          </nav>

          {/* Main content — Profile tab skeleton */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Section: Personal info card */}
            <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-6 space-y-5">
              {/* Card header */}
              <div className="pb-4 border-b border-white/[0.06]">
                <Skeleton className="h-4 w-32 mb-1.5" />
                <Skeleton className="h-3 w-56" />
              </div>

              {/* Form fields — 2-col grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { label: "w-20", input: "w-full" },
                  { label: "w-16", input: "w-full" },
                  { label: "w-24", input: "w-full" },
                  { label: "w-14", input: "w-full" },
                ].map((f, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className={`h-2.5 ${f.label}`} />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                ))}
              </div>

              {/* Email — full width, read-only look */}
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-10 w-full rounded-lg opacity-50" />
              </div>

              {/* Save button */}
              <div className="flex justify-end pt-1">
                <Skeleton className="h-9 w-28 rounded-lg" />
              </div>
            </div>

            {/* Section: Role info card */}
            <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-6 space-y-3">
              <div className="pb-3 border-b border-white/[0.06]">
                <Skeleton className="h-4 w-24 mb-1.5" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2.5 w-44" />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
