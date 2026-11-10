import {
  Baby, Banknote, Book, Briefcase, Car, CircleDashed, CirclePlus, Clapperboard, Coffee, Coins, CreditCard, Dog, Dumbbell, Fuel,
  Gamepad2, Gem, Gift, Globe, GraduationCap, HeartPulse, House, Landmark, Laptop, Music, Phone, PiggyBank, Plane, Repeat, Shield,
  Shirt, ShoppingBag, ShoppingCart, Smartphone, Store, Target, TrendingUp, Utensils, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "credit-card": CreditCard, banknote: Banknote, "piggy-bank": PiggyBank, wallet: Wallet, landmark: Landmark, smartphone: Smartphone,
  globe: Globe, coins: Coins, briefcase: Briefcase, gem: Gem, utensils: Utensils, car: Car, "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart, home: House, zap: Zap, "graduation-cap": GraduationCap, clapperboard: Clapperboard,
  "heart-pulse": HeartPulse, repeat: Repeat, plane: Plane, "circle-dashed": CircleDashed, laptop: Laptop, store: Store,
  "trending-up": TrendingUp, gift: Gift, "circle-plus": CirclePlus, coffee: Coffee, dumbbell: Dumbbell, baby: Baby, dog: Dog,
  shirt: Shirt, fuel: Fuel, phone: Phone, wifi: Wifi, book: Book, music: Music, "gamepad-2": Gamepad2, wrench: Wrench,
  target: Target, shield: Shield,
};

export function Icon({ name, className, size = 16, strokeWidth = 1.75 }: { name: string; className?: string; size?: number; strokeWidth?: number }) {
  const C = ICONS[name] ?? CircleDashed;
  return <C className={className} size={size} strokeWidth={strokeWidth} aria-hidden />;
}

/** Rounded tinted tile with an icon — used for wallets, categories and goals. */
export function IconTile({ name, color, size = 36, iconSize }: { name: string; color: string; size?: number; iconSize?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[11px]"
      style={{ width: size, height: size, background: `color-mix(in oklab, ${color} 14%, transparent)`, color, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)` }}
    >
      <Icon name={name} size={iconSize ?? Math.round(size * 0.46)} />
    </span>
  );
}
