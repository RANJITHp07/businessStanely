'use client'

import { fetchWithAuth } from "@/lib/fetchWithAuth";
import React, { useEffect, useState, use } from 'react'
import { toast } from "react-toastify"
import { useRouter } from "next/navigation"
import CategoryForm from '../../create/page'

interface Category {
    id: string
    name: string
    description: string
    status: string
    createdBy: string
    createdAt: string
    updatedAt: string
}

export default function EditCategory({ params }: { params: Promise<{ id: string }> | { id: string } }) {
    // Unwrap params using React.use()
    const resolvedParams = params instanceof Promise ? use(params) : params;
    const [category, setCategory] = useState<Category | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        const fetchCategory = async () => {
            try {
                const response = await fetchWithAuth(`/api/task-categories/${resolvedParams.id}`)
                if (!response.ok) {
                    throw new Error('Category not found')
                }
                const data = await response.json()
                setCategory(data)
            } catch (error) {
                console.error('Error fetching category:', error)
                toast.error('Failed to load category')
                router.push('/task_category')
            } finally {
                setLoading(false)
            }
        }

        fetchCategory()
    }, [resolvedParams.id, router])

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>
    }

    if (!category) {
        return null
    }

    const initialData = {
        id: category.id,
        name: category.name,
        description: category.description || "",
    }

    return (
        <CategoryForm admin={{ id: category.id, name: category.name }} initialData={initialData} />
    )
}
