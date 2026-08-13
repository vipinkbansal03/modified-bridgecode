"use client";
import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminTextarea, AdminSelect, useToast, LoadingButton } from "@/components/admin/AdminComponents";
import { adminApi } from "@/services/adminApi";
import { Sparkles, Languages } from "lucide-react";

export default function AIToolsPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("ai.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canUpdate = hasPermission("ai.update");

  const [productTitle, setProductTitle] = useState("");
  const [targetLang, setTargetLang] = useState("English");
  const [result, setResult] = useState("");
  const [translateText, setTranslateText] = useState("");
  const [translateLang, setTranslateLang] = useState("Arabic");
  const [translateResult, setTranslateResult] = useState("");
  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const handleGenerate = async () => {
    if (!productTitle) return;
    setGenerating(true);
    try {
      const r = await adminApi.post("/ai/generate", { productTitle, targetLanguage: targetLang });
      setResult(JSON.stringify(r.data.data, null, 2));
      showToast("Content generated.");
    } catch { showToast("Failed. Ensure OpenAI key is configured.", "error"); }
    finally { setGenerating(false); }
  };

  const handleTranslate = async () => {
    if (!translateText) return;
    setTranslating(true);
    try {
      const r = await adminApi.post("/ai/translate", { text: translateText, targetLanguage: translateLang });
      setTranslateResult(r.data.data.translated);
    } catch { showToast("Translation failed.", "error"); }
    finally { setTranslating(false); }
  };

  if (authLoading || !hasPermission("ai.view")) {
    return null;
  }

  return (
    <AdminLayout title="AI Tools" breadcrumb={[{ label: "AI Tools" }]}>
      <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-[13px] text-blue-700">
        AI tools use LangChain + OpenAI. Add your <span className="font-semibold">OPENAI_API_KEY</span> to the backend .env to enable these features.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1"><Sparkles size={16} className="text-[#E31E24]" /><h3 className="text-[14px] font-semibold">Generate Product Content</h3></div>
          <AdminInput label="Product Title" placeholder="e.g. Sapphire True Twin Bracket" value={productTitle} onChange={(e) => setProductTitle(e.target.value)} disabled={!canUpdate || generating} />
          <AdminSelect label="Target Language" options={["English","Arabic","German","French","Spanish","Portuguese","Japanese","Korean","Hindi"].map((l) => ({ value: l, label: l }))} value={targetLang} onChange={(e) => setTargetLang(e.target.value)} disabled={!canUpdate || generating} />
          <LoadingButton onClick={handleGenerate} loading={generating} loadingText="Generating…" disabled={!productTitle || !canUpdate} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
            <Sparkles size={14} /> Generate Content
          </LoadingButton>
          {result && <pre className="rounded-lg bg-[#F2F2F2] p-3 text-[12px] text-[#1A1A1A] overflow-auto max-h-48">{result}</pre>}
        </div>
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1"><Languages size={16} className="text-[#E31E24]" /><h3 className="text-[14px] font-semibold">Translate Text</h3></div>
          <AdminTextarea label="Source Text" rows={4} value={translateText} onChange={(e) => setTranslateText(e.target.value)} placeholder="Paste product description or any text…" disabled={!canUpdate || translating} />
          <AdminSelect label="Translate To" options={["Arabic","German","French","Spanish","Portuguese","Japanese","Korean","Hindi","Turkish"].map((l) => ({ value: l, label: l }))} value={translateLang} onChange={(e) => setTranslateLang(e.target.value)} disabled={!canUpdate || translating} />
          <LoadingButton onClick={handleTranslate} loading={translating} loadingText="Translating…" disabled={!translateText || !canUpdate} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
            <Languages size={14} /> Translate
          </LoadingButton>
          {translateResult && <AdminTextarea label="Translation" rows={4} value={translateResult} readOnly />}
        </div>
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
