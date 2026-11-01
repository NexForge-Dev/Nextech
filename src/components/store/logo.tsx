import { Link } from "@/i18n/navigation";

export function Logo({ name = "NEXTECH", logoUrl, className = "" }: { name?: string; logoUrl?: string | null; className?: string }) {
  return (
    <Link href="/" aria-label={name} className={`wordmark text-xl leading-none text-black md:text-[1.375rem] ${className}`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo of unknown aspect ratio
        <img src={logoUrl} alt={name} className="h-7 w-auto" />
      ) : (
        name.toUpperCase()
      )}
    </Link>
  );
}
