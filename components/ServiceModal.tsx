


import React from 'react';
import { LABELS, SERVICE_DETAILS } from '../constants';
import { ServiceCode } from '../types';

interface ServiceModalProps {
  code: ServiceCode;
  onClose: () => void;
  onStartChat: () => void;
}

const ServiceModal: React.FC<ServiceModalProps> = ({ code, onClose, onStartChat }) => {
  const data = SERVICE_DETAILS[code];
  if (!data) return null;

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/50 z-20" onClick={onClose}>
      <div className="glass rounded-t-2xl sm:rounded-2xl w-full sm:w-[92%] max-w-2xl p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="svcTitle" aria-describedby="svcSubtitle svcPoints" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="svcTitle" className="text-lg font-semibold">{code}) {LABELS[code]}</h3>
            <p id="svcSubtitle" className="text-sm text-gray-300 mt-1">{data.sub}</p>
          </div>
          <button onClick={onClose} className="pill px-3 py-2 text-sm" aria-label="Close service details">Close</button>
        </div>
        <ul id="svcPoints" className="mt-4 list-disc list-inside space-y-2 text-sm text-gray-200">
          {data.points.map((point, index) => <li key={index}>{point}</li>)}
        </ul>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span id="svcBadge" className="pill px-3 py-1 text-xs text-gray-300">{data.badge}</span>
          <div className="flex gap-2">
            <button id="svcStart" className="btn btn-primary" onClick={onStartChat}>Start chat</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceModal;