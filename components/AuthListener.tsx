"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthListener() {
  const router = useRouter();

  useEffect(() => {
    // This listens for ANY change in auth (Sign In, Sign Out, User Deleted)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event);
      
      if (session) {
        // Check if the user actually exists in the DB
        const { data, error } = await supabase.auth.getUser();
        
        if (error || !data.user) {
          console.warn("Session exists but user not found in DB. Logging out...");
          await supabase.auth.signOut();
          router.push("/"); // Using / as the login page based on project structure
          router.refresh();
        }
      } else {
        // No session at all
        router.push("/"); 
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
