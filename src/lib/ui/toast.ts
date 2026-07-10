// RC1.6 — Toast variants padronizados (sonner) com ícones semânticos + tokens.
// Additive — não substitui `sonner`, apenas embrulha para consistência.

import { toast as sonner } from "sonner";
import type { ReactNode } from "react";

type ToastOpts = { description?: ReactNode; duration?: number; id?: string | number };

export const toast = {
  success: (msg: string, opts?: ToastOpts) =>
    sonner.success(msg, { duration: 3500, ...opts }),
  info: (msg: string, opts?: ToastOpts) =>
    sonner(msg, { duration: 3500, ...opts }),
  warning: (msg: string, opts?: ToastOpts) =>
    sonner.warning(msg, { duration: 4500, ...opts }),
  error: (msg: string, opts?: ToastOpts) =>
    sonner.error(msg, { duration: 6000, ...opts }),
  loading: (msg: string, opts?: ToastOpts) => sonner.loading(msg, opts),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};

export type Toast = typeof toast;
