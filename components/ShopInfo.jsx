import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

export default function ShopInfo() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    api.getShopInfo().then(setInfo).catch(() => setInfo(null));
  }, []);

  if (!info) return null;

  return (
    <section className="card shopInfo">
      <h2>商家資訊</h2>
      <p>
        <strong>{info.businessName || "—"}</strong>
      </p>
      <p>聯絡電話：{info.contactPhone || "—"}</p>
      <p>工廠地址：{info.factoryAddress || "—"}</p>
    </section>
  );
}
