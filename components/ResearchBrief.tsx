import React from 'react';
import { ResearchBundle, VerificationLabel } from '../types';
import { VerifiedIcon, InferredIcon, UnverifiedIcon } from './Icons';

interface ResearchBriefProps {
  data: ResearchBundle;
}

const LabelIndicator: React.FC<{ label: VerificationLabel }> = ({ label }) => {
  const styles: Record<VerificationLabel, { className: string; icon: React.ReactNode; text: string }> = {
    "Verified": {
      className: "label-verified",
      icon: <VerifiedIcon />,
      text: "Verified"
    },
    "Reasonably Inferred": {
      className: "label-inferred",
      icon: <InferredIcon />,
      text: "Reasonably Inferred"
    },
    "Unverified—Needs Source": {
      className: "label-unverified",
      icon: <UnverifiedIcon />,
      text: "Unverified—Needs Source"
    }
  };

  const { className, icon, text } = styles[label] || styles["Unverified—Needs Source"];

  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold ${className}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
};

const ResearchBrief: React.FC<ResearchBriefProps> = ({ data }) => {
  return (
    <div className="flex justify-start w-full msg-animated">
      <div className="research-brief rounded-xl border w-full max-w-3xl">
        <div className="px-4 py-3">
          <h2 className="font-semibold text-base">Legal Research Brief</h2>
          <p className="text-sm text-gray-400 mt-1">
            <span className="font-semibold">Issue:</span> {data.issue}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span className="pill px-2 py-0.5 capitalize">{data.forum} Forum</span>
            <span>Last Verified: {data.lastVerifiedOn}</span>
          </div>
        </div>

        <div className="border-t border-white/10">
          {data.points.map((point, index) => (
            <div key={index} className="research-point px-4 py-3">
              <LabelIndicator label={point.label} />
              <p className="mt-1.5 text-[0.95rem] text-gray-200">{point.proposition}</p>
              {point.cite && (
                <p className="mt-2 text-xs text-gray-400">
                  <span className="font-semibold">Citation:</span> {point.cite}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 px-4 py-2 text-[11px] text-gray-500">
          <strong>Disclaimer:</strong> This material provides legal information and analysis. It is not legal advice nor a substitute for advice from a qualified lawyer. No lawyer–client relationship is formed.
        </div>
      </div>
    </div>
  );
};

export default ResearchBrief;