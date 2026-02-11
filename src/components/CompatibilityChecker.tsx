'use client';

import { useState } from 'react';
import ImageUploader, { type UploadedFile } from './ImageUploader';
import { Loader2 } from 'lucide-react';
import { checkCompatibilityAction } from '@/app/actions/wardrobe';
import { createTraceContext } from '@/lib/trace';

type CompatibilityResult = Awaited<ReturnType<typeof checkCompatibilityAction>>;

export default function CompatibilityChecker() {
    const [result, setResult] = useState<CompatibilityResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const handleCheck = async (uploads: UploadedFile[]) => {
        if (uploads.length === 0) return;

        const upload = uploads[0];
        setIsProcessing(true);
        setStatus("Analyzing candidate item...");
        setResult(null);

        try {
            const trace = createTraceContext();
            const res = await checkCompatibilityAction({ storageId: upload.storageId, ...trace });
            setResult(res);
            setStatus(null);
        } catch (error) {
            console.error('compatibility.check.failed', error);
            setStatus("Error checking compatibility.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-8">
                <h2 className="text-2xl font-bold mb-6 text-center">Will it fit my style?</h2>
                <ImageUploader onUploadComplete={handleCheck} label="Upload Item to Check" allowMultiple={false} />

                {isProcessing && (
                    <div className="mt-8 text-center">
                        <Loader2 className="animate-spin h-8 w-8 mx-auto text-indigo-600 mb-2" />
                        <p className="text-gray-600">{status}</p>
                    </div>
                )}

                {status && !isProcessing && !result && (
                    <div className="mt-8 text-center p-4 bg-red-50 rounded-lg border border-red-100">
                        <p className="text-red-600">{status}</p>
                    </div>
                )}

            </div>

            {result && (
                result.evaluation ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Score Card */}
                        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 overflow-hidden relative">
                            <div className={`absolute top-0 left-0 w-full h-2 ${result.evaluation.score >= 70 ? 'bg-green-500' : result.evaluation.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} />

                            <div className="flex flex-col md:flex-row gap-8 items-center">
                                <div className="flex-1">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className={`text-5xl font-black ${result.evaluation.score >= 70 ? 'text-green-600' : result.evaluation.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {result.evaluation.score}%
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">Compatibility Score</h3>
                                            <p className="text-sm text-gray-500">Based on style, color, and wardrobe coherence</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-700 leading-relaxed text-lg">
                                        {result.evaluation.explanation}
                                    </p>
                                </div>

                                <div className="w-full md:w-1/3 bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-semibold mb-2 text-sm text-gray-500 uppercase tracking-wider">Candidate Item</h4>
                                    <p className="font-medium text-gray-900">{result.candidate.description}</p>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {result.candidate.style_tags.map((tag, i) => (
                                            <span key={i} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-600">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Similar Items */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-gray-900">Best Pairings from Wardrobe</h3>
                            {result.similarItems.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {result.similarItems.map((item) => (
                                        <div key={item.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100">
                                            <div className="aspect-[3/4] relative">
                                        <img
                                            src={item.imageUrl}
                                            alt={item.description}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                        />
                                            </div>
                                            <div className="p-3">
                                                <p className="font-medium text-sm truncate">{item.category}</p>
                                                <p className="text-xs text-green-600 mt-1">Match: {Math.round(item.similarity * 100)}%</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No similar items found in your wardrobe.</p>
                            )}
                        </div>

                        {/* Clashing Items */}
                        {result.dissimilarItems && result.dissimilarItems.length > 0 && (
                            <div>
                                <h3 className="text-xl font-bold mb-4 text-gray-900">Potential Clashes</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {result.dissimilarItems.map((item) => (
                                        <div key={item.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-red-100">
                                            <div className="aspect-[3/4] relative">
                                        <img
                                            src={item.imageUrl}
                                            alt={item.description}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                        />
                                            </div>
                                            <div className="p-3">
                                                <p className="font-medium text-sm truncate">{item.category}</p>
                                                <p className="text-xs text-red-600 mt-1">Clash: {Math.round(item.similarity * 100)}%</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
                        <p className="text-gray-600 text-lg">{result.message}</p>
                    </div>
                )
            )}
        </div>
    );
}
