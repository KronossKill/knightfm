"use client";
// Knight FM — shared "active club" hook (Task 23-e, user mandate).
//
// "Cada club es independiente del otro en todos los aspectos aunque sean del
// mismo propietario." Every module view must operate on the club the user
// picked in the top-bar switcher (view-store.activeClubId) — NEVER blindly on
// clubs[0]. The facilities view used to ignore the switcher, so upgrading one
// club's facilities could appear on another; this hook is the single source of
// truth now (facilities, staff, youth, competitions all consume it).

import { useQuery } from "@tanstack/react-query";
import { useViewStore } from "@/components/game/view-store";
import { fetchMyClubs, qk, type ClubMine } from "@/components/game/api";

export function useActiveClub() {
  const activeClubId = useViewStore((s) => s.activeClubId);
  const clubsQ = useQuery({ queryKey: qk.myClubs, queryFn: fetchMyClubs });
  const clubs: ClubMine[] = clubsQ.data?.clubs ?? [];
  const club = clubs.find((c) => c.id === activeClubId) ?? clubs[0] ?? null;
  return { clubs, club, isLoading: clubsQ.isLoading, activeClubId };
}
