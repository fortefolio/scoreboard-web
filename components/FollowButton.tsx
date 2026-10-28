"use client";

import React from "react";
import { useAuth } from "@/components/AuthProvider";
import { useFollow } from "@/lib/hooks/useFollow";
import { useTranslation } from "@/lib/i18n/LanguageContext";

interface FollowButtonProps {
  entityId: string;
  entityType: "match" | "tournament";
  variant?: "icon" | "button" | "pill";
  className?: string;
  onFollowToggle?: (following: boolean) => void;
  // Custom hook instance if shared across parent list
  followHook?: ReturnType<typeof useFollow>;
}

export function FollowButton({
  entityId,
  entityType,
  variant = "icon",
  className = "",
  onFollowToggle,
  followHook,
}: FollowButtonProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const internalHook = useFollow();
  const { isFollowing, toggleFollow, updatingIds } = followHook || internalHook;

  const following = isFollowing(entityId, entityType);
  const isUpdating = updatingIds.has(`${entityType}:${entityId}`);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      // Trigger login prompt or redirect if needed
      window.location.href = `/?auth=login&redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    const nextState = await toggleFollow(entityId, entityType);
    if (onFollowToggle) {
      onFollowToggle(nextState);
    }
  };

  if (variant === "pill" || variant === "button") {
    return (
      <button
        onClick={handleClick}
        disabled={isUpdating}
        title={following ? t("common.following") : t("common.follow")}
        aria-label={following ? t("common.following") : t("common.follow")}
        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer backdrop-blur-md shadow-sm ${
          following
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/10 hover:bg-amber-500/30"
            : "bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-on-surface border border-white/10"
        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        <span
          className={`material-symbols-outlined text-[20px] transition-transform ${
            following ? "text-amber-400 scale-110" : "text-slate-400"
          }`}
          style={following ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          star
        </span>
      </button>
    );
  }

  // Default: "icon"
  return (
    <button
      onClick={handleClick}
      disabled={isUpdating}
      title={following ? t("common.following") : t("common.follow")}
      aria-label={following ? t("common.following") : t("common.follow")}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
        following
          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10"
          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
      } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      <span
        className={`material-symbols-outlined text-[18px] transition-transform ${
          following ? "text-amber-400 scale-110" : ""
        }`}
        style={following ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        star
      </span>
    </button>
  );
}
