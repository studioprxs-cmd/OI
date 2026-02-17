import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";

export default function Loading() {
  return <AdminPageSkeleton title="신고/정산 데이터를 불러오는 중" subtitle="무결성 지표와 큐 우선순위를 계산하고 있습니다." />;
}
