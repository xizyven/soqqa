import { STRATEGIES } from "@/lib/strategies";
import { StrategyDetail } from "@/components/strategies/detail";

export function generateStaticParams() {
  return STRATEGIES.map((s) => ({ slug: s.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StrategyDetail slug={slug} />;
}
