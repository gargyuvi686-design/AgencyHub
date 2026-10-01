import { PrismaClient, UserRole, AgencyStatus, AgencyPlan, ProjectStatus, ProjectPriority, MilestoneStatus, TaskStatus, TaskPriority } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function hash(pwd: string): Promise<string> {
  return bcrypt.hash(pwd, SALT_ROUNDS);
}

async function main() {
  console.log('🌱 Starting database seed...');

  // ─── Clean up existing records (reverse dependency order) ───────────────────
  console.log('Cleaning up existing data...');
  await prisma.activityLog.deleteMany();
  await prisma.feedbackComment.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.file.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.agency.deleteMany();

  const defaultPasswordHash = await hash('Password123!');

  // ─── 1. Super Admin ─────────────────────────────────────────────────────────
  console.log('Creating Super Admin...');
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Platform Super Admin',
      email: 'superadmin@agencyhub.test',
      passwordHash: defaultPasswordHash,
      role: UserRole.SUPER_ADMIN,
      agencyId: null,
      clientId: null,
      isActive: true,
    },
  });

  // ─── 2. Agency A: Acme Digital (Active, PRO) ────────────────────────────────
  console.log('Creating Agency A (Acme Digital)...');
  const agencyA = await prisma.agency.create({
    data: {
      name: 'Acme Digital Agency',
      slug: 'acme-digital',
      ownerName: 'Alice Anderson',
      contactEmail: 'admin@acme.test',
      contactPhone: '+1-555-0100',
      status: AgencyStatus.ACTIVE,
      plan: AgencyPlan.PRO,
    },
  });

  const adminA = await prisma.user.create({
    data: {
      agencyId: agencyA.id,
      name: 'Alice Anderson (Admin)',
      email: 'admin@acme.test',
      passwordHash: defaultPasswordHash,
      role: UserRole.AGENCY_ADMIN,
      isActive: true,
    },
  });

  const memberA = await prisma.user.create({
    data: {
      agencyId: agencyA.id,
      name: 'Mark Miller (Member)',
      email: 'member@acme.test',
      passwordHash: defaultPasswordHash,
      role: UserRole.AGENCY_MEMBER,
      isActive: true,
    },
  });

  const clientNike = await prisma.client.create({
    data: {
      agencyId: agencyA.id,
      companyName: 'Nike Innovation',
      contactName: 'Phil Knight',
      email: 'contact@nike.test',
      phone: '+1-555-0101',
      notes: 'Key enterprise account for digital storefront redesign.',
    },
  });

  const clientUserA = await prisma.user.create({
    data: {
      agencyId: agencyA.id,
      clientId: clientNike.id,
      name: 'Phil Knight (Client)',
      email: 'client@nike.test',
      passwordHash: defaultPasswordHash,
      role: UserRole.CLIENT,
      isActive: true,
    },
  });

  const projectA = await prisma.project.create({
    data: {
      agencyId: agencyA.id,
      clientId: clientNike.id,
      managerId: adminA.id,
      name: 'E-Commerce Experience 2026',
      description: 'Complete overhaul of web & mobile checkout flow.',
      status: ProjectStatus.ACTIVE,
      priority: ProjectPriority.HIGH,
      startDate: new Date(),
    },
  });

  await prisma.projectMember.create({
    data: {
      agencyId: agencyA.id,
      projectId: projectA.id,
      userId: memberA.id,
    },
  });

  const milestoneA1 = await prisma.milestone.create({
    data: {
      agencyId: agencyA.id,
      projectId: projectA.id,
      title: 'UX Research & Wireframing',
      status: MilestoneStatus.DONE,
      sortOrder: 1,
    },
  });

  const milestoneA2 = await prisma.milestone.create({
    data: {
      agencyId: agencyA.id,
      projectId: projectA.id,
      title: 'Design System & Prototypes',
      status: MilestoneStatus.IN_PROGRESS,
      sortOrder: 2,
    },
  });

  await prisma.task.createMany({
    data: [
      {
        agencyId: agencyA.id,
        projectId: projectA.id,
        milestoneId: milestoneA1.id,
        title: 'User interview synthesis',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        createdById: adminA.id,
        assigneeId: memberA.id,
        sortOrder: 1,
      },
      {
        agencyId: agencyA.id,
        projectId: projectA.id,
        milestoneId: milestoneA2.id,
        title: 'Checkout flow responsive Figma screens',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        createdById: adminA.id,
        assigneeId: memberA.id,
        sortOrder: 2,
      },
    ],
  });

  // ─── 3. Agency B: Apex Creative Labs (Active, FREE) ─────────────────────────
  console.log('Creating Agency B (Apex Creative Labs)...');
  const agencyB = await prisma.agency.create({
    data: {
      name: 'Apex Creative Labs',
      slug: 'apex-creative',
      ownerName: 'Bob Bradley',
      contactEmail: 'admin@apex.test',
      contactPhone: '+1-555-0200',
      status: AgencyStatus.ACTIVE,
      plan: AgencyPlan.FREE,
    },
  });

  const adminB = await prisma.user.create({
    data: {
      agencyId: agencyB.id,
      name: 'Bob Bradley (Admin)',
      email: 'admin@apex.test',
      passwordHash: defaultPasswordHash,
      role: UserRole.AGENCY_ADMIN,
      isActive: true,
    },
  });

  const memberB = await prisma.user.create({
    data: {
      agencyId: agencyB.id,
      name: 'Sarah Stone (Member)',
      email: 'member@apex.test',
      passwordHash: defaultPasswordHash,
      role: UserRole.AGENCY_MEMBER,
      isActive: true,
    },
  });

  const clientSpotify = await prisma.client.create({
    data: {
      agencyId: agencyB.id,
      companyName: 'Spotify Studio',
      contactName: 'Daniel Ek',
      email: 'contact@spotify.test',
      phone: '+1-555-0201',
    },
  });

  await prisma.user.create({
    data: {
      agencyId: agencyB.id,
      clientId: clientSpotify.id,
      name: 'Daniel Ek (Client)',
      email: 'client@spotify.test',
      passwordHash: defaultPasswordHash,
      role: UserRole.CLIENT,
      isActive: true,
    },
  });

  const projectB = await prisma.project.create({
    data: {
      agencyId: agencyB.id,
      clientId: clientSpotify.id,
      managerId: adminB.id,
      name: 'Creator Dashboard Audio Analytics',
      description: 'Real-time creator charts and audience breakdown UI.',
      status: ProjectStatus.ACTIVE,
      priority: ProjectPriority.MEDIUM,
      startDate: new Date(),
    },
  });

  await prisma.projectMember.create({
    data: {
      agencyId: agencyB.id,
      projectId: projectB.id,
      userId: memberB.id,
    },
  });

  // ─── 4. Agency C: Suspended Agency (For testing suspension enforcement) ─────
  console.log('Creating Agency C (Suspended Agency)...');
  const agencyC = await prisma.agency.create({
    data: {
      name: 'Suspended Design Co',
      slug: 'suspended-design',
      ownerName: 'Charlie Clark',
      contactEmail: 'admin@suspended.test',
      status: AgencyStatus.SUSPENDED,
      suspendedReason: 'Account suspended due to billing delinquency and TOS review.',
      plan: AgencyPlan.FREE,
    },
  });

  await prisma.user.create({
    data: {
      agencyId: agencyC.id,
      name: 'Charlie Clark (Suspended Admin)',
      email: 'admin@suspended.test',
      passwordHash: defaultPasswordHash,
      role: UserRole.AGENCY_ADMIN,
      isActive: true,
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log('\nDemo Logins (Password for all accounts is "Password123!"):');
  console.log('---------------------------------------------------------');
  console.log('Super Admin:   superadmin@agencyhub.test (/admin)');
  console.log('Agency A Admin:admin@acme.test           (/app)');
  console.log('Agency A Member:member@acme.test         (/app)');
  console.log('Client Portal: client@nike.test          (/portal)');
  console.log('Agency B Admin:admin@apex.test           (/app)');
  console.log('Agency B Member:member@apex.test         (/app)');
  console.log('Suspended User:admin@suspended.test      (Blocked with 403)');
  console.log('---------------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
