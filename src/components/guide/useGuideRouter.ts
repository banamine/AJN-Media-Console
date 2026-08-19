import { useState, useEffect } from "react";

export type GuideView = "hub" | "schedule" | "search";

export function useGuideRouter() {
  const [currentView, setCurrentView] = useState<GuideView>(() => {
    const path = window.location.pathname;
    if (path.startsWith("/guide/schedule")) return "schedule";
    if (path.startsWith("/guide/search")) return "search";
    return "hub";
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith("/guide/schedule")) setCurrentView("schedule");
      else if (path.startsWith("/guide/search")) setCurrentView("search");
      else setCurrentView("hub");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (view: GuideView, params?: Record<string, string>) => {
    setCurrentView(view);
    const searchParams = new URLSearchParams(window.location.search);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) searchParams.set(k, v);
        else searchParams.delete(k);
      });
    }
    const qs = searchParams.toString();
    const hash = window.location.hash;
    const newUrl = `/guide${view === "hub" ? "" : `/${view}`}${qs ? `?${qs}` : ""}${hash}`;
    window.history.pushState({}, "", newUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return { currentView, navigateTo };
}
