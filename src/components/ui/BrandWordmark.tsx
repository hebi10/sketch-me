import Image from 'next/image';
import Link from 'next/link';

export function BrandWordmark() {
  return (
    <Link aria-label="스캐치북 홈" className="wordmark" href="/">
      <Image
        alt=""
        aria-hidden="true"
        className="wordmark-mark"
        height={512}
        sizes="32px"
        src="/brand/sketchbook-logo-mark.webp"
        width={512}
      />
      <span>스캐치북</span>
    </Link>
  );
}
