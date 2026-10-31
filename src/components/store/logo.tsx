import { Link } from "@/i18n/navigation";

export function Logo({ name = "NEXTECH", className = "" }: { name?: string; className?: string }) {
  return (
    <Link href="/" aria-label={name} className={`wordmark text-xl leading-none text-black md:text-[1.375rem] ${className}`}>
      {name.toUpperCase()}
    </Link>
  );
}
