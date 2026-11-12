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
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer border ${
          following
            ? "bg-surface-container-highest text-text-primary border-outline shadow-sm"
            : "bg-surface-container-high hover:bg-surface-container-highest text-text-muted hover:text-text-primary border-outline-variant"
        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        <span
          className={`material-symbols-outlined text-[18px] transition-transform ${
            following ? "text-text-primary scale-105" : "text-text-muted"
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
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer border ${
        following
          ? "bg-surface-container-highest text-text-primary border-outline shadow-sm"
          : "text-text-muted hover:text-text-primary hover:bg-surface-container-high border-transparent hover:border-outline-variant"
      } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      <span
        className={`material-symbols-outlined text-[17px] transition-transform ${
          following ? "text-text-primary scale-105" : ""
        }`}
        style={following ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        star
      </span>
    </button>
  );
}
