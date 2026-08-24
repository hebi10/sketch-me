import Link from 'next/link';

import { CreateSketchbookForm } from './CreateSketchbookForm';

export default function CreateSketchbookPage() {
  return (
    <main className="form-shell">
      <header className="simple-header">
        <Link aria-label="스캐치북 홈" className="header-icon-link" href="/">←</Link>
        <Link className="wordmark" href="/">
          스캐치북
        </Link>
        <span aria-hidden="true" className="header-balance" />
      </header>

      <CreateSketchbookForm />
    </main>
  );
}
