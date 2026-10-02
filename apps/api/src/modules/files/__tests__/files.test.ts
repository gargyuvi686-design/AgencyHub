import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';
import { signSupportToken, SUPPORT_COOKIE_NAME } from '../../../lib/jwt';

const PASSWORD = 'Password123!';
const UUID_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loginAs(email: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${response.status}`);

  const cookies = Array.isArray(response.headers['set-cookie'])
    ? response.headers['set-cookie']
    : [response.headers['set-cookie']];
  const authCookie = cookies.find((cookie) => cookie.startsWith('token='));
  if (!authCookie) throw new Error(`No token cookie returned for ${email}`);
  return authCookie.split(';')[0];
}

describe('Project file HTTP isolation and storage', () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let agencyAId: string;
  let agencyBId: string;
  let ownProjectId: string;
  let otherClientProjectId: string;
  let agencyBProjectId: string;
  let clientId: string;
  let memberId: string;
  let clientCookie: string;
  let adminACookie: string;
  let adminBCookie: string;
  let memberCookie: string;
  let supportCookie: string;
  let adminFileId: string;
  const fileIds: string[] = [];
  const traversalPaths: string[] = [];

  beforeAll(async () => {
    previousUploadDir = process.env.UPLOAD_DIR;
    uploadDir = await mkdtemp(path.join(tmpdir(), 'agencyhub-files-'));
    process.env.UPLOAD_DIR = uploadDir;

    const agencyA = await prisma.agency.findUniqueOrThrow({ where: { slug: 'acme-digital' } });
    const agencyB = await prisma.agency.findUniqueOrThrow({ where: { slug: 'apex-creative' } });
    agencyAId = agencyA.id;
    agencyBId = agencyB.id;

    const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@nike.test' } });
    const client = await prisma.client.findUniqueOrThrow({ where: { id: clientUser.clientId! } });
    clientId = client.id;
    const otherClient = await prisma.client.findFirst({ where: { agencyId: agencyAId, id: { not: clientId } } }) ??
      await prisma.client.create({
        data: {
          agencyId: agencyAId,
          companyName: 'File Isolation Client',
          contactName: 'File Isolation Contact',
          email: 'file-isolation@example.test',
        },
      });

    const adminA = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@acme.test' } });
    const adminB = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@apex.test' } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@acme.test' } });
    const superAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'superadmin@agencyhub.test' } });
    memberId = member.id;

    const ownProject = await prisma.project.findFirst({ where: { agencyId: agencyAId, clientId } }) ??
      await prisma.project.create({
        data: { agencyId: agencyAId, clientId, managerId: adminA.id, name: 'File Own Project Fixture' },
      });
    const otherClientProject = await prisma.project.findFirst({ where: { agencyId: agencyAId, clientId: otherClient.id } }) ??
      await prisma.project.create({
        data: { agencyId: agencyAId, clientId: otherClient.id, managerId: adminA.id, name: 'File Other Client Fixture' },
      });
    const agencyBClient = await prisma.client.findFirst({ where: { agencyId: agencyBId } }) ??
      await prisma.client.create({
        data: {
          agencyId: agencyBId,
          companyName: 'File Agency B Client',
          contactName: 'File Agency B Contact',
          email: 'file-agency-b@example.test',
        },
      });
    const agencyBProject = await prisma.project.findFirst({ where: { agencyId: agencyBId } }) ??
      await prisma.project.create({
        data: { agencyId: agencyBId, clientId: agencyBClient.id, managerId: adminB.id, name: 'File Agency B Project Fixture' },
      });

    ownProjectId = ownProject.id;
    otherClientProjectId = otherClientProject.id;
    agencyBProjectId = agencyBProject.id;

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: ownProjectId, userId: memberId } },
      create: { agencyId: agencyAId, projectId: ownProjectId, userId: memberId },
      update: {},
    });

    clientCookie = await loginAs(clientUser.email);
    adminACookie = await loginAs('admin@acme.test');
    adminBCookie = await loginAs('admin@apex.test');
    memberCookie = await loginAs('member@acme.test');
    const superAdminCookie = await loginAs('superadmin@agencyhub.test');
    supportCookie = `${superAdminCookie}; ${SUPPORT_COOKIE_NAME}=${signSupportToken({
      superAdminId: superAdmin.id,
      supportAgencyId: agencyAId,
    })}`;
  });

  afterAll(async () => {
    if (fileIds.length) await prisma.file.deleteMany({ where: { id: { in: fileIds } } });
    if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
    await Promise.all(traversalPaths.map((filePath) => rm(filePath, { force: true })));
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
  });

  async function upload(cookie: string, projectId: string, fileName: string, contents: Buffer | string) {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/files`)
      .set('Cookie', cookie)
      .attach('file', Buffer.isBuffer(contents) ? contents : Buffer.from(contents), {
        filename: fileName,
        contentType: fileName.endsWith('.txt') ? 'text/plain' : 'application/pdf',
      });
    if (response.status === 201) fileIds.push(response.body.data.id);
    return response;
  }

  it('assigned member and admin can upload/list files; downloads stream bytes and use UUID storage names', async () => {
    const traversalName = `../../${randomUUID()}.txt`;
    const outsidePath = path.resolve(uploadDir, traversalName);
    traversalPaths.push(outsidePath);
    const adminUpload = await upload(adminACookie, ownProjectId, traversalName, 'private file bytes');
    expect(adminUpload.status).toBe(201);
    adminFileId = adminUpload.body.data.id as string;

    const storedFile = await prisma.file.findUniqueOrThrow({ where: { id: adminFileId } });
    expect(UUID_FILE_NAME.test(storedFile.storageKey)).toBe(true);
    const storedPath = path.resolve(uploadDir, storedFile.storageKey);
    expect(path.dirname(storedPath)).toBe(path.resolve(uploadDir));
    await expect(access(outsidePath)).rejects.toMatchObject({ code: 'ENOENT' });

    const memberList = await request(app)
      .get(`/api/v1/projects/${ownProjectId}/files`)
      .set('Cookie', memberCookie);
    expect(memberList.status).toBe(200);
    expect(memberList.body.data.some((file: { id: string }) => file.id === adminFileId)).toBe(true);

    const memberUpload = await upload(memberCookie, ownProjectId, 'member.txt', 'member bytes');
    expect(memberUpload.status).toBe(201);

    const downloaded = await request(app)
      .get(`/api/v1/files/${adminFileId}/download`)
      .set('Cookie', adminACookie);
    expect(downloaded.status).toBe(200);
    expect(downloaded.text).toBe('private file bytes');
    expect(downloaded.headers['content-disposition']).toMatch(/^attachment;/i);
    expect(downloaded.headers['content-disposition']).not.toMatch(/[\r\n/\\]/);

    expect((await request(app).get(`/uploads/${storedFile.storageKey}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/uploads/${storedFile.storageKey}`)).status).toBe(404);

    const diskEntries = await readdir(uploadDir);
    expect(diskEntries.some((name) => UUID_FILE_NAME.test(name))).toBe(true);
    expect(diskEntries.every((name) => UUID_FILE_NAME.test(name))).toBe(true);

    const uploadedEvent = await prisma.activityLog.findFirstOrThrow({
      where: { agencyId: agencyAId, entityId: adminFileId, eventType: 'file.uploaded' },
    });
    expect(uploadedEvent.visibleToClient).toBe(false);

    const memberStorage = await prisma.file.findUniqueOrThrow({ where: { id: memberUpload.body.data.id } });
    const memberDelete = await request(app)
      .delete(`/api/v1/files/${memberUpload.body.data.id}`)
      .set('Cookie', memberCookie);
    expect(memberDelete.status).toBe(204);
    const deletedStorage = await prisma.file.findUnique({ where: { id: memberUpload.body.data.id } });
    expect(deletedStorage).toBeNull();
    await expect(access(path.join(uploadDir, memberStorage.storageKey))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('Scenario 5: cross-agency file list and download and cross-client download return 404', async () => {
    const agencyBUpload = await upload(adminBCookie, agencyBProjectId, 'agency-b.txt', 'agency B bytes');
    expect(agencyBUpload.status).toBe(201);

    const foreignList = await request(app)
      .get(`/api/v1/projects/${agencyBProjectId}/files`)
      .set('Cookie', adminACookie);
    expect(foreignList.status).toBe(404);

    const foreignDownload = await request(app)
      .get(`/api/v1/files/${agencyBUpload.body.data.id}/download`)
      .set('Cookie', adminACookie);
    expect(foreignDownload.status).toBe(404);

    const otherClientUpload = await upload(adminACookie, otherClientProjectId, 'client-two.pdf', 'client two bytes');
    expect(otherClientUpload.status).toBe(201);

    const memberList = await request(app)
      .get(`/api/v1/projects/${otherClientProjectId}/files`)
      .set('Cookie', memberCookie);
    expect(memberList.status).toBe(404);

    const memberUpload = await upload(memberCookie, otherClientProjectId, 'unassigned.txt', 'not allowed');
    expect(memberUpload.status).toBe(404);

    const memberDownload = await request(app)
      .get(`/api/v1/files/${otherClientUpload.body.data.id}/download`)
      .set('Cookie', memberCookie);
    expect(memberDownload.status).toBe(404);

    await request(app)
      .patch(`/api/v1/files/${otherClientUpload.body.data.id}`)
      .set('Cookie', adminACookie)
      .send({ visibleToClient: true })
      .expect(200);

    const clientForeignDownload = await request(app)
      .get(`/api/v1/portal/files/${otherClientUpload.body.data.id}/download`)
      .set('Cookie', clientCookie);
    expect(clientForeignDownload.status).toBe(404);
  });

  it('CLIENT tokens receive 403 on workspace file list, upload, download, share, and delete routes', async () => {
    const list = await request(app)
      .get(`/api/v1/projects/${ownProjectId}/files`)
      .set('Cookie', clientCookie);
    expect(list.status).toBe(403);

    const uploadAttempt = await request(app)
      .post(`/api/v1/projects/${ownProjectId}/files`)
      .set('Cookie', clientCookie)
      .attach('file', Buffer.from('blocked'), { filename: 'blocked.txt', contentType: 'text/plain' });
    expect(uploadAttempt.status).toBe(403);

    const download = await request(app)
      .get(`/api/v1/files/${adminFileId}/download`)
      .set('Cookie', clientCookie);
    expect(download.status).toBe(403);

    const patch = await request(app)
      .patch(`/api/v1/files/${adminFileId}`)
      .set('Cookie', clientCookie)
      .send({ visibleToClient: true });
    expect(patch.status).toBe(403);

    const deleteAttempt = await request(app)
      .delete(`/api/v1/files/${adminFileId}`)
      .set('Cookie', clientCookie);
    expect(deleteAttempt.status).toBe(403);
  });

  it('Scenario 9: CLIENT lists and downloads shared files but gets 404 for an unshared file', async () => {
    const privateUpload = await upload(adminACookie, ownProjectId, 'not-shared.txt', 'not public');
    expect(privateUpload.status).toBe(201);

    const hiddenDownload = await request(app)
      .get(`/api/v1/portal/files/${privateUpload.body.data.id}/download`)
      .set('Cookie', clientCookie);
    expect(hiddenDownload.status).toBe(404);

    const hiddenList = await request(app)
      .get(`/api/v1/portal/projects/${ownProjectId}/files`)
      .set('Cookie', clientCookie);
    expect(hiddenList.status).toBe(200);
    expect(hiddenList.body.data.some((file: { id: string }) => file.id === privateUpload.body.data.id)).toBe(false);

    const sharedUpload = await upload(adminACookie, ownProjectId, 'shared.txt', 'shared bytes');
    expect(sharedUpload.status).toBe(201);
    await request(app)
      .patch(`/api/v1/files/${sharedUpload.body.data.id}`)
      .set('Cookie', adminACookie)
      .send({ visibleToClient: true })
      .expect(200);

    const sharedList = await request(app)
      .get(`/api/v1/portal/projects/${ownProjectId}/files`)
      .set('Cookie', clientCookie);
    expect(sharedList.status).toBe(200);
    expect(sharedList.body.data.some((file: { id: string }) => file.id === sharedUpload.body.data.id)).toBe(true);

    const sharedDownload = await request(app)
      .get(`/api/v1/portal/files/${sharedUpload.body.data.id}/download`)
      .set('Cookie', clientCookie);
    expect(sharedDownload.status).toBe(200);
    expect(sharedDownload.text).toBe('shared bytes');
  });

  it('rejects unsupported MIME types and files larger than 10 MB', async () => {
    const badMime = await request(app)
      .post(`/api/v1/projects/${ownProjectId}/files`)
      .set('Cookie', adminACookie)
      .attach('file', Buffer.from('not a zip'), { filename: 'payload.bin', contentType: 'application/octet-stream' });
    expect(badMime.status).toBe(400);

    const tooLarge = await request(app)
      .post(`/api/v1/projects/${ownProjectId}/files`)
      .set('Cookie', adminACookie)
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'large.txt', contentType: 'text/plain' });
    expect(tooLarge.status).toBe(400);
  });

  it('support mode can download but cannot upload or delete', async () => {
    const uploadResult = await upload(adminACookie, ownProjectId, 'support-check.txt', 'support download');
    expect(uploadResult.status).toBe(201);

    const download = await request(app)
      .get(`/api/v1/files/${uploadResult.body.data.id}/download`)
      .set('Cookie', supportCookie);
    expect(download.status).toBe(200);
    expect(download.text).toBe('support download');

    const uploadAttempt = await request(app)
      .post(`/api/v1/projects/${ownProjectId}/files`)
      .set('Cookie', supportCookie)
      .attach('file', Buffer.from('blocked'), { filename: 'blocked.txt', contentType: 'text/plain' });
    expect(uploadAttempt.status).toBe(403);
    expect(uploadAttempt.body.error.code).toBe('SUPPORT_READ_ONLY');

    const deleteAttempt = await request(app)
      .delete(`/api/v1/files/${uploadResult.body.data.id}`)
      .set('Cookie', supportCookie);
    expect(deleteAttempt.status).toBe(403);
    expect(deleteAttempt.body.error.code).toBe('SUPPORT_READ_ONLY');
  });
});