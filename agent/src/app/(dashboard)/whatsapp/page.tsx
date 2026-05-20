"use client";

import { useEffect } from "react";

export default function WhatsAppRedirectPage() {
    useEffect(() => {
        // Open WhatsApp Web in a new tab
        window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <h2 className="text-xl font-semibold mt-10">WhatsApp is opening in a new tab...</h2>
            <p className="text-gray-500 mt-2">If nothing happens, <a href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">click here</a>.</p>
        </div>
    );
}
