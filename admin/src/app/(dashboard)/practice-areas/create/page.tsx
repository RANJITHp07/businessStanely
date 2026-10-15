"use client"

import PracticeAreaForm, { EMPTY_PRACTICE_AREA } from "../_components/PracticeAreaForm"

export default function CreatePracticeArea() {
    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Create New Parameter Area</h1>
                <p className="text-muted-foreground mt-2">
                    Add a service visitors can pick on the website, with the details clients fill in for it in their portal.
                </p>
            </div>
            <PracticeAreaForm initial={EMPTY_PRACTICE_AREA} />
        </div>
    )
}
