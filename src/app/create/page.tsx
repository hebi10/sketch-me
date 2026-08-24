import Link from 'next/link';

export default function CreateSketchbookPage() {
  return (
    <main className="form-shell">
      <header className="simple-header">
        <Link className="wordmark" href="/">
          스캐치북
        </Link>
      </header>

      <section className="create-intro" aria-labelledby="create-title">
        <p className="eyebrow">새 스캐치북</p>
        <h1 id="create-title">내 스캐치북 만들기</h1>
        <p>친구들이 부를 이름이나 애칭을 먼저 알려주세요.</p>
        <label className="field-label" htmlFor="sketchbook-name">
          이름 또는 애칭
        </label>
        <input id="sketchbook-name" maxLength={24} name="name" placeholder="예: 도영" />
        <button className="button button--primary" disabled type="button">
          다음으로
        </button>
        <p className="field-hint">생성 기능은 Firebase 연결 단계에서 활성화됩니다.</p>
      </section>
    </main>
  );
}
