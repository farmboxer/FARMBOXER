import { Badge } from "@/components/ui/badge";

export function DemoBanner({ extra }: { extra?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      <Badge tone="sample">演示数据</Badge>
      <span>
        种子目录、会话与情报均为样本，非正式财报或真实成交。所有报价引擎遵守可配置毛利底线（默认
        15%）。
      </span>
      {extra ? <span className="text-amber-800">{extra}</span> : null}
    </div>
  );
}
