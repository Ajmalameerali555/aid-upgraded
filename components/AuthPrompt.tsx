import React, { useEffect, useRef, useState } from 'react';
import { GoogleIcon } from './Icons';

declare global {
  interface Window {
    google?: any;
  }
}

interface AuthPromptProps {
    userName: string;
    onGoogleSignInSuccess: (credentialResponse: any) => void;
    onGuestSubmit: (contactInfo: { email: string; }) => void;
}

const AuthPrompt: React.FC<AuthPromptProps> = ({ userName, onGoogleSignInSuccess, onGuestSubmit }) => {
    const googleButtonRef = useRef<HTMLDivElement>(null);
    const CLIENT_ID = "662825592554-ufovpjm4bv5me9d5427f62m97adkf3rj.apps.googleusercontent.com";
    const [showGuestForm, setShowGuestForm] = useState(false);
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState<{ email?: string }>({});

    useEffect(() => {
        if (window.google && googleButtonRef.current && !showGuestForm) {
            window.google.accounts.id.initialize({
                client_id: CLIENT_ID,
                callback: onGoogleSignInSuccess,
            });
            window.google.accounts.id.renderButton(
                googleButtonRef.current,
                { theme: "filled_black", size: "large", type: "standard", text: "signin_with" }
            );
        }
    }, [onGoogleSignInSuccess, showGuestForm]);
    
    const validate = () => {
        const newErrors: { email?: string; } = {};
        if (!email) {
            newErrors.email = "Email is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = "Please enter a valid email address.";
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            onGuestSubmit({ email });
        }
    };


    return (
        <div className="flex justify-start w-full">
            <div className="px-4 py-3 rounded-xl border w-full max-w-2xl msg-bot">
                <h3 className="font-semibold text-base mb-1">Welcome, {userName}!</h3>
                
                {!showGuestForm ? (
                    <>
                        <p className="text-sm text-gray-300 mb-4">Sign in with Google to save your chat history and access it across devices.</p>
                        <div className="flex flex-wrap items-center gap-4 mt-4">
                            <div ref={googleButtonRef}></div>
                            <button onClick={() => setShowGuestForm(true)} className="btn-link text-sm">
                                Continue as Guest
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">Continuing as a guest will only save your chats on this browser.</p>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-gray-300 mb-4">Please provide your details to continue. Your chat history will be saved on this browser only.</p>
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="guest-email" className="text-xs text-gray-400 block mb-1">Email Address</label>
                                <input
                                    id="guest-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`input w-full rounded-md px-3 py-1.5 text-base outline-none focus:ring-2 ${errors.email ? 'border-red-500 focus:ring-red-400' : 'focus:ring-purple-400'}`}
                                    placeholder="example@email.com"
                                    aria-required="true"
                                    aria-invalid={!!errors.email}
                                    aria-describedby={errors.email ? "email-error" : undefined}
                                />
                                {errors.email && <p id="email-error" role="alert" className="text-xs text-red-400 mt-1">{errors.email}</p>}
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <button onClick={handleSubmit} className="btn btn-primary">
                                Proceed as Guest
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuthPrompt;