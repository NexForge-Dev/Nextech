import {
  Baby, Bike, Book, Camera, Car, Coffee, Cpu, Dog, Dumbbell, Gamepad2, Gift, Glasses, Hammer, Headphones,
  Heart, Home, Laptop, Lamp, Monitor, Mouse, Music, Package, Palette, Plane, Plug, Printer, Refrigerator,
  Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, Tablet, Tag, Tent, Trophy, Tv, Utensils, Watch, Wrench,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICON_MAP = {
  Baby, Bike, Book, Camera, Car, Coffee, Cpu, Dog, Dumbbell, Gamepad2, Gift, Glasses, Hammer, Headphones,
  Heart, Home, Laptop, Lamp, Monitor, Mouse, Music, Package, Palette, Plane, Plug, Printer, Refrigerator,
  Shirt, ShoppingBag, Smartphone, Sofa, Sparkles, Tablet, Tag, Tent, Trophy, Tv, Utensils, Watch, Wrench,
} satisfies Record<string, LucideIcon>;

export type CategoryIconName = keyof typeof CATEGORY_ICON_MAP;
export const CATEGORY_ICONS = Object.keys(CATEGORY_ICON_MAP) as CategoryIconName[];

export function CategoryIcon({ name, className, strokeWidth = 1.5 }: { name: string; className?: string; strokeWidth?: number }) {
  const Icon = CATEGORY_ICON_MAP[name as CategoryIconName] ?? Package;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
