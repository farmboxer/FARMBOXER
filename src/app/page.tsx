"use client";

import { DemoBanner } from "@/components/demo-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/client";
import { formatPercent, formatRmb } from "@/lib/utils";
import { useEffect, useState } from "react";

type Dashboard = {
  path: {
    cagr: number;
    multiple: number;
    honestNote: string;
    ambitious: boolean;
    milestones: Array<{ year: number; salesRmb: number; minProfitRmb: number }>;
  };
  settings: { marginFloorPercent: number; currentSalesRmb: number; targetSalesRmb: number };
  stats: {
    contacts: number;
    products: number;
    knowledge: number;
    pendingApprovals: number;
    sentToday: number;
    pendingFindings: number;
  };
  alerts: Array<{ level: string; text: string }>;
  waMode: string;
  lastReview: { title: string; createdAt: string } | null;
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/api/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-stone-500">加载看板…</p>;

  const maxSales = Math.max(...data.path.milestones.map((m) => m.salesRmb));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-emerald-950">经营看板</h1>
        <p className="text-sm text-stone-600">FarmBoxer WhatsApp 经营中台 · 0.15 亿 → 10 亿 · 毛利底线 ≥15%</p>
      </div>
      <DemoBanner extra={`WhatsApp 模式：${data.waMode === "live" ? "真实 Cloud API" : "DEMO/MOCK"}`} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="当前销售假设" value={formatRmb(data.settings.currentSalesRmb, true)} hint="配置项，非正式财报" />
        <Kpi title="五年目标" value={formatRmb(data.settings.targetSalesRmb, true)} hint="10 亿人民币" />
        <Kpi title="所需 CAGR" value={formatPercent(data.path.cagr)} hint={`${data.path.multiple.toFixed(1)} 倍`} />
        <Kpi
          title="毛利底线"
          value={`${data.settings.marginFloorPercent}%`}
          hint="报价与自动回复硬约束"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>五年路径数学</CardTitle>
            <CardDescription>按复利倒推，不是已经完成的业绩。</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm leading-relaxed text-stone-700">{data.path.honestNote}</p>
            <div className="flex h-36 items-end gap-2">
              {data.path.milestones.map((m) => (
                <div key={m.year} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-emerald-800"
                    style={{ height: `${Math.max(8, (m.salesRmb / maxSales) * 120)}px` }}
                    title={formatRmb(m.salesRmb, true)}
                  />
                  <span className="text-[10px] text-stone-500">Y{m.year}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-500">
                    <th className="py-1">年</th>
                    <th>需达销售</th>
                    <th>对应最低利润</th>
                  </tr>
                </thead>
                <tbody>
                  {data.path.milestones.map((m) => (
                    <tr key={m.year} className="border-t border-stone-100">
                      <td className="py-1">Y{m.year}</td>
                      <td>{formatRmb(m.salesRmb, true)}</td>
                      <td>{formatRmb(m.minProfitRmb, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>运营快照</CardTitle>
            <CardDescription>仅统计本库已记录数据</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="客户档案" v={String(data.stats.contacts)} />
            <Row k="产品 SKU" v={String(data.stats.products)} />
            <Row k="知识库条目" v={String(data.stats.knowledge)} />
            <Row k="待批准回复" v={String(data.stats.pendingApprovals)} />
            <Row k="今日已发送" v={String(data.stats.sentToday)} />
            <Row k="待审情报" v={String(data.stats.pendingFindings)} />
            {data.lastReview ? (
              <p className="pt-2 text-xs text-stone-500">最近复盘：{data.lastReview.title}</p>
            ) : (
              <p className="pt-2 text-xs text-stone-500">尚未生成三日复盘</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>提醒</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.alerts.map((a) => (
            <div key={a.text} className="flex items-start gap-2 text-sm">
              <Badge tone={a.level === "warn" ? "warn" : "muted"}>{a.level === "warn" ? "注意" : "说明"}</Badge>
              <span>{a.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-stone-500">{title}</p>
        <p className="mt-1 text-2xl font-semibold text-emerald-950">{value}</p>
        <p className="text-xs text-stone-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
