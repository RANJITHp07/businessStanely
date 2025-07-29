import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin, AdminUser } from "@/lib/auth";


export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        // Get the current admin user
        const currentAdmin = await getCurrentAdmin(req);
        
        if (!currentAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = params;
        const admin = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                email: true,
                adminType: true,
            },
        }) as AdminUser | null;

        if (!admin) {
            return NextResponse.json({ error: "Admin not found" }, { status: 404 });
        }

        // All admin types can view admin details

        return NextResponse.json(admin);
    } catch (error) {
        console.error("Error fetching admin:", error);
        return NextResponse.json(
            { error: "Error fetching admin details" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        // Get the current admin user
        const currentAdmin = await getCurrentAdmin(req);
        
        if (!currentAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (currentAdmin.adminType !== "owner") {
            return NextResponse.json(
                { error: "Only owners can update admin details" },
                { status: 403 }
            );
        }

        const { id } = params;
        const body = await req.json();
        const { username, email, adminType } = body as {
            username: string;
            email: string;
            adminType: "owner" | "admin";
        };

        // Validate required fields
        if (!username || !email || !adminType || !["owner", "admin"].includes(adminType)) {
            return NextResponse.json(
                { error: "All fields are required and must be valid" },
                { status: 400 }
            );
        }

        // Make sure the admin exists before updating
        const existingAdmin = await prisma.user.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!existingAdmin) {
            return NextResponse.json(
                { error: "Admin not found" },
                { status: 404 }
            );
        }

        // Update the admin
        await prisma.user.update({
            where: { id },
            data: {
                username,
                email,
                adminType,
            },
        });

        return NextResponse.json(
            { message: "Admin updated successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error updating admin:", error);
        
        // Check for unique constraint violations
        if (error instanceof Error && 'code' in error && error.code === 'P2002') {
            return NextResponse.json(
                { error: "Username or email already exists" },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: "Error updating admin" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        // Get the current admin user
        const currentAdmin = await getCurrentAdmin(req);
        
        if (!currentAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only owners can delete admins
        if (currentAdmin.adminType !== "owner") {
            return NextResponse.json(
                { error: "Only owners can delete admins" },
                { status: 403 }
            );
        }

        // Ensure params is awaited before accessing its properties
        const id = params.id;

        // Prevent deleting yourself
        if (id === currentAdmin.id) {
            return NextResponse.json(
                { error: "You cannot delete your own account" },
                { status: 400 }
            );
        }

        // Check if admin exists
        const existingAdmin = await prisma.user.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!existingAdmin) {
            return NextResponse.json(
                { error: "Admin not found" },
                { status: 404 }
            );
        }

        // First, find all comments associated with this admin
        const comments = await prisma.comment.findMany({
            where: {
                authorId: id,
                authorType: "USER"
            }
        });

        // If there are comments, delete them first
        if (comments.length > 0) {
            await prisma.comment.deleteMany({
                where: {
                    authorId: id,
                    authorType: "USER"
                }
            });
        }

        // Now delete the admin
        await prisma.user.delete({
            where: { id },
        });

        return NextResponse.json(
            { message: "Admin deleted successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error deleting admin:", error);
        return NextResponse.json(
            { error: "Error deleting admin" },
            { status: 500 }
        );
    }
}