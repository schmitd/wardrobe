"use client";

import Image from "next/image";
import { useState } from "react";
import { deleteItem } from "@/app/actions";
import { Trash2 } from "lucide-react";

interface WardrobeItem {
    id: string;
    image_url: string;
    category: string;
    description: string;
    style_tags: string[];
}

interface WardrobeGridProps {
    items: WardrobeItem[];
}

export default function WardrobeGrid({ items }: WardrobeGridProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [reason, setReason] = useState("Disliked item style");
    const [showConfirm, setShowConfirm] = useState<string | null>(null); // ID of item to confirm delete

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        await deleteItem(id, reason);
        setDeletingId(null);
        setShowConfirm(null);
    };

    if (items.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500">
                No items in your wardrobe yet. Upload some!
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
                <div key={item.id} className="group relative break-inside-avoid rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow bg-white">
                    <div className="aspect-[3/4] relative">
                        <Image
                            src={item.image_url}
                            alt={item.description}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Delete Button (Visible on Hover or if Confirming) */}
                        <div className={`absolute top-2 right-2 ${showConfirm === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                            <button
                                onClick={() => setShowConfirm(item.id)}
                                className="bg-white/80 hover:bg-red-100 p-2 rounded-full text-red-600 shadow-sm backdrop-blur-sm"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="p-3">
                        <p className="font-bold text-sm text-gray-900">{item.category}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {(item.style_tags || []).slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-[10px] bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Delete Confirmation Overlay */}
                    {showConfirm === item.id && (
                        <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in zoom-in-95 duration-200">
                            <h4 className="font-semibold text-sm mb-2 text-gray-900">Delete Item?</h4>
                            <select
                                className="text-xs p-1 border rounded mb-3 w-full"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            >
                                <option value="Disliked item style">Disliked Style</option>
                                <option value="Item damaged/lost">Damaged/Lost</option>
                                <option value="Poor fit">Poor Fit</option>
                                <option value="Other">Other</option>
                            </select>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowConfirm(null)}
                                    className="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    disabled={deletingId === item.id}
                                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                    {deletingId === item.id ? '...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
