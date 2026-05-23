export default function FeedbackModal({ open, message, type, onClose }) {
  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <div className={`modalCard ${type === "error" ? "modalError" : "modalSuccess"}`}>
        <h2 id="feedback-title">{type === "error" ? "操作失敗" : "操作完成"}</h2>
        <p>{message}</p>
        <button type="button" onClick={onClose}>
          確定
        </button>
      </div>
    </div>
  );
}
