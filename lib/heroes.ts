import rawHeroes from "@/data/heroes.json";
import { Hero, PrimaryAttr } from "./types";

export const ALL_HEROES: Hero[] = rawHeroes as Hero[];

export const HERO_MAP: Record<number, Hero> = Object.fromEntries(
  ALL_HEROES.map((h) => [h.id, h])
);

export function getHeroById(id: number): Hero | undefined {
  return HERO_MAP[id];
}

export const ATTR_LABELS: Record<PrimaryAttr, { label: string; color: string; bg: string; border: string }> = {
  str: { label: "Strength", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  agi: { label: "Agility", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  int: { label: "Intelligence", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  all: { label: "Universal", color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30" },
};

export const COMMON_ROLES = [
  "Carry",
  "Support",
  "Nuker",
  "Disabler",
  "Initiator",
  "Durable",
  "Escape",
  "Pusher",
];
