import type { ReactNode } from "react";

export type ChipTone =
  | "neutral"
  | "blue"
  | "amber"
  | "orange"
  | "purple"
  | "green"
  | "red";

const toneClasses: Record<ChipTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  orange: "bg-orange-50 text-orange-700",
  purple: "bg-purple-50 text-purple-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
};

export function StatusChip({
  tone = "neutral",
  children,
}: {
  tone?: ChipTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export const supplierStatusMeta: Record<
  string,
  { label: string; tone: ChipTone }
> = {
  ACTIVE: { label: "合作中", tone: "green" },
  DISABLED: { label: "已停用", tone: "neutral" },
};

export const visibilityMeta: Record<string, { label: string; tone: ChipTone }> =
  {
    ALL: { label: "全员可见", tone: "blue" },
    SPECIFIED: { label: "指定可见", tone: "purple" },
  };

export const roleMeta: Record<string, { label: string; tone: ChipTone }> = {
  ADMIN: { label: "管理员", tone: "purple" },
  MEMBER: { label: "普通用户", tone: "neutral" },
};

export const accountStatusMeta: Record<
  string,
  { label: string; tone: ChipTone }
> = {
  true: { label: "启用", tone: "green" },
  false: { label: "已停用", tone: "neutral" },
};

export const projectStatusMeta: Record<string, { label: string; tone: ChipTone }> =
  {
    ACTIVE: { label: "进行中", tone: "blue" },
    ARCHIVED: { label: "已归档", tone: "neutral" },
  };

export const inquiryStatusMeta: Record<
  string,
  { label: string; tone: ChipTone }
> = {
  DRAFT: { label: "草稿", tone: "neutral" },
  OPEN: { label: "报价中", tone: "blue" },
  CLOSED: { label: "已关闭", tone: "amber" },
  AWARDED: { label: "已定标", tone: "green" },
  CANCELLED: { label: "已作废", tone: "red" },
};

export const mailStatusMeta: Record<string, { label: string; tone: ChipTone }> =
  {
    PENDING: { label: "待发送", tone: "neutral" },
    SENT: { label: "已发送", tone: "green" },
    FAILED: { label: "发送失败", tone: "red" },
  };

export const orderStatusMeta: Record<string, { label: string; tone: ChipTone }> =
  {
    PENDING_CONTRACT: { label: "待合同", tone: "amber" },
    IN_PROGRESS: { label: "履约中", tone: "blue" },
    COMPLETED: { label: "已完成", tone: "green" },
    CANCELLED: { label: "已取消", tone: "red" },
  };

export const contractStatusMeta: Record<
  string,
  { label: string; tone: ChipTone }
> = {
  PENDING_SUBMISSION: { label: "待提交合同", tone: "amber" },
  SUBMITTED: { label: "待内部审核", tone: "blue" },
  RETURNED: { label: "已回传修订版", tone: "purple" },
  COMPLETED: { label: "合同已完成", tone: "green" },
};

export const acceptanceStatusMeta: Record<
  string,
  { label: string; tone: ChipTone }
> = {
  UPLOADED: { label: "待签署", tone: "amber" },
  SIGNED: { label: "已签署", tone: "green" },
};
