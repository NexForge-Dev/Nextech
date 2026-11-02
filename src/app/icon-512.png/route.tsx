import { appIcon } from "@/lib/brand/app-icon";

export const dynamic = "force-static";

export function GET() {
  return appIcon(512);
}
