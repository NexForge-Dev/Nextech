import { Link } from "@/i18n/navigation";

export function Logo({ name = "NEXTECH", logoUrl, className = "text-black" }: { name?: string; logoUrl?: string | null; className?: string }) {
  return (
    <Link href="/" aria-label={name} className={`wordmark inline-flex min-h-11 items-center text-xl leading-none md:min-h-0 md:text-2xl ${className}`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo of unknown aspect ratio
        <img src={logoUrl} alt={name} className="h-7 w-auto" />
      ) : (
        name.toUpperCase()
      )}
    </Link>
  );
}
