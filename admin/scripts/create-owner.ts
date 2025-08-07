import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createOwner() {
  try {
    // Check if owner already exists
    const existingOwner = await prisma.user.findUnique({
      where: { email: 'fr7190143@gmail.com' }
    });

    if (existingOwner) {
      console.log('Owner already exists with email: fr7190143@gmail.com');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('Faizu123', 12);

    // Create the owner user
    const owner = await prisma.user.create({
      data: {
        username: 'Owner',
        email: 'fr7190143@gmail.com',
        password: hashedPassword,
        adminType: 'owner',
        status: 'active',
        permissions: [
          'user_management',
          'agent_management',
          'client_management',
          'task_management',
          'category_management',
          'system_settings',
          'reports_analytics'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('Owner created successfully:');
    console.log({
      id: owner.id,
      username: owner.username,
      email: owner.email,
      adminType: owner.adminType,
      status: owner.status
    });

  } catch (error) {
    console.error('Error creating owner:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createOwner();
