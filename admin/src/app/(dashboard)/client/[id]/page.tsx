"use client"

import { useState, useEffect } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, Edit, Trash2, User, Building2 } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";

import { Client } from '@/types';
import TransferTasksDialog, { type TransferTasksMode } from '../_component/transferTasksDialog';

export default function ClientDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    // Target-client picker needs the full list, not just this client.
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [transferDialogMode, setTransferDialogMode] = useState<TransferTasksMode>("delete");
    const [transferDialogOpen, setTransferDialogOpen] = useState(false);

    useEffect(() => {
        if (!id) return;
        const fetchClient = async () => {
            try {
                const response = await fetch(`/api/clients/${id}`);
                if (response.ok) {
                    const data = await response.json();
                    setClient(data);
                } else {
                    notFound();
                }
            } catch (error) {
                console.error("Error fetching client:", error);
                notFound();
            } finally {
                setLoading(false);
            }
        };

        fetchClient();
    }, [id]);

    useEffect(() => {
        const fetchAllClients = async () => {
            try {
                const response = await fetch('/api/clients');
                if (response.ok) {
                    setAllClients(await response.json());
                }
            } catch (error) {
                console.error("Error fetching clients:", error);
            }
        };

        fetchAllClients();
    }, []);

    const openTransferDialog = (mode: TransferTasksMode) => {
        setTransferDialogMode(mode);
        setTransferDialogOpen(true);
    };

    // A deleted client has no detail page left to show, so leave for the list.
    const handleTransferCompleted = ({ sourceDeleted }: { sourceDeleted: boolean }) => {
        if (sourceDeleted) {
            router.push('/client');
        }
    };

    if (!client) {
        return notFound();
    }

    const getClientName = () => {
        if (client.clientType === 'individual') {
            return `${client.firstName} ${client.lastName}`;
        }
        return client.organizationName;
    }

    return (
        <div className="mx-auto p-6 max-w-4xl">
            <div className="flex justify-between items-center mb-8">
                <Button asChild variant="outline">
                    <Link href="/client">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Clients
                    </Link>
                </Button>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link href={`/client/${client.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={() => openTransferDialog("transfer")}>
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        Transfer Tasks
                    </Button>
                    <Button variant="destructive" onClick={() => openTransferDialog("delete")}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <Avatar className="h-24 w-24">
                        <AvatarFallback>
                            {client.clientType === 'individual' ? <User size={48} /> : <Building2 size={48} />}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="text-3xl">{getClientName()}</CardTitle>
                        <p className="text-muted-foreground">{client.clientType === 'individual' ? 'Individual Client' : 'Organization Client'}</p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {client.clientType === 'individual' && (
                        <div>
                            <h3 className="font-semibold">Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <p><strong>Gender:</strong> {client.gender}</p>
                                <p><strong>Date of Birth:</strong> {client.dateOfBirth ? new Date(client.dateOfBirth).toLocaleDateString() : 'N/A'}</p>
                                <p><strong>ID Proof:</strong> {client.idProofType} - {client.idProofNumber}</p>
                            </div>
                        </div>
                    )}
                    {client.clientType === 'organization' && (
                        <div>
                            <h3 className="font-semibold">Organization Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <p><strong>Registration Number:</strong> {client.registrationNumber}</p>
                                <p><strong>Entity Type:</strong> {client.entityType}</p>
                                <p><strong>Incorporation Date:</strong> {client.incorporationDate ? new Date(client.incorporationDate).toLocaleDateString() : 'N/A'}</p>
                                <p><strong>GST Number:</strong> {client.gstNumber}</p>
                                <p><strong>Authorized Person:</strong> {client.authorizedPersonName} ({client.designation})</p>
                                <p><strong>Contact Email:</strong> {client.contactEmail}</p>
                            </div>
                        </div>
                    )}
                    <div>
                        <h3 className="font-semibold">Contact Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <p><strong>Email:</strong> {client.email}</p>
                            <p><strong>Phone:</strong> {client.phoneNumber}</p>
                            {client.secondaryPhoneNumber && <p><strong>Secondary Phone:</strong> {client.secondaryPhoneNumber}</p>}
                            <p><strong>Address:</strong> {client.address}</p>
                            <p><strong>Preferred Communication:</strong> {client.preferredCommunication}</p>
                        </div>
                    </div>
                    {client.notes && (
                        <div>
                            <h3 className="font-semibold">Notes</h3>
                            <p>{client.notes}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <TransferTasksDialog
                open={transferDialogOpen}
                onOpenChange={setTransferDialogOpen}
                mode={transferDialogMode}
                client={client}
                allClients={allClients}
                onCompleted={handleTransferCompleted}
            />
        </div>
    );
}