import type { Metadata } from 'next';
import Link from 'next/link';

import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { BUSINESS_INFO } from '@/lib/business';

export const metadata: Metadata = {
  title: '개인정보 처리방침',
  description: '스캐치북 서비스가 개인정보와 그림, 사진을 처리하는 방법을 안내합니다.',
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <header className="simple-header">
        <span aria-hidden="true" className="header-balance" />
        <BrandWordmark />
        <span aria-hidden="true" className="header-balance" />
      </header>

      <article className="legal-document">
        <div className="legal-intro">
          <p className="eyebrow">개인정보 처리 안내</p>
          <h1>개인정보 처리방침</h1>
          <p>스캐치북은 서비스를 제공하는 데 필요한 정보만 처리하고, 이용자가 직접 삭제하고 관리할 수 있도록 합니다.</p>
          <p className="legal-effective-date">시행일: 2026년 9월 4일</p>
        </div>

        <nav aria-label="개인정보 처리방침 목차" className="legal-toc">
          <a href="#privacy-items">처리 정보</a>
          <a href="#privacy-retention">보관·삭제</a>
          <a href="#privacy-transfer">국외 이전</a>
          <a href="#privacy-rights">이용자 권리</a>
        </nav>

        <section id="privacy-purpose">
          <h2>처리 목적</h2>
          <ul>
            <li>스케치북 생성, 공개 링크 공유와 친구 그림 접수</li>
            <li>소유자의 그림 관리, BEST 선정과 스토리 이미지 제작</li>
            <li>결제에 따른 참여 가능 인원·워터마크 제거 권한과 구매 기록 관리</li>
            <li>비정상 요청 차단, 관리자 운영과 서비스 보안 유지</li>
          </ul>
        </section>

        <section id="privacy-items">
          <h2>처리하는 개인정보</h2>
          <dl className="legal-data-list">
            <div>
              <dt>스케치북 생성</dt>
              <dd>이름 또는 애칭, 관리용 비밀번호의 일방향 해시, 선택한 비밀번호 힌트, 공개·관리 ID와 생성 시각을 처리합니다.</dd>
            </div>
            <div>
              <dt>선택 정보</dt>
              <dd>소유자가 직접 그린 그림을 선택한 경우에만 저장합니다.</dd>
            </div>
            <div>
              <dt>친구 그림 제출</dt>
              <dd>작성자의 이름 또는 애칭, 그림, 선택한 한마디와 제출 시각을 처리합니다. 제출 그림은 보관용 원본과 갤러리용 320px WebP 썸네일을 별도로 생성해 저장합니다.</dd>
            </div>
            <div>
              <dt>결제</dt>
              <dd>결제용 휴대전화번호, 선택 상품, 결제 금액, 추가 인원, 주문·요청 ID, 페이앱 주문번호, 결제수단 유형, 처리 상태와 시각, 디지털 혜택 즉시 제공 동의 시각과 동의 문구 버전을 처리합니다. 스캐치북 서버에는 휴대전화번호 끝 4자리만 저장하며 전체 번호와 카드번호 등 결제수단 정보는 직접 저장하지 않습니다.</dd>
            </div>
            <div>
              <dt>보안 정보</dt>
              <dd>스케치북 생성 제한을 위해 IP 원문은 저장하지 않고 복원하기 어려운 해시로 변환하여 최대 72시간 보관합니다. 친구 그림의 스케치북별 제출 횟수를 제한하기 위한 IP 해시와 관리 로그인 실패 시 접속정보를 해시한 값은 해당 스케치북 삭제 시까지 저장할 수 있습니다.</dd>
            </div>
          </dl>
          <p>입력한 관리용 비밀번호 원문은 서버에 저장하지 않습니다. 다만 생성 중에는 브라우저의 sessionStorage 초안에 임시 저장되며, 생성에 성공하거나 탭 또는 브라우저 세션이 끝나면 사라집니다.</p>
        </section>

        <section id="privacy-public">
          <h2>공개 범위</h2>
          <p>공개 링크를 아는 사람은 스케치북 이름, 공개 상태인 친구 그림, 작성자 이름 또는 애칭과 한마디를 볼 수 있습니다.</p>
          <p>공개 갤러리의 썸네일은 전송량을 줄이기 위해 최대 약 5분간 브라우저 밖 공유 캐시에 남을 수 있습니다. 그림을 숨김·삭제하면 새 공개 버전으로 바뀌거나 접근이 차단되며, 이전 주소로 다시 요청해도 그림을 제공하지 않습니다.</p>
          <p>본인이나 다른 사람의 민감한 정보, 연락처 또는 공개를 원하지 않는 내용은 이름과 한마디에 입력하지 마세요.</p>
        </section>

        <section id="privacy-retention">
          <h2>보유 기간과 파기</h2>
          <ul>
            <li>무료 스케치북은 생성일로부터 6개월간 보관하며, 그 안의 보관용 그림·갤러리 썸네일, 사진, 한마디도 함께 보관하거나 이용자가 직접 삭제할 때까지 처리합니다.</li>
            <li>유료 스케치북과 그 안의 콘텐츠: 서비스 운영 중 또는 이용자가 직접 삭제할 때까지. 마지막 구매일로부터 최소 1년간 이용을 보장합니다.</li>
            <li>계약 또는 청약철회 기록: 5년, 대금결제 및 재화 공급 기록: 5년, 소비자 불만 또는 분쟁처리 기록: 3년 동안 관계 법령에 따라 보관합니다.</li>
            <li>관리 로그인 세션: 발급일로부터 최대 30일 또는 로그아웃·스케치북 삭제 시까지</li>
            <li>관리자 로그인 세션: 발급일로부터 최대 12시간 또는 로그아웃 시까지</li>
            <li>브라우저 생성 초안: 생성 완료 또는 브라우저 세션 종료 시까지</li>
            <li>IP 기반 요청 제한 정보: 스케치북 생성 제한용 IP 해시는 최대 72시간, 단기 제출 제한 정보는 서버 메모리에서 최대 1시간, 스케치북별 친구 그림 제출 횟수 해시는 해당 스케치북 삭제 시까지</li>
          </ul>
          <p>보관기간이 지나면 무료 스케치북의 Firestore 기록과 Storage 파일을 자동 삭제합니다.</p>
          <p>서비스 이용 중에는 구매 혜택과 거래 내역 확인을 위해 결제 기록을 스케치북과 함께 처리합니다. 스케치북 삭제 뒤에는 법정 보존기간이 남은 최소 거래 기록만 별도 저장소에 분리합니다.</p>
          <p>관리 화면에서 전체 삭제를 요청하면 먼저 공개 접근을 막고 그림과 스케치북 콘텐츠를 삭제합니다. 스케치북을 삭제하더라도 법정 거래 기록은 별도 저장소에 분리하여 법정 기간 동안만 보관합니다. 보존기간이 끝나면 지체 없이 파기합니다.</p>
          <p>삭제된 콘텐츠는 Google의 백업 시스템에서 삭제 요청 후 최대 180일 안에 제거될 수 있습니다. 법정 거래 기록에는 그림·메시지와 결제용 전체 휴대전화번호를 저장하지 않습니다.</p>
        </section>

        <section id="privacy-third-party">
          <h2>개인정보의 제3자 제공 및 처리위탁</h2>
          <p>스캐치북은 결제 처리에 필요한 범위를 제외하고 이용자의 개인정보를 제3자에게 제공하지 않습니다. 이용자가 공개 링크를 직접 공유하여 정보가 공개되는 경우와 법령에 따라 제출 의무가 있는 경우는 예외입니다.</p>
          <p><strong>주식회사 유디아이디(페이앱)</strong>에 결제 요청·승인·취소·정산 처리를 위탁합니다. 결제용 휴대전화번호, 주문번호, 상품명과 결제금액이 페이앱으로 전송되며, 결제수단 정보는 페이앱 결제 화면에서 직접 처리됩니다. 페이앱은 처리 목적 달성 시까지 또는 전자상거래·전자금융거래 관련 법령이 정한 기간 동안 정보를 보관할 수 있습니다.</p>
          <p><a href="https://www.payapp.kr/homepage/udidTerms/payapp_privacy.html">페이앱 개인정보 처리방침</a>에서 상세 처리 항목과 보유 기간을 확인할 수 있습니다.</p>
        </section>

        <section id="privacy-transfer">
          <h2>처리위탁 및 국외 이전</h2>
          <p>서비스 제공을 위해 Google LLC의 Firebase·Google Cloud 서비스와 주식회사 유디아이디의 페이앱을 사용합니다. 서비스 이용에 필요한 정보는 암호화된 네트워크를 통해 전송되며, 각 처리 목적 달성 또는 서비스 계약 종료 시까지 처리됩니다.</p>
          <ul className="legal-location-list">
            <li>Cloud Firestore: 데이터베이스 저장, 대한민국 서울</li>
            <li>Cloud Storage for Firebase: 그림·사진 저장, 미국 버지니아</li>
            <li>Firebase App Hosting: 웹 서비스 제공과 요청 처리, 대만</li>
            <li>Firebase Authentication: 관리자 Google 로그인, 미국</li>
            <li>Firebase App Check: 자동화된 남용 방지, Google 글로벌 인프라</li>
          </ul>
          <p>국외 처리는 이용자가 요청한 서비스 제공에 필요합니다. 이를 원하지 않으면 정보를 입력하지 않거나 관리 화면에서 스케치북을 삭제할 수 있지만, 해당 기능은 이용할 수 없습니다. 자세한 처리 위치와 보호조치는 <a href="https://firebase.google.com/support/privacy">Firebase 개인정보 및 보안 안내</a>에서 확인할 수 있습니다.</p>
        </section>

        <section id="privacy-storage">
          <h2>쿠키와 브라우저 저장소</h2>
          <p>스케치북 관리 권한을 유지하기 위해 필수 관리 쿠키를 최대 30일간 사용합니다. 이 쿠키는 HTTP 전용으로 설정하며 광고나 이용자 추적에 사용하지 않습니다. 쿠키를 삭제하거나 차단하면 관리용 비밀번호로 다시 로그인해야 합니다.</p>
          <p>생성 화면의 입력 유실을 줄이기 위해 이름, 관리용 비밀번호, 힌트와 직접 그린 그림 초안을 sessionStorage에 임시 저장합니다.</p>
        </section>

        <section id="privacy-rights">
          <h2>이용자의 권리와 행사 방법</h2>
          <p>소유자는 관리 화면에서 그림 공개 여부를 바꾸거나 그림과 스케치북 전체를 삭제할 수 있습니다. 개인정보 열람, 정정, 삭제 또는 처리정지를 요청하려면 아래 이메일로 공개 ID와 요청 내용을 보내 주세요. 필요한 경우 권한 확인을 요청할 수 있으며 관련 법령에서 정한 절차에 따라 처리합니다.</p>
        </section>

        <section id="privacy-safety">
          <h2>안전성 확보 조치</h2>
          <ul>
            <li>관리용 비밀번호와 관리 토큰의 일방향 해시 저장</li>
            <li>HTTP 전용·보안·SameSite 속성을 적용한 관리 쿠키</li>
            <li>Firestore·Storage 보안 규칙과 서버 권한 검증</li>
            <li>App Check, 요청 횟수 제한과 관리 로그인 잠금</li>
            <li>운영자 계정 제한과 그림·스케치북 숨김 처리</li>
          </ul>
        </section>

        <section id="privacy-contact">
          <h2>개인정보 문의</h2>
          <p>개인정보처리자: {BUSINESS_INFO.name} · 대표자: {BUSINESS_INFO.representative}</p>
          <p>개인정보 보호와 관련한 문의, 불만 또는 권리 행사는 아래 연락처로 요청할 수 있습니다.</p>
          <p><a href={`mailto:${BUSINESS_INFO.email}`}>{BUSINESS_INFO.email}</a></p>
          <p>침해 상담이 필요한 경우 개인정보침해 신고센터(국번 없이 118) 또는 개인정보분쟁조정위원회(1833-6972)를 이용할 수 있습니다.</p>
        </section>

        <section id="privacy-change">
          <h2>처리방침 변경</h2>
          <p>내용이 바뀌면 시행 전에 서비스 화면을 통해 알립니다. 이용자 권리에 중대한 변경은 적용일 30일 전부터 안내합니다.</p>
          <p>버전 1.4 · 2026년 9월 4일 시행</p>
        </section>
      </article>

      <nav aria-label="정책 문서" className="legal-page-links">
        <Link href="/terms">서비스 이용 및 결제 안내</Link>
        <Link href="/">홈으로 돌아가기</Link>
      </nav>
    </main>
  );
}
