"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MidDrillPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/lane/2/drill");
  }, [router]);

  return (
    <div className="max-w-md mx-auto p-12 text-center text-slate-400 space-y-4">
      <p>Redirecting to Mid Lane Drill...</p>
      <Link href="/lane/2/drill" className="text-sm text-[#d8b57a] hover:underline">
        Click here if not redirected
      </Link>
    </div>
  );
}
