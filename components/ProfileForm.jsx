import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

const emptyForm = { username: "", phone: "", currentPassword: "" };

export default function ProfileForm({ isVendor, isSubmitting, runAction, onUserUpdate }) {
  const [form, setForm] = useState(emptyForm);
  const [initialUsername, setInitialUsername] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        setInitialUsername(profile.username || "");
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

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { phone: form.phone.trim() };
    const usernameChanged = form.username.trim() !== initialUsername;
    if (usernameChanged) {
      payload.username = form.username.trim();
      payload.currentPassword = form.currentPassword;
    }

    await runAction(async () => {
      const data = await api.updateProfile(payload);
      onUserUpdate(data.user, data.token);
      setInitialUsername(data.user.username);
      setForm((prev) => ({ ...prev, currentPassword: "" }));
    }, { successMessage: "個人資料已更新" });
  }

  const usernameLabel = isVendor ? "帳號（使用者名稱）" : "使用者名稱";
  const usernameChanged = form.username.trim() !== initialUsername;

  if (loading) {
    return <p>載入個人資料中…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="grid">
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
      <label>
        電話
        <input
          type="tel"
          placeholder="選填"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          disabled={isSubmitting}
        />
      </label>
      {usernameChanged && (
        <label>
          目前密碼
          <input
            type="password"
            placeholder="變更使用者名稱時必填"
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
