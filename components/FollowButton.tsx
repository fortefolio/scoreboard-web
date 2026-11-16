"use client";

import React from "react";
import { useAuth } from "@/components/AuthProvider";
import { useFollow } from "@/lib/hooks/useFollow";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import SportIcon from "@/components/SportIcon";

interface FollowButtonProps {
  entityId: string;
  entityType: "match" | "tournament";
  variant?: "icon" | "button" | "pill" | "sport-box";
  icon?: React.ReactNode;
  className?: string;
  onFollowToggle?: (following: boolean) => void;
  // Custom hook instance if shared across parent list
  followHook?: ReturnType<typeof useFollow>;
}

export function FollowButton({
  entityId,
  entityType,
  variant = "icon",
  icon,
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

  if (variant === "sport-box") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isUpdating}
        title={following ? t("common.following") : t("common.follow")}
        aria-label={following ? t("common.following") : t("common.follow")}
        aria-pressed={following}
        className={`relative w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          following
            ? "bg-text-primary text-surface-container-lowest border-text-primary shadow-sm"
            : "bg-surface-container-high border-outline-variant text-text-muted hover:text-text-primary hover:border-outline"
        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        {icon}
        <span
          aria-hidden="true"
          className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full ring-2 ring-surface-container flex items-center justify-center transition-colors ${
            following
              ? "bg-text-primary text-surface-container-lowest"
              : "bg-surface-container border border-outline-variant text-text-muted"
          }`}
        >
          <span
            className="material-symbols-outlined leading-none"
            style={{
              fontSize: "10px",
              fontVariationSettings: following ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            star
          </span>
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

/**
 * Reusable compound icon button combining a sport icon with a corner favorite
 * star badge so lists, cards, and detail headers stay consistent.
 */
export function SportFavoriteButton({
  entityId,
  entityType,
  sport,
  size = "md",
  className = "",
  followHook,
}: {
  entityId: string;
  entityType: "match" | "tournament";
  sport?: string | null;
  size?: "sm" | "md";
  className?: string;
  followHook?: ReturnType<typeof useFollow>;
}) {
  const sizeClass = size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const iconClass = size === "sm" ? "text-[18px]" : "text-[20px]";

  return (
    <FollowButton
      entityId={entityId}
      entityType={entityType}
      variant="sport-box"
      followHook={followHook}
      className={`${sizeClass} ${className}`}
      icon={<SportIcon sport={sport} className={iconClass} />}
    />
  );
}
