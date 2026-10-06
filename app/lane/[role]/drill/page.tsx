import LaneDrillClient from "./LaneDrillClient";

export function generateStaticParams() {
  return [
    { role: "1" },
    { role: "2" },
    { role: "3" },
    { role: "4" },
    { role: "5" },
  ];
}

export default async function LaneDrillPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  return <LaneDrillClient roleParam={role} />;
}
