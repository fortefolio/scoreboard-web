"use client";

import React from "react";
import { useAuth } from "@/components/AuthProvider";
import { useFollow } from "@/lib/hooks/useFollow";

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

  if (variant === "button") {
    return (
      <button
        onClick={handleClick}
        disabled={isUpdating}
        title={following ? "Remover dos favoritos" : "Seguir"}
        aria-label={following ? "Remover dos favoritos" : "Seguir"}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
          following
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 shadow-lg shadow-amber-500/10"
            : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white"
        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        <span
          className={`material-symbols-outlined text-[16px] transition-transform ${
            following ? "fill-1 text-amber-400 scale-110" : "text-slate-400"
          }`}
          style={following ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {following ? "star" : "star"}
        </span>
        <span>{following ? "A Seguir" : "Seguir"}</span>
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        onClick={handleClick}
        disabled={isUpdating}
        title={following ? "Remover dos favoritos" : "Seguir"}
        aria-label={following ? "Remover dos favoritos" : "Seguir"}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
          following
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
            : "bg-surface-container-high/60 text-slate-400 border border-white/5 hover:border-white/20 hover:text-white"
        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        <span
          className={`material-symbols-outlined text-[13px] ${
            following ? "text-amber-400" : "text-slate-400"
          }`}
          style={following ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          star
        </span>
        <span>{following ? "Favorito" : "Seguir"}</span>
      </button>
    );
  }

  // Default: "icon"
  return (
    <button
      onClick={handleClick}
      disabled={isUpdating}
      title={following ? "Remover dos favoritos" : "Seguir"}
      aria-label={following ? "Remover dos favoritos" : "Seguir"}
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
