"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  snapshots: string[]; // ISO dates YYYY-MM-DD, newest first
  selected: string | null; // null = latest
}

export default function SnapshotPicker({ snapshots, selected }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (snapshots.length === 0) return null;

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === "latest") params.delete("snapshot");
    else params.set("snapshot", e.target.value);
    const qs = params.toString();
    router.push(`/travels${qs ? `?${qs}` : ""}`);
  };

  return (
    <label className="flex flex-row items-center gap-1 text-xs ink-muted">
      <span>viewing</span>
      <select
        value={selected ?? "latest"}
        onChange={onChange}
        className="bg-[rgba(246,241,230,0.9)] border border-[rgba(18,18,18,0.25)] px-1 py-[1px] text-xs ink-body"
      >
        <option value="latest">latest</option>
        {snapshots.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </label>
  );
}
