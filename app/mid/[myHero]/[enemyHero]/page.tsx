import { redirect } from "next/navigation";

export default async function MidMatchupPageRedirect({
  params,
}: {
  params: Promise<{ myHero: string; enemyHero: string }>;
}) {
  const { myHero, enemyHero } = await params;
  redirect(`/lane/2/${myHero}/${enemyHero}`);
}
