"use client";

import { DemoBanner } from "@/components/demo-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client";
import { useEffect, useState } from "react";

type Settings = {
  companyName: string;
  currentSalesRmb: number;
  targetSalesRmb: number;
  targetYears: number;
  marginFloorPercent: number;
  autoReplyEnabled: boolean;
  autoReplyConfidenceThreshold: number;
  waPhoneNumberId: string;
  waAccessToken: string;
  waVerifyToken: string;
  waBusinessAccountId: string;
  openaiCompatibleBaseUrl: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [meta, setMeta] = useState({ waMode: "demo", envHasOpenAi: false, envHasWa: false });
  const [msg, setMsg] = useState("");
  const [productCsv, setProductCsv] = useState(
    "name,sku,category,listPrice,floorPrice,cost,targetMarkets,solutionTags\n示例配件,FB-BLADE-01,配件,80,60,40,肯尼亚,刀片",
  );
  const [kbCsv, setKbCsv] = useState(
    "title,content,tags,category\n电压确认,先问 220V 还是 380V,电压,报价话术",
  );

  useEffect(() => {
    api<{ settings: Settings; waMode: string; envHasOpenAi: boolean; envHasWa: boolean }>("/api/settings")
      .then((d) => {
        setSettings(d.settings);
        setMeta({ waMode: d.waMode, envHasOpenAi: d.envHasOpenAi, envHasWa: d.envHasWa });
      })
      .catch((e) => setMsg(e.message));
  }, []);

  if (!settings) return <p className="text-sm text-stone-500">{msg || "加载设置…"}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-emerald-950">系统设置</h1>
      <DemoBanner extra={`当前 WhatsApp：${meta.waMode}；LLM：${meta.envHasOpenAi ? "已配置" : "模板回退"}`} />

      <Card>
        <CardHeader>
          <CardTitle>目标与毛利底线</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Field label="公司品牌">
            <Input
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            />
          </Field>
          <Field label="毛利底线 %">
            <Input
              type="number"
              value={settings.marginFloorPercent}
              onChange={(e) => setSettings({ ...settings, marginFloorPercent: Number(e.target.value) })}
            />
          </Field>
          <Field label="当前销售假设（元）">
            <Input
              type="number"
              value={settings.currentSalesRmb}
              onChange={(e) => setSettings({ ...settings, currentSalesRmb: Number(e.target.value) })}
            />
          </Field>
          <Field label="五年目标（元）">
            <Input
              type="number"
              value={settings.targetSalesRmb}
              onChange={(e) => setSettings({ ...settings, targetSalesRmb: Number(e.target.value) })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp 与自动回复</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={settings.autoReplyEnabled}
              onChange={(e) => setSettings({ ...settings, autoReplyEnabled: e.target.checked })}
            />
            开启自动回复（仅高置信且毛利达标时外发）
          </label>
          <Field label="自动回复置信度阈值">
            <Input
              type="number"
              step="0.01"
              value={settings.autoReplyConfidenceThreshold}
              onChange={(e) =>
                setSettings({ ...settings, autoReplyConfidenceThreshold: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Phone Number ID">
            <Input
              value={settings.waPhoneNumberId}
              onChange={(e) => setSettings({ ...settings, waPhoneNumberId: e.target.value })}
            />
          </Field>
          <Field label="Access Token">
            <Input
              type="password"
              value={settings.waAccessToken}
              onChange={(e) => setSettings({ ...settings, waAccessToken: e.target.value })}
            />
          </Field>
          <Field label="Verify Token">
            <Input
              value={settings.waVerifyToken}
              onChange={(e) => setSettings({ ...settings, waVerifyToken: e.target.value })}
            />
          </Field>
          <Field label="WABA ID">
            <Input
              value={settings.waBusinessAccountId}
              onChange={(e) => setSettings({ ...settings, waBusinessAccountId: e.target.value })}
            />
          </Field>
          <p className="sm:col-span-2 text-xs text-stone-500">
            Webhook：<code>/api/whatsapp/webhook</code>。环境变量优先于本页保存值。凭证缺失即 DEMO。
          </p>
        </CardContent>
      </Card>

      <Button
        onClick={() =>
          api("/api/settings", { method: "PUT", body: JSON.stringify(settings) })
            .then(() => setMsg("已保存"))
            .catch((e) => setMsg(e.message))
        }
      >
        保存设置
      </Button>
      {msg ? <p className="text-xs text-emerald-800">{msg}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>CSV 导入产品</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={5} value={productCsv} onChange={(e) => setProductCsv(e.target.value)} />
          <Button
            variant="outline"
            onClick={() =>
              fetch("/api/import/products", { method: "POST", body: productCsv })
                .then((r) => r.json())
                .then((d) => setMsg(d.error || `产品导入 ${d.upserts} 行`))
            }
          >
            导入产品
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>CSV 导入知识库</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={5} value={kbCsv} onChange={(e) => setKbCsv(e.target.value)} />
          <Button
            variant="outline"
            onClick={() =>
              fetch("/api/import/knowledge", { method: "POST", body: kbCsv })
                .then((r) => r.json())
                .then((d) => setMsg(d.error || `知识库导入 ${d.created} 行`))
            }
          >
            导入知识库
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
