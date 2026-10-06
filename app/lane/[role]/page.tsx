import LaneMatrixClient from "./LaneMatrixClient";

export function generateStaticParams() {
  return [
    { role: "1" },
    { role: "2" },
    { role: "3" },
    { role: "4" },
    { role: "5" },
  ];
}

export default async function LaneMatrixPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  return <LaneMatrixClient roleParam={role} />;
}
