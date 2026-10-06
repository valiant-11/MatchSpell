"use client";

import { use, useState } from "react";
import Link from "next/link";
import { getHeroById, ALL_HEROES, ATTR_LABELS } from "@/lib/heroes";
import { ItemPriorityPanel } from "@/components/ItemPriorityPanel";
import { HeroPortrait } from "@/components/HeroPortrait";
import {
  Button,
  IconButton,
  Badge,
  Card,
  CardContent,
  Dialog,
  SearchInput,
} from "@/components/ui";
import { ArrowLeft, Plus, X, Search } from "lucide-react";

export default function DraftHeroItemPage({ params }: { params: Promise<{ heroId: string }> }) {
  const resolvedParams = use(params);
  const heroId = parseInt(resolvedParams.heroId, 10);
  const hero = getHeroById(heroId);

  const [enemyHeroIds, setEnemyHeroIds] = useState<number[]>([11, 8, 17]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (!hero) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-rose-400">Hero not found</h1>
        <Link href="/draft" className="text-sm text-[var(--color-accent)] hover:underline">
          Return to Draft Helper
        </Link>
      </div>
    );
  }

  const attr = ATTR_LABELS[hero.primary_attr] || ATTR_LABELS.all;

  const filteredEnemies = ALL_HEROES.filter(
    (h) =>
      !enemyHeroIds.includes(h.id) &&
      (h.localized_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back Link */}
      <Link
        href="/draft"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text-dim)] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Draft Helper
      </Link>

      {/* Hero Header Card */}
      <Card variant="raised" className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <HeroPortrait
              src={hero.img}
              alt={hero.localized_name}
              size="lg"
              aspectRatio="video"
              glow
            />

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-white">{hero.localized_name}</h1>
                <Badge variant="outline" size="sm">
                  {attr.label}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-text-dim)]">
                {hero.attack_type} • Roles: {hero.roles.join(", ")}
              </p>
            </div>
          </div>

          {/* Enemy Lineup Header Quick Bar */}
          <div className="flex flex-col items-start md:items-end gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              Enemy Lineup Context ({enemyHeroIds.length} heroes):
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {enemyHeroIds.map((eId) => {
                const eHero = getHeroById(eId);
                if (!eHero) return null;
                return (
                  <div
                    key={eId}
                    className="relative group rounded overflow-hidden border border-[var(--color-border)] w-9 h-6 cursor-pointer"
                    title={`Remove ${eHero.localized_name}`}
                  >
                    <HeroPortrait src={eHero.img} alt={eHero.localized_name} size="xs" aspectRatio="video" />
                    <button
                      type="button"
                      onClick={() => setEnemyHeroIds(enemyHeroIds.filter((id) => id !== eId))}
                      aria-label={`Remove ${eHero.localized_name}`}
                      className="absolute inset-0 bg-rose-950/90 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              <IconButton
                icon={<Plus className="w-3.5 h-3.5" />}
                label="Add enemy to test counter rules"
                size="sm"
                variant="outline"
                onClick={() => setShowAddModal(true)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Item Priorities Container */}
      <Card variant="panel" className="p-6">
        <ItemPriorityPanel candidateHero={hero} enemyHeroIds={enemyHeroIds} />
      </Card>

      {/* Add Enemy Dialog */}
      <Dialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Enemy Hero to Test Counter Rules"
        description="Select an enemy hero to evaluate conditional itemization rules."
      >
        <div className="space-y-4">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search enemy heroes..."
          />
          <div className="max-h-[50vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
            {filteredEnemies.slice(0, 36).map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  setEnemyHeroIds([...enemyHeroIds, h.id]);
                  setShowAddModal(false);
                }}
                className="flex items-center gap-2 p-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-border)] hover:border-rose-500 hover:bg-rose-950/20 text-left transition-all"
              >
                <HeroPortrait src={h.img} alt={h.localized_name} size="xs" aspectRatio="video" />
                <span className="text-xs text-slate-200 truncate">{h.localized_name}</span>
              </button>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
