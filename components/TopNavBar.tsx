"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import NotificationBell from "./NotificationBell";

export default function TopNavBar() {
  const { user, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setIsMenuOpen(false);
    await signOut();
  };

  const navLinks = user ? [
    { name: "Matches", href: "/#matches" },
    { name: "Tournaments", href: "/#tournaments" },
  ] : [];

  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl shadow-2xl shadow-indigo-500/5 transition-all duration-300 ease-out border-b border-white/5">
      <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto font-headline tracking-tight">
        <Link href="/" className="text-4xl font-digital text-white tracking-tighter hover:scale-105 transition-transform">
          SCORE:BOARD
        </Link>

        <div className="flex gap-4 md:gap-8 items-center">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-slate-400 hover:text-indigo-300 transition-colors transition-all duration-300 ease-out active:scale-95 text-[10px] md:text-sm font-black uppercase tracking-widest"
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex gap-6 items-center">
          {user && <NotificationBell />}

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 group focus:outline-none"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black group-hover:border-indigo-400/50 transition-all overflow-hidden">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.email?.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-white transition-colors">
                  {isMenuOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Signed in as</p>
                    <p className="text-xs font-bold text-white truncate">{user.email}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => { setIsMenuOpen(false); router.push('/settings'); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">settings</span>
                      Settings
                    </button>
                    <button
                      onClick={() => { setIsMenuOpen(false); router.push('/my-matches'); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all mt-1"
                    >
                      <span className="material-symbols-outlined text-lg">sports_tennis</span>
                      My Matches
                    </button>
                    <button
                      onClick={() => { setIsMenuOpen(false); router.push('/my-tournaments'); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all mt-1"
                    >
                      <span className="material-symbols-outlined text-lg">emoji_events</span>
                      My Tournaments
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all mt-1"
                    >
                      <span className="material-symbols-outlined text-lg">logout</span>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-4">
               <Link
                 href="/?auth=signup"
                 className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500/10 hover:text-indigo-300 transition-all duration-300 ease-out active:scale-95 shadow-lg shadow-indigo-500/20"
               >
                 Get Started
               </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
