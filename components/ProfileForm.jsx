import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

const emptyForm = { username: "", phone: "", currentPassword: "" };

export default function ProfileForm({ isVendor, isSubmitting, runAction, onUserUpdate }) {
  const [form, setForm] = useState(emptyForm);
  const [initialUsername, setInitialUsername] = useState("");
  const [initialPhone, setInitialPhone] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        setInitialUsername(profile.username || "");
        setInitialPhone(profile.phone || "");
        setForm({
          username: profile.username || "",
          phone: profile.phone || "",
          currentPassword: ""
        });
      })
      .catch(() => {
        if (!cancelled) setForm(emptyForm);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 當前欄位是否有被改動
  const usernameChanged = form.username.trim() !== initialUsername;
  const userphoneChanged = form.phone.trim() !== initialPhone;
  // 核心修改 1：不論是名字被改還是電話被改，都代表資料有變更
  const isProfileChanged = usernameChanged || userphoneChanged;

  async function handleSubmit(e) {
    e.preventDefault();
    
    // 建立基礎資料包
    const payload = { 
      username: form.username.trim(),
      phone: form.phone.trim() 
    };

    // 核心修改 2：只要有任何欄位被改動，就必須夾帶目前密碼供後端驗證
    if (isProfileChanged) {
      payload.currentPassword = form.currentPassword;
    }

    await runAction(async () => {
      const data = await api.updateProfile(payload);
      onUserUpdate(data.user, data.token);
      setInitialUsername(data.user.username);
      setInitialPhone(data.user.phone || "");
      setForm((prev) => ({ ...prev, currentPassword: "" }));
    }, { successMessage: "個人資料已更新" });
  }

  const usernameLabel = isVendor ? "帳號（使用者名稱）" : "使用者名稱";

  if (loading) {
    return <p>載入個人資料中…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="grid">
      <h3>個人資料</h3>
      <label>
        {usernameLabel}
        <input
          type="text"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
          disabled={isSubmitting}
        />
      </label>
      {!isVendor && (
        <label>
          電話
          <input 
            type="tel" 
            placeholder="選填" 
            value={form.phone} 
            onChange={(e) => {
              const filteredValue = e.target.value.replace(/[^0-9\-*]/g, "");
              setForm({ ...form, phone: filteredValue });
            }} 
            disabled={isSubmitting} 
          />
        </label>
      )}
      
      {/* 核心修改 3：改用「或 ||」判定，只要其中一個有變，就要求輸入目前密碼 */}
      {isProfileChanged && (
        <label>
          目前密碼
          <input
            type="password"
            placeholder="變更使用者名稱或電話時必填"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
            disabled={isSubmitting}
          />
        </label>
      )}
      
      <button type="submit" disabled={isSubmitting}>
        儲存個人資料
      </button>
    </form>
  );
}