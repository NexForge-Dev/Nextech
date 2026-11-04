"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMarket } from "@/actions/store/preferences";

export function MarketSelector({ current, options, label }: { current: string; options: { code: string; name: string }[]; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const list = options.some((o) => o.code === current) ? options : [{ code: current, name: current }, ...options];
  return (
    <label className="inline-flex items-center gap-2 text-sm text-white/60">
      {label}
      <select
        value={current}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const r = await setMarket(e.target.value);
            if (r.ok) router.refresh();
          })
        }
        className="h-9 cursor-pointer rounded-md border border-line bg-white px-2 text-sm text-black outline-none focus:border-black"
      >
        {list.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
