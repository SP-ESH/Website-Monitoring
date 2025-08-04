import { useState } from "react";

export default function URLInput({ onSubmit }: { onSubmit: (url: string) => void }) {
    const [url, setUrl] = useState("");

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (url) onSubmit(url);
            }}
            className="flex flex-col space-y-2 max-w-md mx-auto"
        >
            <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter website URL"
                className="p-2 border rounded text-gray-700"
                required
            />
            <button type="submit" className="bg-blue-600 text-white p-2 rounded">
                Monitor Website
            </button>
        </form>
    );
}
