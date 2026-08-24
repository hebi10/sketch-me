import Link from 'next/link';

import { CreateSketchbookForm } from './CreateSketchbookForm';

export default function CreateSketchbookPage() {
  return (
    <main className="form-shell">
      <header className="simple-header">
        <Link className="wordmark" href="/">
          스캐치북
        </Link>
      </header>

      <CreateSketchbookForm />
    </main>
  );
}
