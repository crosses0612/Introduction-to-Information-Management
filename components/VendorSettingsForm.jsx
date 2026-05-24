import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

export default function VendorSettingsForm({ isSubmitting, runAction }) {
  const [form, setForm] = useState({
    businessName: "",
    contactPhone: "",
    factoryAddress: "",
    clockOffsetMinutes: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getVendorSettings()
      .then((data) =>
        setForm({
          businessName: data.businessName || "",
          contactPhone: data.contactPhone || "",
          factoryAddress: data.factoryAddress || "",
          clockOffsetMinutes: data.clockOffsetMinutes ?? 0
        })
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await runAction(
      () =>
        api.updateVendorSettings({
          businessName: form.businessName,
          contactPhone: form.contactPhone,
          factoryAddress: form.factoryAddress,
          clockOffsetMinutes: Number(form.clockOffsetMinutes) || 0
        }),
      { successMessage: "商家設定已儲存" }
    );
  }

  if (loading) return <p>載入商家設定中…</p>;

  return (
    <form onSubmit={handleSubmit} className="grid subsection">
      <h3>商家資訊</h3>
      <label>
        商家名稱
        <input
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          disabled={isSubmitting}
        />
      </label>
      <label>
        聯絡電話
        <input
          value={form.contactPhone}
          onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          disabled={isSubmitting}
        />
      </label>
      <label>
        工廠地址
        <input
          value={form.factoryAddress}
          onChange={(e) => setForm({ ...form, factoryAddress: e.target.value })}
          disabled={isSubmitting}
        />
      </label>
      <label>
        測試用時鐘偏移（分鐘）
        <input
          type="number"
          step="1"
          value={form.clockOffsetMinutes}
          onChange={(e) => setForm({ ...form, clockOffsetMinutes: e.target.value })}
          disabled={isSubmitting}
        />
      </label>
      <p className="hint">調整後交貨日提醒會依偏移後的「現在」計算，方便測試。</p>
      <button type="submit" disabled={isSubmitting}>
        儲存商家設定
      </button>
    </form>
  );
}
