import { PlaceForm } from '@/components/admin/PlaceForm';
import { Flash } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth.ts';

export default async function NewPlacePage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await requireAdmin();
  const { err } = await searchParams;
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">장소 추가</h1>
      <p className="text-sm text-ink-soft">
        공식 홈페이지 등에서 직접 확인한 정보만 입력하세요. 모르는 항목은 비워 두면 방문자에게 &lsquo;미확인&rsquo;으로 보여요.
        저장 후 요금·편의시설 항목을 입력하거나 &lsquo;공식 홈페이지에서 확인&rsquo; 버튼으로 후보를 가져올 수 있어요.
      </p>
      <Flash err={err} />
      <PlaceForm />
    </div>
  );
}
