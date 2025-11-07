import React, { useState, useMemo } from 'react';

interface ClauseSwapWizardProps {
    templateContent: string;
    onFinalize: (finalizedContent: string) => void;
}

const ClauseSwapWizard: React.FC<ClauseSwapWizardProps> = ({ templateContent, onFinalize }) => {
    const placeholders = useMemo(() => {
        const matches = templateContent.match(/\<\<([^\>]+)\>\>/g);
        if (!matches) return [];
        // Get unique placeholders, removing the << and >>
        return [...new Set(matches)].map((p: string) => p.substring(2, p.length - 2));
    }, [templateContent]);

    const [values, setValues] = useState<Record<string, string>>(() => 
        placeholders.reduce((acc, p) => ({ ...acc, [p]: '' }), {})
    );

    const handleInputChange = (placeholder: string, value: string) => {
        setValues(prev => ({ ...prev, [placeholder]: value }));
    };

    const handleFinalize = () => {
        let finalized = templateContent;
        for (const placeholder of placeholders) {
            const value = values[placeholder] || `[${placeholder}_NOT_PROVIDED]`;
            // Use a regex with 'g' flag to replace all occurrences
            const regex = new RegExp(`\\<\\<${placeholder}\\>\\>`, 'g');
            finalized = finalized.replace(regex, value);
        }
        onFinalize(finalized);
    };

    // Simple title case for labels
    const formatLabel = (s: string) => s.replace(/_/g, ' ').replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

    return (
        <div className="flex justify-start w-full">
            <div className="px-4 py-3 rounded-xl border w-full max-w-2xl msg-bot">
                <h3 className="font-semibold text-base mb-1">Clause-Swap Wizard</h3>
                <p className="text-sm text-gray-300 mb-4">Please fill in the details below to complete your document.</p>
                
                <div className="space-y-3">
                    {placeholders.map(p => (
                        <div key={p}>
                            <label htmlFor={p} className="text-xs text-gray-400 block mb-1">{formatLabel(p)}</label>
                            <input
                                id={p}
                                type="text"
                                value={values[p]}
                                onChange={(e) => handleInputChange(p, e.target.value)}
                                className="input w-full rounded-md px-3 py-1.5 text-base outline-none focus:ring-2 focus:ring-purple-400"
                            />
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex justify-end">
                    <button onClick={handleFinalize} className="btn btn-primary">
                        Finalize Document
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClauseSwapWizard;