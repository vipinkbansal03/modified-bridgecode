"use client";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { adminApi } from "@/services/adminApi";
import { Sparkles, Languages } from "lucide-react";

export default function AIToolsPage() {
  const [productTitle, setProductTitle] = useState("");
  const [targetLang, setTargetLang] = useState("English");
  const [result, setResult] = useState("");
  const [translateText, setTranslateText] = useState("");
  const [translateLang, setTranslateLang] = useState("Arabic");
  const [translateResult, setTranslateResult] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const handleGenerate = async () => {
    if (!productTitle) return;
    setLoading(true);
    try {
      const r = await adminApi.post("/ai/generate", { productTitle, targetLanguage: targetLang });
      setResult(JSON.stringify(r.data.data, null, 2));
      showToast("Content generated.");
    } catch { showToast("Failed. Ensure OpenAI key is configured.", "error"); }
    finally { setLoading(false); }
  };

  const handleTranslate = async () => {
    if (!translateText) return;
    setLoading(true);
    try {
      const r = await adminApi.post("/ai/translate", { text: translateText, targetLanguage: translateLang });
      setTranslateResult(r.data.data.translated);
    } catch { showToast("Translation failed.", "error"); }
    finally { setLoading(false); }
  };

  return (
    <AdminLayout title="AI Tools" breadcrumb={[{ label: "AI Tools" }]}>
      <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-[13px] text-blue-700">
        AI tools use LangChain + OpenAI. Add your <span className="font-semibold">OPENAI_API_KEY</span> to the backend .env to enable these features.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1"><Sparkles size={16} className="text-[#E31E24]" /><h3 className="text-[14px] font-semibold">Generate Product Content</h3></div>
          <AdminInput label="Product Title" placeholder="e.g. Sapphire True Twin Bracket" value={productTitle} onChange={(e) => setProductTitle(e.target.value)} />
          <AdminSelect label="Target Language" options={["English","Arabic","German","French","Spanish","Portuguese","Japanese","Korean","Hindi"].map((l) => ({ value: l, label: l }))} value={targetLang} onChange={(e) => setTargetLang(e.target.value)} />
          <button onClick={handleGenerate} disabled={loading || !productTitle} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
            <Sparkles size={14} /> {loading ? "Generating…" : "Generate Content"}
          </button>
          {result && <pre className="rounded-lg bg-[#F2F2F2] p-3 text-[12px] text-[#1A1A1A] overflow-auto max-h-48">{result}</pre>}
        </div>
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1"><Languages size={16} className="text-[#E31E24]" /><h3 className="text-[14px] font-semibold">Translate Text</h3></div>
          <AdminTextarea label="Source Text" rows={4} value={translateText} onChange={(e) => setTranslateText(e.target.value)} placeholder="Paste product description or any text…" />
          <AdminSelect label="Translate To" options={["Arabic","German","French","Spanish","Portuguese","Japanese","Korean","Hindi","Turkish"].map((l) => ({ value: l, label: l }))} value={translateLang} onChange={(e) => setTranslateLang(e.target.value)} />
          <button onClick={handleTranslate} disabled={loading || !translateText} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
            <Languages size={14} /> {loading ? "Translating…" : "Translate"}
          </button>
          {translateResult && <AdminTextarea label="Translation" rows={4} value={translateResult} readOnly />}
        </div>
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
