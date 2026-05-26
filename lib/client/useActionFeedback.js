import { useCallback, useRef, useState } from "react";

export function useActionFeedback() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("success");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const runAction = useCallback(async (fn, { successMessage } = {}) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await fn();
      const msg =
        typeof successMessage === "function" ? successMessage(result) : successMessage;
      if (msg) {
        setModalMessage(msg);
        setModalType("success");
        setModalOpen(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return result;
    } catch (error) {
      setModalMessage(error.message || "操作失敗");
      setModalType("error");
      setModalOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  // Variant that does not scroll to top
  const runActionNoScroll = useCallback(async (fn, { successMessage } = {}) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await fn();
      const msg = typeof successMessage === "function" ? successMessage(result) : successMessage;
      if (msg) {
        setModalMessage(msg);
        setModalType("success");
        setModalOpen(true);
        // no scroll here
      }
      return result;
    } catch (error) {
      setModalMessage(error.message || "操作失敗");
      setModalType("error");
      setModalOpen(true);
      // no scroll here
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  const notifyError = useCallback((message) => {
    setModalMessage(message || "操作失敗");
    setModalType("error");
    setModalOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const notifyErrorNoScroll = useCallback((message) => {
    setModalMessage(message || "操作失敗");
    setModalType("error");
    setModalOpen(true);
    // no scroll
  }, []);

  return { modalOpen, modalMessage, modalType, isSubmitting, closeModal, runAction, notifyError, runActionNoScroll, notifyErrorNoScroll };
}
