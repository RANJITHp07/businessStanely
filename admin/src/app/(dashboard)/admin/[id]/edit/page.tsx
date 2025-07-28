"use client";

import { useEffect, useState } from "react";
import Create, { Admin } from "../../create/page";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function EditAdmin() {
    const [admin, setAdmin] = useState<Admin | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const params = useParams();
    const router = useRouter();

    // Check if the current user is an owner
    useEffect(() => {
        const userStr = localStorage.getItem("user")
        if (userStr) {
            try {
                const user = JSON.parse(userStr)
                if (user.adminType !== "owner") {
                    // Redirect non-owner users away from this page
                    toast.error("Only owners can create or edit admins")
                    router.push("/admin")
                    return
                }
            } catch (error) {
                console.error("Error parsing user data:", error)
                router.push("/admin")
                return
            }
        } else {
            // If user data is not available, redirect to admin page
            router.push("/admin")
            return
        }
    }, [router])

    useEffect(() => {
        const fetchAdmin = async () => {
            try {
                const response = await fetch(`/api/admins/${params.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setAdmin(data);
                } else {
                    toast.error("Failed to fetch admin details");
                }
            } catch (error) {
                console.error("Error fetching admin:", error);
                toast.error("An unexpected error occurred");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAdmin();
    }, [params.id]);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return <Create admin={admin} />;
}
