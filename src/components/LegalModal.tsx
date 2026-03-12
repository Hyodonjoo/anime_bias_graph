import React from 'react';
import { X } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LegalModal({ isOpen, onClose }: LegalModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/50 bg-zinc-800/50">
          <h2 className="text-xl font-bold text-gray-100">이용약관</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-300 space-y-6 custom-scrollbar">

          {/* Privacy Policy */}
          <section>
            <h3 className="text-lg font-bold text-blue-400 mb-2">개인정보처리방침 (Privacy Policy)</h3>
            <p className="leading-relaxed">
              본 웹사이트에서는 일반 사용자의 어떠한 개인정보(이름, 이메일, IP 주소 등)도 수집, 저장, 제3자에게 제공하지 않습니다.
              사용자의 애니메이션 그리드 배치 데이터 및 설정은 서버로 전송되지 않으며, 오직 사용자의 기기(브라우저의 로컬 스토리지)에만 임시로 저장됩니다.
            </p>
          </section>

          {/* Service Info */}
          <section>
            <h3 className="text-lg font-bold text-blue-400 mb-2">서비스 내용 (Service Content)</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>본 사이트는 제공된 주제에 따라 애니메이션을 좌표계에 자유롭게 배치하고, 그 결과를 이미지로 다운로드하여 다른 팬들과 함께 성향을 공유할 수 있도록 돕는 <strong>비영리 서비스</strong>입니다.</li>
              <li>서비스 운영 및 유지보수를 위해 상황에 따라 사이트 내에 광고가 게재될 수 있습니다.</li>
              <li>사용자의 배치 데이터는 브라우저 로컬 스토리지에 저장되므로 접속 환경 변동, 캐시 삭제 등으로 인해 언제든지 초기화될 수 있습니다.</li>
            </ul>
          </section>

          {/* Terms of Service */}
          <section>
            <h3 className="text-lg font-bold text-blue-400 mb-2">사용자의 의무 (User Obligations)</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>사용자는 본 사이트를 통해 생성 및 다운로드한 이미지를 <strong>상업적인 용도로 사용해서는 안 됩니다.</strong></li>
              <li>원저작자의 권리를 침해하거나 타인의 명예를 훼손하는 등 법의 테두리를 벗어난 불법적인 목적으로 이미지를 악용해서는 안 됩니다.</li>
              <li>사용자는 서비스의 운영을 방해하는 행위를 해서는 안 됩니다.</li>
              <li>사용자는 서비스에 비정상적인 접근을 해서는 안 됩니다.</li>
              <li>사용자는 사이트를 무단으로 복제 및 변형하여 본 사이트인 것처럼 사칭하거나 다른 이용자에게 혼동을 주는 행위를 해서는 안 됩니다.</li>
            </ul>
          </section>

          {/* Copyright */}
          <section>
            <h3 className="text-lg font-bold text-blue-400 mb-2">저작권 (Copyright & Fair Use)</h3>
            <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 text-gray-400 text-xs">
              <strong>Third-party Copyright:</strong> 사이트 내에서 제공, 노출되는 모든 애니메이션 포스터, 캐릭터 이미지 등 제3자 이미지의 저작권 및 지적 재산권은
              오직 원작자 및 해당 애니메이션의 제작사, 배포사에 귀속되어 있습니다. 본 사이트는 취미 및 정보 공유를 목적으로 하는 '공정 이용(Fair Use)' 원칙을 준수하고자 노력합니다.
            </div>
          </section>

          {/* Disclaimer */}
          <section>
            <h3 className="text-lg font-bold text-blue-400 mb-2">면책 조항 (Disclaimer)</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>본 사이트는 기기 내 저장소(로컬 스토리지)를 활용하므로, 브라우저 환경 변화나 설정(캐시 삭제 등)에 따른 데이터 초기화 및 유실 과정에 대하여 운영자는 책임을 지지 않으며 데이터 복구를 지원하지 않습니다.</li>
              <li>사이트 이용 중 또는 생성된 이미지를 활용, 공유하여 발생하는 사용자의 손해 및 제3자와의 분쟁 등에 대하여
                본 사이트 및 운영자는 어떠한 법적 책임도 지지 않습니다.</li>
              <li>이용자의 귀책 사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.</li>
              <li>사이트는 운영, 기술상의 이유로 언제든 중단 될 수 있습니다.</li>
              <li>관련 법령의 제개정이나 서비스 정책의 변경에 따라 본 약관의 내용이 예고 없이 변경될 수 있습니다.</li>
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h3 className="text-lg font-bold text-blue-400 mb-2">문의 (Contact)</h3>
            <p className="leading-relaxed">
              서비스 오류 신고 및 기타 문의 사항이 있으실 경우 아래의 이메일로 연락해 주시기 바랍니다.<br />
              <a href="mailto:hyoctopusdev@gmail.com" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">hyoctopusdev@gmail.com</a>
            </p>
          </section>

        </div>

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}
