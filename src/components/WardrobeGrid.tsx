import Image from "next/image";

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
                    </div>
                    <div className="p-3">
                        <p className="font-bold text-sm text-gray-900">{item.category}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {item.style_tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-[10px] bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
