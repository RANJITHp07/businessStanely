export interface Agent {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    secondaryPhoneNumber: string | null;
    agentType: string;
    barAssociationId: string;
    jurisdiction: string;
    specializations: string[];
    photo: string | null;
    superior: Agent | null;
    subordinates: Agent[];
}

export interface Client {
    id: string;
    clientType: string;
    email: string;
    phoneNumber: string;
    secondaryPhoneNumber: string | null;
    address: string | null;
    preferredCommunication: string | null;
    notes: string | null;
    firstName: string | null;
    lastName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    idProofType: string | null;
    idProofNumber: string | null;
    organizationName: string | null;
    registrationNumber: string | null;
    entityType: string | null;
    incorporationDate: string | null;
    gstNumber: string | null;
    authorizedPersonName: string | null;
    designation: string | null;
    contactEmail: string | null;
}