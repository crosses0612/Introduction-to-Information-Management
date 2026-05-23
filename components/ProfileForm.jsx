import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

const emptyForm = { email: "", phone: "", currentPassword: "", password: "" };

export default function ProfileForm({ isVendor, isSubmitting, runAction, onUserUpdate }) {
  const [form, setForm] = useState(emptyForm);
  const [initialEmail, setInitialEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        setInitialEmail(profile.email || "");
        setForm({
          email: profile.email || "",
          phone: profile.phone || "",
          currentPassword: "",
          password: ""
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
    const emailChanged = form.email.trim() !== initialEmail;
    if (emailChanged) {
      payload.email = form.email.trim();
      payload.currentPassword = form.currentPassword;
    }
    if (form.password.trim()) {
      payload.password = form.password;
      payload.currentPassword = form.currentPassword;
    }

    await runAction(async () => {
      const data = await api.updateProfile(payload);
      onUserUpdate(data.user, data.token);
      setInitialEmail(data.user.email);
      setForm((prev) => ({ ...prev, currentPassword: "", password: "" }));
    }, { successMessage: "個人資料已更新" });
  }

  const emailLabel = isVendor ? "帳號（Email）" : "電子郵件";
  const emailChanged = form.email.trim() !== initialEmail;
  const needsCurrentPassword = emailChanged || form.password.trim().length > 0;

  if (loading) {
    return <p>載入個人資料中…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="grid">
      <label>
        {emailLabel}
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
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
      {needsCurrentPassword && (
        <label>
          目前密碼
          <input
            type="password"
            placeholder="必填"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
            disabled={isSubmitting}
          />
        </label>
      )}
      <label>
        新密碼
        <input
          type="password"
          placeholder="選填，至少 6 字元"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          disabled={isSubmitting}
        />
      </label>
      <button type="submit" disabled={isSubmitting}>
        儲存個人資料
      </button>
    </form>
  );
}
