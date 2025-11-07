import React from 'react';

interface PrivacyPolicyProps {
  onClose: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4" onClick={onClose}>
      <div 
        className="glass rounded-2xl w-full max-w-3xl h-full max-h-[85vh] flex flex-col shadow-2xl" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="privacy-title" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-start justify-between gap-3 p-6 border-b border-white/10">
          <div>
            <h2 id="privacy-title" className="text-lg font-semibold">Privacy Policy for AIDLEX.AE</h2>
            <p className="text-sm text-gray-400 mt-1">Last Updated: {new Date().toLocaleDateString('en-GB')}</p>
          </div>
          <button onClick={onClose} className="pill px-3 py-2 text-sm">Close</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm text-gray-300">
          <p>Welcome to AIDLEX.AE. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application.</p>

          <h3 className="text-base font-semibold text-white pt-2">1. Information We Collect</h3>
          <p>We may collect the following types of information:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Personal Information:</strong> When you proceed as a guest, we ask for your name, email, and mobile number. If you sign in with Google, we receive your name and email address from your Google account.</li>
            <li><strong>Chat Data:</strong> All text, queries, and documents you submit during your chat sessions are collected to provide you with AI-generated responses.</li>
            <li><strong>Voice Data:</strong> If you use the voice input (microphone) feature, your speech is captured and converted to text for processing. We do not store the audio recordings.</li>
            <li><strong>Usage Data:</strong> Your chat history (messages, session titles) is stored locally in your browser's storage to allow you to continue your sessions.</li>
          </ul>

          <h3 className="text-base font-semibold text-white pt-2">2. How We Use Your Information</h3>
          <p>We use the information we collect to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Provide, operate, and maintain our services.</li>
            <li>Personalize your experience by addressing you by name.</li>
            <li>Process your queries and provide responses through our AI models.</li>
            <li>Enable session persistence by saving your chat history on your device.</li>
            <li>Comply with legal obligations.</li>
          </ul>

          <h3 className="text-base font-semibold text-white pt-2">3. Data Sharing and Third Parties</h3>
          <p>To provide our service, we share some of your data with third-party providers:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Google Gemini API:</strong> Your chat messages, attached documents, and system instructions are sent to Google's Gemini API to generate responses. We do not control how Google processes this data. We encourage you to review Google's privacy policy.</li>
            <li><strong>Google Sign-In:</strong> If you choose to authenticate, we use Google's Sign-In service. This interaction is subject to Google's privacy policy.</li>
          </ul>
          <p>We do not sell or rent your personal information to third parties.</p>

          <h3 className="text-base font-semibold text-white pt-2">4. Data Storage and Security</h3>
          <p>Your chat history and session data are stored in your browser's Local Storage. This means the data resides on your device and is not automatically synced across devices unless you are logged into a profile (a feature that may be implemented in the future).</p>
          <p>We take reasonable measures to protect your information, but no electronic storage or transmission is 100% secure.</p>
          
          <h3 className="text-base font-semibold text-white pt-2">5. Your Rights and Choices</h3>
          <p>You have control over your data in the following ways:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Access and Review:</strong> You can review your chat history at any time within the application.</li>
            <li><strong>Deletion:</strong> You can delete your entire chat history using the "Clear All History" button in the settings menu. This action is irreversible and removes all session data from your browser's storage.</li>
            <li><strong>Microphone Access:</strong> You can grant or deny microphone access through your browser's permission settings. The voice input feature will not function without this permission.</li>
          </ul>

          <h3 className="text-base font-semibold text-white pt-2">6. Changes to This Privacy Policy</h3>
          <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>

          <h3 className="text-base font-semibold text-white pt-2">7. Contact Us</h3>
          <p>If you have any questions about this Privacy Policy, please contact us through the available channels on our main website.</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
