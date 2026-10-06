import { ALL_HEROES } from "@/lib/heroes";
import DraftHeroItemClient from "./DraftHeroItemClient";

export function generateStaticParams() {
  return ALL_HEROES.map((h) => ({ heroId: String(h.id) }));
}

export default async function DraftHeroItemPage({
  params,
}: {
  params: Promise<{ heroId: string }>;
}) {
  const { heroId } = await params;
  return <DraftHeroItemClient heroIdParam={heroId} />;
}
