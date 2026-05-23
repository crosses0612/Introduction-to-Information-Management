import { useState } from "react";
import { api } from "@/lib/client/api";

export default function ChangePasswordForm({ isSubmitting, runAction, onUserUpdate }) {
  const [form, setForm] = useState({ currentPassword: "", password: "" });

  async function handleSubmit(e) {
    e.preventDefault();
    await runAction(async () => {
      const data = await api.updateProfile({
        currentPassword: form.currentPassword,
        password: form.password
      });
      onUserUpdate(data.user, data.token);
      setForm({ currentPassword: "", password: "" });
    }, { successMessage: "密碼已更新" });
  }

  return (
    <form onSubmit={handleSubmit} className="grid">
      <h3>變更密碼</h3>
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
      <label>
        新密碼
        <input
          type="password"
          placeholder="至少 6 字元"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={6}
          disabled={isSubmitting}
        />
      </label>
      <button type="submit" disabled={isSubmitting}>
        變更密碼
      </button>
    </form>
  );
}
