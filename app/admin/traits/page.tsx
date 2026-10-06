"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { ALL_HEROES } from "@/lib/heroes";
import rawTraits from "@/data/traits.json";
import { ALLOWED_TAGS, TraitTag, DamageType, HeroTrait } from "@/lib/types";
import { Sliders, Download, Copy, Check } from "lucide-react";
import { Button, SearchInput, Badge, Card } from "@/components/ui";

const initialTraitsMap = rawTraits as Record<string, HeroTrait>;

export default function AdminTraitsPage() {
  const [traits, setTraits] = useState<Record<string, HeroTrait>>(initialTraitsMap);
  const [selectedHeroId, setSelectedHeroId] = useState<number>(17); // Default Storm Spirit
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const activeHero = ALL_HEROES.find((h) => h.id === selectedHeroId) || ALL_HEROES[0];
  const activeTrait = traits[String(activeHero.id)] || {
    heroId: activeHero.id,
    heroName: activeHero.name,
    localized_name: activeHero.localized_name,
    tags: [],
    dmgType: "magical" as DamageType,
    lanePlan: { harass: "", waveclear: "", level6: "", runeControl: "" },
  };

  const filteredHeroes = useMemo(() => {
    if (!search.trim()) return ALL_HEROES;
    const q = search.toLowerCase();
    return ALL_HEROES.filter(
      (h) => h.localized_name.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)
    );
  }, [search]);

  const handleToggleTag = (tag: TraitTag) => {
    const currentTags = new Set(activeTrait.tags);
    if (currentTags.has(tag)) currentTags.delete(tag);
    else currentTags.add(tag);

    const updated = {
      ...traits,
      [String(activeHero.id)]: {
        ...activeTrait,
        tags: Array.from(currentTags),
      },
    };
    setTraits(updated);
  };

  const handleChangeDmg = (dmgType: DamageType) => {
    const updated = {
      ...traits,
      [String(activeHero.id)]: {
        ...activeTrait,
        dmgType,
      },
    };
    setTraits(updated);
  };

  const handleLanePlanChange = (field: keyof HeroTrait["lanePlan"], value: string) => {
    const updated = {
      ...traits,
      [String(activeHero.id)]: {
        ...activeTrait,
        lanePlan: {
          ...activeTrait.lanePlan,
          [field]: value,
        },
      },
    };
    setTraits(updated);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(traits, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "traits.overrides.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(traits, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-bold uppercase tracking-wider">
              Dev Only
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sliders className="w-6 h-6 text-sky-400" />
              Hero Traits & Lane Plans Manager
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Configure tags and lane plans for each hero. Changes can be exported to <code className="text-sky-400">traits.overrides.json</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportJson}
            leftIcon={<Download className="w-4 h-4" />}
            size="sm"
          >
            Export traits.overrides.json
          </Button>
          <Button
            onClick={handleCopyJson}
            variant="secondary"
            size="sm"
            leftIcon={copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? "Copied JSON!" : "Copy JSON"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Hero Selector List */}
        <div className="lg:col-span-4 bg-[#101622] border border-[#1e283d] rounded-xl p-4 flex flex-col h-[750px]">
          <div className="mb-3">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search heroes..."
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filteredHeroes.map((hero) => {
              const isSelected = hero.id === activeHero.id;
              const hTrait = traits[String(hero.id)];
              const tagCount = hTrait?.tags?.length || 0;

              return (
                <button
                  key={hero.id}
                  onClick={() => setSelectedHeroId(hero.id)}
                  type="button"
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                    isSelected
                      ? "bg-slate-800 border border-sky-500/50 shadow"
                      : "hover:bg-slate-900 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative w-8 h-5 rounded overflow-hidden shrink-0">
                      <Image src={hero.img} alt={hero.localized_name} fill className="object-cover" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {hero.localized_name}
                    </span>
                  </div>

                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-mono">
                    {tagCount} tags
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Editor Panel */}
        <div className="lg:col-span-8 bg-[#101622] border border-[#1e283d] rounded-xl p-6 space-y-6 overflow-y-auto max-h-[750px]">
          {/* Hero Header */}
          <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
            <div className="relative w-20 h-12 rounded-lg overflow-hidden border border-slate-700 shadow-md">
              <Image src={activeHero.img} alt={activeHero.localized_name} fill className="object-cover" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{activeHero.localized_name}</h2>
              <span className="text-xs text-slate-400 font-mono">{activeHero.name}</span>
            </div>
          </div>

          {/* Damage Type */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Primary Damage Type
            </label>
            <div className="flex flex-wrap gap-2">
              {(["physical", "magical", "pure", "mixed"] as DamageType[]).map((d) => (
                <button
                  key={d}
                  onClick={() => handleChangeDmg(d)}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                    activeTrait.dmgType === d
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow"
                      : "bg-[#0c1018] text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Tags Multi-Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Trait Tags ({activeTrait.tags.length} selected)
              </label>
              <span className="text-[11px] text-slate-500">Allowed tags per spec</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {ALLOWED_TAGS.map((tag) => {
                const isChecked = activeTrait.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    type="button"
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                      isChecked
                        ? "bg-sky-500/20 border-sky-400 text-sky-200 font-semibold"
                        : "bg-[#0c1018] border-slate-800/80 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span className="truncate">{tag}</span>
                    <span className="ml-1 text-[10px]">{isChecked ? "✓" : "+"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lane Plan Notes */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Generated Lane Plan Template
            </label>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold text-slate-400">Harass & Trades:</span>
                <textarea
                  value={activeTrait.lanePlan?.harass || ""}
                  onChange={(e) => handleLanePlanChange("harass", e.target.value)}
                  rows={2}
                  className="w-full mt-1 bg-[#0c1018] border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400">Waveclear & Pushing:</span>
                <textarea
                  value={activeTrait.lanePlan?.waveclear || ""}
                  onChange={(e) => handleLanePlanChange("waveclear", e.target.value)}
                  rows={2}
                  className="w-full mt-1 bg-[#0c1018] border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400">Level 6 Power Spike:</span>
                <textarea
                  value={activeTrait.lanePlan?.level6 || ""}
                  onChange={(e) => handleLanePlanChange("level6", e.target.value)}
                  rows={2}
                  className="w-full mt-1 bg-[#0c1018] border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400">Rune Control:</span>
                <textarea
                  value={activeTrait.lanePlan?.runeControl || ""}
                  onChange={(e) => handleLanePlanChange("runeControl", e.target.value)}
                  rows={2}
                  className="w-full mt-1 bg-[#0c1018] border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
