import { savePlace } from '@/app/admin/actions';
import { CATEGORY_LABELS, VERIFY_LABELS } from '@/lib/types.ts';
import { VERIFY_KEYS } from '@/lib/admin/validate.ts';
import { Card, Field, btnPrimary, inputCls } from './ui';

export interface PlaceFormValues {
  id?: string;
  slug?: string;
  name?: string;
  sido?: string;
  sigungu?: string;
  address?: string | null;
  category?: string | null;
  description?: string | null;
  official_url?: string | null;
  source_url?: string | null;
  recommended_age?: string | null;
  verify_status?: string;
  last_checked_at?: string | null; // YYYY-MM-DD
  is_published?: boolean;
  is_test_data?: boolean;
}

export function PlaceForm({ v = {} }: { v?: PlaceFormValues }) {
  return (
    <Card title="기본 정보">
      <form action={savePlace} className="grid gap-4 sm:grid-cols-2">
        {v.id && <input type="hidden" name="id" value={v.id} />}
        <Field label="장소 이름 *">
          <input name="name" required maxLength={100} defaultValue={v.name} className={inputCls} />
        </Field>
        <Field label="주소용 이름(slug) *" hint="영문 소문자·숫자·하이픈. 예: seoul-childrens-museum">
          <input name="slug" required pattern="[a-z0-9\-]{1,100}" defaultValue={v.slug} className={inputCls} />
        </Field>
        <Field label="시·도 *" hint="예: 서울특별시">
          <input name="sido" required maxLength={30} defaultValue={v.sido} className={inputCls} />
        </Field>
        <Field label="시·군·구" hint="예: 종로구">
          <input name="sigungu" maxLength={30} defaultValue={v.sigungu} className={inputCls} />
        </Field>
        <Field label="주소">
          <input name="address" maxLength={200} defaultValue={v.address ?? ''} className={inputCls} />
        </Field>
        <Field label="분류">
          <select name="category" defaultValue={v.category ?? ''} className={inputCls}>
            <option value="">선택 안 함</option>
            {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="한 줄 소개">
            <input name="description" maxLength={500} defaultValue={v.description ?? ''} className={inputCls} />
          </Field>
        </div>
        <Field label="공식 홈페이지 URL" hint="자동 점검은 이 주소를 읽어요">
          <input name="official_url" type="url" defaultValue={v.official_url ?? ''} className={inputCls} />
        </Field>
        <Field label="대표 출처 URL" hint="정보를 확인한 페이지 (요금 안내 페이지 등)">
          <input name="source_url" type="url" defaultValue={v.source_url ?? ''} className={inputCls} />
        </Field>
        <Field label="추천 연령" hint="예: 12개월 이상">
          <input name="recommended_age" maxLength={50} defaultValue={v.recommended_age ?? ''} className={inputCls} />
        </Field>
        <Field label="장소 전체 검증 상태">
          <select name="verify_status" defaultValue={v.verify_status ?? 'needs_check'} className={inputCls}>
            {VERIFY_KEYS.map((k) => <option key={k} value={k}>{VERIFY_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label="마지막 확인일" hint="확인된 상태면 필수">
          <input name="last_checked_at" type="date" defaultValue={v.last_checked_at ?? ''} className={inputCls} />
        </Field>
        <div className="flex flex-col justify-end gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_published" defaultChecked={v.is_published ?? false} className="h-5 w-5 accent-coral" />
            방문자에게 공개
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_test_data" defaultChecked={v.is_test_data ?? false} className="h-5 w-5 accent-coral" />
            테스트 데이터 (화면에 &lsquo;예시 데이터&rsquo; 표시)
          </label>
        </div>
        <div className="sm:col-span-2">
          <button className={btnPrimary}>{v.id ? '기본 정보 저장' : '장소 만들기'}</button>
        </div>
      </form>
    </Card>
  );
}
